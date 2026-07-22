"use client";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface UserSession {
  id: string; device_label: string; ip: string | null;
  created_at: string; last_seen_at: string; is_active: boolean;
}

const SESSION_TOKEN_KEY = "cec_session_token";

function getOrCreateSessionToken(): string {
  if (typeof window === "undefined") return "";
  let token = window.localStorage.getItem(SESSION_TOKEN_KEY);
  if (!token) {
    token = crypto.randomUUID();
    window.localStorage.setItem(SESSION_TOKEN_KEY, token);
  }
  return token;
}

function detectDeviceLabel(): string {
  if (typeof navigator === "undefined") return "Dispositivo desconhecido";
  const ua = navigator.userAgent;
  const browser = /Chrome/.test(ua) ? "Chrome" : /Firefox/.test(ua) ? "Firefox" : /Safari/.test(ua) ? "Safari" : /Edg/.test(ua) ? "Edge" : "Navegador";
  const os = /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "Mac" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "";
  return `${browser} · ${os}`.trim();
}

/** Registra/atualiza a sessão atual. Chamar após login e periodicamente. */
export async function touchCurrentSession(sb: SupabaseClient): Promise<void> {
  const token = getOrCreateSessionToken();
  if (!token) return;
  await sb.rpc("touch_session", {
    p_session_token: token, p_device_label: detectDeviceLabel(), p_user_agent: navigator.userAgent,
  });
}

export function getCurrentSessionToken(): string {
  return getOrCreateSessionToken();
}

export async function listMySessions(sb: SupabaseClient): Promise<UserSession[]> {
  const { data, error } = await sb.from("user_sessions").select("*")
    .eq("is_active", true).order("last_seen_at", { ascending: false });
  if (error) { console.error("[security] listMySessions", error); return []; }
  return (data ?? []) as UserSession[];
}

export async function endSession(sb: SupabaseClient, sessionId: string): Promise<void> {
  const { error } = await sb.rpc("end_session", { p_session_id: sessionId });
  if (error) throw error;
}

/** Sai de TODOS os dispositivos (invalida os tokens de verdade, via Supabase Auth). */
export async function signOutEverywhere(sb: SupabaseClient): Promise<void> {
  const { error } = await sb.auth.signOut({ scope: "global" });
  if (error) throw error;
}

export async function changeMyPassword(sb: SupabaseClient, newPassword: string): Promise<void> {
  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/** Admin envia e-mail de redefinição de senha pra outro usuário. */
export async function sendPasswordResetTo(sb: SupabaseClient, email: string): Promise<void> {
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/nova-senha`,
  });
  if (error) throw error;
}
