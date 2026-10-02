import { ClassDashboard } from "@/components/admin-workspace";

export default async function ClassDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClassDashboard classId={id} />;
}
