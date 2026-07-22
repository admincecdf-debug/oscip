"use client";
import * as XLSX from "xlsx";

// ── Tipos ─────────────────────────────────────────────────────
export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
  format?: (value: unknown) => string;
}

// ── Helpers ───────────────────────────────────────────────────
function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("pt-BR");
}
function fmtCurrency(v: number | null | undefined): string {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function fmtBool(v: boolean | null | undefined): string {
  if (v == null) return "—";
  return v ? "Sim" : "Não";
}
function getVal(obj: Record<string, unknown>, key: string): unknown {
  return key.split(".").reduce((o, k) => (o as Record<string, unknown>)?.[k], obj as unknown);
}

// ══════════════════════════════════════════════════════════════
// EXCEL (CSV via SheetJS)
// ══════════════════════════════════════════════════════════════
export function exportToExcel(
  data: Record<string, unknown>[],
  columns: ExportColumn[],
  filename: string,
  sheetName = "Dados"
) {
  const headers = columns.map(c => c.header);
  const rows = data.map(row =>
    columns.map(col => {
      const val = getVal(row, col.key);
      if (col.format) return col.format(val);
      if (typeof val === "boolean") return fmtBool(val);
      if (val == null) return "";
      return String(val);
    })
  );

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Larguras de coluna
  ws["!cols"] = columns.map(c => ({ wch: c.width ?? 20 }));

  // Estilo cabeçalho (negrito via SheetJS CE)
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c: C })];
    if (cell) cell.s = { font: { bold: true }, fill: { fgColor: { rgb: "0E2A47" } } };
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ══════════════════════════════════════════════════════════════
// PDF (via jsPDF + autotable — carregados dinamicamente)
// ══════════════════════════════════════════════════════════════
export async function exportToPDF(opts: {
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  data: Record<string, unknown>[];
  filename: string;
  landscape?: boolean;
}) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: opts.landscape ? "landscape" : "portrait", unit: "mm", format: "a4" });

  // Cabeçalho
  doc.setFontSize(16);
  doc.setTextColor(14, 42, 71); // navy
  doc.text(opts.title, 14, 18);

  if (opts.subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text(opts.subtitle, 14, 26);
  }

  doc.setFontSize(8);
  doc.setTextColor(160, 160, 160);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")} · CEC Family`, 14, opts.subtitle ? 32 : 26);

  // Linha divisória
  doc.setDrawColor(201, 162, 39); // gold
  doc.setLineWidth(0.5);
  doc.line(14, opts.subtitle ? 35 : 29, doc.internal.pageSize.width - 14, opts.subtitle ? 35 : 29);

  // Tabela
  const headers = opts.columns.map(c => c.header);
  const rows = opts.data.map(row =>
    opts.columns.map(col => {
      const val = getVal(row, col.key);
      if (col.format) return col.format(val);
      if (typeof val === "boolean") return fmtBool(val);
      if (val == null) return "—";
      return String(val);
    })
  );

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: opts.subtitle ? 38 : 32,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: {
      fillColor: [14, 42, 71],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: Object.fromEntries(
      opts.columns.map((c, i) => [i, { cellWidth: c.width ? c.width * 0.35 : "auto" }])
    ),
    margin: { left: 14, right: 14 },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    didDrawPage: (data: any) => {
      // Rodapé com número de página
      const pageSize = doc.internal.pageSize;
      doc.setFontSize(7);
      doc.setTextColor(160, 160, 160);
      doc.text(
        `Página ${data.pageNumber} de ${data.pageCount}`,
        pageSize.width / 2,
        pageSize.height - 8,
        { align: "center" }
      );
    },
  });

  doc.save(`${opts.filename}.pdf`);
}

// ══════════════════════════════════════════════════════════════
// COLUNAS PRÉ-DEFINIDAS POR MÓDULO
// ══════════════════════════════════════════════════════════════

export const MEMBER_COLUMNS: ExportColumn[] = [
  { header: "Nome",            key: "full_name",     width: 30 },
  { header: "E-mail",          key: "email",         width: 28 },
  { header: "Telefone",        key: "phone",         width: 18 },
  { header: "Estágio",         key: "journey_stage", width: 18 },
  { header: "Status",          key: "status",        width: 12 },
  { header: "Igreja",          key: "church_id",     width: 20 },
  { header: "Nascimento",      key: "birth_date",    width: 16, format: v => fmtDate(v as string) },
  { header: "Entrou em",       key: "joined_at",     width: 16, format: v => fmtDate(v as string) },
];

export const WEEKLY_REPORT_COLUMNS: ExportColumn[] = [
  { header: "Data",            key: "meeting_date",      width: 14, format: v => fmtDate(v as string) },
  { header: "Life Group",      key: "life_group_id",     width: 28 },
  { header: "Presentes",       key: "attendance_count",  width: 12 },
  { header: "Frequentadores",  key: "frequentadores_count", width: 16 },
  { header: "Visitantes",      key: "visitors_count",    width: 12 },
  { header: "Decisões",        key: "decisions_count",   width: 12 },
  { header: "Disc. Ativos",    key: "disc_ativos",       width: 14 },
  { header: "Integrados",      key: "cons_integrados",   width: 14 },
  { header: "Saúde",           key: "saude_status",      width: 14 },
  { header: "Fluiu?",          key: "flowed",            width: 10, format: v => fmtBool(v as boolean) },
];

export const ASSET_COLUMNS: ExportColumn[] = [
  { header: "Código",          key: "patrimony_code",    width: 14 },
  { header: "Nome",            key: "name",              width: 28 },
  { header: "Categoria",       key: "category",          width: 16 },
  { header: "Condição",        key: "condition",         width: 14 },
  { header: "Origem",          key: "origin",            width: 14 },
  { header: "Fabricante",      key: "manufacturer",      width: 18 },
  { header: "Modelo",          key: "model",             width: 16 },
  { header: "Nº Série",        key: "serial_number",     width: 16 },
  { header: "Aquisição",       key: "acquired_at",       width: 14, format: v => fmtDate(v as string) },
  { header: "Valor",           key: "acquisition_value", width: 16, format: v => fmtCurrency(v as number) },
  { header: "Durável?",        key: "is_durable",        width: 10, format: v => fmtBool(v as boolean) },
];

export const PROPERTY_COLUMNS: ExportColumn[] = [
  { header: "Nome",            key: "name",              width: 28 },
  { header: "Tipo",            key: "occupation_type",   width: 16 },
  { header: "Endereço",        key: "address",           width: 30 },
  { header: "Cidade",          key: "city",              width: 18 },
  { header: "Estado",          key: "state",             width: 10 },
  { header: "Proprietário",    key: "owner_name",        width: 22 },
  { header: "Fim contrato",    key: "contract_end_at",   width: 16, format: v => fmtDate(v as string) },
  { header: "IPTU vence",      key: "iptu_due_at",       width: 14, format: v => fmtDate(v as string) },
];

export const FINANCE_COLUMNS: ExportColumn[] = [
  { header: "Data",            key: "occurred_on",       width: 14, format: v => fmtDate(v as string) },
  { header: "Tipo",            key: "direction",         width: 10 },
  { header: "Categoria",       key: "kind",              width: 18 },
  { header: "Valor",           key: "amount",            width: 16, format: v => fmtCurrency(v as number) },
  { header: "Ofertante",       key: "payer_name",        width: 22 },
  { header: "Descrição",       key: "description",       width: 30 },
];

const RELMDA_STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho", enviado: "Enviado", em_analise: "Em análise",
  correcao_solicitada: "Correção solicitada", corrigido: "Corrigido", validado: "Validado", encerrado: "Encerrado",
};

export const RELMDA_OVERVIEW_COLUMNS: ExportColumn[] = [
  { header: "Life Group",      key: "life_group_name",   width: 26 },
  { header: "Líder",           key: "leader_name",       width: 22 },
  { header: "Igreja",          key: "church_name",       width: 22 },
  { header: "Status",          key: "status",            width: 16, format: v => RELMDA_STATUS_LABELS[v as string] ?? String(v ?? "—") },
  { header: "Enviado em",      key: "sent_at",           width: 16, format: v => v ? new Date(v as string).toLocaleString("pt-BR") : "—" },
  { header: "Membros",         key: "total_members",     width: 12 },
  { header: "MDA",             key: "mda_count",         width: 10 },
  { header: "Visitantes",      key: "visitantes_count",  width: 12 },
  { header: "GE",              key: "ge_count",          width: 10 },
  { header: "TADEL",           key: "tadel_count",       width: 10 },
  { header: "EMP",             key: "emp_participants",  width: 10 },
  { header: "Oferta total",    key: "offering_total",    width: 16, format: v => fmtCurrency(v as number) },
  { header: "Kg do Amor",      key: "kg_amor",           width: 14 },
  { header: "Inconsistente?",  key: "is_inconsistent",   width: 14 },
];

export const RELMDA_SECTOR_COLUMNS: ExportColumn[] = [
  { header: "Setor",           key: "sectorName",        width: 26 },
  { header: "Life Groups",     key: "lifeGroups",        width: 14 },
  { header: "Membros",         key: "membros",           width: 12 },
  { header: "MDA",             key: "mda",               width: 10 },
  { header: "GE",              key: "ge",                width: 10 },
  { header: "Visitantes",      key: "visitantes",        width: 12 },
  { header: "TADEL",           key: "tadel",             width: 10 },
  { header: "EMP",             key: "emp",               width: 10 },
  { header: "Oferta total",    key: "ofertaTotal",       width: 16, format: v => fmtCurrency(v as number) },
  { header: "Kg do Amor",      key: "kgAmor",            width: 14 },
  { header: "Enviados",        key: "enviados",          width: 12 },
  { header: "Esperados",       key: "esperados",         width: 12 },
];
