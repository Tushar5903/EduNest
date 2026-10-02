import { PersonDashboard } from "@/components/admin-workspace";

export default async function StudentDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PersonDashboard personId={id} role="student" />;
}
