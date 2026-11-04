// Background sounds: static files made once by the team (CLAUDE.md "Sounds"), the same for everyone.
// They are public assets under /sounds/, never served by the API. Only list sounds whose files exist.

type SoundBase = { slug: string; title: string; src: string; cover: string };

export type Sound =
  /** A seamless soundscape that loops until stopped (or the 15-min auto-stop). */
  | (SoundBase & {
      kind: "loop";
      /** Optional loop points, as sample indices at SOUND_SAMPLE_RATE. Unset = loop the whole decoded file. */
      loopStartSample?: number;
      loopEndSample?: number;
    })
  /** A 90 s one-shot POV scene that plays once and ends on its own built-in fade-out. */
  | (SoundBase & { kind: "story" });

/** The rate the soundscape MP3s are encoded at; converts the manifest's sample indices into seconds. */
export const SOUND_SAMPLE_RATE = 44_100;

/**
 * Each loop file is 92.000 s: the 90 s loop with 1 s of circular padding on either side, so playback starts at
 * loopStart and wraps at loopEnd without ever hitting the MP3 encoder's edge samples.
 */
const LOOP_WINDOW = { loopStartSample: 44_100, loopEndSample: 4_013_100 };

// `v` = short hash of each file, so a replaced file gets a new URL and the cache-first SW cache never serves
// a stale copy (same idea as the API's media `v`).
const files = (slug: string, mp3: string, webp: string) => ({
  src: `/sounds/${slug}.mp3?v=${mp3}`,
  cover: `/sounds/${slug}.webp?v=${webp}`,
});

const story = (slug: string, title: string, mp3: string, webp: string): Sound => ({
  kind: "story",
  slug,
  title,
  ...files(slug, mp3, webp),
});

const loop = (slug: string, title: string, mp3: string, webp: string): Sound => ({
  kind: "loop",
  slug,
  title,
  ...files(slug, mp3, webp),
  ...LOOP_WINDOW,
});

/** Stories first, then loops. */
export const SOUNDS: Sound[] = [
  story("cars", "Race Car", "5354d7dd", "83e658db"),
  story("farm", "Farm Dog", "874d2d49", "ecfda901"),
  story("train", "Train Driver", "77083a4c", "2953972a"),
  story("construction", "Building Site", "1d9d5957", "c8c14ff0"),
  story("rocket", "Rocket Ride", "91075ad0", "32d846a1"),
  loop("ocean", "Ocean Waves", "70ac4991", "11196ecd"),
  loop("jungle", "Jungle", "5c40511e", "0b47136c"),
  loop("rain", "Rainstorm", "525a5637", "3beab5a2"),
];
