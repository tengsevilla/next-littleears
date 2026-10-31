import { expect, test } from "@playwright/test";
import { fail, mockBackend, ok, PARENT, TOKEN } from "./support/backend";

const INVITE_TOKEN = "invite-tok_123";
const INVITE_PATH = `/api/auth/invites/${INVITE_TOKEN}`;

test("happy path: the invited email is shown read-only, the token leaves the URL, and the parent lands in the studio", async ({
  page,
}) => {
  const api = await mockBackend(page, {
    [`GET ${INVITE_PATH}`]: ok({ email: "new@example.com" }),
    "POST /api/auth/register": ok({ accessToken: TOKEN, user: { ...PARENT, email: "new@example.com" } }),
    "GET /api/songs": ok([]),
  });
  await page.goto(`/signup?token=${INVITE_TOKEN}`);
  await expect(page).toHaveTitle("Join LittleEars · LittleEars");

  const email = page.getByLabel("Email");
  await expect(email).toHaveValue("new@example.com");
  await expect(email).toHaveAttribute("readonly", "");
  // Stripped from the address bar and the history entry as soon as it was read.
  await expect(page).toHaveURL("/signup");
  expect(await page.evaluate(() => window.location.href)).not.toContain(INVITE_TOKEN);

  // Client-side rules: 10+ characters, and both fields must match. Nothing is sent until they pass.
  await page.getByLabel("Password", { exact: true }).fill("short");
  await page.getByLabel("Confirm password").fill("short");
  await page.getByRole("button", { name: "Continue to the studio" }).click();
  await expect(page.getByText("Use at least 10 characters.")).toBeVisible();
  await page.getByLabel("Password", { exact: true }).fill("a-long-password");
  await page.getByLabel("Confirm password").fill("a-long-passwerd");
  await page.getByRole("button", { name: "Continue to the studio" }).click();
  await expect(page.getByText("The passwords don't match.")).toBeVisible();
  expect(api.count("POST", "/api/auth/register")).toBe(0);

  await page.getByLabel("Confirm password").fill("a-long-password");
  await page.getByRole("button", { name: "Continue to the studio" }).click();
  await expect(page).toHaveURL("/studio");
  await expect(page.getByRole("heading", { name: "Songs", level: 1 })).toBeVisible();

  const register = api.calls.find((c) => c.method === "POST" && c.path === "/api/auth/register");
  expect(register?.body).toEqual({ token: INVITE_TOKEN, password: "a-long-password" });
  // Signed in from memory, like login: no extra refresh round trip was needed to open the studio.
  expect(api.count("POST", "/api/auth/refresh")).toBe(0);
  expect(api.calls.find((c) => c.path === "/api/songs")?.authorization).toBe(`Bearer ${TOKEN}`);
  expect(page.url()).not.toContain("a-long-password");
});

test("an invalid, expired or used token shows one generic message and no form", async ({ page }) => {
  await mockBackend(page, {
    [`GET ${INVITE_PATH}`]: fail(404, "NOT_FOUND", "Invite not found"),
  });
  await page.goto(`/signup?token=${INVITE_TOKEN}`);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("This invite link doesn't work any more");
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "I already have an account" })).toHaveAttribute("href", "/login");
  await expect(page).toHaveURL("/signup");
});

test("no token at all shows the same message without calling the API", async ({ page }) => {
  const api = await mockBackend(page, {});
  await page.goto("/signup");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("This invite link doesn't work any more");
  expect(api.calls.filter((c) => c.path.startsWith("/api/auth/invites"))).toEqual([]);
});

test("an email that already has an account points to sign in", async ({ page }) => {
  await mockBackend(page, {
    [`GET ${INVITE_PATH}`]: ok({ email: "new@example.com" }),
    "POST /api/auth/register": fail(409, "CONFLICT", "Email already registered"),
  });
  await page.goto(`/signup?token=${INVITE_TOKEN}`);
  await page.getByLabel("Password", { exact: true }).fill("a-long-password");
  await page.getByLabel("Confirm password").fill("a-long-password");
  await page.getByRole("button", { name: "Continue to the studio" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("There's already an account for this email.");
  await expect(page.getByRole("link", { name: "Sign in instead" })).toHaveAttribute("href", "/login");
});

test("nothing secret ever reaches a page URL: the form posts, and the token is only sent to the API", async ({ page }) => {
  const appUrls: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).origin === "http://localhost:3000") appUrls.push(r.url());
  });
  await mockBackend(page, {
    [`GET ${INVITE_PATH}`]: ok({ email: "new@example.com" }),
    "POST /api/auth/register": fail(429, "RATE_LIMITED", "Too many requests"),
  });
  await page.goto(`/signup?token=${INVITE_TOKEN}`);
  await expect(page.locator("form")).toHaveAttribute("method", "post");
  await page.getByLabel("Password", { exact: true }).fill("secret-password-1");
  await page.getByLabel("Confirm password").fill("secret-password-1");
  await page.getByRole("button", { name: "Continue to the studio" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Too many tries");

  await expect(page).toHaveURL("/signup");
  // The only app-origin request carrying the token is the initial page load itself.
  const afterLoad = appUrls.filter((u) => !u.endsWith(`/signup?token=${INVITE_TOKEN}`));
  for (const url of afterLoad) {
    expect(url).not.toContain(INVITE_TOKEN);
    expect(url).not.toContain("secret-password-1");
  }
  expect(await page.evaluate(() => window.location.href)).not.toContain(INVITE_TOKEN);
});
