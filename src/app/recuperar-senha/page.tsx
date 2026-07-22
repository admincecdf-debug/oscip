"use client";
import dynamic from "next/dynamic";
const ForgotPasswordForm = dynamic(() => import("@/components/public/ForgotPasswordForm"), {
  ssr: false, loading: () => <main className="grid h-screen place-items-center text-muted">Carregando…</main>,
});
export default function Page() { return <ForgotPasswordForm />; }
