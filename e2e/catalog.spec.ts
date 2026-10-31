import { expect, test, type Page } from "@playwright/test";
import { asAdmin, fail, MP3, mockBackend, ok, PNG, type Reply } from "./support/backend";

function catalogSong(overrides: Record<string, unknown> = {}) {
  return {
    id: "s1",
    title: "Sparkly Teeth",
    mood: "playful",
    ageBand: "3-5",
    lyrics: ["Brush brush brush", "Sparkly teeth all day"],
    audioUrl: "/api/media/s1/audio?v=a1",
    imageUrl: "/api/media/s1/image?v=i1",
    durationMs: 90_500,
    inMyLibrary: false,
    mine: false,
    ...overrides,
  };
}

const TEETH = catalogSong();
const MOON = catalogSong({
  id: "s2",
  title: "Goodnight Moon Boat",
  mood: "lullaby",
  ageBand: "1-2",
  audioUrl: "/api/media/s2/audio?v=a2",
  imageUrl: "/api/media/s2/image?v=i2",
  durationMs: 60_000,
  inMyLibrary: true,
  mine: true,
});

const MEDIA = {
  "GET /api/media/s1/image": { file: PNG, contentType: "image/png" },
  "GET /api/media/s2/image": { file: PNG, contentType: "image/png" },
  "GET /api/media/s1/audio": { file: MP3, contentType: "audio/mpeg" },
};

const page1 = (songs: unknown[], total = songs.length, page = 1): Reply => ({ data: songs, meta: { page, total } });
const card = (page: Page, title: string) => page.getByRole("article", { name: title });

test("lists shared songs with cover, mood, age, duration, and the Yours / In your player markers", async ({ page }) => {
  const api = await mockBackend(page, { "GET /api/catalog": page1([TEETH, MOON]), ...MEDIA });
  await page.goto("/studio/catalog");
  await expect(page.getByRole("heading", { name: "Catalog", level: 1 })).toBeVisible();

  const teeth = card(page, "Sparkly Teeth");
  await expect(teeth).toContainText("Playful");
  await expect(teeth).toContainText("3–5 years");
  await expect(teeth).toContainText("1:31");
  await expect(teeth.getByText("Yours")).toHaveCount(0);
  await expect(teeth.getByRole("button", { name: "Add to my player" })).toBeVisible();
  await expect(teeth.getByRole("img", { name: "Cover for Sparkly Teeth" })).toHaveAttribute("src", /^blob:/);

  const moon = card(page, "Goodnight Moon Boat");
  await expect(moon.getByText("Yours")).toBeVisible();
  await expect(moon.getByText("In your player")).toBeVisible();
  await expect(moon.getByRole("button", { name: "Remove from my player" })).toBeVisible();
  // Parents never see the admin action.
  await expect(page.getByRole("button", { name: "Remove from catalog" })).toHaveCount(0);

  expect(api.calls.find((c) => c.path.startsWith("/api/catalog"))?.path).toBe("/api/catalog?page=1");
  // Audio is only fetched when someone presses Listen.
  expect(api.count("GET", /^\/api\/media\/.*\/audio/)).toBe(0);
});

test("listen inline and expand the lyrics", async ({ page }) => {
  const api = await mockBackend(page, { "GET /api/catalog": page1([TEETH]), ...MEDIA });
  await page.goto("/studio/catalog");
  const teeth = card(page, "Sparkly Teeth");

  await teeth.getByRole("button", { name: "Listen" }).click();
  await expect(teeth.locator("audio")).toHaveAttribute("src", /^blob:/);
  expect(api.count("GET", "/api/media/s1/audio?v=a1")).toBe(1);

  const toggle = teeth.getByRole("button", { name: "Show lyrics" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(teeth.getByRole("group", { name: "Lyrics" })).toContainText("Sparkly teeth all day");
  await teeth.getByRole("button", { name: "Hide lyrics" }).click();
  await expect(teeth.getByRole("group", { name: "Lyrics" })).toHaveCount(0);
});

test("filters by mood and age band, and pages through results", async ({ page }) => {
  const api = await mockBackend(page, {
    "GET /api/catalog": ({ url }) => {
      const p = Number(url.searchParams.get("page"));
      if (url.searchParams.get("mood") === "calm") return page1([], 0);
      return page1([p === 2 ? MOON : TEETH], 30, p);
    },
    ...MEDIA,
  });
  await page.goto("/studio/catalog");
  await expect(page.getByText("Page 1 of 2")).toBeVisible();
  await expect(page.getByRole("button", { name: "Newer" })).toBeDisabled();
  await page.getByRole("button", { name: "Older" }).click();
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  await expect(card(page, "Goodnight Moon Boat")).toBeVisible();

  await page.getByRole("combobox", { name: "Age" }).click();
  await page.getByRole("option", { name: "1–2 years" }).click();
  await expect.poll(() => api.calls.at(-1)?.path).toBe("/api/catalog?ageBand=1-2&page=1");

  await page.getByRole("combobox", { name: "Mood" }).click();
  await page.getByRole("option", { name: "Calm" }).click();
  await expect(page.getByText("No shared songs match")).toBeVisible();
  expect(api.calls.some((c) => c.path === "/api/catalog?mood=calm&ageBand=1-2&page=1")).toBe(true);
});

test("empty catalog explains how songs get there", async ({ page }) => {
  await mockBackend(page, { "GET /api/catalog": page1([]) });
  await page.goto("/studio/catalog");
  await expect(page.getByText("No shared songs yet")).toBeVisible();
});

test("Add to my player / Remove from my player toggles and calls the library items API", async ({ page }) => {
  const api = await mockBackend(page, {
    "GET /api/catalog": page1([TEETH]),
    "POST /api/library/items": ok(null),
    "DELETE /api/library/items/s1": ok(null),
    ...MEDIA,
  });
  await page.goto("/studio/catalog");
  const teeth = card(page, "Sparkly Teeth");

  await teeth.getByRole("button", { name: "Add to my player" }).click();
  await expect(teeth.getByRole("button", { name: "Remove from my player" })).toBeVisible();
  await expect(teeth.getByText("In your player")).toBeVisible();
  expect(api.calls.find((c) => c.method === "POST" && c.path === "/api/library/items")?.body).toEqual({ songId: "s1" });

  await teeth.getByRole("button", { name: "Remove from my player" }).click();
  await expect(teeth.getByRole("button", { name: "Add to my player" })).toBeVisible();
  expect(api.count("DELETE", "/api/library/items/s1")).toBe(1);
});

test("adding a song that stopped being shared rolls back and refreshes", async ({ page }) => {
  let gone = false;
  await mockBackend(page, {
    "GET /api/catalog": () => page1(gone ? [] : [TEETH]),
    "POST /api/library/items": () => {
      gone = true;
      return fail(404, "NOT_FOUND", "Song not found");
    },
    ...MEDIA,
  });
  await page.goto("/studio/catalog");
  await card(page, "Sparkly Teeth").getByRole("button", { name: "Add to my player" }).click();
  await expect(page.getByText("That song isn't shared any more")).toBeVisible();
  await expect(page.getByText("No shared songs yet")).toBeVisible();
});

test("admin: Remove from catalog explains it affects every family, then removes it", async ({ page }) => {
  let removed = false;
  const api = await mockBackend(page, {
    ...asAdmin(),
    "GET /api/catalog": () => page1(removed ? [MOON] : [TEETH, MOON]),
    "DELETE /api/catalog/s1": () => {
      removed = true;
      return ok(null);
    },
    ...MEDIA,
  });
  await page.goto("/studio/catalog");
  await card(page, "Sparkly Teeth").getByRole("button", { name: "Remove from catalog" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("every family's player");
  await dialog.getByRole("button", { name: "Keep it shared" }).click();
  expect(api.count("DELETE", "/api/catalog/s1")).toBe(0);

  await card(page, "Sparkly Teeth").getByRole("button", { name: "Remove from catalog" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Remove for everyone" }).click();
  await expect(card(page, "Sparkly Teeth")).toHaveCount(0);
  await expect(card(page, "Goodnight Moon Boat")).toBeVisible();
  expect(api.count("DELETE", "/api/catalog/s1")).toBe(1);
});
