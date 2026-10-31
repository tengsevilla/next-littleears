import { expect, test, type Page } from "@playwright/test";
import { fail, MILO, mockBackend, ok, song, ZOE } from "./support/backend";

async function pickChild(page: Page, name: string) {
  await page.getByRole("combobox", { name: "Who is it for?" }).click();
  await page.getByRole("option", { name }).click();
}

const lengthRadio = (page: Page, name: string) => page.getByRole("radio", { name });

test("validates the topic on the client and sends nothing", async ({ page }) => {
  const api = await mockBackend(page, { "GET /api/children": ok([ZOE, MILO]) });
  await page.goto("/studio/new");
  await page.getByRole("button", { name: "Make the song" }).click();
  await expect(page.getByText("Tell us a little more: at least 2 characters.")).toBeVisible();
  await page.getByLabel("What should it be about?").fill("   a   ");
  await page.getByRole("button", { name: "Make the song" }).click();
  await expect(page.getByText("Tell us a little more: at least 2 characters.")).toBeVisible();
  expect(api.count("POST", "/api/songs")).toBe(0);
});

test("ageBand shows only for a generic song; a child brings the name preview", async ({ page }) => {
  await mockBackend(page, { "GET /api/children": ok([ZOE, MILO]) });
  await page.goto("/studio/new");
  await expect(page.getByRole("combobox", { name: "Age" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Hear how we say/ })).toHaveCount(0);

  await pickChild(page, "Zoë");
  await expect(page.getByRole("combobox", { name: "Age" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Hear how we say Zoë" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Make Zoë's song" })).toBeVisible();

  await pickChild(page, "Anyone (generic song)");
  await expect(page.getByRole("combobox", { name: "Age" })).toBeVisible();
});

test("ages 1–2 force 60 s, by child or by age band", async ({ page }) => {
  await mockBackend(page, { "GET /api/children": ok([ZOE, MILO]) });
  await page.goto("/studio/new");

  await lengthRadio(page, "2 minutes").click();
  await expect(lengthRadio(page, "2 minutes")).toBeChecked();

  await pickChild(page, "Milo"); // ageBand 1-2
  await expect(lengthRadio(page, "1 minute")).toBeChecked();
  await expect(lengthRadio(page, "1½ minutes")).toBeDisabled();
  await expect(lengthRadio(page, "2 minutes")).toBeDisabled();
  await expect(page.getByText("Songs for ages 1–2 are 1 minute")).toBeVisible();

  await pickChild(page, "Zoë"); // 3-5: the earlier choice comes back
  await expect(lengthRadio(page, "2 minutes")).toBeEnabled();
  await expect(lengthRadio(page, "2 minutes")).toBeChecked();

  await pickChild(page, "Anyone (generic song)");
  await page.getByRole("combobox", { name: "Age" }).click();
  await page.getByRole("option", { name: "1–2 years" }).click();
  await expect(lengthRadio(page, "1 minute")).toBeChecked();
  await expect(lengthRadio(page, "2 minutes")).toBeDisabled();
});

test("submits a personalized song without ageBand and opens its page", async ({ page }) => {
  const api = await mockBackend(page, {
    "GET /api/children": ok([ZOE, MILO]),
    "POST /api/songs": { status: 201, data: { id: "s9", status: "queued" } },
    "GET /api/songs/s9": ok(song({ id: "s9", status: "queued", title: null, lyrics: null, safety: null })),
  });
  await page.goto("/studio/new");
  await pickChild(page, "Zoë");
  await page.getByLabel("What should it be about?").fill("  a red balloon  ");
  await page.getByRole("radio", { name: /Lullaby/ }).click();
  await page.getByRole("button", { name: "Make Zoë's song" }).click();

  await expect(page).toHaveURL("/studio/songs/s9");
  const post = api.calls.find((c) => c.method === "POST" && c.path === "/api/songs");
  expect(post?.body).toEqual({ childId: "c1", topic: "a red balloon", mood: "lullaby", lengthSec: 60 });
});

test("generic song sends ageBand", async ({ page }) => {
  const api = await mockBackend(page, {
    "POST /api/songs": { status: 201, data: { id: "s9", status: "queued" } },
    "GET /api/songs/s9": ok(song({ id: "s9", status: "queued" })),
  });
  await page.goto("/studio/new");
  await page.getByLabel("What should it be about?").fill("the moon");
  await page.getByRole("button", { name: "Make the song" }).click();
  await expect(page).toHaveURL("/studio/songs/s9");
  const post = api.calls.find((c) => c.method === "POST" && c.path === "/api/songs");
  expect(post?.body).toEqual({ topic: "the moon", mood: "playful", lengthSec: 60, ageBand: "3-5" });
});

test("429 RATE_LIMITED shows a friendly toast; VALIDATION shows the API message", async ({ page }) => {
  const api = await mockBackend(page, { "POST /api/songs": fail(429, "RATE_LIMITED", "Too many songs") });
  await page.goto("/studio/new");
  await page.getByLabel("What should it be about?").fill("the moon");
  await page.getByRole("button", { name: "Make the song" }).click();
  await expect(page.getByText("You've made a lot of songs this hour")).toBeVisible();
  await expect(page).toHaveURL("/studio/new");

  api.set("POST /api/songs", fail(400, "VALIDATION", "topic: must be 2-120 characters"));
  await page.getByLabel("What should it be about?").press("Enter"); // the toast can sit over the button
  await expect(page.getByRole("alert").filter({ hasText: "topic: must be 2-120 characters" })).toBeVisible();
});

test("query params prefill the form (Try again)", async ({ page }) => {
  await mockBackend(page, { "GET /api/children": ok([ZOE, MILO]) });
  await page.goto("/studio/new?topic=the%20big%20red%20bus&mood=calm&lengthSec=120&childId=c1");
  await expect(page.getByLabel("What should it be about?")).toHaveValue("the big red bus");
  await expect(page.getByRole("radio", { name: /Calm/ })).toBeChecked();
  await expect(lengthRadio(page, "2 minutes")).toBeChecked();
  await expect(page.getByRole("button", { name: "Make Zoë's song" })).toBeVisible();
});

test("mood and length radios have names and labelled groups", async ({ page }) => {
  await mockBackend(page, {});
  await page.goto("/studio/new");
  const mood = page.getByRole("radiogroup", { name: "Mood" });
  const length = page.getByRole("radiogroup", { name: "Length" });
  for (const name of ["Playful", "Calm", "Lullaby"])
    await expect(mood.getByRole("radio", { name, exact: true })).toBeVisible();
  for (const name of ["1 minute", "1½ minutes", "2 minutes"]) {
    await expect(length.getByRole("radio", { name, exact: true })).toBeVisible();
  }
  await expect(mood.getByRole("radio", { name: "Playful", exact: true })).toBeChecked();
});

test("after a submit, New song in the nav (and Back) shows a fresh, enabled form", async ({ page }) => {
  await mockBackend(page, {
    "POST /api/songs": { status: 201, data: { id: "s9", status: "queued" } },
    "GET /api/songs/s9": ok(song({ id: "s9", status: "queued" })),
  });
  await page.goto("/studio/new");
  await page.getByLabel("What should it be about?").fill("the moon");
  await page.getByRole("radio", { name: "Calm", exact: true }).click();
  await page.getByRole("button", { name: "Make the song" }).click();
  await expect(page).toHaveURL("/studio/songs/s9", { timeout: 15_000 });

  await page.getByRole("navigation", { name: "Studio" }).getByRole("link", { name: "New song" }).click();
  await expect(page).toHaveURL("/studio/new");
  await expect(page.getByLabel("What should it be about?")).toHaveValue("");
  await expect(page.getByRole("radio", { name: "Playful", exact: true })).toBeChecked();
  await expect(page.getByRole("button", { name: "Make the song" })).toBeEnabled();

  // Submit again, then come back with the browser's Back button.
  await page.getByLabel("What should it be about?").fill("the sun");
  await page.getByRole("button", { name: "Make the song" }).click();
  await expect(page).toHaveURL("/studio/songs/s9");
  await page.goBack();
  await expect(page).toHaveURL("/studio/new");
  await expect(page.getByLabel("What should it be about?")).toHaveValue("");
  await expect(page.getByRole("button", { name: "Make the song" })).toBeEnabled();
});
