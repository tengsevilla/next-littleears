import { expect, test } from "@playwright/test";
import { isLibraryUrl, isMediaUrl, isSoundUrl } from "../src/lib/offline";

// Unit check of the service worker's route matchers (no browser needed): the API is cross-origin,
// so only the API origin's /api/media/* and /api/library may ever hit the runtime caches.
const API = "http://localhost:3001";
const url = (u: string) => new URL(u);

test("media matcher: API origin + /api/media/* only", () => {
  expect(isMediaUrl(url(`${API}/api/media/s1/audio?v=abc`), API)).toBe(true);
  expect(isMediaUrl(url(`${API}/api/media/s1/image?v=def`), API)).toBe(true);
  expect(isMediaUrl(url("http://localhost:3000/api/media/s1/audio?v=abc"), API)).toBe(false);
  expect(isMediaUrl(url("https://evil.example.com/api/media/s1/audio"), API)).toBe(false);
  expect(isMediaUrl(url(`${API}/api/songs/s1`), API)).toBe(false);
});

test("library matcher: exact /api/library path on the API origin, any childId", () => {
  expect(isLibraryUrl(url(`${API}/api/library`), API)).toBe(true);
  expect(isLibraryUrl(url(`${API}/api/library?childId=c1`), API)).toBe(true);
  expect(isLibraryUrl(url(`${API}/api/library/extra`), API)).toBe(false);
  expect(isLibraryUrl(url("http://localhost:3000/api/library"), API)).toBe(false);
  expect(isLibraryUrl(url(`${API}/api/children`), API)).toBe(false);
});

test("sounds matcher: the app's own /sounds/* only", () => {
  const APP = "http://localhost:3000";
  expect(isSoundUrl(url(`${APP}/sounds/rocket.mp3`), APP)).toBe(true);
  expect(isSoundUrl(url(`${APP}/sounds/rocket.webp`), APP)).toBe(true);
  expect(isSoundUrl(url(`${APP}/sounds/rocket.mp3?v=b19126eb`), APP)).toBe(true);
  expect(isSoundUrl(url(`${API}/sounds/rocket.mp3`), APP)).toBe(false);
  expect(isSoundUrl(url(`${APP}/play`), APP)).toBe(false);
});
