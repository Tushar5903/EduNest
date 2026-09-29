import { StatCard, EmptyState } from "@/components/ui";

export default function SuperDashboardPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-xl font-bold">Super-admin dashboard</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Schools" value="—" hint="GET /super/institutes" />
        <StatCard title="Pending approvals" value="—" hint="GET /super/requests?status=pending" />
        <StatCard title="Suspended" value="—" hint="Directory status filter" />
        <StatCard title="Audit events" value="—" hint="Counts only, no PII" />
      </div>
      <EmptyState title="Privacy rule" hint="Never render student/teacher names, marks, fee rows, complaint text here." />
    </div>
  );
}
