"use client";
import { GraduationCap, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemberEnrollments } from "@/hooks/use-queries";
import { ENROLLMENT_STATUS_LABELS } from "@/services/formacao";

const STATUS_COLOR: Record<string, string> = {
  concluido: "bg-green-100 text-green-800 border-green-300",
  cursando: "bg-blue-100 text-blue-800 border-blue-300",
  matriculado: "bg-yellow-100 text-yellow-800 border-yellow-300",
  desistente: "bg-gray-100 text-gray-600 border-gray-300",
};

export function FormacaoMembro({ memberId }: { memberId: string }) {
  const { data: enrollments = [], isLoading } = useMemberEnrollments(memberId);

  if (isLoading) return <p className="py-8 text-center text-sm italic text-muted-foreground">Carregando formação…</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><GraduationCap className="h-4 w-4 text-gold" />Formação</CardTitle>
      </CardHeader>
      <CardContent>
        {enrollments.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">Nenhuma matrícula registrada — Encontro com Deus, CTL, Escola de Líderes, etc.</p>
        ) : (
          <div className="space-y-2">
            {enrollments.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div>
                  <p className="text-sm font-semibold text-navy">{e.course_name}</p>
                  <p className="text-xs text-muted-foreground">{e.class_name}{e.completed_at ? ` · concluído em ${new Date(e.completed_at).toLocaleDateString("pt-BR")}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  {e.certificate_issued && <Award className="h-4 w-4 text-gold" />}
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_COLOR[e.status]}`}>{ENROLLMENT_STATUS_LABELS[e.status]}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
