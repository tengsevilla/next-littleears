import { expect, test } from "@playwright/test";

test("landing page loads and links to the player and studio", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("LittleEars");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("LittleEars");
  await expect(page.getByRole("link", { name: "Let's play!" })).toHaveAttribute("href", "/play");
  await expect(page.getByRole("link", { name: "Grown-ups: make a song" })).toHaveAttribute("href", "/studio");
});
