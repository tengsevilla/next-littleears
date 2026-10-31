import { expect, test } from "@playwright/test";
import { fail, MP3, mockBackend, ok, PNG, song, ZOE } from "./support/backend";

const MEDIA = {
  "GET /api/media/s1/audio": { file: MP3, contentType: "audio/mpeg" },
  "GET /api/media/s1/image": { file: PNG, contentType: "image/png" },
};
const WITH_MEDIA = { audioUrl: "/api/media/s1/audio?v=a1", imageUrl: "/api/media/s1/image?v=i1" };
const SHARED = song({ ...WITH_MEDIA, status: "ready", approvedAt: "2026-10-29T09:00:00Z", shared: true });
const NOTICE = "Generic songs are shared with all LittleEars families once you approve them. Don't include names or places.";

test("new song: the sharing notice shows only for a generic song", async ({ page }) => {
  await mockBackend(page, { "GET /api/children": ok([ZOE]) });
  await page.goto("/studio/new");
  await expect(page.getByRole("note")).toHaveText(NOTICE);

  await page.getByRole("combobox", { name: "Who is it for?" }).click();
  await page.getByRole("option", { name: "Zoë" }).click();
  await expect(page.getByText(NOTICE)).toHaveCount(0);

  await page.getByRole("combobox", { name: "Who is it for?" }).click();
  await page.getByRole("option", { name: "Anyone (generic song)" }).click();
  await expect(page.getByRole("note")).toHaveText(NOTICE);
});

test("shared song: badge, no Redo actions, and an explanation", async ({ page }) => {
  await mockBackend(page, { "GET /api/songs/s1": ok(SHARED), ...MEDIA });
  await page.goto("/studio/songs/s1");
  await expect(page.getByText("Shared with all families")).toBeVisible();
  await expect(page.getByText("Shared songs can't be changed — make a new song.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Make a new song" })).toHaveAttribute("href", "/studio/new");
  for (const name of ["Redo lyrics", "Redo music", "Redo picture"]) {
    await expect(page.getByRole("button", { name })).toHaveCount(0);
  }
});

test("a ready personalized song is not marked shared and can still be redone", async ({ page }) => {
  await mockBackend(page, {
    "GET /api/songs/s1": ok({ ...SHARED, childId: "c1", shared: false }),
    "GET /api/children": ok([ZOE]),
    ...MEDIA,
  });
  await page.goto("/studio/songs/s1");
  await expect(page.getByRole("button", { name: "Redo lyrics" })).toBeVisible();
  await expect(page.getByText("Shared with all families")).toHaveCount(0);
});

test("delete of a shared song explains it stays in the catalog for other families", async ({ page }) => {
  const api = await mockBackend(page, {
    "GET /api/songs/s1": ok(SHARED),
    "DELETE /api/songs/s1": ok(null),
    "GET /api/songs": ok([]),
    ...MEDIA,
  });
  await page.goto("/studio/songs/s1");
  await page.getByRole("button", { name: "Delete song" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("leave your studio and your player");
  await expect(dialog).toContainText("stays in the catalog for other families");
  await expect(dialog).not.toContainText("can't be recovered");
  await dialog.getByRole("button", { name: "Delete song" }).click();
  await expect(page).toHaveURL("/studio");
  expect(api.count("DELETE", "/api/songs/s1")).toBe(1);
});

test("approving a generic song says it is now shared", async ({ page }) => {
  const review = song({ ...WITH_MEDIA, status: "pending_review" });
  await mockBackend(page, {
    "GET /api/songs/s1": ok(review),
    "POST /api/songs/s1/approve": ok({ ...review, status: "ready", approvedAt: "2026-10-29T09:00:00Z", shared: true }),
    ...MEDIA,
  });
  await page.goto("/studio/songs/s1");
  await expect(page.getByText("Approving shares this song with all LittleEars families")).toBeVisible();
  await page.getByRole("button", { name: "Approve for the player" }).click();
  await expect(page.getByText('"Sparkly Teeth" is in your player and now shared with all LittleEars families')).toBeVisible();
  await expect(page.getByText("Shared with all families")).toBeVisible();
  await expect(page.getByRole("button", { name: "Redo lyrics" })).toHaveCount(0);
});

test("a 409 from regenerate (song became shared meanwhile) is explained and the song refreshed", async ({ page }) => {
  // Stale view: still pending_review in this tab, but approved (and so shared) elsewhere.
  let calls = 0;
  const api = await mockBackend(page, {
    "GET /api/songs/s1": () => ok(calls++ === 0 ? song({ ...WITH_MEDIA, status: "pending_review" }) : SHARED),
    "POST /api/songs/s1/regenerate": fail(409, "CONFLICT", "Shared songs can't be changed — make a new song"),
    ...MEDIA,
  });
  await page.goto("/studio/songs/s1");
  await page.getByRole("button", { name: "Redo music" }).click();
  await expect(page.getByText("Shared songs can't be changed — make a new song").first()).toBeVisible();
  await expect(page.getByText("Shared with all families")).toBeVisible();
  await expect(page.getByRole("button", { name: "Redo music" })).toHaveCount(0);
  expect(api.count("GET", "/api/songs/s1")).toBe(2);
});
