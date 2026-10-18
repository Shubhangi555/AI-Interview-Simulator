/** Live mic level as a row of bars; purely visual, hidden from screen readers. */
export function LevelMeter({ level, active }: { level: number; active: boolean }) {
  const bars = 24;
  return (
    <div className={`meter ${active ? 'live' : ''}`} aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => {
        // Taller in the centre, scaled by level
        const shape = 1 - Math.abs(i - bars / 2) / (bars / 2);
        const h = active ? Math.max(0.08, level * (0.35 + shape * 0.65)) : 0.08;
        return <span key={i} style={{ transform: `scaleY(${h})` }} />;
      })}
    </div>
  );
}
