import { expect, test, type Locator, type Page } from "@playwright/test";
import { asAdmin, mockBackend, ok } from "./support/backend";

// /play would otherwise register the service worker, which answers requests behind page.route's back.
test.use({ serviceWorkers: "block" });

const studioNav = (page: Page) => page.getByRole("navigation", { name: "Studio" });
// Two Play links are rendered (phone top row, desktop nav); responsive classes leave exactly one visible.
const playLink = (page: Page) => page.getByRole("banner").getByRole("link", { name: "Play", exact: true }).filter({ visible: true });

async function openStudio(page: Page, admin = false) {
  await mockBackend(page, {
    ...(admin ? asAdmin() : {}),
    "GET /api/songs": ok([]),
    "GET /api/children": ok([]),
    "GET /api/library": ok([]),
  });
  await page.goto("/studio");
}

/** Fully inside the viewport and not cut by any scrolling/clipping ancestor. */
async function expectUnclipped(locator: Locator, viewportWidth: number) {
  await expect(locator).toBeInViewport({ ratio: 1 });
  const box = (await locator.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewportWidth);
  const clipped = await locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    for (let p = el.parentElement; p; p = p.parentElement) {
      if (getComputedStyle(p).overflowX === "visible") continue;
      const c = p.getBoundingClientRect();
      if (r.left < c.left - 0.5 || r.right > c.right + 0.5) return true;
    }
    return false;
  });
  expect(clipped).toBe(false);
}

test("desktop: the studio nav ends with Play, which opens the kid player", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openStudio(page, true);
  const links = studioNav(page).getByRole("link").filter({ visible: true });
  await expect(links).toHaveText(["Songs", "Children", "Catalog", "Invites", "Play"]);
  await expect(playLink(page)).toHaveCount(1);
  const play = links.last();
  await expect(play).toHaveAttribute("href", "/play");
  await expect(play).not.toHaveAttribute("aria-current", /.*/);

  await play.click();
  await expect(page).toHaveURL(/\/play$/);
});

test("375 px admin: Play sits in the top row and every nav link is fully visible", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openStudio(page, true);
  const nav = studioNav(page);
  const textLinks = nav.getByRole("link").filter({ visible: true });
  await expect(textLinks).toHaveText(["Songs", "Children", "Catalog", "Invites"]);
  for (const link of await textLinks.all()) await expectUnclipped(link, 375);

  const play = playLink(page);
  await expect(play).toHaveCount(1);
  await expectUnclipped(play, 375);
  // Top row, beside Sign out, above the links row.
  const signOut = (await page.getByRole("button", { name: "Sign out" }).boundingBox())!;
  const playBox = (await play.boundingBox())!;
  expect(Math.abs(playBox.y + playBox.height / 2 - (signOut.y + signOut.height / 2))).toBeLessThanOrEqual(2);
  expect(playBox.x + playBox.width).toBeLessThanOrEqual(signOut.x);
  expect(playBox.y + playBox.height).toBeLessThanOrEqual((await textLinks.first().boundingBox())!.y);

  await play.click();
  await expect(page).toHaveURL(/\/play$/);
});
