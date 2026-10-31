import { expect, test, type Page, type Route } from "@playwright/test";

// API responses are route-mocked so these specs don't depend on the backend being up.
const ORIGIN = "http://localhost:3000";

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

async function mockApi(page: Page, path: string, status: number, body: unknown) {
  await page.route(`**${path}`, (route) =>
    route.request().method() === "OPTIONS" ? json(route, 204, null) : json(route, status, body),
  );
}

test("login page renders the sign-in form", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveTitle("Sign in · LittleEars");
  await expect(page.getByRole("heading", { name: "Grown-ups sign in" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in to the studio" })).toBeEnabled();
});

test("login shows a friendly error for bad credentials", async ({ page }) => {
  await mockApi(page, "/api/auth/login", 401, {
    data: null,
    error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
    meta: {},
  });
  await page.goto("/login");
  await page.getByLabel("Email").fill("parent@example.com");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in to the studio" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "That email and password don't match. Please try again." }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("login validates fields before calling the API", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in to the studio" }).click();
  await expect(page.getByText("Enter the email you use for LittleEars.")).toBeVisible();
  await expect(page.getByText("Enter your password.")).toBeVisible();
});

test("successful login ignores an off-site next param and opens the studio", async ({ page }) => {
  await mockApi(page, "/api/auth/login", 200, {
    data: { accessToken: "test-token", user: { id: "u1", email: "parent@example.com" } },
    error: null,
    meta: {},
  });
  // The studio landing page lists songs; without this mock it would reach the real API with a fake token.
  await mockApi(page, "/api/songs", 200, { data: [], error: null, meta: {} });
  await mockApi(page, "/api/children", 200, { data: [], error: null, meta: {} });
  await page.goto("/login?next=" + encodeURIComponent("//evil.example.com/studio"));
  await page.getByLabel("Email").fill("parent@example.com");
  await page.getByLabel("Password").fill("correct-password");
  await page.getByRole("button", { name: "Sign in to the studio" }).click();
  await expect(page).toHaveURL(`${ORIGIN}/studio`);
  await expect(page.getByRole("heading", { name: "Songs", level: 1 })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Studio" }).getByRole("link", { name: "Children" })).toBeVisible();
});

test("studio redirects to /login when the session can't be refreshed", async ({ page }) => {
  await mockApi(page, "/api/auth/refresh", 401, {
    data: null,
    error: { code: "UNAUTHORIZED", message: "No session" },
    meta: {},
  });
  await page.goto("/studio/children");
  await expect(page).toHaveURL(/\/login\?next=%2Fstudio%2Fchildren$/);
  await expect(page.getByRole("heading", { name: "Grown-ups sign in" })).toBeVisible();
});
