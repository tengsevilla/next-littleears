import type { Page, Route } from "@playwright/test";

// A route-mocked backend for the studio specs: every request to the API origin is recorded and answered
// from a handler map, so nothing reaches the real API (real generation costs money).
export const API = "http://localhost:3001";
const ORIGIN = "http://localhost:3000";
export const TOKEN = "test-token";

const CORS = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Expose-Headers": "Content-Range, Accept-Ranges, Content-Length",
};

// 1×1 PNG and a few bytes of MP3 frame header: enough for a Blob, the browser never has to decode them.
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
export const MP3 = Buffer.from("SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA", "base64");

/**
 * A real, decodable silent WAV, for specs that need the <audio> element to actually play (the MP3 above is
 * only a header). Long by default so it never ends on its own; specs fire `ended` themselves.
 */
export function silentWav(seconds = 60, sampleRate = 8000): Buffer {
  const samples = seconds * sampleRate;
  const buf = Buffer.alloc(44 + samples, 0x80); // 8-bit PCM silence is 0x80
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + samples, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16); // fmt chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate, 28); // byte rate
  buf.writeUInt16LE(1, 32); // block align
  buf.writeUInt16LE(8, 34); // bits per sample
  buf.write("data", 36);
  buf.writeUInt32LE(samples, 40);
  return buf;
}

export type Reply =
  | { status?: number; data?: unknown; meta?: Record<string, unknown>; error?: { code: string; message: string } }
  | { status?: number; file: Buffer; contentType: string };
export type Handler = (req: { url: URL; body: unknown }) => Reply;
export type Call = { method: string; path: string; authorization: string | undefined; body: unknown };

export const PARENT = { id: "u1", email: "parent@example.com", role: "parent" };
export const ADMIN = { id: "u0", email: "admin@example.com", role: "admin" };
/** Signs the mocked session in as the admin (pass into mockBackend's handlers). */
export const asAdmin = () => ({ "POST /api/auth/refresh": ok({ accessToken: TOKEN, user: ADMIN }) });

export const ok = (data: unknown): Reply => ({ data });
export const fail = (status: number, code: string, message = code): Reply => ({ status, error: { code, message } });

function fulfill(route: Route, reply: Reply) {
  if ("file" in reply) {
    return route.fulfill({
      status: reply.status ?? 200,
      headers: { ...CORS, "Content-Type": reply.contentType, "Cache-Control": "private, max-age=31536000, immutable" },
      body: reply.file,
    });
  }
  const failed = "error" in reply && reply.error;
  const meta = ("meta" in reply && reply.meta) || {};
  return route.fulfill({
    status: reply.status ?? 200,
    headers: CORS,
    contentType: "application/json",
    body: JSON.stringify(failed ? { data: null, error: reply.error, meta: {} } : { data: reply.data ?? null, error: null, meta }),
  });
}

/**
 * Handlers are keyed "METHOD /path" (no query string). The refresh endpoint is pre-wired to a signed-in parent.
 * Unknown routes answer 404 so a missing mock fails loudly instead of hanging.
 */
export async function mockBackend(page: Page, handlers: Record<string, Handler | Reply>) {
  const calls: Call[] = [];
  const all: Record<string, Handler | Reply> = {
    "POST /api/auth/refresh": ok({ accessToken: TOKEN, user: PARENT }),
    "GET /api/children": ok([]),
    ...handlers,
  };
  await page.route(`${API}/**`, (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const url = new URL(req.url());
    const body = req.postData() ? (JSON.parse(req.postData() as string) as unknown) : undefined;
    calls.push({ method: req.method(), path: url.pathname + url.search, authorization: req.headers().authorization, body });
    const handler = all[`${req.method()} ${url.pathname}`];
    if (!handler) return fulfill(route, fail(404, "NOT_FOUND", `No mock for ${req.method()} ${url.pathname}`));
    return fulfill(route, typeof handler === "function" ? handler({ url, body }) : handler);
  });
  return {
    calls,
    count: (method: string, path: string | RegExp) =>
      calls.filter((c) => c.method === method && (typeof path === "string" ? c.path === path : path.test(c.path))).length,
    /** Replace or add a handler after the page has loaded. */
    set: (key: string, handler: Handler | Reply) => {
      all[key] = handler;
    },
  };
}

export const ZOE = { id: "c1", displayName: "Zoë", phoneticName: "Zoh-ee", ageBand: "3-5", createdAt: "2026-10-01T00:00:00Z" };
export const MILO = { id: "c2", displayName: "Milo", phoneticName: null, ageBand: "1-2", createdAt: "2026-10-02T00:00:00Z" };

export function song(overrides: Record<string, unknown> = {}) {
  return {
    id: "s1",
    childId: null,
    topic: "brushing teeth",
    mood: "playful",
    ageBand: "3-5",
    lengthSec: 90,
    status: "pending_review",
    title: "Sparkly Teeth",
    lyrics: ["Brush brush brush", "Sparkly teeth all day"],
    safety: { pass: true, reasons: [] },
    audioUrl: null,
    imageUrl: null,
    durationMs: null,
    error: null,
    createdAt: "2026-10-28T10:00:00Z",
    approvedAt: null,
    shared: false,
    ...overrides,
  };
}

export function summary(overrides: Record<string, unknown> = {}) {
  const { id, childId, topic, mood, status, title, imageUrl, createdAt } = song(overrides);
  return { id, childId, topic, mood, status, title, imageUrl, createdAt };
}
