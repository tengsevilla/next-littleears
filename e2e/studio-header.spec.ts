import { expect, test, type Page } from "@playwright/test";
import { asAdmin, mockBackend, ok } from "./support/backend";

// /play would otherwise register the service worker, which answers requests behind page.route's back.
test.use({ serviceWorkers: "block" });

const studioNav = (page: Page) => page.getByRole("navigation", { name: "Studio" });

async function openStudio(page: Page, admin = false) {
  await mockBackend(page, {
    ...(admin ? asAdmin() : {}),
    "GET /api/songs": ok([]),
    "GET /api/children": ok([]),
    "GET /api/library": ok([]),
  });
  await page.goto("/studio");
}

test("the studio nav ends with a Play link that opens the kid player", async ({ page }) => {
  await openStudio(page);
  const links = studioNav(page).getByRole("link");
  await expect(links.last()).toHaveAccessibleName("Play");
  const play = studioNav(page).getByRole("link", { name: "Play", exact: true });
  await expect(play).toHaveAttribute("href", "/play");
  await expect(play).not.toHaveAttribute("aria-current", /.*/);

  await play.click();
  await expect(page).toHaveURL(/\/play$/);
});

test("for admins Play comes after Invites", async ({ page }) => {
  await openStudio(page, true);
  await expect(studioNav(page).getByRole("link")).toHaveText(["Songs", "New song", "Children", "Catalog", "Invites", "Play"]);
});

test("Play stays visible at 375 px while the text links scroll", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openStudio(page, true);
  const play = studioNav(page).getByRole("link", { name: "Play", exact: true });
  await expect(play).toBeInViewport({ ratio: 1 });
  const box = (await play.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(375);
});
