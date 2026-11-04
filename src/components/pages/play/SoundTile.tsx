"use client";

import { useState } from "react";
import {
  AudioWaveform,
  CarFront,
  CloudRain,
  Construction,
  PawPrint,
  Rocket,
  TrainFront,
  TreePalm,
  Waves,
  type LucideIcon,
} from "lucide-react";
import type { Sound } from "@/lib/sounds";
import { CoverTile, TilePlaceholder } from "./CoverTile";

const SOUND_ICON: Record<string, LucideIcon> = {
  construction: Construction,
  farm: PawPrint,
  cars: CarFront,
  rocket: Rocket,
  train: TrainFront,
  ocean: Waves,
  jungle: TreePalm,
  rain: CloudRain,
};

/** A soundscape tile. Until the cover arrives (or if it 404s) it is a coloured tile with a big icon. */
export function SoundTile({
  sound,
  index,
  active,
  night,
  onToggle,
}: {
  sound: Sound;
  index: number;
  active: boolean;
  night: boolean;
  onToggle: (sound: Sound) => void;
}) {
  const [coverFailed, setCoverFailed] = useState(false);

  return (
    <CoverTile label={sound.title} active={active} night={night} badgeIcon={AudioWaveform} onClick={() => onToggle(sound)}>
      <TilePlaceholder icon={SOUND_ICON[sound.slug] ?? AudioWaveform} index={index} />
      {!coverFailed && (
        // Served as-is from /sounds/ (not through the image optimizer) so the service worker's
        // cache-first /sounds/* route keeps it available offline.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={sound.cover}
          alt=""
          draggable={false}
          onError={() => setCoverFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </CoverTile>
  );
}
