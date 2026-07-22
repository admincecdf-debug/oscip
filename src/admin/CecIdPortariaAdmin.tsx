"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Search, CheckCircle2, XCircle, AlertTriangle, IdCard, Clock, CameraOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRecentCheckins } from "@/hooks/use-queries";
import { supabase } from "@/lib/supabase/client";
import * as Cid from "@/services/cecId";
import { CARD_STATUS_LABELS, CARD_STATUS_COLORS } from "@/services/cecId";
import type { CheckinLookupResult, CardStatus } from "@/types/domain";

export function CecIdPortariaAdmin() {
  const qc = useQueryClient();
  const [eventLabel, setEventLabel] = useState("");
  const [eventLocked, setEventLocked] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [result, setResult] = useState<CheckinLookupResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanSupported, setScanSupported] = useState<boolean | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const { data: recent = [] } = useRecentCheckins(eventLocked ? eventLabel : undefined);

  useEffect(() => {
    setScanSupported(typeof window !== "undefined" && "BarcodeDetector" in window);
  }, []);

  const stopScan = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  useEffect(() => () => stopScan(), [stopScan]);

  async function handleLookupToken(token: string) {
    setErr(""); setResult(null); setNotFound(false); setBusy(true);
    try {
      const found = await Cid.lookupByToken(supabase, Cid.extractTokenFromQr(token));
      if (found) setResult(found); else setNotFound(true);
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro ao buscar"); }
    finally { setBusy(false); }
  }

  async function startScan() {
    setErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Detector = (window as any).BarcodeDetector;
      const detector = new Detector({ formats: ["qr_code"] });

      const tick = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            stopScan();
            await handleLookupToken(codes[0].rawValue as string);
            return;
          }
        } catch { /* segue tentando */ }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setErr("Não foi possível acessar a câmera. Use a busca manual pelo CEC ID abaixo.");
      setScanning(false);
    }
  }

  async function handleManualSearch() {
    if (!manualCode.trim()) return;
    setErr(""); setResult(null); setNotFound(false); setBusy(true);
    try {
      const found = await Cid.lookupByCecId(supabase, manualCode.trim());
      if (found) setResult(found); else setNotFound(true);
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro ao buscar"); }
    finally { setBusy(false); }
  }

  async function confirmEntry(method: "qr" | "manual") {
    if (!result) return;
    setBusy(true); setErr("");
    try {
      await Cid.registerCheckin(supabase, result.member_id, eventLabel, method);
      qc.invalidateQueries({ queryKey: ["cec-id-checkins"] });
      setResult(null); setManualCode("");
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro ao registrar entrada"); }
    finally { setBusy(false); }
  }

  if (!eventLocked) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-8">
        <div className="text-center">
          <IdCard className="mx-auto h-10 w-10 text-gold" />
          <h2 className="mt-2 font-display text-2xl text-navy">Leitor de Portaria</h2>
          <p className="text-sm text-muted-foreground">Informe o nome do evento/local antes de começar a registrar entradas.</p>
        </div>
        <div>
          <Label>Evento ou local</Label>
          <Input placeholder="Ex: Culto de Celebração — 20/07" value={eventLabel} onChange={(e) => setEventLabel(e.target.value)} />
        </div>
        <Button className="w-full" disabled={!eventLabel.trim()} onClick={() => setEventLocked(true)}>Começar leitura</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4 py-4">
      <div className="flex items-center justify-between rounded-md border bg-muted/30 p-2 text-sm">
        <span className="font-semibold text-navy">{eventLabel}</span>
        <Button variant="outline" size="sm" onClick={() => { stopScan(); setEventLocked(false); setResult(null); }}>Trocar evento</Button>
      </div>

      {!result && !notFound && (
        <>
          {scanSupported && (
            <div className="space-y-2">
              {!scanning ? (
                <Button className="w-full gap-2" onClick={startScan}><Camera className="h-4 w-4" />Escanear QR Code</Button>
              ) : (
                <div className="space-y-2">
                  <video ref={videoRef} className="w-full rounded-lg border" muted playsInline />
                  <Button variant="outline" className="w-full gap-2" onClick={stopScan}><CameraOff className="h-4 w-4" />Parar câmera</Button>
                </div>
              )}
            </div>
          )}
          {scanSupported === false && (
            <p className="flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />Este navegador não suporta leitura de QR pela câmera. Use a busca manual abaixo.
            </p>
          )}

          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" /><span className="text-xs text-muted-foreground">ou</span><div className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-2">
            <Label>Buscar por CEC ID</Label>
            <div className="flex gap-2">
              <Input placeholder="CEC-BR-2026-00000001" value={manualCode} onChange={(e) => setManualCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleManualSearch()} />
              <Button onClick={handleManualSearch} disabled={busy || !manualCode.trim()} className="gap-1.5 shrink-0"><Search className="h-4 w-4" />Buscar</Button>
            </div>
          </div>
        </>
      )}

      {err && <p className="text-sm text-destructive">{err}</p>}

      {notFound && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
          <XCircle className="mx-auto h-8 w-8 text-red-500" />
          <p className="mt-1 font-semibold text-red-700">Credencial não encontrada</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setNotFound(false)}>Tentar de novo</Button>
        </div>
      )}

      {result && (
        <ResultCard result={result} busy={busy} onConfirm={confirmEntry} onCancel={() => setResult(null)} />
      )}

      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-navy-600">
          <Clock className="h-3.5 w-3.5" />Últimas entradas
        </p>
        {recent.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma entrada registrada ainda pra este evento.</p>
        ) : (
          <ul className="divide-y rounded-md border text-sm">
            {recent.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-3 py-1.5">
                <span className="font-mono text-xs text-muted-foreground">{c.cec_id ?? "—"}</span>
                <span className="text-xs text-muted-foreground">{new Date(c.checked_at).toLocaleTimeString("pt-BR")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ResultCard({
  result, busy, onConfirm, onCancel,
}: { result: CheckinLookupResult; busy: boolean; onConfirm: (method: "qr" | "manual") => void; onCancel: () => void }) {
  const blocked = result.card_status === "suspensa" || result.card_status === "cancelada";
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-3">
        {result.photo_url ? (
          <img src={result.photo_url} alt={result.full_name} className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <div className="grid h-14 w-14 place-items-center rounded-full bg-navy/10 text-navy"><IdCard className="h-6 w-6" /></div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-bold text-navy">{result.full_name}</p>
          <p className="truncate text-xs text-muted-foreground">{result.categoria} {result.church_name && `· ${result.church_name}`}</p>
          <p className="font-mono text-[11px] text-muted-foreground">{result.cec_id}</p>
        </div>
      </div>
      <span className={`mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold ${CARD_STATUS_COLORS[result.card_status as CardStatus]}`}>
        {blocked ? <XCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
        {CARD_STATUS_LABELS[result.card_status as CardStatus]}
      </span>

      {blocked && (
        <p className="mt-2 flex items-center gap-1.5 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />Carteira {CARD_STATUS_LABELS[result.card_status as CardStatus].toLowerCase()} — entrada não recomendada.
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onCancel}>Cancelar</Button>
        <Button className="flex-1 gap-1.5" disabled={busy} onClick={() => onConfirm("manual")}>
          <CheckCircle2 className="h-4 w-4" />{busy ? "Registrando…" : "Confirmar Entrada"}
        </Button>
      </div>
    </div>
  );
}
