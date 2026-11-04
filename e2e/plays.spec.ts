import { expect, test, type Page } from "@playwright/test";
import { API, mockBackend, ok, PNG, silentWav, type Handler, type Reply } from "./support/backend";

// A service worker would answer requests behind page.route's back.
test.use({ serviceWorkers: "block" });
// Each test boots /play cold on the dev server with real audio; give them room under parallel load.
test.beforeEach(() => test.slow());

const QUEUE_KEY = "littleears.plays.queue";

function librarySong(n: number) {
  return {
    id: `s${n}`,
    childId: null,
    title: `Song ${n}`,
    mood: "playful",
    audioUrl: `/api/media/s${n}/audio?v=a${n}`,
    imageUrl: `/api/media/s${n}/image?v=i${n}`,
    durationMs: 60_000,
  };
}

/**
 * The kid player with two songs and the sound files mocked. The page clock is installed before load, so the
 * tracker's 10 s timer only moves when a test fast-forwards it; audio itself still plays in real time.
 */
async function openPlayer(page: Page, opts: { view?: "songs" | "sounds"; queue?: unknown[]; soundSeconds?: number; plays?: Handler | Reply; offlineAtStart?: boolean } = {}) {
  await page.clock.install();
  await page.addInitScript(
    ({ view, queue, key }) => {
      window.localStorage.setItem("littleears.player", JSON.stringify({ childId: null, displayName: "Everyone" }));
      if (view) window.localStorage.setItem("littleears.player.view", view);
      if (queue) window.localStorage.setItem(key, JSON.stringify(queue));
    },
    { view: opts.view ?? null, queue: opts.queue ?? null, key: QUEUE_KEY },
  );
  const wav = silentWav(opts.soundSeconds ?? 1);
  await page.route(/\/sounds\/[a-z]+\.mp3(\?|$)/, (route) => route.fulfill({ status: 200, contentType: "audio/mpeg", body: wav }));
  await page.route(/\/sounds\/[a-z]+\.webp(\?|$)/, (route) => route.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  const api = await mockBackend(page, {
    "GET /api/library": ok([librarySong(1), librarySong(2)]),
    "GET /api/media/s1/audio": { file: silentWav(), contentType: "audio/wav" },
    "GET /api/media/s2/audio": { file: silentWav(), contentType: "audio/wav" },
    "GET /api/media/s1/image": { file: PNG, contentType: "image/png" },
    "GET /api/media/s2/image": { file: PNG, contentType: "image/png" },
    "POST /api/plays": opts.plays ?? ok(null),
  });
  // "Offline": every API request fails at the network level (registered last, so it runs first).
  let offline = !!opts.offlineAtStart;
  await page.route(`${API}/**`, (route) => (offline ? route.abort("internetdisconnected") : route.fallback()));
  await page.goto("/play");
  const plays = () => api.calls.filter((c) => c.method === "POST" && c.path === "/api/plays");
  return {
    api: {
      ...api,
      goOnline: () => {
        offline = false;
      },
    },
    plays,
  };
}

const audioPlaying = (page: Page) => page.locator("audio").evaluate((el: HTMLAudioElement) => !el.paused && el.currentTime > 0);
const readQueue = (page: Page) => page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "[]") as unknown[], QUEUE_KEY);

test("a song counts once after 10 s of playback, pausing holds the count", async ({ page }) => {
  const { plays } = await openPlayer(page);
  await page.getByRole("button", { name: "Song 1", exact: true }).click();
  await expect.poll(() => audioPlaying(page)).toBe(true);

  await page.clock.fastForward(6_000);
  // Paused for a long while: those seconds don't count.
  await page.getByRole("button", { name: "Pause" }).click();
  await page.clock.fastForward(60_000);
  expect(plays()).toHaveLength(0);

  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(() => audioPlaying(page)).toBe(true);
  await page.clock.fastForward(3_000);
  expect(plays()).toHaveLength(0);

  await page.clock.fastForward(1_500);
  await expect.poll(() => plays().length).toBe(1);
  expect(plays()[0].body).toEqual({ songId: "s1" });
  expect(plays()[0].authorization).toBe("Bearer test-token");

  // Still playing the same song: no second count.
  await page.clock.fastForward(60_000);
  expect(plays()).toHaveLength(1);
});

test("switching songs before 10 s resets the count", async ({ page }) => {
  const { plays } = await openPlayer(page);
  await page.getByRole("button", { name: "Song 1", exact: true }).click();
  await expect.poll(() => audioPlaying(page)).toBe(true);
  await page.clock.fastForward(8_000);

  await page.getByRole("button", { name: "Song 2", exact: true }).click();
  await expect.poll(() => page.locator("audio").evaluate((el: HTMLAudioElement) => el.src)).toMatch(/^blob:/);
  await expect.poll(() => audioPlaying(page)).toBe(true);
  await page.clock.fastForward(8_000);
  expect(plays()).toHaveLength(0);

  await page.clock.fastForward(2_500);
  await expect.poll(() => plays().length).toBe(1);
  expect(plays()[0].body).toEqual({ songId: "s2" });
});

test("a sound counts once per tap, not once per repeat", async ({ page }) => {
  // A 1 s story: its 10 passes all run (in real time) during the test.
  const { plays } = await openPlayer(page, { view: "sounds" });
  const rocket = page.getByRole("region", { name: "Sounds" }).getByRole("button", { name: "Rocket Ride", exact: true });

  await rocket.click();
  await expect(rocket).toHaveAttribute("aria-pressed", "true");
  // Give the fetch/decode a moment so the source is actually playing, then cross the 10 s mark.
  await page.waitForTimeout(300);
  await page.clock.fastForward(9_000);
  expect(plays()).toHaveLength(0);
  await page.clock.fastForward(1_500);
  await expect.poll(() => plays().length).toBe(1);
  expect(plays()[0].body).toEqual({ soundSlug: "rocket" });

  // It keeps repeating until it ends by itself: still one play.
  await page.clock.fastForward(60_000);
  await expect(rocket).toHaveAttribute("aria-pressed", "false", { timeout: 20_000 });
  await page.clock.fastForward(60_000);
  expect(plays()).toHaveLength(1);

  // A new tap is a new play.
  await rocket.click();
  await expect(rocket).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(300);
  await page.clock.fastForward(10_500);
  await expect.poll(() => plays().length).toBe(2);
});

test("an offline play is queued and sent when the device is back online", async ({ page }) => {
  const { plays } = await openPlayer(page);
  let offline = true;
  await page.route(`${API}/api/plays`, (route) =>
    offline && route.request().method() === "POST" ? route.abort("internetdisconnected") : route.fallback(),
  );

  await page.getByRole("button", { name: "Song 1", exact: true }).click();
  await expect.poll(() => audioPlaying(page)).toBe(true);
  await page.clock.fastForward(10_500);
  await expect.poll(() => readQueue(page)).toEqual([{ songId: "s1", playedAt: expect.any(String) }]);
  // Playback carried on regardless.
  expect(await audioPlaying(page)).toBe(true);
  expect(plays()).toHaveLength(0);

  offline = false;
  // Coming back online must not reload the page (that would stop the song): a marker on window survives.
  let navigations = 0;
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navigations++;
  });
  await page.evaluate(() => ((window as unknown as { __marker: number }).__marker = 1));
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => plays().length).toBe(1);
  expect(plays()[0].body).toEqual({ songId: "s1", playedAt: expect.any(String) });
  await expect.poll(() => readQueue(page)).toEqual([]);
  expect(navigations).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(1);
  expect(await audioPlaying(page)).toBe(true);
});

test("opening the player flushes the queue; a 4xx entry is dropped, a 5xx entry is kept", async ({ page }) => {
  const now = new Date().toISOString();
  const queue = [
    { songId: "gone", playedAt: now },
    { soundSlug: "rain", playedAt: now },
    { songId: "s1", playedAt: now },
  ];
  // Answers depend on the item: unknown song → 404 (dropped), the sound → 500 (kept, the flush stops there).
  const { plays } = await openPlayer(page, {
    queue,
    plays: ({ body }) => {
      const b = body as { songId?: string; soundSlug?: string };
      if (b.songId === "gone") return { status: 404, error: { code: "NOT_FOUND", message: "nope" } };
      if (b.soundSlug) return { status: 500, error: { code: "INTERNAL", message: "boom" } };
      return ok(null);
    },
  });
  await expect.poll(() => plays().length).toBe(2);
  await expect
    .poll(() => readQueue(page))
    .toEqual([
      { soundSlug: "rain", playedAt: now },
      { songId: "s1", playedAt: now },
    ]);
});

test("signing out clears the queue of unsent plays", async ({ page }) => {
  await page.addInitScript((key) => {
    if (!sessionStorage.getItem("seeded")) {
      window.localStorage.setItem(key, JSON.stringify([{ songId: "s1", playedAt: new Date().toISOString() }]));
      sessionStorage.setItem("seeded", "1");
    }
  }, QUEUE_KEY);
  await mockBackend(page, { "GET /api/songs": ok([]), "POST /api/auth/logout": ok(null) });
  await page.goto("/studio");
  expect(await readQueue(page)).toHaveLength(1);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await readQueue(page)).toEqual([]);
});

test("offline at startup, then back online: no reload, the session and library recover, the queue flushes", async ({ page }) => {
  const queued = [{ songId: "s1", playedAt: new Date().toISOString() }];
  const { api, plays } = await openPlayer(page, { queue: queued, offlineAtStart: true });
  // Started without a token: the queue stays put and the library came back empty (no cache in this spec).
  await expect(page.getByRole("button", { name: "Song 1", exact: true })).toHaveCount(0);
  expect(plays()).toHaveLength(0);
  expect(await readQueue(page)).toHaveLength(1);

  await api.goOnline();
  await page.evaluate(() => ((window as unknown as { __marker: number }).__marker = 1));
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  // SWR revalidates the library on reconnect; the request refreshes the session and goes out with a token.
  await expect(page.getByRole("button", { name: "Song 1", exact: true })).toBeVisible();
  await expect.poll(() => plays().length).toBe(1);
  expect(plays()[0].authorization).toBe("Bearer test-token");
  await expect.poll(() => readQueue(page)).toEqual([]);
  expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(1);
});
