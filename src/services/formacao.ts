"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Course, CourseClass, CourseEnrollment, CourseEnrollmentView, FormacaoStats, EnrollmentStatus, ClassStatus } from "@/types/domain";

// ── Cursos ────────────────────────────────────────────────────
export async function listCourses(sb: SupabaseClient): Promise<Course[]> {
  const { data, error } = await sb.from("courses").select("*").order("name");
  if (error) { console.error("[formacao] listCourses", error); return []; }
  return (data ?? []) as Course[];
}

export async function createCourse(sb: SupabaseClient, input: { name: string; description?: string; category?: string; church_id?: string | null }): Promise<void> {
  const { error } = await sb.from("courses").insert(input);
  if (error) throw error;
}

export async function updateCourse(sb: SupabaseClient, id: string, patch: Partial<Course>): Promise<void> {
  const { error } = await sb.from("courses").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCourse(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("courses").delete().eq("id", id);
  if (error) throw error;
}

// ── Turmas ────────────────────────────────────────────────────
export async function listClasses(sb: SupabaseClient, courseId?: string): Promise<CourseClass[]> {
  let q = sb.from("course_classes").select("*").order("start_date", { ascending: false });
  if (courseId) q = q.eq("course_id", courseId);
  const { data, error } = await q;
  if (error) { console.error("[formacao] listClasses", error); return []; }
  return (data ?? []) as CourseClass[];
}

export async function createClass(sb: SupabaseClient, input: {
  course_id: string; church_id?: string | null; name: string; instructor_id?: string | null;
  location?: string; start_date?: string; end_date?: string; max_vagas?: number;
}): Promise<void> {
  const { error } = await sb.from("course_classes").insert(input);
  if (error) throw error;
}

export async function updateClass(sb: SupabaseClient, id: string, patch: Partial<CourseClass>): Promise<void> {
  const { error } = await sb.from("course_classes").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteClass(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("course_classes").delete().eq("id", id);
  if (error) throw error;
}

// ── Matrículas ────────────────────────────────────────────────
export async function listEnrollments(sb: SupabaseClient, classId?: string): Promise<CourseEnrollmentView[]> {
  let q = sb.from("course_enrollments_view").select("*").order("enrolled_at", { ascending: false });
  if (classId) q = q.eq("class_id", classId);
  const { data, error } = await q;
  if (error) { console.error("[formacao] listEnrollments", error); return []; }
  return (data ?? []) as CourseEnrollmentView[];
}

export async function listMemberEnrollments(sb: SupabaseClient, memberId: string): Promise<CourseEnrollmentView[]> {
  const { data, error } = await sb.from("course_enrollments_view").select("*").eq("member_id", memberId).order("enrolled_at", { ascending: false });
  if (error) { console.error("[formacao] listMemberEnrollments", error); return []; }
  return (data ?? []) as CourseEnrollmentView[];
}

export async function enrollMember(sb: SupabaseClient, classId: string, memberId: string): Promise<void> {
  const { error } = await sb.from("course_enrollments").insert({ class_id: classId, member_id: memberId });
  if (error) throw error;
}

export async function updateEnrollmentStatus(sb: SupabaseClient, id: string, status: EnrollmentStatus): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (status === "concluido") patch.completed_at = new Date().toISOString();
  const { error } = await sb.from("course_enrollments").update(patch).eq("id", id);
  if (error) throw error;
}

export async function removeEnrollment(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("course_enrollments").delete().eq("id", id);
  if (error) throw error;
}

// ── Indicadores ──────────────────────────────────────────────
export async function getFormacaoStats(sb: SupabaseClient, churchId: string | null): Promise<FormacaoStats | null> {
  const { data, error } = await sb.rpc("dashboard_formacao_scoped", { p_church_id: churchId }).maybeSingle();
  if (error) { console.error("[formacao] getFormacaoStats", error); return null; }
  return data as FormacaoStats | null;
}

export const CLASS_STATUS_LABELS: Record<ClassStatus, string> = {
  planejada: "Planejada", em_andamento: "Em andamento", concluida: "Concluída", cancelada: "Cancelada",
};
export const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  matriculado: "Matriculado", cursando: "Cursando", concluido: "Concluído", desistente: "Desistente",
};
