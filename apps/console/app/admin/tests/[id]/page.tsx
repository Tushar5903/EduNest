import { Suspense } from "react";
import { TestPerformance } from "@/components/admin-workspace";

export default async function TestPerformancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <TestPerformance testId={id} />
    </Suspense>
  );
}
