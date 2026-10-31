import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LittleEars",
    short_name: "LittleEars",
    description: "Little songs, made for little ears — and approved by grown-ups.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#fff4de",
    theme_color: "#e85d3f",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
