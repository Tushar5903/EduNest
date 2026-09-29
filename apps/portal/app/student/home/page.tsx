import { StatCard, EmptyState } from "@/components/ui";

export default function StudentHomePage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-xl font-bold">Student home</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard title="Attendance" value="—" hint="Connect GET /students/me/attendance" />
        <StatCard title="Fee due" value="—" hint="Connect GET /students/me/fees" />
        <StatCard title="Notices" value="—" hint="Connect GET /notices" />
      </div>
      <EmptyState title="Wire to API next" hint="Use lib/api.ts + TanStack Query key ['attendance','me'] etc." />
    </div>
  );
}
