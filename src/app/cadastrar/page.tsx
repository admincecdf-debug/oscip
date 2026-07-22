"use client";
import dynamic from "next/dynamic";
import { Suspense } from "react";

const RegisterWizard = dynamic(() => import("@/components/public/RegisterWizard"), {
  ssr: false,
  loading: () => <main className="grid h-screen place-items-center text-muted">Carregando…</main>,
});

export default function CadastrarPage() {
  return (
    <Suspense fallback={<main className="grid h-screen place-items-center text-muted">Carregando…</main>}>
      <RegisterWizard />
    </Suspense>
  );
}
