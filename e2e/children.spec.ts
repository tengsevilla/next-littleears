import { expect, test, type Page, type Route } from "@playwright/test";

// API responses are route-mocked so these specs don't depend on the backend being up.
const ORIGIN = "http://localhost:3000";
const CLIP = "data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA";
const ZOE = { id: "c1", displayName: "Zoë", phoneticName: "Zoh-ee", ageBand: "3-5", createdAt: "2026-10-01T00:00:00Z" };
const MILO = { id: "c2", displayName: "Milo", phoneticName: null, ageBand: "1-2", createdAt: "2026-10-02T00:00:00Z" };

function json(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: {
      "Access-Control-Allow-Origin": ORIGIN,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    },
    body: JSON.stringify(body),
  });
}

/** Mocks a path; returns a counter of non-preflight calls. */
async function mockApi(page: Page, path: string, status: number, body: unknown) {
  const calls = { count: 0 };
  await page.route(`**${path}`, (route) => {
    if (route.request().method() === "OPTIONS") return json(route, 204, null);
    calls.count++;
    return json(route, status, body);
  });
  return calls;
}

/** Signed-in studio with two children; HTMLMediaElement playback is stubbed and recorded. */
async function openChildren(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __plays: string[] };
    w.__plays = [];
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      w.__plays.push(this.src);
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = () => {};
  });
  await mockApi(page, "/api/auth/refresh", 200, {
    data: { accessToken: "test-token", user: { id: "u1", email: "parent@example.com" } },
    error: null,
    meta: {},
  });
  await mockApi(page, "/api/children", 200, { data: [ZOE, MILO], error: null, meta: {} });
  await page.goto("/studio/children");
  await expect(page.getByRole("heading", { name: "Children", level: 1 })).toBeVisible();
}

const plays = (page: Page) => page.evaluate(() => (window as unknown as { __plays: string[] }).__plays);

test("name preview calls the endpoint once, plays, and replays from memory", async ({ page }) => {
  await openChildren(page);
  const preview = await mockApi(page, "/api/children/c1/name-preview", 200, {
    data: { audioUrl: CLIP },
    error: null,
    meta: {},
  });
  const button = page.getByRole("button", { name: "Hear how we say Zoë", exact: true });

  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  expect(await plays(page)).toEqual([CLIP]);
  expect(preview.count).toBe(1);

  await button.click(); // second click while playing stops it
  await expect(button).toHaveAttribute("aria-pressed", "false");

  await button.click(); // played again from the in-memory cache
  await expect(button).toHaveAttribute("aria-pressed", "true");
  expect(await plays(page)).toEqual([CLIP, CLIP]);
  expect(preview.count).toBe(1);
});

test("name preview shows a friendly toast when rate-limited", async ({ page }) => {
  await openChildren(page);
  await mockApi(page, "/api/children/c2/name-preview", 429, {
    data: null,
    error: { code: "RATE_LIMITED", message: "Too many requests" },
    meta: {},
  });
  const button = page.getByRole("button", { name: "Hear how we say Milo", exact: true });
  await button.click();
  await expect(page.getByText("You've heard a lot of names just now. Please try again in a minute.")).toBeVisible();
  await expect(button).toHaveAttribute("aria-pressed", "false");
  expect(await plays(page)).toEqual([]);
});

test("edit dialog offers a preview; create dialog asks to save first", async ({ page }) => {
  await openChildren(page);
  await page.getByRole("button", { name: "Edit Zoë" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Hear how we say Zoë" })).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("button", { name: "Add a child" }).click();
  await expect(page.getByRole("dialog").getByText("Save first, then you can hear how it sounds")).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("button", { name: /Hear how we say/ })).toHaveCount(0);
});

test("delete dialog warns that personalized songs are deleted too", async ({ page }) => {
  await openChildren(page);
  await page.getByRole("button", { name: "Remove Zoë" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("All of Zoë's personalized songs will be deleted too");
  await expect(dialog).toContainText("can't be recovered");
  await expect(dialog.getByRole("button", { name: "Delete Zoë and their songs" })).toBeVisible();
});
