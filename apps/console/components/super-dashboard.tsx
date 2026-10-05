"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2, CheckCircle2, Clock3, Download, MoreVertical, Users } from "lucide-react";
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { listInstitutes, listRequests } from "@/lib/super";
import { ActiveDonutShape, DonutLegend, STATUS_COLORS, useDonutSelection } from "@/components/donut-chart";

const COLORS = STATUS_COLORS;
type ChartProps = Record<string, unknown>;
// Recharts 2 declarations predate the React 19 JSX types used by this app.
const SafeArea = Area as unknown as React.ComponentType<ChartProps>;
const SafeXAxis = XAxis as unknown as React.ComponentType<ChartProps>;
const SafeYAxis = YAxis as unknown as React.ComponentType<ChartProps>;
const SafeTooltip = Tooltip as unknown as React.ComponentType<ChartProps>;
const SafePie = Pie as unknown as React.ComponentType<ChartProps>;

function monthKey(date: string) {
  const value = new Date(date);
  return value.toLocaleString("en-US", { month: "short" });
}

export function SuperDashboard() {
  const institutes = useQuery({ queryKey: ["super", "institutes"], queryFn: () => listInstitutes() });
  const requests = useQuery({ queryKey: ["super", "requests", "pending"], queryFn: () => listRequests("pending") });
  const rows = institutes.data ?? [];
  const pending = requests.data ?? [];
  const active = rows.filter((row) => row.status === "active").length;
  const suspended = rows.filter((row) => row.status === "suspended").length;
  const students = rows.reduce((total, row) => total + row.students, 0);
  const monthly = rows.reduce<Record<string, number>>((acc, row) => {
    const key = monthKey(row.createdAt);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const growth = Object.entries(monthly).map(([month, count]) => ({ month, current: count }));
  const status = [
    { name: "Active", value: active },
    { name: "Pending review", value: rows.filter((row) => row.status === "pending").length },
    { name: "Suspended", value: suspended },
  ].filter((item) => item.value > 0);
  const statusSel = useDonutSelection(status, COLORS);

  return <div className="space-y-5">
    <div className="flex flex-col justify-between gap-4 rounded-xl bg-white px-6 py-5 shadow-sm ring-1 ring-[#e7e4f5] sm:flex-row sm:items-end"><div><div className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#77748d]">Home <span className="mx-2">›</span> Dashboard</div><h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Super Admin Dashboard</h1><p className="mt-1 text-sm text-[#77748d]">Overview of platform activity, registrations, and institutional operations.</p></div><button className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#272757] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1d1c45]"><Download size={17} />Export summary</button></div>
    {institutes.isError || requests.isError ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">The dashboard could not load live platform data. Check that the API is running and try again.</div> : null}
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric title="Total institutes" value={institutes.isLoading ? "…" : rows.length.toLocaleString()} hint="Registered on platform" icon={<Building2 size={21} />} />
      <Metric title="Active institutes" value={institutes.isLoading ? "…" : active.toLocaleString()} hint="Operational tenants" icon={<CheckCircle2 size={21} />} tone="green" />
      <Metric title="Pending requests" value={requests.isLoading ? "…" : pending.length.toLocaleString()} hint="Awaiting review" icon={<Clock3 size={21} />} tone="amber" />
      <Metric title="Total students" value={institutes.isLoading ? "…" : students.toLocaleString()} hint="Across active institutes" icon={<Users size={21} />} />
    </div>
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
      <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-[#e7e4f5]"><div className="mb-4 flex items-start justify-between"><div><h2 className="font-display text-xl font-bold">Platform Growth</h2><p className="mt-1 text-sm text-[#77748d]">Institute registrations returned by the live directory API.</p></div><MoreVertical size={19} className="text-[#77748d]" /></div><div className="h-[280px]">{growth.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={growth}><defs><linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#272757" stopOpacity={0.25} /><stop offset="95%" stopColor="#272757" stopOpacity={0} /></linearGradient></defs><SafeXAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#77748d", fontSize: 12 }} /><SafeYAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#77748d", fontSize: 12 }} /><SafeTooltip contentStyle={{ borderRadius: 8, border: "1px solid #e7e4f5" }} /><SafeArea type="monotone" dataKey="current" stroke="#272757" strokeWidth={3} fill="url(#growthFill)" /></AreaChart></ResponsiveContainer> : <EmptyChart />}</div></section>
      <section className="@container rounded-xl bg-white p-5 shadow-sm ring-1 ring-[#e7e4f5]"><div className="mb-4"><h2 className="font-display text-xl font-bold">Institute Status</h2><p className="mt-1 text-sm text-[#77748d]">Current platform distribution</p></div><div className="flex flex-col items-center gap-4 @sm:flex-row @sm:items-center @sm:gap-2"><div className="relative h-[210px] w-full min-w-0 @sm:flex-1">{status.length ? <><ResponsiveContainer width="100%" height="100%"><PieChart><SafePie data={statusSel.pieData} dataKey="value" nameKey="name" innerRadius={63} outerRadius={88} paddingAngle={4} labelLine={false} activeIndex={statusSel.activeIndex} activeShape={ActiveDonutShape} onMouseEnter={statusSel.handleEnter} onMouseLeave={statusSel.handleLeave} onClick={statusSel.handleClick} style={{ cursor: "pointer" }}>{statusSel.pieData.map((entry) => { const fi = status.findIndex((d) => d.name === entry.name); return <Cell key={entry.name} fill={COLORS[fi >= 0 ? fi : 0]} style={{ cursor: "pointer" }} />; })}</SafePie></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 grid place-items-center"><div className="text-center"><div className="font-display text-3xl font-bold">{rows.length}</div><div className="text-xs uppercase tracking-[0.14em] text-[#77748d]">Total</div></div></div></> : <EmptyChart />}</div><DonutLegend items={status} colors={COLORS} activeName={statusSel.displayed.name} onHover={(n) => statusSel.setHover(n)} onSelect={(n) => statusSel.toggleSelect(n)} /></div></section>
    </div>
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2"><DataPanel title="Recent Institute Requests" subtitle="Live pending queue" empty={!pending.length} loading={requests.isLoading}>{pending.slice(0, 5).map((row) => <div key={row.instituteId} className="flex items-center justify-between gap-3 border-t border-[#eeeefa] py-3 text-sm"><div className="min-w-0"><div className="truncate font-semibold">{row.schoolName}</div><div className="text-xs text-[#77748d]">{row.code} · {row.admin?.name ?? "No administrator"}</div></div><span className="rounded bg-[#fff6dc] px-2 py-1 text-xs font-semibold text-[#946d11]">Pending</span></div>)}</DataPanel><DataPanel title="Recently Registered" subtitle="Live institutional tenants" empty={!rows.length} loading={institutes.isLoading}>{rows.slice(0, 5).map((row) => <div key={row.instituteId} className="flex items-center justify-between gap-3 border-t border-[#eeeefa] py-3 text-sm"><div className="min-w-0"><div className="truncate font-semibold">{row.schoolName}</div><div className="text-xs text-[#77748d]">{row.code} · {new Date(row.createdAt).toLocaleDateString()}</div></div><span className={`rounded px-2 py-1 text-xs font-semibold ${row.status === "active" ? "bg-[#e7f7f0] text-[#137451]" : "bg-[#f0efff] text-[#4f4c8e]"}`}>{row.status}</span></div>)}</DataPanel></div>
  </div>;
}

function Metric({ title, value, hint, icon, tone = "purple" }: { title: string; value: string; hint: string; icon: React.ReactNode; tone?: "purple" | "green" | "amber" }) {
  const colors = { purple: "bg-[#eeecff] text-[#272757]", green: "bg-[#e7f7f0] text-[#137451]", amber: "bg-[#fff6dc] text-[#946d11]" };
  return <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-[#e7e4f5]"><div className="flex items-start justify-between"><div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#77748d]">{title}</div><div className={`grid h-10 w-10 place-items-center rounded-lg ${colors[tone]}`}>{icon}</div></div><div className="mt-3 font-display text-3xl font-bold tabular-nums">{value}</div><div className="mt-2 text-sm text-[#77748d]">{hint}</div></div>;
}
function DataPanel({ title, subtitle, children, empty, loading }: { title: string; subtitle: string; children: React.ReactNode; empty: boolean; loading: boolean }) { return <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-[#e7e4f5]"><h2 className="font-display text-xl font-bold">{title}</h2><p className="mb-3 mt-1 text-sm text-[#77748d]">{subtitle}</p>{loading ? <div className="h-28 animate-pulse rounded bg-[#f0efff]" /> : empty ? <div className="rounded-lg border border-dashed border-[#d8d5ed] p-8 text-center text-sm text-[#77748d]">No live records returned.</div> : children}</section>; }
function EmptyChart() { return <div className="grid h-full place-items-center text-sm text-[#77748d]">No live data returned.</div>; }
