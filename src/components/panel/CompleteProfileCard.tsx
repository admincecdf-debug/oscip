"use client";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Camera, ChevronRight, X, Check, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMemberCompletion } from "@/hooks/use-queries";
import { supabase } from "@/lib/supabase/client";
import { updateMember, uploadMemberPhoto } from "@/services/members";
import { logAudit } from "@/services/audit";
import type { Member } from "@/types/domain";

interface FormValues {
  birth_date: string; phone: string; phone_is_whatsapp: boolean;
  cpf: string; rg: string; rg_orgao_expedidor: string;
  phone_recado: string; phone_recado_nome: string;
  cep: string; address: string; numero: string; complemento: string; neighborhood: string; city: string; state: string;
  gender: string; marital_status: string;
}

const LOCAL_STORAGE_SNOOZE_KEY = "cec_complete_profile_snoozed_until";

/**
 * Card "Complete seu cadastro" (script Cadastro/Realocação/Carteirinha, Seção 8-9).
 * Só aparece se o membro logado tiver cadastro incompleto. Preenche endereço,
 * documentos, contato de recado e foto — base pra futura Carteirinha de Membro.
 */
export function CompleteProfileCard({ member }: { member: Member | null | undefined }) {
  const qc = useQueryClient();
  const { data: percent = 0 } = useMemberCompletion(member?.id ?? null);
  const [open, setOpen] = useState(false);
  const [snoozed, setSnoozed] = useState(() => {
    if (typeof window === "undefined") return false;
    const until = window.localStorage.getItem(LOCAL_STORAGE_SNOOZE_KEY);
    return until ? new Date(until) > new Date() : false;
  });

  if (!member) return null;

  function snooze() {
    const until = new Date(); until.setDate(until.getDate() + 7);
    window.localStorage.setItem(LOCAL_STORAGE_SNOOZE_KEY, until.toISOString());
    setSnoozed(true);
  }

  // ── Estado 1: cadastro pessoal já 100% completo ──────────────────────────
  // (não esconde mais o card — mostra que está tudo certo e aguardando a
  // liderança validar o vínculo institucional, conforme Seção 7-8 do script)
  if (percent >= 100) {
    return (
      <>
        <Card className="border border-blue-200 bg-blue-50/30">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
            <div className="min-w-[220px] flex-1">
              <p className="font-display text-base font-bold text-navy">Seus dados estão atualizados</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Seu cadastro pessoal está completo e foi enviado para validação da liderança.
                Após essa validação, sua Carteirinha CEC ID poderá ser liberada.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-1">
              Atualizar meus dados <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
        {open && <CompleteProfileDialog member={member} onClose={() => setOpen(false)} />}
      </>
    );
  }

  // ── Estado 2: adiado — faixa discreta, sempre clicável ───────────────────
  if (snoozed) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-between rounded-md border border-dashed border-red-300 bg-red-50/50 px-3 py-2 text-left text-xs text-navy hover:bg-red-50"
        >
          <span>Complete seu cadastro pra liberar a Carteirinha Digital ({percent}% concluído)</span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        </button>
        {open && <CompleteProfileDialog member={member} onClose={() => setOpen(false)} />}
      </>
    );
  }

  // ── Estado 3: incompleto — card vermelho, elevado, botão amarelo (Seção 12) ──
  return (
    <>
      <button onClick={() => setOpen(true)} className="block w-full text-left">
        <Card className="border-2 border-red-300 shadow-lg shadow-red-100 transition hover:shadow-xl hover:-translate-y-0.5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
            <div className="min-w-[220px] flex-1">
              <p className="font-display text-base font-bold text-red-700">Complete seu cadastro</p>
              <p className="text-xs text-muted-foreground">
                Seu cadastro ainda possui informações pendentes. Complete seus dados para iniciar
                o processo de liberação da sua Carteirinha CEC ID.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-2 flex-1 max-w-[180px] overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-red-400 transition-all" style={{ width: `${percent}%` }} />
                </div>
                <span className="text-xs font-semibold text-red-700">Cadastro {percent}% completo</span>
              </div>
            </div>
            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" onClick={snooze}>Lembrar depois</Button>
              <Button size="sm" onClick={() => setOpen(true)} className="gap-1 bg-amber-400 text-amber-950 hover:bg-amber-500">
                Completar meus dados <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </button>
      {open && <CompleteProfileDialog member={member} onClose={() => setOpen(false)} />}
    </>
  );
}

function CompleteProfileDialog({ member, onClose }: { member: Member; onClose: () => void }) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(member.photo_url ?? null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(!!member.consent_accepted_at);
  const [photoConsent, setPhotoConsent] = useState(!!member.photo_consent_accepted_at);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const { register, handleSubmit } = useForm<FormValues>({
    defaultValues: {
      birth_date: member.birth_date ?? "", phone: member.phone ?? "",
      phone_is_whatsapp: !!member.whatsapp && member.whatsapp === member.phone,
      cpf: member.cpf ?? "", rg: member.rg ?? "", rg_orgao_expedidor: member.rg_orgao_expedidor ?? "",
      phone_recado: member.phone_recado ?? "", phone_recado_nome: member.phone_recado_nome ?? "",
      cep: member.cep ?? "", address: member.address ?? "", numero: member.numero ?? "", complemento: member.complemento ?? "",
      neighborhood: member.neighborhood ?? "", city: member.city ?? "", state: member.state ?? "",
      gender: member.gender ?? "", marital_status: member.marital_status ?? "",
    },
  });

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function onSubmit(v: FormValues) {
    if (!consent) { setErr("É necessário aceitar o termo de consentimento (LGPD) para continuar."); return; }
    setBusy(true); setErr("");
    try {
      let photoUrl = member.photo_url ?? null;
      if (photoFile) {
        photoUrl = await uploadMemberPhoto(supabase, member.id, photoFile);
      }
      const { phone_is_whatsapp, ...rest } = v;
      await updateMember(supabase, member.id, {
        ...rest,
        whatsapp: phone_is_whatsapp ? v.phone : null,
        photo_url: photoUrl,
        consent_accepted_at: new Date().toISOString(),
        photo_consent_accepted_at: photoConsent ? new Date().toISOString() : member.photo_consent_accepted_at ?? null,
      });
      await logAudit(supabase, "update", "members", member.id, { acao: "complementacao_cadastro" });
      qc.invalidateQueries({ queryKey: ["member-completion", member.id] });
      qc.invalidateQueries({ queryKey: ["my-member"] });
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao salvar. Tente novamente.");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Complete seu cadastro</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Foto */}
          <div className="flex flex-col items-center gap-2">
            <button
              type="button" onClick={() => fileInputRef.current?.click()}
              className="group relative h-24 w-24 overflow-hidden rounded-full border-2 border-dashed border-muted-foreground/40 bg-muted/30"
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Foto do membro" className="h-full w-full object-cover" />
              ) : (
                <Camera className="absolute inset-0 m-auto h-8 w-8 text-muted-foreground" />
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-[10px] font-semibold text-white opacity-0 group-hover:opacity-100">
                Trocar foto
              </span>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handlePhotoChange} />
            <p className="text-xs text-muted-foreground">Toque pra tirar uma foto ou escolher da galeria</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Data de nascimento</Label><Input type="date" {...register("birth_date")} /></div>
            <div>
              <Label>Telefone principal</Label>
              <Input {...register("phone")} placeholder="(00) 00000-0000" />
              <label className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <input type="checkbox" {...register("phone_is_whatsapp")} />
                Este número também é WhatsApp
              </label>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>CPF</Label><Input {...register("cpf")} placeholder="000.000.000-00" /></div>
            <div><Label>RG</Label><Input {...register("rg")} /></div>
            <div><Label>Órgão expedidor (RG)</Label><Input {...register("rg_orgao_expedidor")} placeholder="SSP/DF" /></div>
            <div><Label>Estado civil</Label>
              <select {...register("marital_status")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">— Selecione —</option>
                <option value="solteiro">Solteiro(a)</option>
                <option value="casado">Casado(a)</option>
                <option value="divorciado">Divorciado(a)</option>
                <option value="viuvo">Viúvo(a)</option>
              </select>
            </div>
            <div><Label>Sexo</Label>
              <select {...register("gender")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">— Selecione —</option>
                <option value="masculino">Masculino</option>
                <option value="feminino">Feminino</option>
                <option value="outro">Outro</option>
                <option value="prefiro_nao_informar">Prefiro não informar</option>
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Telefone de recado</Label><Input {...register("phone_recado")} /></div>
            <div><Label>Nome do contato de recado</Label><Input {...register("phone_recado_nome")} /></div>
          </div>

          <div className="rounded-md border bg-muted/20 p-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Endereço</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div><Label>CEP</Label><Input {...register("cep")} placeholder="00000-000" /></div>
              <div className="sm:col-span-2"><Label>Logradouro</Label><Input {...register("address")} /></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div><Label>Número</Label><Input {...register("numero")} /></div>
              <div><Label>Complemento</Label><Input {...register("complemento")} /></div>
              <div><Label>Bairro</Label><Input {...register("neighborhood")} /></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Cidade</Label><Input {...register("city")} /></div>
              <div><Label>Estado</Label><Input {...register("state")} placeholder="DF" /></div>
            </div>
          </div>

          <div className="space-y-2 rounded-md border border-navy-100 bg-navy-50/40 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-navy"><ShieldCheck className="h-3.5 w-3.5" /> Privacidade (LGPD)</p>
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
              Autorizo o uso dos meus dados pessoais pela CEC Family para fins administrativos e ministeriais, podendo corrigi-los ou solicitar sua exclusão a qualquer momento.
            </label>
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={photoConsent} onChange={(e) => setPhotoConsent(e.target.checked)} className="mt-0.5" />
              Autorizo o uso da minha foto na futura Carteirinha de Membro da CEC.
            </label>
          </div>

          {err && <p className="text-sm text-destructive">{err}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 gap-1"><X className="h-4 w-4" />Cancelar</Button>
            <Button type="submit" disabled={busy} className="flex-1 gap-1.5">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
