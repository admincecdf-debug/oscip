import { MonthlyReportDetailView } from "@/components/admin/MonthlyReportDetailView";

export default async function MonthlyReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MonthlyReportDetailView reportId={id} />;
}
