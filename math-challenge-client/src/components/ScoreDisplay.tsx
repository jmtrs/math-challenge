interface ScoreDisplayProps {
  scores: { teamA: number; teamB: number };
  currentTeam: "Team A" | "Team B" | null;
}

export function ScoreDisplay({ scores, currentTeam }: ScoreDisplayProps) {
  return (
    <div className="z-10 mt-6 flex gap-8 items-center mb-8">
      <div
        className={`
          flex flex-col items-center justify-center
          w-24 h-24 p-2 rounded-lg
          bg-muted/30 backdrop-blur border border-white/10
          ${currentTeam === "Team A" ? "ring-2 ring-primary/60" : ""}
        `}
      >
        <span className="text-xs text-muted-foreground">Team A</span>
        <span className="text-2xl font-bold mt-1">{scores.teamA}</span>
      </div>

      <div
        className={`
          flex flex-col items-center justify-center
          w-24 h-24 p-2 rounded-lg
          bg-muted/30 backdrop-blur border border-white/10
          ${currentTeam === "Team B" ? "ring-2 ring-primary/60" : ""}
        `}
      >
        <span className="text-xs text-muted-foreground">Team B</span>
        <span className="text-2xl font-bold mt-1">{scores.teamB}</span>
      </div>
    </div>
  );
}
