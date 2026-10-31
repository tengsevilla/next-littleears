import { expect, test } from "@playwright/test";
import { mockBackend, ok, PNG, summary, TOKEN, ZOE } from "./support/backend";

const IMAGE = "/api/media/s1/image?v=abc123";

const SONGS = [
  summary({ id: "s1", title: "Sparkly Teeth", status: "ready", childId: "c1", imageUrl: IMAGE, createdAt: "2026-10-27T10:00:00Z" }),
  summary({ id: "s2", title: null, topic: "the big red bus", status: "composing", createdAt: "2026-10-28T10:00:00Z" }),
  summary({ id: "s3", title: "Moon Nap", mood: "lullaby", status: "pending_review", createdAt: "2026-10-26T10:00:00Z" }),
  summary({ id: "s4", title: "Oops", status: "failed", createdAt: "2026-10-25T10:00:00Z" }),
];

test("song list renders newest first with status, child chip and cover", async ({ page }) => {
  const api = await mockBackend(page, {
    "GET /api/songs": ok(SONGS),
    "GET /api/children": ok([ZOE]),
    "GET /api/media/s1/image": { file: PNG, contentType: "image/png" },
  });
  await page.goto("/studio");

  const items = page.getByRole("list", { name: "Songs" }).getByRole("listitem");
  await expect(items).toHaveCount(4);
  // Newest first; an untitled song shows its topic.
  await expect(items.nth(0)).toContainText("the big red bus");
  await expect(items.nth(0)).toContainText("Composing music");
  await expect(items.nth(1)).toContainText("Sparkly Teeth");
  await expect(items.nth(1)).toContainText("Ready to play");
  await expect(items.nth(1)).toContainText("For Zoë");
  await expect(items.nth(2)).toContainText("Needs your review");
  await expect(items.nth(2)).toContainText("Lullaby");
  await expect(items.nth(3)).toContainText("Failed");

  // The cover is fetched with the bearer token and shown through a blob: URL; null covers make no request.
  await expect(items.nth(1).locator("img")).toHaveAttribute("src", /^blob:/);
  const media = api.calls.filter((c) => c.path.startsWith("/api/media/"));
  expect(media).toEqual([expect.objectContaining({ path: IMAGE, authorization: `Bearer ${TOKEN}` })]);

  await expect(page.getByRole("link", { name: "New song" }).first()).toHaveAttribute("href", "/studio/new");
});

test("filters map to the status query param; In progress filters the full list", async ({ page }) => {
  const api = await mockBackend(page, {
    "GET /api/songs": ({ url }) => {
      const status = url.searchParams.get("status");
      return ok(status ? SONGS.filter((s) => s.status === status) : SONGS);
    },
  });
  await page.goto("/studio");
  const items = page.getByRole("list", { name: "Songs" }).getByRole("listitem");
  await expect(items).toHaveCount(4);

  await page.getByRole("tab", { name: "Ready" }).click();
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText("Sparkly Teeth");
  expect(api.count("GET", "/api/songs?status=ready")).toBe(1);

  await page.getByRole("tab", { name: "Needs review" }).click();
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText("Moon Nap");
  expect(api.count("GET", "/api/songs?status=pending_review")).toBe(1);

  await page.getByRole("tab", { name: "In progress" }).click();
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText("the big red bus");
  expect(api.count("GET", /\?status=(queued|writing|checking|composing|illustrating|mixing)/)).toBe(0);

  await page.getByRole("tab", { name: "Rejected" }).click();
  await expect(page.getByText("No songs here right now")).toBeVisible();
});

test("empty list links to the new song form and does not poll", async ({ page }) => {
  const api = await mockBackend(page, { "GET /api/songs": ok([]) });
  await page.goto("/studio");
  await expect(page.getByText("No songs yet")).toBeVisible();
  await page.getByRole("link", { name: "Make your first song" }).click();
  await expect(page).toHaveURL("/studio/new");
  expect(api.count("GET", "/api/songs")).toBe(1);
});

test("list polls while a song is in progress and stops once all are done", async ({ page }) => {
  let calls = 0;
  await mockBackend(page, {
    "GET /api/songs": () => {
      calls++;
      return ok([summary({ id: "s2", title: null, status: calls < 2 ? "mixing" : "pending_review" })]);
    },
  });
  await page.goto("/studio");
  await expect(page.getByText("Mixing", { exact: true })).toBeVisible();
  await expect(page.getByText("Needs your review")).toBeVisible({ timeout: 6000 });
  const settled = calls;
  await page.waitForTimeout(3500);
  expect(calls).toBe(settled);
});
