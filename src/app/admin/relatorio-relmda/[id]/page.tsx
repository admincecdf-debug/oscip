import { RelmdaReportPrintView } from "@/components/admin/RelmdaReportPrintView";

export default async function RelmdaReportPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RelmdaReportPrintView reportId={id} />;
}
