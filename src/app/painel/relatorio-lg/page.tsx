"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, Clock, AlertTriangle } from "lucide-react";
import { useMyProfile, useMyMember, useCells, useRelmdaDraftId, useRelmdaDeadline } from "@/hooks/use-queries";

const WEEKDAY_NAMES = ["domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado"];

function DeadlineBanner({ churchId }: { churchId: string | null }) {
  const { data: deadline } = useRelmdaDeadline(churchId);
  if (!deadline) return null;

  const now = new Date();
  // Próxima ocorrência do dia/hora limite configurado (olhando pra trás até 7 dias)
  const todayDow = now.getDay();
  let diffDays = (deadline.deadline_weekday - todayDow + 7) % 7;
  const deadlineDate = new Date(now);
  deadlineDate.setDate(now.getDate() + diffDays);
  const [h, m] = deadline.deadline_time.split(":").map(Number);
  deadlineDate.setHours(h, m, 0, 0);
  if (diffDays === 0 && deadlineDate < now) deadlineDate.setDate(deadlineDate.getDate() + 7);

  const msLeft = deadlineDate.getTime() - now.getTime();
  const hoursLeft = msLeft / 1000 / 60 / 60;
  const isUrgent = hoursLeft <= deadline.reminder_before_hours;
  const isPast = hoursLeft < 0;

  return (
    <div className={`mb-3 flex items-center gap-2 rounded-md border p-2.5 text-xs ${
      isPast ? "border-red-300 bg-red-50 text-red-700" : isUrgent ? "border-amber-300 bg-amber-50 text-amber-700" : "border-muted bg-muted/20 text-muted-foreground"
    }`}>
      {isPast || isUrgent ? <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> : <Clock className="h-3.5 w-3.5 shrink-0" />}
      <span>
        Prazo de envio: <b>{WEEKDAY_NAMES[deadline.deadline_weekday]}, {deadline.deadline_time.slice(0,5)}</b>
        {isPast ? " — prazo já passou, envie o quanto antes." : isUrgent ? " — está perto de vencer!" : ""}
      </span>
    </div>
  );
}

const RelmdaLiderForm = dynamic(
  () => import("@/components/panel/RelmdaLiderForm").then((m) => m.RelmdaLiderForm),
  { ssr: false, loading: () => <p className="p-6 text-sm text-muted-foreground">Carregando…</p> }
);

function weekNumberOfMonth(date: Date): number {
  return Math.min(5, Math.ceil(date.getDate() / 7));
}

export default function RelatorioLgPage() {
  const { data: profile, isLoading: loadingProfile } = useMyProfile();
  const { data: member, isLoading: loadingMember } = useMyMember();
  const { data: cells = [], isLoading: loadingCells } = useCells();

  if (loadingProfile || loadingMember || loadingCells) {
    return <main className="grid min-h-screen place-items-center text-sm text-muted-foreground">Carregando…</main>;
  }

  const myCell = member?.life_group_id ? cells.find((c) => c.id === member.life_group_id) ?? null : null;
  const isResponsible = !!myCell && !!profile && (
    myCell.leader_id === profile.id || myCell.coleader_id === profile.id || myCell.supervisor_id === profile.id
  );

  if (!myCell) {
    return (
      <main className="grid min-h-screen place-items-center p-5 text-center">
        <div>
          <p className="text-sm text-muted-foreground">Você ainda não está vinculado a um Life Group.</p>
          <Link href="/painel" className="mt-3 inline-flex items-center gap-1 text-sm text-navy underline"><ArrowLeft className="h-3.5 w-3.5" />Voltar ao painel</Link>
        </div>
      </main>
    );
  }

  if (!isResponsible) {
    return (
      <main className="grid min-h-screen place-items-center p-5 text-center">
        <div>
          <p className="text-sm text-muted-foreground">Você não possui permissão para preencher o relatório deste Life Group.</p>
          <Link href="/painel" className="mt-3 inline-flex items-center gap-1 text-sm text-navy underline"><ArrowLeft className="h-3.5 w-3.5" />Voltar ao painel</Link>
        </div>
      </main>
    );
  }

  const today = new Date();
  const week = weekNumberOfMonth(today);
  const month = today.getMonth() + 1;
  const year = today.getFullYear();

  return (
    <div className="mx-auto max-w-2xl p-4">
      <DeadlineBanner churchId={myCell.church_id} />
      <DraftLoader lifeGroupId={myCell.id} cellName={myCell.name} week={week} month={month} year={year} />
    </div>
  );
}

function DraftLoader({ lifeGroupId, cellName, week, month, year }: { lifeGroupId: string; cellName: string; week: number; month: number; year: number }) {
  const { data: reportId, isLoading, error } = useRelmdaDraftId(lifeGroupId, week, month, year);

  if (isLoading) return <main className="grid min-h-screen place-items-center text-sm text-muted-foreground">Preparando relatório da semana…</main>;
  if (error || !reportId) return <main className="grid min-h-screen place-items-center text-sm text-red-600">Não foi possível abrir o relatório. Tente novamente.</main>;

  return <RelmdaLiderForm reportId={reportId} cellName={cellName} />;
}
