"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { GraduationCap, Plus, Users, Award, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase/client";
import { useCourses, useCourseClasses, useEnrollments, useAllMembers } from "@/hooks/use-queries";
import * as Fo from "@/services/formacao";
import { CLASS_STATUS_LABELS, ENROLLMENT_STATUS_LABELS } from "@/services/formacao";
import type { Course, CourseClass, EnrollmentStatus } from "@/types/domain";

const CATEGORY_LABELS: Record<string, string> = {
  formacao_basica: "Formação Básica", lideranca: "Liderança", ministerial: "Ministerial",
};

export function FormacaoAdmin() {
  const { data: courses = [] } = useCourses();
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedClass, setSelectedClass] = useState<CourseClass | null>(null);
  const [showNewCourse, setShowNewCourse] = useState(false);

  if (selectedClass) return <ClassDetail cls={selectedClass} onBack={() => setSelectedClass(null)} />;
  if (selectedCourse) return <CourseDetail course={selectedCourse} onBack={() => setSelectedCourse(null)} onOpenClass={setSelectedClass} />;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl text-navy flex items-center gap-2"><GraduationCap className="h-5 w-5 text-gold" />Formação</h2>
          <p className="text-sm text-muted-foreground">Cursos, turmas e matrículas — Encontro com Deus, CTL, Escola de Líderes, TADEL, etc.</p>
        </div>
        <Button size="sm" onClick={() => setShowNewCourse(true)} className="gap-1.5"><Plus className="h-4 w-4" />Novo curso</Button>
      </div>

      {showNewCourse && <NewCourseForm onClose={() => setShowNewCourse(false)} />}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((c) => (
          <button key={c.id} onClick={() => setSelectedCourse(c)} className="text-left">
            <Card className="h-full transition hover:shadow-md">
              <CardContent className="pt-4">
                <p className="font-semibold text-navy">{c.name}</p>
                {c.category && <p className="text-xs text-gold">{CATEGORY_LABELS[c.category] ?? c.category}</p>}
                {c.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{c.description}</p>}
                {!c.is_active && <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">Inativo</span>}
              </CardContent>
            </Card>
          </button>
        ))}
        {courses.length === 0 && <p className="col-span-full py-8 text-center text-sm text-muted-foreground">Nenhum curso cadastrado ainda.</p>}
      </div>
    </div>
  );
}

function NewCourseForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("formacao_basica");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await Fo.createCourse(supabase, { name, category, description });
      qc.invalidateQueries({ queryKey: ["courses"] });
      onClose();
    } finally { setBusy(false); }
  }

  return (
    <Card><CardContent className="space-y-3 pt-4">
      <div><Label className="text-xs">Nome do curso</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Encontro com Deus" /></div>
      <div><Label className="text-xs">Categoria</Label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          <option value="formacao_basica">Formação Básica</option>
          <option value="lideranca">Liderança</option>
          <option value="ministerial">Ministerial</option>
        </select>
      </div>
      <div><Label className="text-xs">Descrição (opcional)</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      <div className="flex gap-2"><Button onClick={save} disabled={busy}>{busy ? "Salvando…" : "Criar curso"}</Button><Button variant="outline" onClick={onClose}>Cancelar</Button></div>
    </CardContent></Card>
  );
}

function CourseDetail({ course, onBack, onOpenClass }: { course: Course; onBack: () => void; onOpenClass: (c: CourseClass) => void }) {
  const qc = useQueryClient();
  const { data: classes = [] } = useCourseClasses(course.id);
  const [showNewClass, setShowNewClass] = useState(false);
  const [name, setName] = useState(""); const [startDate, setStartDate] = useState(""); const [endDate, setEndDate] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveClass() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await Fo.createClass(supabase, { course_id: course.id, name, start_date: startDate || undefined, end_date: endDate || undefined });
      qc.invalidateQueries({ queryKey: ["course-classes", course.id] });
      setShowNewClass(false); setName(""); setStartDate(""); setEndDate("");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4 p-4">
      <button onClick={onBack} className="text-sm text-muted-foreground hover:text-navy">← Voltar pra Formação</button>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-navy">{course.name}</h2>
        <Button size="sm" onClick={() => setShowNewClass(true)} className="gap-1.5"><Plus className="h-4 w-4" />Nova turma</Button>
      </div>

      {showNewClass && (
        <Card><CardContent className="space-y-3 pt-4">
          <div><Label className="text-xs">Nome da turma</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Turma Jan/2026" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Início</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div><Label className="text-xs">Fim</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          </div>
          <div className="flex gap-2"><Button onClick={saveClass} disabled={busy}>{busy ? "Salvando…" : "Criar turma"}</Button><Button variant="outline" onClick={() => setShowNewClass(false)}>Cancelar</Button></div>
        </CardContent></Card>
      )}

      <div className="space-y-2">
        {classes.map((c) => (
          <button key={c.id} onClick={() => onOpenClass(c)} className="flex w-full items-center justify-between rounded-lg border bg-card p-3 text-left shadow-sm hover:shadow-md">
            <div>
              <p className="font-semibold text-navy">{c.name}</p>
              <p className="text-xs text-muted-foreground">{c.start_date ? new Date(c.start_date).toLocaleDateString("pt-BR") : "Sem data"}</p>
            </div>
            <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">{CLASS_STATUS_LABELS[c.status]}</span>
          </button>
        ))}
        {classes.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma turma criada ainda.</p>}
      </div>
    </div>
  );
}

function ClassDetail({ cls, onBack }: { cls: CourseClass; onBack: () => void }) {
  const qc = useQueryClient();
  const { data: enrollments = [] } = useEnrollments(cls.id);
  const { data: members = [] } = useAllMembers();
  const [query, setQuery] = useState("");
  const enrolledIds = new Set(enrollments.map((e) => e.member_id));
  const results = query.trim().length >= 2 ? members.filter((m) => !enrolledIds.has(m.id) && m.full_name.toLowerCase().includes(query.toLowerCase())).slice(0, 6) : [];

  async function addMember(memberId: string) {
    await Fo.enrollMember(supabase, cls.id, memberId);
    qc.invalidateQueries({ queryKey: ["enrollments", cls.id] });
    setQuery("");
  }

  async function setStatus(id: string, status: EnrollmentStatus) {
    await Fo.updateEnrollmentStatus(supabase, id, status);
    qc.invalidateQueries({ queryKey: ["enrollments", cls.id] });
  }

  async function remove(id: string) {
    await Fo.removeEnrollment(supabase, id);
    qc.invalidateQueries({ queryKey: ["enrollments", cls.id] });
  }

  return (
    <div className="space-y-4 p-4">
      <button onClick={onBack} className="text-sm text-muted-foreground hover:text-navy">← Voltar</button>
      <h2 className="font-display text-xl text-navy">{cls.name}</h2>

      <Card><CardContent className="pt-4">
        <Label className="text-xs">Adicionar participante</Label>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome…" />
        {results.length > 0 && (
          <div className="mt-1 space-y-1 rounded-md border p-1">
            {results.map((m) => (
              <button key={m.id} onClick={() => addMember(m.id)} className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted">{m.full_name}</button>
            ))}
          </div>
        )}
      </CardContent></Card>

      <div className="space-y-1.5">
        {enrollments.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg border bg-card p-2.5">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium text-navy">{e.member_name}</p>
              {e.certificate_issued && <Award className="h-3.5 w-3.5 text-gold" />}
            </div>
            <div className="flex items-center gap-1.5">
              <select value={e.status} onChange={(ev) => setStatus(e.id, ev.target.value as EnrollmentStatus)} className="h-8 rounded-md border bg-background px-2 text-xs">
                {Object.entries(ENROLLMENT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <Button size="sm" variant="ghost" className="text-red-500" onClick={() => remove(e.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        ))}
        {enrollments.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum participante matriculado ainda.</p>}
      </div>
    </div>
  );
}
