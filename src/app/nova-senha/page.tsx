"use client";
import dynamic from "next/dynamic";
const ResetPasswordForm = dynamic(() => import("@/components/public/ResetPasswordForm"), {
  ssr: false, loading: () => <main className="grid h-screen place-items-center text-muted">Carregando…</main>,
});
export default function Page() { return <ResetPasswordForm />; }
