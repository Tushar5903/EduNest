"use client";

import { useState } from "react";
import { Cell, Pie as PieRaw, PieChart, ResponsiveContainer, Sector as SectorRaw } from "recharts";

export const GENDER_COLORS = ["#3B82F6", "#EC4899", "#8B5CF6"];
export const ATTENDANCE_COLORS = ["#13855b", "#d64545", "#f59e0b"];

export const PERFORMANCE_TRACK_COLOR = "#eeeef8";

export function performanceColor(pct: number): string {
  if (pct >= 90) return "#15803d";
  if (pct >= 75) return "#4ade80";
  if (pct >= 60) return "#f59e0b";
  if (pct >= 40) return "#eab308";
  return "#dc2626";
}

export function performanceLabel(pct: number): string {
  if (pct >= 90) return "Excellent";
  if (pct >= 75) return "Good";
  if (pct >= 60) return "Average";
  if (pct >= 40) return "Low";
  return "Critical";
}

export type DonutItem = { name: string; value: number };

/**
 * Shared responsive pie layout — one design everywhere.
 * Desktop (sm and up): pie on the left, labels in a fixed side column.
 * Mobile: pie centered on top, labels below it — a single column for up to
 * 3 labels, two label columns when there are more than 3.
 */
export function pieLayoutClass(): string {
  return "flex flex-col items-center gap-4 @sm:flex-row @sm:items-center @sm:gap-2";
}

export function pieCanvasClass(heightClass: string): string {
  // NOTE: flex-1 only in side-by-side (row) mode. In stacked (column) mode the
  // parent height is indefinite, so flex-basis:0% would override the fixed
  // height class and collapse the canvas to zero height (invisible pie).
  return `relative min-w-0 w-full ${heightClass} @sm:flex-1`;
}

export function legendClass(count: number): string {
  return count > 3
    ? "grid w-full grid-cols-2 gap-3 @sm:flex @sm:w-[132px] @sm:shrink-0 @sm:flex-col"
    : "flex w-full flex-col gap-3 @sm:w-[132px] @sm:shrink-0";
}

const Pie = PieRaw as unknown as React.ComponentType<Record<string, unknown>>;
const Sector = SectorRaw as unknown as React.ComponentType<Record<string, unknown>>;

export function ActiveDonutShape(props: unknown) {
  const p = props as Record<string, unknown>;
  const outerRadius = Number(p.outerRadius || 0);
  return <Sector {...p} outerRadius={outerRadius + 5} stroke="#ffffff" strokeWidth={2} />;
}

export function DonutLegend({ items, colors, activeName, onHover, onSelect }: { items: DonutItem[]; colors: string[]; activeName?: string | null; onHover?: (name: string | null) => void; onSelect?: (name: string) => void }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const interactive = Boolean(onHover || onSelect);
  return (
    <div className={legendClass(items.length)}>
      {items.map((entry, index) => {
        const percent = total > 0 ? Math.round((entry.value / total) * 100) : 0;
        const isActive = activeName === entry.name;
        return (
          <span
            key={entry.name}
            role={onSelect ? "button" : undefined}
            tabIndex={onSelect ? 0 : undefined}
            title={entry.name}
            onMouseEnter={() => onHover?.(entry.name)}
            onMouseLeave={() => onHover?.(null)}
            onClick={() => onSelect?.(entry.name)}
            onKeyDown={(e) => { if (onSelect && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onSelect(entry.name); } }}
            className={`inline-flex items-center justify-between gap-2 rounded-md px-1 py-0.5 text-xs font-semibold text-[#57558b] transition-colors${interactive ? " cursor-pointer hover:bg-[#f0efff]" : ""}${isActive ? " bg-[#f0efff]" : ""}`}
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: colors[index % colors.length], display: "inline-block", flexShrink: 0 }} />
              <span className="truncate">{entry.name}</span>
            </span>
            <span className="tabular-nums text-[#272757]">{percent}%</span>
          </span>
        );
      })}
    </div>
  );
}

export function useDonutSelection(items: DonutItem[], colors: string[]) {
  const [pinned, setPinned] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const pieData = items.filter((d) => d.value > 0);
  const total = items.reduce((sum, d) => sum + d.value, 0);
  const dominant = items.reduce((max, d) => (d.value > max.value ? d : max), items[0] ?? { name: "", value: 0 });
  const activeName = hover ?? pinned;
  const activeEntry = items.find((d) => d.name === activeName && d.value > 0);
  const displayed = activeEntry ?? dominant;
  const displayedIndex = Math.max(0, items.findIndex((d) => d.name === displayed.name));
  const displayedPct = total > 0 ? Math.round((displayed.value / total) * 100) : 0;
  const displayedColor = colors[displayedIndex % colors.length] ?? colors[0];
  const activeIndex = Math.max(0, pieData.findIndex((e) => e.name === displayed.name));
  const handleEnter = (_: unknown, index: unknown) => { const i = Number(index); if (Number.isFinite(i) && pieData[i]) setHover(pieData[i].name); };
  const handleLeave = () => setHover(null);
  const handleClick = (_: unknown, index: unknown) => { const i = Number(index); if (!Number.isFinite(i) || !pieData[i]) return; const name = pieData[i].name; setPinned((prev) => (prev === name ? null : name)); };
  const toggleSelect = (name: string) => setPinned((prev) => (prev === name ? null : name));
  return { pieData, total, dominant, displayed, displayedIndex, displayedPct, displayedColor, activeIndex, pinned, hover, setPinned, setHover, handleEnter, handleLeave, handleClick, toggleSelect };
}

export function PerformanceRing({ value, heightClass = "h-64", innerRadius = 64, outerRadius = 92 }: { value: number; heightClass?: string; innerRadius?: number; outerRadius?: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const color = performanceColor(pct);
  const label = performanceLabel(pct);
  const data = [{ name: "Score", value: pct }, { name: "Remaining", value: Math.max(0, 100 - pct) }];
  return (
    <div className={pieLayoutClass()}>
      <div className={pieCanvasClass(heightClass)}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={innerRadius} outerRadius={outerRadius} paddingAngle={0} startAngle={90} endAngle={-270} stroke="none">
              <Cell fill={color} />
              <Cell fill={PERFORMANCE_TRACK_COLOR} />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-semibold text-[#57558b]">{label}</span>
          <span className="font-display text-3xl font-bold tabular-nums" style={{ color }}>{pct}%</span>
        </div>
      </div>
      {/* Grade scale legend: desktop side column only — hidden on narrow
          containers where the ring + center label stand alone. */}
      <div className="hidden gap-3 @sm:flex @sm:w-[132px] @sm:shrink-0 @sm:flex-col">
        {[
          { name: "Excellent ≥90", swatch: "#15803d" },
          { name: "Good 75–89", swatch: "#4ade80" },
          { name: "Average 60–74", swatch: "#f59e0b" },
          { name: "Low 40–59", swatch: "#eab308" },
          { name: "Critical <40", swatch: "#dc2626" },
        ].map((b) => (
          <span key={b.name} className={`inline-flex items-center justify-between gap-2 rounded-md px-1 py-0.5 text-xs font-semibold text-[#57558b]${b.swatch === color ? " bg-[#f0efff]" : ""}`}>
            <span className="inline-flex min-w-0 items-center gap-2">
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: b.swatch, display: "inline-block", flexShrink: 0 }} />
              <span className="truncate">{b.name}</span>
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function DonutChart({ items, colors, heightClass = "h-64", innerRadius = 64, outerRadius = 92 }: { items: DonutItem[]; colors: string[]; heightClass?: string; innerRadius?: number; outerRadius?: number }) {
  const sel = useDonutSelection(items, colors);
  if (sel.total === 0) return null;
  return (
    <div className={pieLayoutClass()}>
      <div className={pieCanvasClass(heightClass)}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={sel.pieData} dataKey="value" nameKey="name" innerRadius={innerRadius} outerRadius={outerRadius} paddingAngle={4} labelLine={false} activeIndex={sel.activeIndex} activeShape={ActiveDonutShape} onMouseEnter={sel.handleEnter} onMouseLeave={sel.handleLeave} onClick={sel.handleClick} style={{ cursor: "pointer" }}>
              {sel.pieData.map((entry) => { const fi = items.findIndex((d) => d.name === entry.name); return <Cell key={entry.name} fill={colors[fi >= 0 ? fi : 0]} style={{ cursor: "pointer" }} />; })}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-semibold text-[#57558b]">{sel.displayed.name}</span>
          <span className="font-display text-3xl font-bold tabular-nums" style={{ color: sel.displayedColor }}>{sel.displayedPct}%</span>
        </div>
      </div>
      <DonutLegend items={items} colors={colors} activeName={sel.displayed.name} onHover={(n) => sel.setHover(n)} onSelect={(n) => sel.toggleSelect(n)} />
    </div>
  );
}
