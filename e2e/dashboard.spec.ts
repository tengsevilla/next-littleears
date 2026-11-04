import { expect, test, type Page } from "@playwright/test";
import { asAdmin, fail, mockBackend, ok, PNG } from "./support/backend";

test.use({ serviceWorkers: "block" });

function stats(overrides: Record<string, unknown> = {}) {
  return {
    totals: { plays: 42, songPlays: 30, soundPlays: 12, activeFamilies: 3, families: 5, songsCreated: 7, sharedSongs: 4 },
    daily: [
      { date: "2026-11-02", songPlays: 10, soundPlays: 4 },
      { date: "2026-11-03", songPlays: 12, soundPlays: 5 },
      { date: "2026-11-04", songPlays: 8, soundPlays: 3 },
    ],
    topSongs: [
      { id: "s1", title: "Sparkly Teeth", imageUrl: "/api/media/s1/image?v=i1", plays: 20, families: 3, libraryAdds: 4, mine: true },
      { id: "s2", title: "Moon Boat", imageUrl: null, plays: 10, families: 2, libraryAdds: 1, mine: false },
    ],
    personalizedPlays: 6,
    topSounds: [
      { slug: "rain", plays: 8, families: 2 },
      { slug: "retired-sound", plays: 4, families: 1 },
    ],
    ...overrides,
  };
}

const EMPTY = stats({
  totals: { plays: 0, songPlays: 0, soundPlays: 0, activeFamilies: 0, families: 5, songsCreated: 2, sharedSongs: 1 },
  daily: [],
  topSongs: [],
  personalizedPlays: 0,
  topSounds: [],
});

async function openDashboard(page: Page, payload: unknown = stats()) {
  await page.route(/\/sounds\/[a-z-]+\.webp(\?|$)/, (route) => route.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  const api = await mockBackend(page, {
    ...asAdmin(),
    "GET /api/songs": ok([]),
    "GET /api/admin/stats": ok(payload),
    "GET /api/media/s1/image": { file: PNG, contentType: "image/png" },
  });
  await page.goto("/studio");
  await page.getByRole("navigation", { name: "Studio" }).getByRole("link", { name: "Dashboard" }).click();
  await expect(page).toHaveURL(/\/studio\/dashboard$/);
  return api;
}

const tile = (page: Page, label: string) => page.locator("dl[aria-label=Totals] > div").filter({ hasText: label });

test("admin: Dashboard link opens tiles, chart and tables from the stats payload", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const api = await openDashboard(page);
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
  expect(api.count("GET", "/api/admin/stats?range=30d")).toBe(1);

  await expect(tile(page, "Total plays")).toContainText("42");
  await expect(tile(page, "Song plays")).toContainText("30");
  await expect(tile(page, "Sound plays")).toContainText("12");
  await expect(tile(page, "Active families")).toContainText("3 of 5");
  await expect(tile(page, "Songs created")).toContainText("7");
  await expect(tile(page, "Shared songs")).toContainText("4");

  // Chart: two lines and a legend naming both series.
  const chart = page.getByRole("img", { name: "Plays per day, songs and sounds" });
  await expect(chart.locator(".recharts-line-curve")).toHaveCount(2);
  await expect(chart.getByText("Songs", { exact: true })).toBeVisible();
  await expect(chart.getByText("Sounds", { exact: true })).toBeVisible();

  const songs = page.getByRole("table", { name: "Top songs" });
  const first = songs.getByRole("row").nth(1);
  await expect(first).toContainText("Sparkly Teeth");
  await expect(first).toContainText("Yours");
  await expect(first.getByRole("cell")).toHaveText(["Sparkly TeethYours", "20", "3", "4"]);
  await expect(songs.getByRole("row").nth(2)).not.toContainText("Yours");
  // The cover arrives through the token, as an object URL.
  await expect(first.locator("img")).toHaveAttribute("src", /^blob:/);
  expect(api.calls.find((c) => c.path.startsWith("/api/media/s1/image"))?.authorization).toBe("Bearer test-token");

  await expect(page.getByText("Personalized songs: 6 plays")).toBeVisible();

  const sounds = page.getByRole("table", { name: "Top sounds" });
  await expect(sounds.getByRole("row").nth(1).getByRole("cell")).toHaveText(["Rainstorm", "8", "2"]);
  await expect(sounds.getByRole("row").nth(1).locator("img")).toHaveAttribute("src", /^\/sounds\/rain\.webp\?v=/);
  // Unknown slug: shown as itself, with a placeholder icon.
  await expect(sounds.getByRole("row").nth(2).getByRole("cell")).toHaveText(["retired-sound", "4", "1"]);
  await expect(sounds.getByRole("row").nth(2).locator("img")).toHaveCount(0);
});

test("the range switch refetches with the new range", async ({ page }) => {
  const api = await openDashboard(page);
  const range = page.getByRole("group", { name: "Date range" });
  await expect(range.getByRole("button", { name: "30 days" })).toHaveAttribute("aria-pressed", "true");
  await expect(tile(page, "Total plays")).toContainText("42");

  api.set("GET /api/admin/stats", ({ url }) =>
    ok(url.searchParams.get("range") === "7d" ? stats({ totals: { ...stats().totals, plays: 9 } }) : stats()),
  );
  await range.getByRole("button", { name: "7 days" }).click();
  await expect(range.getByRole("button", { name: "7 days" })).toHaveAttribute("aria-pressed", "true");
  await expect(tile(page, "Total plays")).toContainText("9");
  expect(api.count("GET", "/api/admin/stats?range=7d")).toBe(1);

  await range.getByRole("button", { name: "All time" }).click();
  await expect.poll(() => api.count("GET", "/api/admin/stats?range=all")).toBe(1);
});

test("no plays yet: the empty state says counting starts from now", async ({ page }) => {
  await openDashboard(page, EMPTY);
  await expect(page.getByRole("heading", { name: "No plays yet" })).toBeVisible();
  await expect(page.getByText(/Counting starts from now/)).toBeVisible();
  await expect(tile(page, "Active families")).toContainText("0 of 5");
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByRole("img", { name: "Plays per day, songs and sounds" })).toHaveCount(0);
});

test("a failed load shows an error with a retry", async ({ page }) => {
  await mockBackend(page, { ...asAdmin(), "GET /api/admin/stats": fail(500, "INTERNAL", "boom") });
  await page.goto("/studio/dashboard");
  await expect(page.getByRole("alert").filter({ hasText: "We couldn't load the dashboard." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("375 px: the dashboard fits without horizontal page scroll", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route(/\/sounds\/[a-z-]+\.webp(\?|$)/, (route) => route.fulfill({ status: 200, contentType: "image/png", body: PNG }));
  await mockBackend(page, { ...asAdmin(), "GET /api/admin/stats": ok(stats()), "GET /api/media/s1/image": { file: PNG, contentType: "image/png" } });
  await page.goto("/studio/dashboard");
  await expect(page.getByRole("table", { name: "Top songs" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test("parent: no Dashboard link, and the page says it isn't available without calling the API", async ({ page }) => {
  const api = await mockBackend(page, { "GET /api/songs": ok([]) });
  await page.goto("/studio");
  const nav = page.getByRole("navigation", { name: "Studio" });
  await expect(nav.getByRole("link", { name: "Catalog" })).toBeVisible();
  await expect(nav.getByRole("link", { name: /Dashboard|Stats/ })).toHaveCount(0);

  await page.goto("/studio/dashboard");
  await expect(page.getByRole("heading", { name: "The dashboard isn't available on your account" })).toBeVisible();
  expect(api.calls.filter((c) => c.path.startsWith("/api/admin"))).toEqual([]);
});

test("a 403 from the API (role changed since sign-in) shows the same friendly page", async ({ page }) => {
  await mockBackend(page, { ...asAdmin(), "GET /api/admin/stats": fail(403, "FORBIDDEN", "Admins only") });
  await page.goto("/studio/dashboard");
  await expect(page.getByRole("heading", { name: "The dashboard isn't available on your account" })).toBeVisible();
});
