import { expect, test, type Page } from "@playwright/test";
import { fail, MP3, mockBackend, ok, PNG, song, summary, TOKEN, ZOE } from "./support/backend";

const AUDIO = "/api/media/s1/audio?v=a1";
const IMAGE = "/api/media/s1/image?v=i1";
const MEDIA = {
  "GET /api/media/s1/audio": { file: MP3, contentType: "audio/mpeg" },
  "GET /api/media/s1/image": { file: PNG, contentType: "image/png" },
};
const REVIEW = song({ status: "pending_review", audioUrl: AUDIO, imageUrl: IMAGE, childId: "c1" });

const currentStep = (page: Page) => page.getByRole("list", { name: "Song progress" }).locator('[aria-current="step"]');

test("polls through the pipeline to pending_review, then stops", async ({ page }) => {
  test.slow();
  const sequence = [
    song({ status: "writing", title: null, lyrics: null, safety: null }),
    song({ status: "composing" }),
    REVIEW,
  ];
  let calls = 0;
  await mockBackend(page, {
    "GET /api/songs/s1": () => ok(sequence[Math.min(calls++, sequence.length - 1)]),
    "GET /api/children": ok([ZOE]),
    ...MEDIA,
  });
  await page.goto("/studio/songs/s1");

  await expect(currentStep(page)).toHaveText("Writing the words");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("brushing teeth"); // topic until titled
  await expect(currentStep(page)).toHaveText("Composing the music", { timeout: 6000 });
  await expect(page.getByText("Needs your review")).toBeVisible({ timeout: 6000 });
  await expect(page.getByRole("list", { name: "Song progress" })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sparkly Teeth");
  await expect(page.getByText("For Zoë")).toBeVisible();
  await expect(page.getByText("Passed the safety check.")).toBeVisible();
  await expect(page.getByRole("group", { name: "Lyrics" })).toContainText("Sparkly teeth all day");

  const settled = calls;
  await page.waitForTimeout(3500);
  expect(calls).toBe(settled);
});

test("media is fetched once with the bearer token and rendered via blob: URLs", async ({ page }) => {
  const api = await mockBackend(page, {
    "GET /api/songs": ok([summary({ imageUrl: IMAGE })]),
    "GET /api/songs/s1": ok(REVIEW),
    ...MEDIA,
  });
  await page.goto("/studio");
  await page.getByRole("link", { name: /Sparkly Teeth/ }).click();
  await expect(page).toHaveURL("/studio/songs/s1", { timeout: 15_000 }); // first dev compile of the route can be slow

  await expect(page.getByRole("img", { name: "Cover for Sparkly Teeth" })).toHaveAttribute("src", /^blob:/);
  await expect(page.locator("audio")).toHaveAttribute("src", /^blob:/);
  await expect(page.locator("audio")).toHaveAttribute("controls", "");

  const media = api.calls.filter((c) => c.path.startsWith("/api/media/"));
  // The cover was already cached from the list, so each URL is fetched exactly once.
  expect(media.map((c) => c.path).sort()).toEqual([AUDIO, IMAGE].sort());
  for (const call of media) expect(call.authorization).toBe(`Bearer ${TOKEN}`);
});

test("no media request goes out for null media URLs", async ({ page }) => {
  const api = await mockBackend(page, {
    "GET /api/songs": ok([summary({ status: "illustrating" })]),
    "GET /api/songs/s1": ok(song({ status: "illustrating" })),
  });
  await page.goto("/studio");
  await expect(page.getByText("Drawing the cover")).toBeVisible();
  await page.goto("/studio/songs/s1");
  await expect(currentStep(page)).toHaveText("Drawing the cover");
  await expect(page.locator("audio")).toHaveCount(0);
  expect(api.calls.filter((c) => c.path.startsWith("/api/media/"))).toEqual([]);
});

test("approve moves the song to ready", async ({ page }) => {
  const api = await mockBackend(page, {
    "GET /api/songs/s1": ok(REVIEW),
    "POST /api/songs/s1/approve": ok({ ...REVIEW, status: "ready", approvedAt: "2026-10-29T09:00:00Z" }),
    ...MEDIA,
  });
  await page.goto("/studio/songs/s1");
  await page.getByRole("button", { name: "Approve for the player" }).click();
  await expect(page.getByText("Ready to play")).toBeVisible();
  await expect(page.getByText(/Approved/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve for the player" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reject" })).toHaveCount(0);
  expect(api.count("POST", "/api/songs/s1/approve")).toBe(1);
});

test("409 CONFLICT refreshes the song and shows a toast", async ({ page }) => {
  let rejected = false;
  const api = await mockBackend(page, {
    "GET /api/songs/s1": () => ok(rejected ? { ...REVIEW, status: "rejected" } : REVIEW),
    "POST /api/songs/s1/approve": () => {
      rejected = true;
      return fail(409, "CONFLICT", "Only a song waiting for review can be approved");
    },
    ...MEDIA,
  });
  await page.goto("/studio/songs/s1");
  await page.getByRole("button", { name: "Approve for the player" }).click();
  await expect(page.getByText("This song changed in the meantime")).toBeVisible();
  await expect(page.getByText("This song was rejected")).toBeVisible();
  expect(api.count("GET", "/api/songs/s1")).toBe(2);
});

test("regenerate from ready warns, then returns to the queue and resumes polling", async ({ page }) => {
  const ready = { ...REVIEW, status: "ready", approvedAt: "2026-10-29T09:00:00Z" };
  const queued = { ...ready, status: "queued", approvedAt: null, imageUrl: null, audioUrl: null };
  let regenerated = false;
  const api = await mockBackend(page, {
    "GET /api/songs/s1": () => ok(regenerated ? queued : ready),
    "POST /api/songs/s1/regenerate": () => {
      regenerated = true;
      return ok(queued);
    },
    ...MEDIA,
  });
  await page.goto("/studio/songs/s1");
  await expect(page.getByText("takes this song out of the kid player")).toBeVisible();

  await page.getByRole("button", { name: "Redo picture" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("will leave the kid player and go back to review");
  await dialog.getByRole("button", { name: "Redo the picture" }).click();

  await expect(page.getByText("Waiting to start")).toBeVisible();
  await expect(page.getByRole("list", { name: "Song progress" })).toBeVisible();
  const post = api.calls.find((c) => c.method === "POST" && c.path === "/api/songs/s1/regenerate");
  expect(post?.body).toEqual({ part: "image" });

  const before = api.count("GET", "/api/songs/s1");
  await expect.poll(() => api.count("GET", "/api/songs/s1"), { timeout: 6000 }).toBeGreaterThan(before);
});

test("regenerate from pending_review starts immediately", async ({ page }) => {
  const api = await mockBackend(page, {
    "GET /api/songs/s1": ok(REVIEW),
    "POST /api/songs/s1/regenerate": ok({ ...REVIEW, status: "writing", audioUrl: null, imageUrl: null }),
    ...MEDIA,
  });
  await page.goto("/studio/songs/s1");
  await page.getByRole("button", { name: "Redo lyrics" }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Song progress" }).locator('[aria-current="step"]')).toHaveText(
    "Writing the words",
  );
  expect(api.calls.find((c) => c.path === "/api/songs/s1/regenerate")?.body).toEqual({ part: "lyrics" });
});

test("delete asks first, then returns to the list", async ({ page }) => {
  const api = await mockBackend(page, {
    "GET /api/songs/s1": ok(REVIEW),
    "DELETE /api/songs/s1": ok(null),
    "GET /api/songs": ok([]),
    ...MEDIA,
  });
  await page.goto("/studio/songs/s1");
  await page.getByRole("button", { name: "Delete song" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("can't be recovered");
  await dialog.getByRole("button", { name: "Delete song" }).click();
  await expect(page).toHaveURL("/studio");
  expect(api.count("DELETE", "/api/songs/s1")).toBe(1);
});

test("a failed song explains why and offers Try again with the same settings", async ({ page }) => {
  await mockBackend(page, {
    "GET /api/songs/s1": ok(
      song({ status: "failed", error: "The music service is busy", childId: "c1", mood: "calm", lengthSec: 120 }),
    ),
    "GET /api/children": ok([ZOE]),
  });
  await page.goto("/studio/songs/s1");
  await expect(page.getByText("The music service is busy")).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve for the player" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Redo lyrics" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Try again" })).toHaveAttribute(
    "href",
    "/studio/new?topic=brushing+teeth&mood=calm&lengthSec=120&childId=c1",
  );
});
