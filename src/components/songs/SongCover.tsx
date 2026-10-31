"use client";

import { Music } from "lucide-react";
import { useMediaObjectUrl } from "@/hooks/api/useMediaObjectUrl";
import { cn } from "@/lib/utils";

/** Cover art via the authenticated media hook; a soft placeholder while there is no image (or it fails). */
export function SongCover({ imageUrl, alt, className }: { imageUrl: string | null; alt: string; className?: string }) {
  const { objectUrl, isLoading } = useMediaObjectUrl(imageUrl);

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-sunshine/30 text-amber-900/60",
        isLoading && "animate-pulse",
        className,
      )}
    >
      {objectUrl ? (
        // A blob: URL from the media hook — next/image can't optimize it, so a plain <img> is correct here.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={objectUrl} alt={alt} className="size-full object-cover" />
      ) : (
        <Music aria-hidden className="size-1/3" />
      )}
    </div>
  );
}
