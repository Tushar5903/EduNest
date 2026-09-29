import { StatCard, EmptyState } from "@/components/ui";

export default function TeacherDashboardPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-xl font-bold">Live Queue</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard title="Live now" value="—" hint="GET /teacher/today-schedule?date&now" />
        <StatCard title="Upcoming" value="—" hint="Poll useNow() every 1 min" />
        <StatCard title="Done" value="—" hint="Collapsed section" />
      </div>
      <EmptyState title="Wire to API next" hint="Client Component + useNow + ['schedule',date] query" />
    </div>
  );
}
