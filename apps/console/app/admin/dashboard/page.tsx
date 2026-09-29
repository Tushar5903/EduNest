import { StatCard, EmptyState } from "@/components/ui";

export default function AdminDashboardPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-xl font-bold">Admin dashboard</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Students" value="—" hint="GET /admin/reports/school" />
        <StatCard title="Teachers" value="—" hint="GET /admin/reports/school" />
        <StatCard title="Collection %" value="—" hint="GET /admin/reports/school" />
        <StatCard title="Complaints" value="—" hint="GET /admin/complaints" />
      </div>
      <EmptyState title="Wire to API next" hint="Server Component + ?format=csv export" />
    </div>
  );
}
