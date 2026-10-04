"use client";

import { useState } from "react";
import { Cell, Pie as PieRaw, PieChart, ResponsiveContainer, Sector as SectorRaw } from "recharts";

export const GENDER_COLORS = ["#3B82F6", "#EC4899", "#8B5CF6"];
export const ATTENDANCE_COLORS = ["#13855b", "#d64545", "#f59e0b"];
export const STATUS_COLORS = ["#13855b", "#f59e0b", "#d64545"];

export type DonutItem = { name: string; value: number };

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
    <div className="flex w-[132px] shrink-0 flex-col gap-3">
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

export function DonutChart({ items, colors, heightClass = "h-64", innerRadius = 64, outerRadius = 92, centerOverride }: { items: DonutItem[]; colors: string[]; heightClass?: string; innerRadius?: number; outerRadius?: number; centerOverride?: { top: string; value: string; color?: string } }) {
  const sel = useDonutSelection(items, colors);
  if (sel.total === 0) return null;
  const top = centerOverride?.top ?? sel.displayed.name;
  const value = centerOverride?.value ?? `${sel.displayedPct}%`;
  const color = centerOverride?.color ?? sel.displayedColor;
  return (
    <div className="flex items-center gap-2">
      <div className={`relative min-w-0 flex-1 ${heightClass}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={sel.pieData} dataKey="value" nameKey="name" innerRadius={innerRadius} outerRadius={outerRadius} paddingAngle={4} labelLine={false} activeIndex={sel.activeIndex} activeShape={ActiveDonutShape} onMouseEnter={sel.handleEnter} onMouseLeave={sel.handleLeave} onClick={sel.handleClick} style={{ cursor: "pointer" }}>
              {sel.pieData.map((entry) => { const fi = items.findIndex((d) => d.name === entry.name); return <Cell key={entry.name} fill={colors[fi >= 0 ? fi : 0]} style={{ cursor: "pointer" }} />; })}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-semibold text-[#57558b]">{top}</span>
          <span className="font-display text-3xl font-bold tabular-nums" style={{ color }}>{value}</span>
        </div>
      </div>
      <DonutLegend items={items} colors={colors} activeName={sel.displayed.name} onHover={(n) => sel.setHover(n)} onSelect={(n) => sel.toggleSelect(n)} />
    </div>
  );
}
