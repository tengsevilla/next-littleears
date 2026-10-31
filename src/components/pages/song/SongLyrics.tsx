export function SongLyrics({ lyrics }: { lyrics: string[] }) {
  return (
    <div aria-label="Lyrics" role="group" className="flex flex-col gap-0.5 text-[0.95rem] leading-relaxed">
      {lyrics.map((line, i) =>
        line.trim() === "" ? <span key={i} aria-hidden className="h-3" /> : <p key={i}>{line}</p>,
      )}
    </div>
  );
}
