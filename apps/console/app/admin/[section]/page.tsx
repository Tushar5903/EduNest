import AdminWorkspace from "@/components/admin-workspace";

const supported = new Set(["students", "teachers", "classes", "timetable", "attendance", "tests", "results", "fees", "salary", "notices", "complaints", "reports", "settings"]);

export default async function AdminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!supported.has(section)) return <div className="rounded-2xl bg-white p-8">This admin section is not available.</div>;
  return <AdminWorkspace kind={section} />;
}
