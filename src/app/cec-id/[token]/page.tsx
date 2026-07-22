import { createClient } from "@/lib/supabase/server";
import { CheckCircle2, XCircle, IdCard } from "lucide-react";

export default async function CecIdValidationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("validate_cec_id", { p_token: token });
  const v = data?.[0];

  const ok = v?.valid;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_30%_20%,#16345A,#0E2A47_60%)] grid place-items-center p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-xl">
        <div className="mb-3 flex items-center justify-center gap-1.5 text-navy">
          <IdCard className="h-4 w-4" />
          <span className="text-xs font-bold uppercase tracking-widest">CEC ID</span>
        </div>
        {!v || !v.full_name ? (
          <>
            <XCircle className="mx-auto mb-2 h-10 w-10 text-destructive" />
            <p className="font-medium text-navy">Credencial não encontrada</p>
          </>
        ) : (
          <>
            {v.photo_url && (
              <img src={v.photo_url} alt={v.full_name} className="mx-auto mb-3 h-20 w-20 rounded-full object-cover" />
            )}
            <p className="font-display text-lg font-bold text-navy">{v.full_name}</p>
            <p className="text-sm text-gold">{v.categoria}</p>
            {v.church_name && <p className="text-xs text-muted-foreground">{v.church_name}</p>}
            <p className="mt-1 font-mono text-xs text-muted-foreground">{v.cec_id}</p>
            <div className={`mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
              ok ? "border-green-300 bg-green-50 text-green-700" : "border-red-300 bg-red-50 text-red-700"
            }`}>
              {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
              {ok ? "Credencial válida" : `Credencial ${v.card_status ?? "inválida"}`}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
