"use client";
import dynamic from "next/dynamic";
const LoginForm = dynamic(() => import("@/components/public/LoginForm"), {
  ssr: false, loading: () => <main className="grid h-screen place-items-center text-muted">Carregando…</main>,
});
export default function Page() { return <LoginForm />; }
