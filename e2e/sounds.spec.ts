import { expect, test, type Page } from "@playwright/test";
import { SOUNDS } from "../src/lib/sounds";
import { mockBackend, ok, PNG, silentWav } from "./support/backend";

// Same reason as play.spec: a service worker would answer /sounds/* from its cache behind page.route's back.
test.use({ serviceWorkers: "block" });
// Each test boots /play cold on the dev server and runs real Web Audio; give them room under parallel load.
test.beforeEach(() => test.slow());

// 1 s: short enough that a story's 10 passes end during the test. `wavSeconds` serves a longer one.
const WAV = silentWav(1);

type Recorded = {
  loop: boolean;
  loopStart: number;
  loopEnd: number;
  duration: number;
  starts: number;
  /** Every stop() call: the scheduled end-of-plays one at start, then any tap/replace/unmount stop. */
  stops: number;
  /** When each stop() takes effect, in seconds after the source started. */
  stopAfter: number[];
  /** setValueAtTime calls on its gain, in seconds after the source started. */
  sets: { to: number; after: number }[];
  ramps: { to: number; over: number }[];
};

/**
 * Wraps the real AudioContext so playback really happens (the WAV fixture is decoded), while every buffer
 * source and the gain automation feeding it are recorded on window.__sound for the assertions.
 */
async function spyOnWebAudio(page: Page) {
  await page.addInitScript(() => {
    type Rec = {
      node: AudioBufferSourceNode;
      starts: number;
      startAt: number;
      stopAts: number[];
      sets: { to: number; time: number }[];
      ramps: { to: number; over: number }[];
    };
    const state = { sources: [] as Rec[] };
    (window as unknown as { __sound: typeof state }).__sound = state;
    const Real = window.AudioContext;
    window.AudioContext = class extends Real {
      createBufferSource() {
        const node = super.createBufferSource();
        const rec: Rec = { node, starts: 0, startAt: 0, stopAts: [], sets: [], ramps: [] };
        const start = node.start.bind(node);
        const stop = node.stop.bind(node);
        node.start = (...args: Parameters<AudioBufferSourceNode["start"]>) => {
          rec.starts++;
          rec.startAt = args[0] ?? this.currentTime;
          start(...args);
        };
        node.stop = (...args: Parameters<AudioBufferSourceNode["stop"]>) => {
          rec.stopAts.push(args[0] ?? this.currentTime);
          stop(...args);
        };
        state.sources.push(rec);
        return node;
      }
      createGain() {
        const gain = super.createGain();
        // The gain node is created right after its source; tie its automation to that source's record.
        const rec = state.sources[state.sources.length - 1];
        const ramp = gain.gain.linearRampToValueAtTime.bind(gain.gain);
        const set = gain.gain.setValueAtTime.bind(gain.gain);
        gain.gain.linearRampToValueAtTime = (value: number, time: number) => {
          rec?.ramps.push({ to: value, over: Math.round((time - this.currentTime) * 10) / 10 });
          return ramp(value, time);
        };
        gain.gain.setValueAtTime = (value: number, time: number) => {
          rec?.sets.push({ to: value, time });
          return set(value, time);
        };
        return gain;
      }
    };
  });
}

const sources = (page: Page): Promise<Recorded[]> =>
  page.evaluate(() => {
    type Rec = {
      node: AudioBufferSourceNode;
      starts: number;
      startAt: number;
      stopAts: number[];
      sets: { to: number; time: number }[];
      ramps: { to: number; over: number }[];
    };
    const round = (n: number) => Math.round(n * 10) / 10;
    return (window as unknown as { __sound: { sources: Rec[] } }).__sound.sources.map((r) => ({
      loop: r.node.loop,
      loopStart: r.node.loopStart,
      loopEnd: r.node.loopEnd,
      duration: r.node.buffer?.duration ?? 0,
      starts: r.starts,
      stops: r.stopAts.length,
      stopAfter: r.stopAts.map((t) => round(t - r.startAt)),
      sets: r.sets.map((e) => ({ to: e.to, after: round(e.time - r.startAt) })),
      ramps: r.ramps,
    }));
  });

async function setUp(
  page: Page,
  opts: { view?: "songs" | "sounds"; clock?: boolean; missingCover?: string; wavSeconds?: number } = {},
) {
  await spyOnWebAudio(page);
  // Covers are mocked too, so the spec tests the tile, not the asset files; `missingCover` answers 404.
  await page.route(/\/sounds\/[a-z]+\.webp(\?|$)/, (route) =>
    new URL(route.request().url()).pathname === `/sounds/${opts.missingCover}.webp`
      ? route.fulfill({ status: 404 })
      : route.fulfill({ status: 200, contentType: "image/png", body: PNG }),
  );
  if (opts.clock) await page.clock.install();
  await page.addInitScript((view) => {
    window.localStorage.setItem("littleears.player", JSON.stringify({ childId: null, displayName: "Everyone" }));
    if (view) window.localStorage.setItem("littleears.player.view", view);
  }, opts.view ?? null);
  const wav = opts.wavSeconds === undefined ? WAV : silentWav(opts.wavSeconds);
  const soundRequests: string[] = [];
  // The URLs carry ?v=<hash>, which a glob would not match; the regex allows any query.
  await page.route(/\/sounds\/[a-z]+\.mp3(\?|$)/, (route) => {
    const url = new URL(route.request().url());
    soundRequests.push(url.pathname + url.search);
    return route.fulfill({ status: 200, contentType: "audio/mpeg", body: wav });
  });
  const api = await mockBackend(page, {
    "GET /api/library": ok([
      {
        id: "s1",
        childId: null,
        title: "Song 1",
        mood: "playful",
        audioUrl: "/api/media/s1/audio?v=a1",
        imageUrl: "/api/media/s1/image?v=i1",
        durationMs: 60_000,
      },
    ]),
    "GET /api/media/s1/audio": { file: silentWav(), contentType: "audio/wav" },
    "GET /api/media/s1/image": { file: PNG, contentType: "image/png" },
    "GET /api/songs": ok([]),
  });
  await page.goto("/play");
  return { api, soundRequests };
}

const soundsGrid = (page: Page) => page.getByRole("region", { name: "Sounds" });
const soundTile = (page: Page, name: string) => soundsGrid(page).getByRole("button", { name, exact: true });
const audioPaused = (page: Page) => page.locator("audio").evaluate((el: HTMLAudioElement) => el.paused);
const playbackState = (page: Page) => page.evaluate(() => navigator.mediaSession.playbackState);

test("the Sounds toggle shows one tile per manifest sound, stories first, and is remembered", async ({ page }) => {
  await setUp(page, { missingCover: "cars" });
  const songsToggle = page.getByRole("button", { name: "Songs", exact: true });
  const soundsToggle = page.getByRole("button", { name: "Sounds", exact: true });
  await expect(songsToggle).toHaveAttribute("aria-pressed", "true");
  for (const toggle of [songsToggle, soundsToggle]) {
    const box = await toggle.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(96);
    expect(box!.height).toBeGreaterThanOrEqual(96);
  }

  await soundsToggle.click();
  await expect(soundsToggle).toHaveAttribute("aria-pressed", "true");
  expect(SOUNDS).toHaveLength(8);
  const tiles = soundsGrid(page).getByRole("button");
  await expect(tiles).toHaveCount(SOUNDS.length);
  const names = ["Race Car", "Farm Dog", "Train Driver", "Building Site", "Rocket Ride", "Ocean Waves", "Jungle", "Rainstorm"];
  for (const [i, name] of names.entries()) await expect(tiles.nth(i)).toHaveAccessibleName(name);
  // Covers load from their versioned URLs; a missing one falls back to its coloured icon tile.
  const covers = soundsGrid(page).locator("img");
  await expect(covers).toHaveCount(SOUNDS.length - 1);
  await expect(soundTile(page, "Race Car").locator("img")).toHaveCount(0);
  await expect(soundTile(page, "Jungle").locator("img")).toHaveAttribute("src", "/sounds/jungle.webp?v=0b47136c");
  for (const img of await covers.all()) await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole("region", { name: "Songs" })).toHaveCount(0);

  await page.reload();
  await expect(soundsGrid(page).getByRole("button")).toHaveCount(SOUNDS.length);
  expect(await page.evaluate(() => window.localStorage.getItem("littleears.player.view"))).toBe("sounds");
});

test("a loop repeats its window gaplessly and ends after 10 passes with a 10 s fade; a tap fades it out", async ({ page }) => {
  // A 92 s fixture, like the real files, so the manifest's loop window fits inside it.
  const { soundRequests } = await setUp(page, { view: "sounds", wavSeconds: 92 });
  const ocean = soundTile(page, "Ocean Waves");

  await ocean.click();
  await expect(ocean).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await sources(page))[0]?.starts).toBe(1);
  let [src] = await sources(page);
  expect(src.loop).toBe(true);
  // The manifest's 44100 / 4013100 samples at 44.1 kHz: the 90 s loop inside 1 s of padding.
  expect(src.loopStart).toBe(1);
  expect(src.loopEnd).toBe(91);
  expect(src.ramps[0]).toEqual({ to: 1, over: 1 });
  // 10 passes of the 90 s window, the last 10 s fading to silence.
  expect(src.stopAfter).toEqual([900]);
  expect(src.sets).toContainEqual({ to: 1, after: 890 });
  expect(src.ramps[1]).toEqual({ to: 0, over: 900 });
  expect(soundRequests).toEqual(["/sounds/ocean.mp3?v=70ac4991"]);

  // A tap mid-repeat replaces the scheduled end with the 1 s fade.
  await ocean.click();
  await expect(ocean).toHaveAttribute("aria-pressed", "false");
  [src] = await sources(page);
  expect(src.stops).toBe(2);
  expect(src.ramps.at(-1)).toEqual({ to: 0, over: 1 });

  // The decoded buffer is kept: playing it again does not refetch.
  await ocean.click();
  await expect.poll(async () => (await sources(page)).length).toBe(2);
  expect(soundRequests).toEqual(["/sounds/ocean.mp3?v=70ac4991"]);

  // Another sound replaces it: only one plays.
  await soundTile(page, "Rainstorm").click();
  await expect(soundTile(page, "Rainstorm")).toHaveAttribute("aria-pressed", "true");
  await expect(ocean).toHaveAttribute("aria-pressed", "false");
  await expect.poll(async () => (await sources(page))[1].stops).toBe(2);
});

test("a story repeats whole, is scheduled to end after 10 passes, and a tap mid-repeat fades it out", async ({ page }) => {
  const { soundRequests } = await setUp(page, { view: "sounds", wavSeconds: 60 });
  const cars = soundTile(page, "Race Car");

  await cars.click();
  await expect(cars).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await sources(page))[0]?.starts).toBe(1);
  let [src] = await sources(page);
  expect(src.loop).toBe(true);
  expect(src.loopStart).toBe(0);
  expect(src.loopEnd).toBe(src.duration);
  expect(src.stopAfter).toEqual([10 * src.duration]);
  // Only the 1 s fade-in: the file's own fade makes the end soft.
  expect(src.ramps).toEqual([{ to: 1, over: 1 }]);
  expect(soundRequests).toEqual([SOUNDS.find((s) => s.slug === "cars")!.src]);
  await expect.poll(() => playbackState(page)).toBe("playing");

  await cars.click();
  await expect(cars).toHaveAttribute("aria-pressed", "false");
  [src] = await sources(page);
  expect(src.stops).toBe(2);
  expect(src.ramps.at(-1)).toEqual({ to: 0, over: 1 });
  await expect.poll(() => playbackState(page)).toBe("paused");

  // A loop replaces a story like any other sound.
  await cars.click();
  await expect.poll(async () => (await sources(page))[1]?.starts).toBe(1);
  await soundTile(page, "Jungle").click();
  await expect(soundTile(page, "Jungle")).toHaveAttribute("aria-pressed", "true");
  await expect(cars).toHaveAttribute("aria-pressed", "false");
  await expect.poll(async () => (await sources(page))[1].stops).toBe(2);
});

test("a short story plays its 10 passes, ends by itself and goes idle", async ({ page }) => {
  await setUp(page, { view: "sounds" });
  const cars = soundTile(page, "Race Car");

  await cars.click();
  await expect.poll(async () => (await sources(page))[0]?.starts).toBe(1);
  const startedAt = Date.now();
  expect((await sources(page))[0].stopAfter).toEqual([10]);
  // Still repeating after the first pass of the 1 s fixture…
  await page.waitForTimeout(3000);
  await expect(cars).toHaveAttribute("aria-pressed", "true");
  // …then idle by itself after the 10th: tile and lock screen, with no further stop or fade.
  await expect(cars).toHaveAttribute("aria-pressed", "false", { timeout: 20_000 });
  expect(Date.now() - startedAt).toBeGreaterThanOrEqual(9_000);
  await expect.poll(() => playbackState(page)).toBe("paused");
  const [src] = await sources(page);
  expect(src.stops).toBe(1);
  expect(src.ramps).toEqual([{ to: 1, over: 1 }]);

  // It can be played again.
  await cars.click();
  await expect.poll(async () => (await sources(page))[1]?.starts).toBe(1);
});

test("no timer stops a sound: a loop still plays 20 minutes of wall-clock later", async ({ page }) => {
  // page.clock moves timers, not the audio clock: the only end is the one scheduled on the source.
  await setUp(page, { view: "sounds", clock: true, wavSeconds: 92 });
  const jungle = soundTile(page, "Jungle");
  await jungle.click();
  await expect.poll(async () => (await sources(page))[0]?.starts).toBe(1);

  await page.clock.fastForward("20:00");
  await expect(jungle).toHaveAttribute("aria-pressed", "true");
  expect((await sources(page))[0].stops).toBe(1);
});

test("starting a song stops the sound, and starting a sound pauses the song", async ({ page }) => {
  await setUp(page, { view: "sounds", wavSeconds: 92 });
  await soundTile(page, "Ocean Waves").click();
  await expect.poll(async () => (await sources(page))[0]?.starts).toBe(1);

  await page.getByRole("button", { name: "Songs", exact: true }).click();
  await page.getByRole("button", { name: "Song 1", exact: true }).click();
  await expect(page.getByRole("button", { name: "Song 1", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await sources(page))[0].stops).toBe(2);

  await page.getByRole("button", { name: "Sounds", exact: true }).click();
  await expect(soundTile(page, "Ocean Waves")).toHaveAttribute("aria-pressed", "false");
  await soundTile(page, "Jungle").click();
  await expect(soundTile(page, "Jungle")).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => audioPaused(page)).toBe(true);
});

test("Back to studio stops the sound", async ({ page }) => {
  await setUp(page, { view: "sounds", wavSeconds: 92 });
  await soundTile(page, "Rainstorm").click();
  await expect.poll(async () => (await sources(page))[0]?.starts).toBe(1);

  await page.getByRole("button", { name: "Grown-ups: press and hold for 3 seconds" }).hover();
  await page.mouse.down();
  await page.waitForTimeout(3300);
  await page.mouse.up();
  await page.getByRole("dialog", { name: "Grown-ups" }).getByRole("link", { name: "Back to studio" }).click();
  await expect(page).toHaveURL(/\/studio$/);
  await expect.poll(async () => (await sources(page))[0].stops).toBe(2);
});

