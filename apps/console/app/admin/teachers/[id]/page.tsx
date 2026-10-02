import { PersonDashboard } from "@/components/admin-workspace";

export default async function TeacherDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PersonDashboard personId={id} role="teacher" />;
}
