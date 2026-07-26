"use client";
import { useMemo, useState } from "react";
import { FileBarChart } from "lucide-react";
import { useAccessibleAreas, useAreaConsolidado } from "@/hooks/use-queries";
import type { AreaConsolidadoRow } from "@/types/domain";

const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const WEEKDAY_LABELS: Record<string, string> = { domingo: "Dom", segunda: "Seg", terca: "Ter", quarta: "Qua", quinta: "Qui", sexta: "Sex", sabado: "Sáb" };

function sumBy(rows: AreaConsolidadoRow[], key: keyof AreaConsolidadoRow): number {
  return rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
}

/**
 * Relatório Consolidado por Área — pra Supervisores de Área/Setor,
 * Distrito e Administrador Nacional. Reúne todos os Life Groups de
 * uma Área, agrupados por Setor, com subtotais e total geral.
 */
export function AreaConsolidadoAdmin() {
  const { data: areas = [] } = useAccessibleAreas();
  const uniqueAreas = useMemo(() => {
    const seen = new Map<string, string>();
    areas.forEach((a) => seen.set(a.area_id, a.area_name));
    return Array.from(seen.entries());
  }, [areas]);

  const [areaId, setAreaId] = useState<string>("");
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const { data: rows = [], isLoading } = useAreaConsolidado(areaId || null, month, year);

  const bySector = useMemo(() => {
    const map = new Map<string, { name: string; rows: AreaConsolidadoRow[] }>();
    rows.forEach((r) => {
      if (!map.has(r.sector_id)) map.set(r.sector_id, { name: r.sector_name, rows: [] });
      map.get(r.sector_id)!.rows.push(r);
    });
    return Array.from(map.values());
  }, [rows]);

  const naoAconteceram = rows.filter((r) => !r.relatorio_enviado);
  const areaName = uniqueAreas.find(([id]) => id === areaId)?.[1] ?? "";

  return (
    <div className="space-y-4 p-4">
      <div>
        <h2 className="flex items-center gap-2 font-display text-xl text-navy"><FileBarChart className="h-5 w-5 text-gold" />Relatório Consolidado por Área</h2>
        <p className="text-sm text-muted-foreground">Visão resumida de todos os Life Groups da área, por setor.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select value={areaId} onChange={(e) => setAreaId(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
          <option value="">Selecione uma área…</option>
          {uniqueAreas.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="h-10 rounded-md border bg-background px-3 text-sm">
          {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-10 rounded-md border bg-background px-3 text-sm">
          {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {!areaId ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Escolha uma área pra ver o relatório.</p>
      ) : isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[1400px] text-xs">
            <thead className="bg-navy text-white">
              <tr>
                <th className="p-2 text-left">Setor</th>
                <th className="p-2 text-left">Bairro</th>
                <th className="p-2 text-left">Líder</th>
                <th className="p-2 text-left">Fone</th>
                <th className="p-2 text-left">Auxiliar</th>
                <th className="p-2 text-left">Dia</th>
                <th className="p-2 text-center">Membros</th>
                <th className="p-2 text-center">Discipuladores</th>
                <th className="p-2 text-center">MDA</th>
                <th className="p-2 text-center">C.C</th>
                <th className="p-2 text-center">CEL</th>
                <th className="p-2 text-center">%</th>
                <th className="p-2 text-center">GE</th>
                <th className="p-2 text-center">Visit.</th>
                <th className="p-2 text-center">Pix</th>
                <th className="p-2 text-center">Espécie</th>
                <th className="p-2 text-center">Presenças</th>
                <th className="p-2 text-center">Kg amor</th>
              </tr>
            </thead>
            <tbody>
              {bySector.map((s) => (
                <SectorBlock key={s.name} name={s.name} rows={s.rows} />
              ))}
              <tr className="border-t-2 border-navy bg-gold/10 font-bold text-navy">
                <td className="p-2" colSpan={6}>TOTAIS DA ÁREA</td>
                <td className="p-2 text-center">{sumBy(rows, "membros")}</td>
                <td className="p-2 text-center">{sumBy(rows, "discipuladores")}</td>
                <td className="p-2 text-center">{sumBy(rows, "mda_semanal")}</td>
                <td className="p-2 text-center">{sumBy(rows, "cc")}</td>
                <td className="p-2 text-center">{sumBy(rows, "cel")}</td>
                <td className="p-2 text-center">—</td>
                <td className="p-2 text-center">{rows.filter((r) => r.ge).length}</td>
                <td className="p-2 text-center">{sumBy(rows, "visitantes")}</td>
                <td className="p-2 text-center">R$ {sumBy(rows, "oferta_pix").toFixed(0)}</td>
                <td className="p-2 text-center">R$ {sumBy(rows, "oferta_especie").toFixed(0)}</td>
                <td className="p-2 text-center">{sumBy(rows, "total_presencas")}</td>
                <td className="p-2 text-center">{sumBy(rows, "kg_amor").toFixed(0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {areaId && !isLoading && (
        <div className="rounded-lg border bg-muted/20 p-3 text-xs">
          <p className="font-bold uppercase tracking-wide text-muted-foreground">Observações — {areaName}, {MONTH_NAMES[month - 1]}/{year}</p>
          {naoAconteceram.length === 0 ? (
            <p className="mt-1 text-green-700">Todas as células enviaram relatório no período.</p>
          ) : (
            <p className="mt-1 text-amber-700">
              Células sem relatório no período: {naoAconteceram.map((r) => r.bairro || "Sem nome").join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SectorBlock({ name, rows }: { name: string; rows: AreaConsolidadoRow[] }) {
  return (
    <>
      <tr className="bg-navy/5">
        <td colSpan={18} className="p-1.5 text-xs font-bold uppercase tracking-wide text-navy">Setor: {name}</td>
      </tr>
      {rows.map((r) => (
        <tr key={r.lg_id} className={`border-t ${!r.relatorio_enviado ? "bg-red-50" : ""}`}>
          <td className="p-2"></td>
          <td className="p-2">{r.bairro ?? "—"}</td>
          <td className="p-2">{r.lider_nome ?? "—"}</td>
          <td className="p-2">{r.lider_fone ?? "—"}</td>
          <td className="p-2">{r.auxiliar_nome ?? "—"}</td>
          <td className="p-2">{r.dia_semana ? (WEEKDAY_LABELS[r.dia_semana] ?? r.dia_semana) : "—"}</td>
          <td className="p-2 text-center">{r.membros}</td>
          <td className="p-2 text-center">{r.discipuladores}</td>
          <td className="p-2 text-center">{r.mda_semanal}</td>
          <td className="p-2 text-center">{r.cc}</td>
          <td className="p-2 text-center">{r.cel}</td>
          <td className="p-2 text-center">{r.pct_mda}%</td>
          <td className="p-2 text-center">{r.ge ? "✅" : "—"}</td>
          <td className="p-2 text-center">{r.visitantes}</td>
          <td className="p-2 text-center">R$ {r.oferta_pix.toFixed(0)}</td>
          <td className="p-2 text-center">R$ {r.oferta_especie.toFixed(0)}</td>
          <td className="p-2 text-center">{r.total_presencas}</td>
          <td className="p-2 text-center">{r.kg_amor.toFixed(0)}</td>
        </tr>
      ))}
      <tr className="border-b bg-muted/30 font-semibold text-navy">
        <td className="p-1.5" colSpan={6}>Subtotal — {name}</td>
        <td className="p-1.5 text-center">{sumBy(rows, "membros")}</td>
        <td className="p-1.5 text-center">{sumBy(rows, "discipuladores")}</td>
        <td className="p-1.5 text-center">{sumBy(rows, "mda_semanal")}</td>
        <td className="p-1.5 text-center">{sumBy(rows, "cc")}</td>
        <td className="p-1.5 text-center">{sumBy(rows, "cel")}</td>
        <td className="p-1.5 text-center">—</td>
        <td className="p-1.5 text-center">{rows.filter((r) => r.ge).length}</td>
        <td className="p-1.5 text-center">{sumBy(rows, "visitantes")}</td>
        <td className="p-1.5 text-center">R$ {sumBy(rows, "oferta_pix").toFixed(0)}</td>
        <td className="p-1.5 text-center">R$ {sumBy(rows, "oferta_especie").toFixed(0)}</td>
        <td className="p-1.5 text-center">{sumBy(rows, "total_presencas")}</td>
        <td className="p-1.5 text-center">{sumBy(rows, "kg_amor").toFixed(0)}</td>
      </tr>
    </>
  );
}
