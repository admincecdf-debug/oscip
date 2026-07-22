"use client";
import {
  Sparkles, Flame, Music, Flower, HandHelping, Heart, Crown, Award, FileText, Megaphone,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useMyMinistries, useMinistryPosts } from "@/hooks/use-queries";
import type { Ministry } from "@/types/domain";

const ICONS: Record<string, React.ComponentType<{className?:string}>> = {
  "sparkles": Sparkles, "flame": Flame, "music": Music, "flower": Flower,
  "praying-hands": HandHelping, "hand-helping": HandHelping, "heart": Heart, "crown": Crown,
};

export function MyMinistriesPanel() {
  const { data: ministries = [], isLoading } = useMyMinistries();

  if (isLoading) {
    return <p className="py-6 text-center text-sm italic text-muted">Carregando…</p>;
  }
  if (ministries.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <Award className="mx-auto h-10 w-10 text-muted" />
          <p className="mt-3 text-sm text-muted">
            Você ainda não está vinculado a um ministério.
            <br />Fale com sua liderança para participar!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-navy">
        <Award className="h-5 w-5 text-gold" />
        <h2 className="font-display text-xl">Meus ministérios</h2>
      </div>
      {ministries.map((m) => <MinistryDisplay key={m.id} ministry={m} />)}
    </div>
  );
}

function MinistryDisplay({ ministry: ms }: { ministry: Ministry }) {
  const { data: posts = [] } = useMinistryPosts(ms.id);
  const Ico = ICONS[ms.icon ?? "sparkles"] ?? Sparkles;

  return (
    <Card style={{ borderTop: `4px solid ${ms.color ?? "#C9A227"}` }}>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="rounded-xl p-2.5 text-white" style={{ backgroundColor: ms.color ?? "#C9A227" }}>
            <Ico className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <CardTitle>{ms.name}</CardTitle>
            {ms.description && <CardDescription>{ms.description}</CardDescription>}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-navy-600">
          <Megaphone className="h-4 w-4 text-gold" />Avisos do ministério
        </h3>
        {posts.length === 0 ? (
          <p className="rounded-md bg-navy-50/40 p-4 text-center text-sm italic text-muted">
            Nenhum aviso publicado ainda.
          </p>
        ) : (
          <div className="space-y-3">
            {posts.map((p) => (
              <div key={p.id} className="rounded-lg border-l-4 bg-card p-3" style={{ borderLeftColor: ms.color ?? "#C9A227" }}>
                <div className="flex items-start gap-2">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  <div className="flex-1">
                    <b className="block text-navy">{p.title}</b>
                    {p.published_at && (
                      <p className="text-[11px] text-muted">{new Date(p.published_at).toLocaleDateString("pt-BR")}</p>
                    )}
                    {p.body && <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{p.body}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
