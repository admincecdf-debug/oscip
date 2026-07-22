"use client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useStates, useNucleos, useDistricts, useAreas, useSectors, useChurches, useCells } from "@/hooks/use-queries";

export function MdaStructure({ churchId }: { churchId?: string } = {}) {
  const { data: states = [] } = useStates();
  const { data: nucleos = [] } = useNucleos();
  const { data: districts = [] } = useDistricts();
  const { data: sectors = [] } = useSectors();
  const { data: churches = [] } = useChurches();
  const { data: allCells = [] } = useCells();

  // Escopo por Igreja Local: agora ela é folha, então "estrutura" vira
  // sua linhagem territorial (Estado > Núcleo > Distrito > Setor) + seus próprios LGs.
  if (churchId) {
    const church = churches.find((c) => c.id === churchId);
    const sector = sectors.find((s) => s.id === church?.sector_id);
    const district = districts.find((d) => d.id === sector?.district_id);
    const nucleo = nucleos.find((n) => n.id === district?.nucleo_id);
    const state = states.find((s) => s.id === nucleo?.state_id);
    const cells = allCells.filter((c) => c.church_id === churchId);

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Localização na Estrutura Territorial (MEO-001)</CardTitle>
            <CardDescription>Estado → Núcleo → Distrito → Setor → Igreja Local</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted">
              {state?.name ?? "—"} → {nucleo?.name ?? "—"} → {district?.name ?? "—"} → {sector?.name ?? "—"} → <b className="text-navy">{church?.name ?? "—"}</b>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Life Groups desta Igreja ({cells.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {cells.length === 0 && <p className="text-sm italic text-muted">Nenhum Life Group cadastrado ainda.</p>}
            {cells.map((c) => (
              <div key={c.id} className="rounded-md border p-3 text-sm">
                <b className="text-navy">{c.name}</b>
                {c.meeting_weekday && <span className="ml-2 text-xs text-muted">{c.meeting_weekday} {c.meeting_time ?? ""}</span>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Visão global: só os totais (a exploração interativa fica no HierarchyExplorer do Dashboard)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Estrutura Territorial — resumo</CardTitle>
        <CardDescription>Estado → Núcleo → Distrito → Setor → Igreja Local → Life Group (MEO-001).</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <MdaCount label="Estados" value={states.length} />
          <MdaCount label="Núcleos" value={nucleos.length} />
          <MdaCount label="Distritos" value={districts.length} />
          <MdaCount label="Setores" value={sectors.length} />
          <MdaCount label="Igrejas Locais" value={churches.length} />
          <MdaCount label="Life Groups" value={allCells.length} />
        </div>
      </CardContent>
    </Card>
  );
}

export function MdaCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-4 text-center">
      <p className="font-display text-2xl font-semibold text-gold">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
