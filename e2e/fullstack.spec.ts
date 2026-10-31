import { expect, test, type BrowserContext, type Page, type Response } from "@playwright/test";

// Opt-in full-stack spec: drives the real UI against the real Express API (no page.route mocks).
// Run ONLY against a backend started with LYRICS_PROVIDER/MUSIC_PROVIDER/IMAGE_PROVIDER(/TTS)=mock — against
// real providers every step below spends real music, image and TTS credits.
//
//   E2E_FULLSTACK=1 E2E_EMAIL=… E2E_PASSWORD=… npx playwright test e2e/fullstack.spec.ts
//
// Credentials come from the environment only: never hardcoded, never logged, never in a URL. Tracing is off
// for this file so the password typed into the login form can't end up in a trace archive.

const API = process.env.E2E_API_URL ?? "http://localhost:3001";
const PLAYER_KEY = "littleears.player";

/** Letters only, so the name passes the displayName regex. */
const randomLetters = (n: number) => Array.from({ length: n }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join("");

type Envelope<T> = { data: T | null; error: { code: string; message: string } | null; meta: Record<string, unknown> };
type LibraryEntry = { id: string; title: string | null; audioUrl: string | null };
type SongBody = { id: string; status: string; title: string | null; safety: { pass: boolean; reasons: string[] } | null };

async function dataOf<T>(res: Response): Promise<T> {
  const body = (await res.json()) as Envelope<T>;
  if (body.error || body.data === null) throw new Error(`${res.url()} → ${body.error?.code ?? "no data"}`);
  return body.data;
}

test.use({ serviceWorkers: "block", trace: "off" });

test.describe("full stack (real API, mock AI providers)", () => {
  test.skip(!process.env.E2E_FULLSTACK, "Opt-in: set E2E_FULLSTACK=1 with a mock-provider backend on :3001");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  // One context for the whole file: the refresh cookie rotates on every refresh, so separate per-test
  // contexts restored from a saved state would replay a revoked token.
  let context: BrowserContext;
  let page: Page;
  const created = { childId: null as string | null, songIds: [] as string[] };
  const childName = `Testkid${randomLetters(6)}`;
  let goodSong: { id: string; title: string } | null = null;
  let tilesBefore = 0;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(180_000);
    if (!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD) throw new Error("Set E2E_EMAIL and E2E_PASSWORD");

    // The backend can take ~40 s to boot; wait for its health check instead of assuming it's up.
    await expect
      .poll(
        async () => {
          try {
            return (await fetch(`${API}/api/health`)).status;
          } catch {
            return 0;
          }
        },
        { timeout: 120_000, intervals: [2_000] },
      )
      .toBe(200);

    context = await browser.newContext({ baseURL: testInfo.project.use.baseURL, serviceWorkers: "block" });
    // Observe (not mock) every media element's playback: the name preview plays a detached `new Audio()`.
    await context.addInitScript(() => {
      const w = window as unknown as { __plays: string[] };
      w.__plays = [];
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
        this.addEventListener("playing", () => w.__plays.push(this.currentSrc.slice(0, 16)), { once: true });
        return play.call(this);
      };
    });
    page = await context.newPage();
  });

  test.afterAll(async () => {
    if (!page) return;
    try {
      // A fresh token from the page's own refresh cookie (same-site with the API, so the strict cookie is sent).
      await page.goto("/");
      let token = await page.evaluate(async (api) => {
        try {
          const res = await fetch(`${api}/api/auth/refresh`, { method: "POST", credentials: "include" });
          const body = (await res.json().catch(() => null)) as { data?: { accessToken?: string } } | null;
          return body?.data?.accessToken ?? null;
        } catch {
          return null;
        }
      }, API);
      if (!token) {
        // Cookie gone (e.g. the login step failed half-way): sign in through the API, credentials in the body only.
        const res = await context.request.post(`${API}/api/auth/login`, {
          data: { email: process.env.E2E_EMAIL, password: process.env.E2E_PASSWORD },
        });
        token = ((await res.json()) as { data?: { accessToken?: string } }).data?.accessToken ?? null;
      }
      if (token) {
        const headers = { Authorization: `Bearer ${token}` };
        for (const id of created.songIds) {
          const res = await context.request.delete(`${API}/api/songs/${id}`, { headers });
          if (!res.ok() && res.status() !== 404) console.warn(`cleanup: DELETE song ${id} → ${res.status()}`);
        }
        if (created.childId) {
          const res = await context.request.delete(`${API}/api/children/${created.childId}`, { headers });
          if (!res.ok() && res.status() !== 404) console.warn(`cleanup: DELETE child → ${res.status()}`);
        }
      } else if (created.songIds.length || created.childId) {
        console.warn("cleanup: no token, test data left behind", created);
      }
      await page.evaluate((key) => window.localStorage.removeItem(key), PLAYER_KEY);
    } finally {
      await context.close();
    }
  });

  /** Create a generic song through /studio/new; returns its id once the song page is showing. */
  async function createGenericSong(topic: string, mood?: "Lullaby") {
    await page.goto("/studio/new");
    await expect(page.getByRole("combobox", { name: "Who is it for?" })).toHaveText(/Anyone \(generic song\)/);
    await expect(page.getByRole("combobox", { name: "Age" })).toHaveText(/3–5 years/);
    await page.getByLabel("What should it be about?").fill(topic);
    if (mood) await page.getByRole("radio", { name: mood }).click();
    await page.getByRole("radio", { name: "1 minute" }).click();
    await expect(page.getByRole("radio", { name: "1 minute" })).toBeChecked();

    const createdRes = page.waitForResponse((r) => r.request().method() === "POST" && r.url() === `${API}/api/songs`);
    await page.getByRole("button", { name: "Make the song" }).click();
    const { id } = await dataOf<{ id: string; status: string }>(await createdRes);
    created.songIds.push(id);
    await expect(page).toHaveURL(new RegExp(`/studio/songs/${id}$`));
    return id;
  }

  /**
   * Record every status the song page's 3 s poll sees, per song. Started before the song exists, so even
   * the page's first GET is captured.
   */
  function watchSongs() {
    const seen = new Map<string, string[]>();
    const latest = new Map<string, SongBody>();
    page.on("response", async (res) => {
      if (res.request().method() !== "GET" || !/^\/api\/songs\/[^/]+$/.test(new URL(res.url()).pathname) || !res.ok()) return;
      try {
        const song = await dataOf<SongBody>(res);
        latest.set(song.id, song);
        const statuses = seen.get(song.id) ?? [];
        if (statuses.at(-1) !== song.status) seen.set(song.id, [...statuses, song.status]);
      } catch {
        // A body we can't read (navigation in between): the next poll covers it.
      }
    });
    return { seen: (id: string) => seen.get(id) ?? [], latest: (id: string) => latest.get(id) };
  }

  /** Open /play for "Everyone" and return the generic library the grid was built from. */
  async function openPlayer(): Promise<LibraryEntry[]> {
    const libraryRes = page.waitForResponse(
      (r) => r.request().method() === "GET" && r.url() === `${API}/api/library`,
      { timeout: 60_000 },
    );
    await page.goto("/play");
    const picker = page.getByRole("heading", { name: "Who's listening?" });
    const grid = page.getByRole("region", { name: "Songs" });
    const empty = page.getByRole("img", { name: "No songs yet" });
    await expect(picker.or(grid).or(empty)).toBeVisible({ timeout: 30_000 });
    if (await picker.isVisible()) await page.getByRole("button", { name: "Everyone", exact: true }).click();
    const library = await dataOf<LibraryEntry[]>(await libraryRes);
    await expect(grid.or(empty)).toBeVisible();
    return library;
  }

  const songTiles = (title: string) => page.getByRole("region", { name: "Songs" }).getByRole("button", { name: title, exact: true });
  const audioState = () =>
    page.locator("main audio").evaluate((el: HTMLAudioElement) => ({ paused: el.paused, ended: el.ended, t: el.currentTime }));

  test("1. parent signs in through /login", async () => {
    await page.goto("/login");
    // Submitting before hydration would fall back to a native form submit.
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Email").fill(process.env.E2E_EMAIL as string);
    await page.getByLabel("Password").fill(process.env.E2E_PASSWORD as string);
    await page.getByRole("button", { name: "Sign in to the studio" }).click();
    await expect(page).toHaveURL(/\/studio$/, { timeout: 30_000 });
    expect(page.url()).not.toContain("password");
  });

  test("2. add a child and hear the name preview", async () => {
    await page.goto("/studio/children");
    await page.getByRole("button", { name: "Add a child", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Add a child" });
    await dialog.getByLabel("Name", { exact: true }).fill(childName);

    const createdRes = page.waitForResponse((r) => r.request().method() === "POST" && r.url() === `${API}/api/children`);
    await dialog.getByRole("button", { name: `Add ${childName}` }).click();
    created.childId = (await dataOf<{ id: string }>(await createdRes)).id;
    await expect(dialog).toBeHidden();

    const row = page.getByRole("list", { name: "Children" }).getByRole("listitem").filter({ hasText: childName });
    await expect(row).toBeVisible();

    const previewRes = page.waitForResponse(
      (r) => r.request().method() === "POST" && r.url() === `${API}/api/children/${created.childId}/name-preview`,
    );
    await row.getByRole("button", { name: `Hear how we say ${childName}` }).click();
    const { audioUrl } = await dataOf<{ audioUrl: string }>(await previewRes);
    expect(audioUrl).toMatch(/^data:audio\//);
    // The clip actually started playing (fires "playing"), from the data: URL the API returned.
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __plays: string[] }).__plays), { timeout: 15_000 })
      .toContainEqual(expect.stringMatching(/^data:audio\//));
  });

  test("3. a generic lullaby polls through the pipeline to pending_review", async () => {
    const topic = `a sleepy owl ${randomLetters(5)}`;
    const watch = watchSongs();
    const id = await createGenericSong(topic, "Lullaby");

    await expect(page.getByRole("button", { name: "Approve for the player" })).toBeVisible({ timeout: 150_000 });
    await expect.poll(() => watch.latest(id)?.status).toBe("pending_review");
    // The page kept polling while the worker moved the song along.
    const seen = watch.seen(id);
    expect(seen.some((s) => ["queued", "writing", "checking", "composing", "illustrating", "mixing"].includes(s))).toBe(true);
    expect(seen.at(-1)).toBe("pending_review");

    const title = watch.latest(id)?.title ?? topic;
    goodSong = { id, title };
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByText("Passed the safety check.")).toBeVisible();
    await expect(page.getByRole("group", { name: "Lyrics" }).locator("p").first()).not.toBeEmpty();
    await expect(page.getByRole("img", { name: `Cover for ${title}` })).toHaveAttribute("src", /^blob:/, { timeout: 30_000 });
    await expect(page.locator(`audio[aria-label="Listen to ${title}"]`)).toHaveAttribute("src", /^blob:/, { timeout: 30_000 });
  });

  test("4. an unapproved song never reaches the player", async () => {
    expect(goodSong).not.toBeNull();
    const { id, title } = goodSong!;
    const library = await openPlayer();
    expect(library.map((s) => s.id)).not.toContain(id);
    // Earlier mock songs share the fixture title, so count them rather than expecting zero.
    tilesBefore = library.filter((s) => s.audioUrl && s.title === title).length;
    await expect(songTiles(title)).toHaveCount(tilesBefore);
  });

  test("5. approved: the tile appears, plays once, and stops", async () => {
    expect(goodSong).not.toBeNull();
    const { id, title } = goodSong!;
    await page.goto(`/studio/songs/${id}`);
    const approveRes = page.waitForResponse((r) => r.request().method() === "POST" && r.url() === `${API}/api/songs/${id}/approve`);
    await page.getByRole("button", { name: "Approve for the player" }).click();
    expect((await dataOf<SongBody>(await approveRes)).status).toBe("ready");
    await expect(page.getByText(`"${title}" is in the player now`)).toBeVisible();

    const library = await openPlayer();
    const playable = library.filter((s) => s.audioUrl);
    const index = playable.findIndex((s) => s.id === id);
    expect(index).toBeGreaterThanOrEqual(0);
    await expect(songTiles(title)).toHaveCount(tilesBefore + 1);

    const audioRequests: string[] = [];
    page.on("request", (req) => {
      const m = new URL(req.url()).pathname.match(/^\/api\/media\/([^/]+)\/audio$/);
      if (m) audioRequests.push(m[1]);
    });
    const tile = page.getByRole("region", { name: "Songs" }).getByRole("button").nth(index);
    await expect(tile).toHaveAccessibleName(title);
    await tile.click();
    await expect(tile).toHaveAttribute("aria-pressed", "true", { timeout: 20_000 });
    await expect(page.locator("main audio")).toHaveAttribute("src", /^blob:/);

    // Playing for real: not paused, and the clock moves.
    await expect.poll(async () => (await audioState()).t, { timeout: 15_000, intervals: [100] }).toBeGreaterThan(0);
    const { t: t1, paused } = await audioState();
    expect(paused).toBe(false);
    await expect.poll(async () => (await audioState()).t, { timeout: 5_000, intervals: [100] }).toBeGreaterThan(t1);

    // The mock tone is ~3 s: it ends, playback stops, and nothing else starts.
    await expect.poll(async () => (await audioState()).ended, { timeout: 30_000 }).toBe(true);
    expect((await audioState()).paused).toBe(true);
    await expect(tile).toHaveAttribute("aria-pressed", "false");
    // A finished lullaby dims the screen.
    const sleep = page.getByRole("button", { name: "Wake up the player" });
    await expect(sleep).toBeVisible();
    await page.waitForTimeout(1_500);
    expect(audioRequests.every((songId) => songId === id)).toBe(true);
    await expect(page.getByRole("region", { name: "Songs" }).locator('[aria-pressed="true"]')).toHaveCount(0);
    expect((await audioState()).paused).toBe(true);
    await sleep.click();
    await expect(sleep).toBeHidden();
  });

  test("6. parent gate: a tap does nothing, a 3 s hold opens the menu", async () => {
    await expect(page).toHaveURL(/\/play$/);
    const gate = page.getByRole("button", { name: "Grown-ups: press and hold for 3 seconds" });
    await gate.click();
    await page.waitForTimeout(3_500);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await gate.hover();
    await page.mouse.down();
    await page.waitForTimeout(3_300);
    await page.mouse.up();
    const menu = page.getByRole("dialog", { name: "Grown-ups" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("link", { name: "Back to studio" })).toHaveAttribute("href", "/studio");
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
  });

  test("7. an [unsafe] topic ends rejected with its safety reasons and stays out of the player", async () => {
    const watch = watchSongs();
    const id = await createGenericSong(`a picnic [unsafe] ${randomLetters(5)}`);

    await expect(page.getByText("This song was rejected")).toBeVisible({ timeout: 150_000 });
    await expect.poll(() => watch.latest(id)?.status).toBe("rejected");
    const latest = watch.latest(id)!;
    expect(latest.safety?.pass).toBe(false);
    expect(latest.safety?.reasons.length).toBeGreaterThan(0);

    await expect(page.getByText("It kept failing our safety check, so it never reached the player.")).toBeVisible();
    await expect(page.getByText("Didn't pass the safety check")).toBeVisible();
    for (const reason of latest.safety!.reasons) await expect(page.getByText(reason, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve for the player" })).toHaveCount(0);

    const library = await openPlayer();
    expect(library.map((s) => s.id)).not.toContain(id);
    if (latest.title) await expect(songTiles(latest.title)).toHaveCount(0);
  });
});
