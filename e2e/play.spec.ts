import { expect, test, type Page } from "@playwright/test";
import { API, fail, MILO, mockBackend, ok, PNG, silentWav, TOKEN, ZOE, type Reply } from "./support/backend";

// page.route never sees fetches made by a service worker, so a registered SW could answer from its cache
// behind the mocks' back. Blocked for this file (the SW is also disabled under `next dev`).
test.use({ serviceWorkers: "block" });

const WAV = silentWav();

function librarySong(n: number, overrides: Record<string, unknown> = {}) {
  const id = `s${n}`;
  return {
    id,
    childId: null,
    title: `Song ${n}`,
    mood: "playful",
    audioUrl: `/api/media/${id}/audio?v=a${n}`,
    imageUrl: `/api/media/${id}/image?v=i${n}`,
    durationMs: 60_000,
    ...overrides,
  };
}

function media(count: number): Record<string, Reply> {
  const handlers: Record<string, Reply> = {};
  for (let n = 1; n <= count; n++) {
    handlers[`GET /api/media/s${n}/audio`] = { file: WAV, contentType: "audio/wav" };
    handlers[`GET /api/media/s${n}/image`] = { file: PNG, contentType: "image/png" };
  }
  return handlers;
}

/** Skip the picker: this device already plays for `choice`. */
async function choose(page: Page, choice: { childId: string | null; displayName: string }) {
  await page.addInitScript((value) => window.localStorage.setItem("littleears.player", value), JSON.stringify(choice));
}

const audioPaused = (page: Page) => page.locator("audio").evaluate((el: HTMLAudioElement) => el.paused);
const tile = (page: Page, n: number) => page.getByRole("button", { name: `Song ${n}`, exact: true });

test("picker stores the child once and then shows that child's grid", async ({ page }) => {
  const api = await mockBackend(page, {
    "GET /api/children": ok([ZOE, MILO]),
    "GET /api/library": ok([librarySong(1, { childId: "c1" }), librarySong(2)]),
    ...media(2),
  });
  await page.goto("/play");
  await expect(page.getByRole("heading", { name: "Who's listening?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Everyone" })).toBeVisible();
  await page.getByRole("button", { name: /Zoë/ }).click();

  await expect(page.getByRole("region", { name: "Songs" }).getByRole("button")).toHaveCount(2);
  expect(await page.evaluate(() => window.localStorage.getItem("littleears.player"))).toBe(
    JSON.stringify({ childId: "c1", displayName: "Zoë" }),
  );
  expect(api.count("GET", "/api/library?childId=c1")).toBeGreaterThan(0);
  // The kid view never shows the child's name (or any text).
  await expect(page.getByText("Zoë")).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("region", { name: "Songs" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Who's listening?" })).toHaveCount(0);
});

test("Everyone asks the library for generic songs only", async ({ page }) => {
  const api = await mockBackend(page, {
    "GET /api/children": ok([ZOE]),
    "GET /api/library": ok([librarySong(1)]),
    ...media(1),
  });
  await page.goto("/play");
  await page.getByRole("button", { name: "Everyone" }).click();
  await expect(tile(page, 1)).toBeVisible();
  expect(api.calls.filter((c) => c.path.startsWith("/api/library")).map((c) => c.path)).toEqual(["/api/library"]);
});

test("the grid shows exactly the library's ready songs, with covers fetched through the token", async ({ page }) => {
  await choose(page, { childId: "c1", displayName: "Zoë" });
  // What the backend returns for ?childId=c1: ready songs only (generic + Zoë's).
  const api = await mockBackend(page, {
    "GET /api/library": ok([librarySong(1), librarySong(2, { childId: "c1", mood: "lullaby" })]),
    ...media(2),
  });
  await page.goto("/play");
  const grid = page.getByRole("region", { name: "Songs" });
  await expect(grid.getByRole("button")).toHaveCount(2);
  await expect(grid.locator("img")).toHaveCount(2);
  for (const img of await grid.locator("img").all()) await expect(img).toHaveAttribute("src", /^blob:/);
  await expect(page.locator("audio")).not.toHaveAttribute("controls");
  await expect(page.locator('input[type="range"]')).toHaveCount(0);
  await expect(page.locator("a")).toHaveCount(0); // no links out of the kid view

  const images = api.calls.filter((c) => c.path.includes("/image"));
  expect(images.map((c) => c.path).sort()).toEqual(["/api/media/s1/image?v=i1", "/api/media/s2/image?v=i2"]);
  for (const call of images) expect(call.authorization).toBe(`Bearer ${TOKEN}`);
});

test("an empty library shows a calm, text-free state", async ({ page }) => {
  await choose(page, { childId: null, displayName: "Everyone" });
  await mockBackend(page, { "GET /api/library": ok([]) });
  await page.goto("/play");
  await expect(page.getByRole("img", { name: "No songs yet" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Play", exact: true })).toHaveCount(0);
});

test("tapping a tile plays that song and stops after it ends", async ({ page }) => {
  await choose(page, { childId: null, displayName: "Everyone" });
  const api = await mockBackend(page, { "GET /api/library": ok([librarySong(1), librarySong(2)]), ...media(2) });
  await page.goto("/play");

  await tile(page, 1).click();
  await expect(tile(page, 1)).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await expect(page.locator("audio")).toHaveAttribute("src", /^blob:/);

  await page.locator("audio").dispatchEvent("ended");
  await expect(tile(page, 1)).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  expect(await audioPaused(page)).toBe(true);
  await page.waitForTimeout(500);
  await expect(tile(page, 2)).toHaveAttribute("aria-pressed", "false");
  expect(api.count("GET", /\/api\/media\/s2\/audio/)).toBe(0);
});

test("the big button pauses and resumes the current song", async ({ page }) => {
  await choose(page, { childId: null, displayName: "Everyone" });
  await mockBackend(page, { "GET /api/library": ok([librarySong(1)]), ...media(1) });
  await page.goto("/play");

  await page.getByRole("button", { name: "Play", exact: true }).click(); // nothing picked yet: plays the first song
  await expect(tile(page, 1)).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(tile(page, 1)).toHaveAttribute("aria-pressed", "false");
  expect(await audioPaused(page)).toBe(true);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(tile(page, 1)).toHaveAttribute("aria-pressed", "true");
});

test("play all walks at most 5 songs, then stops", async ({ page }) => {
  test.slow();
  await choose(page, { childId: null, displayName: "Everyone" });
  const songs = [1, 2, 3, 4, 5, 6].map((n) => librarySong(n));
  const api = await mockBackend(page, { "GET /api/library": ok(songs), ...media(6) });
  await page.goto("/play");

  await page.getByRole("button", { name: "Play all" }).click();
  for (let n = 1; n <= 5; n++) {
    await expect(tile(page, n)).toHaveAttribute("aria-pressed", "true");
    await page.locator("audio").dispatchEvent("ended");
  }
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  expect(await audioPaused(page)).toBe(true);
  await page.waitForTimeout(500);
  await expect(page.getByRole("region", { name: "Songs" }).locator('[aria-pressed="true"]')).toHaveCount(0);
  expect(api.count("GET", /\/api\/media\/s6\/audio/)).toBe(0);
  expect(api.calls.filter((c) => /\/audio/.test(c.path)).length).toBe(5);
});

test("parent gate: a short tap does nothing, a 3 s hold opens the menu", async ({ page }) => {
  await choose(page, { childId: "c1", displayName: "Zoë" });
  await mockBackend(page, { "GET /api/library": ok([librarySong(1)]), ...media(1), "GET /api/children": ok([ZOE]) });
  await page.goto("/play");
  const gate = page.getByRole("button", { name: "Grown-ups: press and hold for 3 seconds" });

  await gate.click();
  await page.waitForTimeout(3500);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Released early: still nothing.
  await gate.hover();
  await page.mouse.down();
  await page.waitForTimeout(1500);
  await page.mouse.up();
  await page.waitForTimeout(2000);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.mouse.down();
  await page.waitForTimeout(3300);
  await page.mouse.up();
  const menu = page.getByRole("dialog", { name: "Grown-ups" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("link", { name: "Back to studio" })).toHaveAttribute("href", "/studio");

  await menu.getByRole("button", { name: "Change child" }).click();
  await expect(page.getByRole("heading", { name: "Who's listening?" })).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem("littleears.player"))).toBeNull();
});

test("parent gate opens with a 3 s Space hold from the keyboard", async ({ page }) => {
  await choose(page, { childId: null, displayName: "Everyone" });
  await mockBackend(page, { "GET /api/library": ok([]) });
  await page.goto("/play");
  await page.getByRole("button", { name: "Grown-ups: press and hold for 3 seconds" }).focus();
  await page.keyboard.down(" ");
  await page.waitForTimeout(3300);
  await page.keyboard.up(" ");
  const menu = page.getByRole("dialog", { name: "Grown-ups" });
  await expect(menu).toBeVisible();
  // The empty-library hint is only for the parent, behind the gate.
  await expect(menu).toContainText("Approve a song in the studio");
});

test("a 401 on refresh sends the parent to /login and back to /play", async ({ page }) => {
  await mockBackend(page, {
    "POST /api/auth/refresh": fail(401, "UNAUTHORIZED", "No session"),
    "POST /api/auth/login": ok({ accessToken: TOKEN, user: { id: "u1", email: "parent@example.com" } }),
    "GET /api/children": ok([ZOE]),
  });
  await page.goto("/play");
  await expect(page).toHaveURL(/\/login\?next=%2Fplay$/);

  // Submitting before React hydrates would fall back to a native GET form submit; let the page settle first.
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill("parent@example.com");
  await page.getByLabel("Password").fill("correct-password");
  await page.getByRole("button", { name: "Sign in to the studio" }).click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByRole("heading", { name: "Who's listening?" })).toBeVisible();
});

test("no network at startup keeps the player on /play, running without a token", async ({ page }) => {
  await choose(page, { childId: null, displayName: "Everyone" });
  // Registered after mockBackend, so it wins for refresh: the request fails like it would offline.
  const api = await mockBackend(page, { "GET /api/library": ok([librarySong(1)]), ...media(1) });
  await page.route(`${API}/api/auth/refresh`, (route) => route.abort("internetdisconnected"));
  await page.goto("/play");
  await expect(tile(page, 1)).toBeVisible();
  await expect(page).toHaveURL(/\/play$/);
  // Offline these come from the service worker's cache, which ignores headers.
  expect(api.calls.find((c) => c.path === "/api/library")?.authorization).toBeUndefined();
});

test("signing out of the studio deletes the offline media, library and sounds caches", async ({ page }) => {
  await mockBackend(page, { "GET /api/songs": ok([]), "POST /api/auth/logout": ok(null) });
  await page.goto("/studio");
  await page.evaluate(async () => {
    await (await caches.open("littleears-media")).put("/x", new Response("m"));
    await (await caches.open("littleears-library")).put("/y", new Response("l"));
    await (await caches.open("littleears-sounds")).put("/sounds/rain.mp3", new Response("s"));
    await (await caches.open("unrelated")).put("/z", new Response("z"));
  });
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.evaluate(() => caches.keys())).sort()).toEqual(["unrelated"]);
});
