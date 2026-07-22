import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  RegistrationEvent, RegistrationEventInput, EventRegistration, EventRegistrationSummary,
  RegisterForEventResult, MyEventRegistration,
} from "@/types/domain";

// ---------- Público ----------
export async function listPublicRegistrationEvents(sb: SupabaseClient, churchId?: string | null): Promise<RegistrationEvent[]> {
  let q = sb.from("registration_events").select("*").eq("status", "publicado").order("start_at", { ascending: true });
  if (churchId) q = q.or(`church_id.eq.${churchId},church_id.is.null`);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as RegistrationEvent[];
}

export async function getRegistrationEventBySlug(sb: SupabaseClient, slug: string): Promise<RegistrationEvent | null> {
  const { data, error } = await sb.from("registration_events").select("*").eq("slug", slug).maybeSingle();
  if (error) return null;
  return data as RegistrationEvent | null;
}

export async function registerForEvent(
  sb: SupabaseClient, eventId: string, fullName: string, email?: string | null, phone?: string | null
): Promise<RegisterForEventResult> {
  const { data, error } = await sb.rpc("register_for_event", {
    p_event_id: eventId, p_full_name: fullName, p_email: email ?? null, p_phone: phone ?? null,
  }).single();
  if (error) throw error;
  return data as RegisterForEventResult;
}

export async function cancelRegistration(sb: SupabaseClient, registrationId: string): Promise<void> {
  const { error } = await sb.rpc("cancel_event_registration", { p_registration_id: registrationId });
  if (error) throw error;
}

export async function listMyEventRegistrations(sb: SupabaseClient): Promise<MyEventRegistration[]> {
  const { data, error } = await sb
    .from("event_registrations")
    .select("*, event:registration_events(*)")
    .order("registered_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as unknown as MyEventRegistration[];
}

// ---------- Admin ----------
export async function listRegistrationEventsAdmin(sb: SupabaseClient): Promise<RegistrationEvent[]> {
  const { data, error } = await sb.from("registration_events").select("*").order("start_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as RegistrationEvent[];
}

export async function getRegistrationEventAdmin(sb: SupabaseClient, id: string): Promise<RegistrationEvent | null> {
  const { data, error } = await sb.from("registration_events").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as RegistrationEvent | null;
}

export async function createRegistrationEvent(sb: SupabaseClient, input: RegistrationEventInput): Promise<RegistrationEvent> {
  const { data: { user } } = await sb.auth.getUser();
  const { data, error } = await sb.from("registration_events").insert({ ...input, created_by: user?.id ?? null }).select().single();
  if (error) throw error;
  return data as RegistrationEvent;
}

export async function updateRegistrationEvent(sb: SupabaseClient, id: string, input: RegistrationEventInput): Promise<RegistrationEvent> {
  const { data, error } = await sb.from("registration_events").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data as RegistrationEvent;
}

export async function listEventRegistrations(sb: SupabaseClient, eventId: string): Promise<EventRegistration[]> {
  const { data, error } = await sb.from("event_registrations").select("*").eq("event_id", eventId).order("registered_at");
  if (error) throw error;
  return (data ?? []) as EventRegistration[];
}

export async function getRegistrationSummary(sb: SupabaseClient, eventId: string): Promise<EventRegistrationSummary | null> {
  const { data, error } = await sb.rpc("event_registration_summary", { p_event_id: eventId }).maybeSingle();
  if (error) throw error;
  return data as EventRegistrationSummary | null;
}
