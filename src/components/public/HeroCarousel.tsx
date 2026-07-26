"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Banner } from "@/types/domain";

interface Props {
  banners: Banner[];
  /** Quando não há banners, exibe um hero estático de fallback. */
  fallback?: React.ReactNode;
  intervalMs?: number;
  onSeeVideos?: () => void;
  onSeeServices?: () => void;
}

export function HeroCarousel({ banners, fallback, intervalMs = 6000, onSeeVideos, onSeeServices }: Props) {
  const [i, setI] = useState(0);
  const active = banners.filter((b) => b.is_active);
  const total = active.length;

  useEffect(() => {
    if (total <= 1) return;
    const t = setInterval(() => setI((x) => (x + 1) % total), intervalMs);
    return () => clearInterval(t);
  }, [total, intervalMs]);

  if (total === 0) {
    return <DefaultHero onSeeVideos={onSeeVideos} onSeeServices={onSeeServices} fallback={fallback} />;
  }

  const b = active[i];
  function prev() { setI((x) => (x - 1 + total) % total); }
  function next() { setI((x) => (x + 1) % total); }

  return (
    <section
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy-600 to-navy"
      style={b.image_url ? { backgroundImage: `linear-gradient(rgba(14,42,71,0.78), rgba(14,42,71,0.85)), url(${b.image_url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
    >
      <div className="p-8 md:p-12">
        <span className="inline-block rounded-full border border-gold px-3 py-1 text-[11px] font-extrabold tracking-widest text-gold">CEC MANAUS</span>
        <h1 className="mt-4 font-display text-3xl md:text-5xl font-semibold leading-tight text-white">{b.title}</h1>
        {b.subtitle && <p className="mt-3 max-w-2xl text-sm md:text-base text-white/85">{b.subtitle}</p>}
        {b.cta_label && b.cta_url && (
          <div className="mt-6">
            <Button asChild className="gap-2"><a href={b.cta_url} target={b.cta_url.startsWith("http") ? "_blank" : undefined} rel="noreferrer">{b.cta_label}</a></Button>
          </div>
        )}
      </div>

      {total > 1 && (
        <>
          <button onClick={prev} aria-label="Anterior"
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white backdrop-blur transition hover:bg-white/20">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={next} aria-label="Próximo"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white backdrop-blur transition hover:bg-white/20">
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
            {active.map((_, idx) => (
              <button key={idx} onClick={() => setI(idx)} aria-label={`Slide ${idx+1}`}
                className={`h-2 rounded-full transition-all ${idx === i ? "w-8 bg-gold" : "w-2 bg-white/40"}`} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function DefaultHero({ onSeeVideos, onSeeServices, fallback }: { onSeeVideos?: () => void; onSeeServices?: () => void; fallback?: React.ReactNode }) {
  if (fallback) return <>{fallback}</>;
  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy-600 to-navy p-8 md:p-12">
      <span className="inline-block rounded-full border border-gold px-3 py-1 text-[11px] font-extrabold tracking-widest text-gold">CEC MANAUS</span>
      <h1 className="mt-4 font-display text-3xl md:text-5xl font-semibold leading-tight text-white">Bem-vindo à nossa família</h1>
      <p className="mt-3 max-w-xl text-sm md:text-base text-white/80">
        Acompanhe pregações, agenda, cultos e a vida das nossas células — abertos a todos.
        Para discipulado e gestão pastoral, entre na área do membro.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        {onSeeVideos   && <Button onClick={onSeeVideos}   className="gap-2"><Play className="h-4 w-4" /> Ver pregações</Button>}
        {onSeeServices && <Button variant="outline" onClick={onSeeServices} className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">Horários de culto</Button>}
      </div>
      <Sparkles className="absolute right-4 top-4 h-8 w-8 text-gold/30" />
    </section>
  );
}
