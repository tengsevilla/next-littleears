import { expect, test } from "@playwright/test";

// Credentials must never end up in a URL: not from a native (pre-hydration / no-JS) submit, and not if a
// URL already carries them. No API call is involved, so nothing here reaches the backend.

test.describe("with JavaScript disabled", () => {
  test.use({ javaScriptEnabled: false });

  test("a native submit POSTs the fields in the body, never in the query string", async ({ page }) => {
    await page.goto("/login?next=%2Fplay");
    await page.getByLabel("Email").fill("parent@example.com");
    await page.getByLabel("Password").fill("correct-password");
    const [request] = await Promise.all([
      page.waitForRequest((r) => new URL(r.url()).pathname === "/login" && r.isNavigationRequest()),
      page.getByRole("button", { name: "Sign in to the studio" }).click(),
    ]);
    expect(request.method()).toBe("POST");
    await page.waitForLoadState();

    const url = new URL(page.url());
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.has("password")).toBe(false);
    expect(url.searchParams.has("email")).toBe(false);
    expect(url.searchParams.get("next")).toBe("/play");
    expect(page.url()).not.toContain("correct-password");
    // The POST renders the login page again rather than an error.
    await expect(page.getByRole("heading", { name: "Grown-ups sign in" })).toBeVisible();
  });
});

test("credentials in the query string are stripped at once and never prefilled", async ({ page }) => {
  await page.goto("/login?email=parent%40example.com&password=leaked-secret&next=%2Fplay");
  await expect(page).toHaveURL(/\/login\?next=%2Fplay$/);
  await expect(page.getByLabel("Password")).toHaveValue("");
  await expect(page.getByLabel("Email")).toHaveValue("");
  expect(await page.evaluate(() => window.location.href)).not.toContain("leaked-secret");
});
