"use client";

import { useState } from "react";
import { clearPlayerChoice, readPlayerChoice, savePlayerChoice, type PlayerChoice } from "@/lib/playerChoice";
import { ChildPicker } from "./ChildPicker";
import { KidPlayer } from "./KidPlayer";

const isNightNow = () => {
  const hour = new Date().getHours();
  return hour >= 19 || hour < 7;
};

/** Mounted only on the client, after the session check, so reading storage and the clock here is hydration-safe. */
export function PlayerApp({ offline }: { offline: boolean }) {
  const [choice, setChoice] = useState<PlayerChoice | null>(readPlayerChoice);
  const [night] = useState(isNightNow);

  function pick(next: PlayerChoice) {
    savePlayerChoice(next);
    setChoice(next);
  }

  function changeChild() {
    clearPlayerChoice();
    setChoice(null);
  }

  if (!choice) return <ChildPicker offline={offline} onPick={pick} />;
  return <KidPlayer childId={choice.childId} night={night} onChangeChild={changeChild} />;
}
