"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, Download, Search, ShieldAlert, X } from "lucide-react";
import { useMemo, useState } from "react";
import { getAuditStats, listAuditEvents, type AuditEvent } from "@/lib/super";

function toDayKey(timestamp: string): string {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return "";
  return cellKey(d.getFullYear(), d.getMonth(), d.getDate());
}

function cellKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function AuditPage() {
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const events = useQuery({ queryKey: ["super", "audit", "all"], queryFn: () => listAuditEvents() });
  const stats = useQuery({ queryKey: ["super", "audit", "stats"], queryFn: getAuditStats });
  const logDates = useMemo(
    () => new Set((events.data ?? []).map((event) => toDayKey(event.timestamp)).filter(Boolean)),
    [events.data],
  );
  const rows = useMemo(
    () =>
      (events.data ?? []).filter((event) => {
        const haystack =
          `${event.id} ${event.actorName ?? ""} ${event.actor} ${event.action} ${event.entityName ?? ""} ${event.entityId}`.toLowerCase();
        return (
          (!selectedDate || toDayKey(event.timestamp) === selectedDate) &&
          (!search || haystack.includes(search.toLowerCase())) && (!severity || event.severity === severity)
        );
      }),
    [events.data, search, severity, selectedDate],
  );
  return <div className="space-y-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#77748d]">Home <span className="mx-2">›</span> Audit Logs</div><h1 className="font-display text-3xl font-bold sm:text-4xl">Audit Logs</h1><p className="mt-1 text-sm text-[#77748d]">Monitor and review authoritative administrative actions across the platform.</p></div><div className="flex gap-2"><button className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-semibold ring-1 ring-[#e7e4f5]"><Download size={17} />Export log</button><button className="inline-flex items-center gap-2 rounded-lg bg-[#272757] px-4 py-3 text-sm font-semibold text-white"><ShieldAlert size={17} />Verify chain integrity</button></div></div>{events.isError ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Unable to load audit events. Check the backend and try again.</div> : null}<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric title="Total events" value={stats.data?.total ?? "—"} hint="Backend KPI" /><Metric title="Events today" value={stats.data?.today ?? "—"} hint="Backend KPI" /><Metric title="Active administrators" value={stats.data?.activeAdministrators ?? "—"} hint="Backend KPI" /><Metric title="Critical events (7d)" value={stats.data?.criticalSevenDays ?? "—"} hint="Backend KPI" danger /></div><section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-[#e7e4f5]"><div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center"><div className="relative flex-1"><Search className="absolute left-3 top-3 text-[#85829f]" size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search keyword, administrator, or entity" className="h-11 w-full rounded-lg bg-[#f6f4ff] pl-10 pr-3 text-sm outline-none ring-[#cbc8f3] focus:ring-2" /></div><select value={severity} onChange={(event) => setSeverity(event.target.value)} className="h-11 rounded-lg bg-[#f6f4ff] px-3 text-sm" aria-label="Filter by severity"><option value="">All severities</option><option value="INFO">INFO</option><option value="WARNING">WARNING</option><option value="CRITICAL">CRITICAL</option></select>{selectedDate ? <button onClick={() => setSelectedDate("")} className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#272757] px-4 text-sm font-semibold text-white"><X size={15} />{selectedDate}</button> : null}</div><div className="flex flex-col gap-5 xl:grid xl:grid-cols-[minmax(0,1.25fr)_minmax(350px,0.75fr)]"><div className="order-2 overflow-x-auto rounded-lg ring-1 ring-[#eeeefa] xl:order-1 xl:col-start-1 xl:row-start-1 xl:row-span-2"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-[#f0efff] text-xs uppercase tracking-wider text-[#77748d]"><tr><th className="px-4 py-3">Timestamp</th><th className="px-4 py-3">Administrator</th><th className="px-4 py-3">Entity</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Severity</th></tr></thead><tbody>{events.isLoading ? <tr><td colSpan={5} className="p-10 text-center text-[#77748d]">Loading audit events…</td></tr> : rows.length === 0 ? <tr><td colSpan={5} className="p-10 text-center text-[#77748d]">No audit events returned.</td></tr> : rows.map((event) => <tr key={event.id} onClick={() => setSelected(event)} className={`cursor-pointer border-t border-[#eeeefa] hover:bg-[#faf9ff] ${selected?.id === event.id ? "bg-[#eeecff]" : ""}`}><td className="whitespace-nowrap px-4 py-4 font-mono text-xs text-[#555282]">{new Date(event.timestamp).toLocaleString()}</td><td className="break-words px-4 py-4 font-medium">{event.actorName ?? event.actor}</td><td className="break-words px-4 py-4">{event.entityName ?? event.entityId}</td><td className="px-4 py-4 font-mono text-xs">{event.action}</td><td className="px-4 py-4"><span className={`rounded px-2 py-1 text-xs font-semibold ${event.severity === "CRITICAL" ? "bg-[#ffe4e4] text-[#a32635]" : event.severity === "WARNING" ? "bg-[#fff6dc] text-[#946d11]" : "bg-[#e7f7f0] text-[#137451]"}`}>{event.severity}</span></td></tr>)}</tbody></table></div><div className="order-1 xl:order-2 xl:col-start-2 xl:row-start-1"><LogCalendar logDates={logDates} selectedDate={selectedDate} monthCursor={monthCursor} onMonthChange={setMonthCursor} onSelect={(day) => { setSelectedDate(day); setSelected(null); }} onClear={() => setSelectedDate("")} /></div>{selected ? <div className="order-3 xl:col-start-2 xl:row-start-2"><Inspector event={selected} onClose={() => setSelected(null)} /></div> : <div className="order-3 hidden rounded-lg bg-[#f6f4ff] p-8 text-center text-sm text-[#77748d] xl:col-start-2 xl:row-start-2 xl:block">Select an event to inspect its immutable details.</div>}</div></section></div>;
}
function Metric({ title, value, hint, danger = false }: { title: string; value: number | string; hint: string; danger?: boolean }) { return <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-[#e7e4f5]"><div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#77748d]">{title}</div><div className={`mt-3 font-display text-3xl font-bold tabular-nums ${danger ? "text-[#a32635]" : ""}`}>{value}</div><div className="mt-2 text-sm text-[#77748d]">{hint}</div></div>; }
function LogCalendar({ logDates, selectedDate, monthCursor, onMonthChange, onSelect, onClear }: { logDates: Set<string>; selectedDate: string; monthCursor: Date; onMonthChange: (next: Date) => void; onSelect: (day: string) => void; onClear: () => void }) {
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [...Array<string | null>(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => cellKey(year, month, i + 1))];
  const monthLabel = monthCursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  return <div className="rounded-lg bg-[#f6f4ff]"><div className="flex items-center justify-between bg-[#eeecff] p-4"><div className="flex items-center gap-2"><CalendarDays size={16} className="text-[#555282]" /><h2 className="font-display text-sm font-bold">{monthLabel}</h2></div><div className="flex items-center gap-1"><button aria-label="Previous month" onClick={() => onMonthChange(new Date(year, month - 1, 1))} className="rounded-lg p-1.5 hover:bg-white"><ChevronLeft size={17} /></button><button aria-label="Next month" onClick={() => onMonthChange(new Date(year, month + 1, 1))} className="rounded-lg p-1.5 hover:bg-white"><ChevronRight size={17} /></button></div></div><div className="p-4"><div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-[#77748d]">{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => <span key={d} className="py-1">{d}</span>)}</div><div className="mt-1 grid grid-cols-7 gap-1">{cells.map((day, i) => {
    if (!day) return <span key={`blank-${i}`} />;
    const hasLogs = logDates.has(day);
    const isSelected = day === selectedDate;
    const dayNumber = Number(day.slice(8));
    if (!hasLogs) return <span key={day} aria-disabled="true" title="No logs on this date" className="grid h-9 place-items-center rounded-lg text-sm text-[#c9c6e2]">{dayNumber}</span>;
    return <button key={day} onClick={() => onSelect(day)} aria-pressed={isSelected} title="View logs for this date" className={`grid h-9 place-items-center rounded-lg text-sm font-semibold ${isSelected ? "bg-[#272757] text-white" : "bg-[#eeecff] text-[#272757] hover:bg-[#272757] hover:text-white"}`}>{dayNumber}</button>;
  })}</div>{selectedDate ? <button onClick={onClear} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-[#272757] ring-1 ring-[#e7e4f5]"><X size={13} />Clear {selectedDate}</button> : <p className="mt-3 text-xs text-[#77748d]">Only highlighted dates have logs and can be selected.</p>}</div></div>;
}
function Inspector({ event, onClose }: { event: AuditEvent; onClose: () => void }) { return <aside className="rounded-lg bg-[#f6f4ff]"><div className="flex items-start justify-between bg-[#eeecff] p-4"><div><div className="text-xs font-mono font-bold text-[#555282]">#{event.id}</div><h2 className="mt-1 font-display text-lg font-bold">Event Audit Inspector</h2></div><button aria-label="Close inspector" onClick={onClose}><X size={19} /></button></div><div className="space-y-4 p-4 text-sm"><div className="grid grid-cols-2 gap-3"><Info label="Action" value={event.action} /><Info label="Entity name" value={event.entityName ?? event.entityId} /><Info label="Entity" value={`${event.entityType} · ${event.entityId}`} /><Info label="Administrator name" value={event.actorName ?? event.actor} /><Info label="Administrator" value={event.actor} /><Info label="Timestamp" value={new Date(event.timestamp).toLocaleString()} /></div><div><div className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#77748d]">Justification</div><div className="rounded bg-white p-3">{event.justification ?? "No justification supplied."}</div></div><div><div className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#77748d]">State transition diff</div><pre className="overflow-auto rounded bg-[#17164b] p-3 text-xs text-[#ecebff]">{JSON.stringify({ before: event.diffBefore ?? null, after: event.diffAfter ?? null }, null, 2)}</pre></div><div className="flex items-center gap-2 rounded bg-white p-3 text-xs text-[#555282]"><CalendarDays size={15} />Append-only audit detail from the server</div></div></aside>; }
function Info({ label, value }: { label: string; value: string }) { return <div><div className="text-xs uppercase tracking-wider text-[#77748d]">{label}</div><div className="mt-1 break-words font-medium">{value}</div></div>; }
