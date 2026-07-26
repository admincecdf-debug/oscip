"use client";
import { useState } from "react";
import { Newspaper, Calendar as Cal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { usePublicNews } from "@/hooks/use-queries";
import type { News, NewsCategory } from "@/types/domain";

const CATEGORIES: { value: NewsCategory; label: string }[] = [
  { value: "minha_comunidade", label: "Minha comunidade" },
  { value: "cec_manaus",       label: "CEC Manaus" },
  { value: "cec_brasilia",     label: "CEC Brasília" },
  { value: "geral",            label: "Gerais" },
];

export function PublicNewsSection({ churchId }: { churchId?: string | null } = {}) {
  const [cat, setCat] = useState<NewsCategory | "todas">("todas");
  const { data: all = [] } = usePublicNews(undefined, churchId);
  const filtered = cat === "todas" ? all : all.filter((n) => n.category === cat);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-navy">
        <Newspaper className="h-5 w-5 text-gold" />
        <h2 className="font-display text-2xl">Notícias</h2>
      </div>

      <Tabs value={cat} onValueChange={(v) => setCat(v as NewsCategory | "todas")}>
        <div className="overflow-x-auto">
          <TabsList className="min-w-max">
            <TabsTrigger value="todas">Todas</TabsTrigger>
            {CATEGORIES.map((c) => <TabsTrigger key={c.value} value={c.value}>{c.label}</TabsTrigger>)}
          </TabsList>
        </div>

        <TabsContent value={cat}>
          {filtered.length === 0 ? (
            <p className="py-8 text-center italic text-muted">Nenhuma notícia publicada nessa categoria.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((n) => <NewsCard key={n.id} news={n} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NewsCard({ news: n }: { news: News }) {
  const cat = CATEGORIES.find((c) => c.value === n.category)?.label ?? n.category;
  return (
    <Card className="overflow-hidden">
      {n.cover_url && <img src={n.cover_url} alt="" className="aspect-video w-full object-cover" />}
      <CardHeader>
        <span className="text-[10px] font-extrabold tracking-widest text-gold">{cat.toUpperCase()}</span>
        <CardTitle className="text-base leading-snug">{n.title}</CardTitle>
        {n.published_at && (
          <CardDescription className="flex items-center gap-1 text-xs">
            <Cal className="h-3 w-3" />{new Date(n.published_at).toLocaleDateString("pt-BR")}
            {n.author_name && <span> · {n.author_name}</span>}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {n.summary && <p className="text-sm text-muted">{n.summary}</p>}
      </CardContent>
    </Card>
  );
}
