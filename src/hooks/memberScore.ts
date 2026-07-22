"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MemberScore, BirthdayMember } from "@/types/domain";

// ── Score do Membro ──────────────────────────────────────────
export async function getMemberScores(
  sb: SupabaseClient,
  opts?: { churchId?: string; lgId?: string; band?: string }
): Promise<MemberScore[]> {
  let q = sb.from("member_score").select("*").order("score_total", { ascending: false });
  if (opts?.churchId) q = q.eq("church_id", opts.churchId);
  if (opts?.lgId)     q = q.eq("life_group_id", opts.lgId);
  if (opts?.band)     q = q.eq("engagement_band", opts.band);
  const { data, error } = await q;
  if (error) { console.error("[member_score]", error); return []; }
  return (data ?? []) as MemberScore[];
}

export async function getMemberScoreById(
  sb: SupabaseClient,
  memberId: string
): Promise<MemberScore | null> {
  const { data, error } = await sb
    .from("member_score").select("*").eq("id", memberId).single();
  if (error) { console.error("[member_score_id]", error); return null; }
  return data as MemberScore;
}

// ── Aniversariantes ──────────────────────────────────────────
export async function getBirthdaysToday(
  sb: SupabaseClient,
  churchId?: string
): Promise<BirthdayMember[]> {
  let q = sb.from("birthday_today").select("*");
  if (churchId) q = q.eq("church_id", churchId);
  const { data, error } = await q;
  if (error) { console.error("[birthday_today]", error); return []; }
  return (data ?? []) as BirthdayMember[];
}

export async function getBirthdaysMonth(
  sb: SupabaseClient,
  opts?: { churchId?: string; lgId?: string }
): Promise<BirthdayMember[]> {
  let q = sb.from("birthday_month").select("*");
  if (opts?.churchId) q = q.eq("church_id", opts.churchId);
  if (opts?.lgId)     q = q.eq("life_group_id", opts.lgId);
  const { data, error } = await q;
  if (error) { console.error("[birthday_month]", error); return []; }
  return (data ?? []) as BirthdayMember[];
}

export async function getBirthdaysUpcoming(
  sb: SupabaseClient,
  churchId?: string
): Promise<BirthdayMember[]> {
  let q = sb.from("birthday_upcoming").select("*");
  if (churchId) q = q.eq("church_id", churchId);
  const { data, error } = await q;
  if (error) { console.error("[birthday_upcoming]", error); return []; }
  return (data ?? []) as BirthdayMember[];
}
