import { cacheLife } from "next/cache";
import { createSerwistRoute } from "@serwist/turbopack";

// Serves the service worker (/serwist/sw.js) bundled by esbuild from src/app/sw.ts.
// Precache = Next's static build assets (auto) + the app shell pages below.
// A fresh revision per build invalidates the precached HTML on deploy.
const revision = process.env.VERCEL_GIT_COMMIT_SHA ?? crypto.randomUUID();

// Fail the build rather than ship a worker that matches the wrong API origin.
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
if (!apiUrl) throw new Error("NEXT_PUBLIC_API_URL must be set (it is inlined into the service worker)");

const serwist = createSerwistRoute({
  swSrc: "src/app/sw.ts",
  additionalPrecacheEntries: ["/", "/play", "/~offline"].map((url) => ({ url, revision })),
  // Native esbuild everywhere (Serwist only defaults to it on Windows; Vercel is Linux).
  useNativeEsbuild: true,
  // The worker matches API requests by origin; the API URL is public, so inlining it is safe.
  esbuildOptions: {
    define: { "process.env.NEXT_PUBLIC_API_URL": JSON.stringify(apiUrl) },
  },
});

export const { generateStaticParams } = serwist;

// Serwist's handler bundles with esbuild + reads the build dir, which Cache Components
// treats as uncached I/O and would defer to request time (where the esbuild devDependency
// isn't deployed). `use cache` + cacheLife("max") replaces its `force-static` export so the
// files are prerendered at build time.
async function getSerwistFile(path: string) {
  "use cache";
  cacheLife("max");
  const res = await serwist.GET(new Request("http://localhost"), { params: Promise.resolve({ path }) });
  return { body: await res.text(), headers: Object.fromEntries(res.headers) };
}

export async function GET(_request: Request, { params }: RouteContext<"/serwist/[path]">) {
  const { path } = await params;
  // Only the prerendered outputs; anything else would trigger a runtime esbuild bundle.
  if (path !== "sw.js" && path !== "sw.js.map") return new Response("Not found", { status: 404 });
  const { body, headers } = await getSerwistFile(path);
  return new Response(body, { headers });
}
