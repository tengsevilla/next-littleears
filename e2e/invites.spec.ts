import { expect, test } from "@playwright/test";
import { asAdmin, fail, mockBackend, ok } from "./support/backend";

// Route mocks only: the real POST /api/invites sends a real email.
const PENDING = {
  id: "i1",
  email: "pending@example.com",
  status: "pending",
  createdAt: "2026-10-28T10:00:00Z",
  expiresAt: "2026-11-04T10:00:00Z",
};
const USED = { ...PENDING, id: "i2", email: "used@example.com", status: "used" };
const EXPIRED = { ...PENDING, id: "i3", email: "expired@example.com", status: "expired" };
const REVOKED = { ...PENDING, id: "i4", email: "revoked@example.com", status: "revoked" };
const LINK = "http://localhost:3000/signup?token=raw-token-shown-once";

test("admin: an emailed invite shows the sent panel with the link collapsed, list statuses, revoke a pending one", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  let invites = [USED, EXPIRED, REVOKED];
  const api = await mockBackend(page, {
    ...asAdmin(),
    "GET /api/invites": () => ok(invites),
    "POST /api/invites": ({ body }) => {
      invites = [PENDING, ...invites];
      return ok({ ...PENDING, email: (body as { email: string }).email, inviteUrl: LINK, emailStatus: "sent" });
    },
    "DELETE /api/invites/i1": () => {
      invites = invites.map((i) => (i.id === "i1" ? { ...i, status: "revoked" } : i));
      return ok(null);
    },
  });
  await page.goto("/studio/invites");
  const nav = page.getByRole("navigation", { name: "Studio" });
  await expect(nav.getByRole("link", { name: "Invites" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Catalog" })).toBeVisible();
  await expect(page.getByText("we'll send them a sign-up link")).toBeVisible();

  const list = page.getByRole("list", { name: "Invites" });
  await expect(list.getByText("Joined", { exact: true })).toBeVisible();
  await expect(list.getByText("Expired", { exact: true })).toBeVisible();
  await expect(list.getByText("Revoked", { exact: true })).toBeVisible();
  await expect(list.getByRole("button", { name: /Revoke invite/ })).toHaveCount(0); // none pending yet
  // Send again only for pending and expired.
  await expect(list.getByRole("button", { name: /again$/ })).toHaveCount(1);
  await expect(list.getByRole("button", { name: "Send the invite for expired@example.com again" })).toBeVisible();

  // Client-side email check sends nothing.
  await page.getByLabel("Email to invite").fill("not-an-email");
  await page.getByRole("button", { name: "Send invite" }).click();
  await expect(page.getByText("Enter the email address of the person you want to invite.")).toBeVisible();
  expect(api.count("POST", "/api/invites")).toBe(0);

  await page.getByLabel("Email to invite").fill("pending@example.com");
  await page.getByRole("button", { name: "Send invite" }).click();
  const created = page.getByRole("region", { name: "New invite" });
  await expect(created).toContainText("Invite emailed to pending@example.com");
  await expect(created).toContainText("works once and expires");
  await expect(created).not.toContainText("couldn't send");
  // The fallback link is collapsed until asked for.
  await expect(created.getByLabel("Invite link")).toBeHidden();
  await created.getByText("Copy link instead").click();
  await expect(created.getByLabel("Invite link")).toHaveValue(LINK);
  await created.getByRole("button", { name: "Copy link" }).click();
  await expect(created.getByRole("button", { name: "Copied" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(LINK);
  expect(api.calls.find((c) => c.method === "POST" && c.path === "/api/invites")?.body).toEqual({
    email: "pending@example.com",
  });

  await expect(list.getByText("Waiting", { exact: true })).toBeVisible();
  await created.getByRole("button", { name: "Done" }).click();
  await expect(page.getByLabel("Invite link")).toHaveCount(0); // shown once, then gone

  await list.getByRole("button", { name: "Revoke invite for pending@example.com" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("The link stops working right away");
  await dialog.getByRole("button", { name: "Revoke invite" }).click();
  await expect(list.getByText("Waiting", { exact: true })).toHaveCount(0);
  expect(api.count("DELETE", "/api/invites/i1")).toBe(1);
});

test("admin: a failed email shows the warning panel with the link visible to copy", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  let invites: (typeof PENDING)[] = [];
  await mockBackend(page, {
    ...asAdmin(),
    "GET /api/invites": () => ok(invites),
    "POST /api/invites": () => {
      invites = [PENDING];
      return { status: 201, data: { ...PENDING, inviteUrl: LINK, emailStatus: "failed" } };
    },
  });
  await page.goto("/studio/invites");
  await page.getByLabel("Email to invite").fill("pending@example.com");
  await page.getByRole("button", { name: "Send invite" }).click();

  const created = page.getByRole("region", { name: "New invite" });
  await expect(created).toContainText("We couldn't send the email. Copy this link and send it yourself.");
  await expect(created).not.toContainText("Invite emailed");
  await expect(created.getByText("Copy link instead")).toHaveCount(0);
  await expect(created.getByLabel("Invite link")).toBeVisible();
  await expect(created.getByLabel("Invite link")).toHaveValue(LINK);
  await created.getByRole("button", { name: "Copy link" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(LINK);
  // The invite still exists even though the email failed.
  await expect(page.getByRole("list", { name: "Invites" }).getByText("Waiting", { exact: true })).toBeVisible();
});

test("admin: Send again confirms, posts the same email, replaces the old entry and shows the result panel", async ({
  page,
}) => {
  const OLD = { ...PENDING, id: "old", email: "again@example.com" };
  const FRESH = { ...OLD, id: "new", createdAt: "2026-10-31T09:00:00Z", expiresAt: "2026-11-07T09:00:00Z" };
  let invites = [OLD, EXPIRED];
  const api = await mockBackend(page, {
    ...asAdmin(),
    "GET /api/invites": () => ok(invites),
    "POST /api/invites": ({ body }) => {
      const { email } = body as { email: string };
      if (email === EXPIRED.email) {
        const fresh = { ...EXPIRED, id: "new-expired", status: "pending" };
        invites = [fresh, ...invites.filter((i) => i.id !== EXPIRED.id)];
        return { status: 201, data: { ...fresh, inviteUrl: LINK, emailStatus: "failed" } };
      }
      // The backend revokes the older pending invite for the same email.
      invites = [FRESH, ...invites.map((i) => (i.id === OLD.id ? { ...i, status: "revoked" } : i))];
      return { status: 201, data: { ...FRESH, inviteUrl: LINK, emailStatus: "sent" } };
    },
  });
  await page.goto("/studio/invites");
  const list = page.getByRole("list", { name: "Invites" });
  const items = list.getByRole("listitem");
  await expect(items).toHaveCount(2);

  // Cancelling sends nothing.
  await list.getByRole("button", { name: "Send the invite for again@example.com again" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("The link you sent before stops working right away");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
  expect(api.count("POST", "/api/invites")).toBe(0);

  await list.getByRole("button", { name: "Send the invite for again@example.com again" }).click();
  await dialog.getByRole("button", { name: "Send new invite" }).click();
  const created = page.getByRole("region", { name: "New invite" });
  await expect(created).toContainText("Invite emailed to again@example.com");
  await expect(created.getByLabel("Invite link")).toBeHidden();
  expect(api.calls.filter((c) => c.method === "POST" && c.path === "/api/invites").map((c) => c.body)).toEqual([
    { email: "again@example.com" },
  ]);

  // The new pending invite replaces the old one, which now shows as revoked.
  const againItems = items.filter({ hasText: "again@example.com" });
  await expect(againItems).toHaveCount(2);
  await expect(againItems.first().getByText("Waiting", { exact: true })).toBeVisible();
  await expect(againItems.nth(1).getByText("Revoked", { exact: true })).toBeVisible();
  await expect(list.getByRole("button", { name: "Revoke invite for again@example.com" })).toHaveCount(1);
  await created.getByRole("button", { name: "Done" }).click();

  // Expired invites can be sent again too; a failed email shows the link straight away.
  await list.getByRole("button", { name: "Send the invite for expired@example.com again" }).click();
  await expect(dialog).toContainText("The old link has expired");
  await dialog.getByRole("button", { name: "Send new invite" }).click();
  await expect(created).toContainText("We couldn't send the email");
  await expect(created.getByLabel("Invite link")).toHaveValue(LINK);
  await expect(list.getByText("Expired", { exact: true })).toHaveCount(0);
  expect(api.calls.filter((c) => c.method === "POST" && c.path === "/api/invites").at(-1)?.body).toEqual({
    email: "expired@example.com",
  });
});

test("admin: 409 for an existing account is a friendly message", async ({ page }) => {
  await mockBackend(page, {
    ...asAdmin(),
    "GET /api/invites": ok([]),
    "POST /api/invites": fail(409, "CONFLICT", "Email already registered"),
  });
  await page.goto("/studio/invites");
  await expect(page.getByText("No invites yet.")).toBeVisible();
  await page.getByLabel("Email to invite").fill("parent@example.com");
  await page.getByRole("button", { name: "Send invite" }).click();
  await expect(page.getByText("That email already has a LittleEars account")).toBeVisible();
  await expect(page.getByLabel("Invite link")).toHaveCount(0);
});

test("parent: no Invites link, and the page says it isn't available without calling the API", async ({ page }) => {
  const api = await mockBackend(page, { "GET /api/songs": ok([]) });
  await page.goto("/studio");
  const nav = page.getByRole("navigation", { name: "Studio" });
  await expect(nav.getByRole("link", { name: "Catalog" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Invites" })).toHaveCount(0);

  await page.goto("/studio/invites");
  await expect(page.getByRole("heading", { name: "Invites aren't available on your account" })).toBeVisible();
  expect(api.calls.filter((c) => c.path.startsWith("/api/invites"))).toEqual([]);
});

test("a 403 from the API (role changed since sign-in) shows the same friendly page", async ({ page }) => {
  await mockBackend(page, { ...asAdmin(), "GET /api/invites": fail(403, "FORBIDDEN", "Admins only") });
  await page.goto("/studio/invites");
  await expect(page.getByRole("heading", { name: "Invites aren't available on your account" })).toBeVisible();
});
