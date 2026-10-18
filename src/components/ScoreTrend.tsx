import { useEffect, useRef, useState } from 'react';
import type { HistoryEntry } from '../state/history';

const H = 200;
const PAD = { top: 18, right: 40, bottom: 30, left: 34 };
const GRID = [0, 50, 100];

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/**
 * Overall score over time (single series, so no legend: the heading names it).
 * Hover / focus a point for details; click it to open that report.
 */
export function ScoreTrend({ entries, onOpen }: { entries: HistoryEntry[]; onOpen: (id: string) => void }) {
  const [active, setActive] = useState<number | null>(null);
  // Draw at the real pixel width so text stays legible on phones (a scaled viewBox shrinks it)
  const plotRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  const visible = entries.length >= 2;
  useEffect(() => {
    const el = plotRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [visible]); // the plot element only exists once there are 2+ points
  if (!visible) return null;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (entries.length === 1 ? innerW / 2 : (i / (entries.length - 1)) * innerW);
  const y = (score: number) => PAD.top + innerH - (score / 100) * innerH;
  const points = entries.map((e, i) => ({ e, cx: x(i), cy: y(e.report.overallScore) }));
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  const hovered = active !== null ? points[active] : null;

  return (
    <figure className="trend">
      <figcaption>
        <h2>Overall score over time</h2>
        <span className="hint">Last {entries.length} interviews · click a point to open it</span>
      </figcaption>
      <div className="trend-plot" ref={plotRef} onMouseLeave={() => setActive(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Overall scores for ${entries.length} interviews, latest ${Math.round(last.e.report.overallScore)}`}>
          {GRID.map((g) => (
            <g key={g}>
              <line className="trend-grid" x1={PAD.left} x2={W - PAD.right} y1={y(g)} y2={y(g)} />
              <text className="trend-axis" x={PAD.left - 8} y={y(g)} dy="0.32em" textAnchor="end">{g}</text>
            </g>
          ))}
          <text className="trend-axis" x={points[0].cx} y={H - 8} textAnchor="start">{shortDate(entries[0].completedAt)}</text>
          <text className="trend-axis" x={last.cx} y={H - 8} textAnchor="end">{shortDate(last.e.completedAt)}</text>

          {hovered && <line className="trend-cross" x1={hovered.cx} x2={hovered.cx} y1={PAD.top} y2={PAD.top + innerH} />}
          <path className="trend-line" d={path} />
          {points.map((p, i) => (
            <circle key={p.e.id} className={`trend-dot ${active === i ? 'on' : ''}`} cx={p.cx} cy={p.cy} r={active === i ? 5.5 : 4} />
          ))}
          {/* Selective direct label: latest value only */}
          <text className="trend-label" x={last.cx + 10} y={last.cy} dy="0.32em">{Math.round(last.e.report.overallScore)}</text>

          {/* Hit targets, larger than the marks; keyboard-focusable */}
          {points.map((p, i) => (
            <circle
              key={`hit-${p.e.id}`}
              className="trend-hit"
              cx={p.cx}
              cy={p.cy}
              r={16}
              tabIndex={0}
              role="button"
              aria-label={`${shortDate(p.e.completedAt)}: ${p.e.config.role}, score ${Math.round(p.e.report.overallScore)}. Open report.`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              onClick={() => onOpen(p.e.id)}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                  ev.preventDefault();
                  onOpen(p.e.id);
                }
              }}
            />
          ))}
        </svg>
        {hovered && (
          <div
            className="trend-tip"
            role="status"
            style={{
              left: `${(hovered.cx / W) * 100}%`,
              top: `${(hovered.cy / H) * 100}%`,
              transform: `translate(${hovered.cx > W * 0.7 ? 'calc(-100% - 12px)' : '12px'}, -50%)`,
            }}
          >
            <strong>{Math.round(hovered.e.report.overallScore)}</strong>
            <span>
              {hovered.e.config.role} · {hovered.e.config.seniority}
            </span>
            <span className="hint">{shortDate(hovered.e.completedAt)}</span>
          </div>
        )}
      </div>
    </figure>
  );
}
