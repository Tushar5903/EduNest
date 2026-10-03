"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpRight, BarChart3, Bell, BookOpen, CalendarDays, CheckCircle2, ChevronDown,
  ClipboardCheck, DollarSign, Download, FileText, GraduationCap, LayoutDashboard, LifeBuoy,
  MoreHorizontal, Plus, Search, Settings2, ShieldAlert, Users, WalletCards, XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, apiPatch, apiPost } from "@/lib/api";
import { ChartCard, EmptyState, Skeleton, StatCard, StatusBadge } from "@/components/ui";
import { Area as AreaRaw, AreaChart, Bar as BarRaw, BarChart, CartesianGrid, Cell, Pie as PieRaw, PieChart, ResponsiveContainer, Tooltip as TooltipRaw, XAxis as XAxisRaw, YAxis as YAxisRaw } from "recharts";
import { toast } from "sonner";

type RecordValue = string | number | boolean | null | undefined;
type Row = Record<string, RecordValue | object>;
type ListResponse = { data: Row[]; page?: number; total?: number };
type ResourceResponse = ListResponse | Report | Row[];
const CURRENT_ACADEMIC_YEAR = (() => {
  const now = new Date();
  const startYear = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
})();
const CURRENT_PAYROLL_MONTH = (() => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
})();
type Report = { headcounts: { students: number; teachers: number; classes: number }; gender: Record<string, number>; fees: { collected: number; totalDue: number; percent: number }; attendanceDocs: number; complaints: number; avgMarks: number };

const Area = AreaRaw as unknown as React.ComponentType<Record<string, unknown>>;
const Bar = BarRaw as unknown as React.ComponentType<Record<string, unknown>>;
const Pie = PieRaw as unknown as React.ComponentType<Record<string, unknown>>;
const Tooltip = TooltipRaw as unknown as React.ComponentType<Record<string, unknown>>;
const XAxis = XAxisRaw as unknown as React.ComponentType<Record<string, unknown>>;
const YAxis = YAxisRaw as unknown as React.ComponentType<Record<string, unknown>>;

const routeConfig: Record<string, { title: string; eyebrow: string; description: string; endpoint?: string; icon: typeof Users; columns?: string[] }> = {
  students: { title: "Students Directory", eyebrow: "Dashboard / People", description: "Manage student enrollments, academic records, and personal profiles.", endpoint: "/admin/students?page=1&limit=20", icon: GraduationCap, columns: ["name", "loginId", "classId", "rollNo", "status"] },
  teachers: { title: "Faculty & Teachers Directory", eyebrow: "Dashboard / People", description: "Manage faculty, department assignments, teaching loads, and contact details.", endpoint: "/admin/teachers?page=1&limit=20", icon: Users, columns: ["name", "loginId", "subject", "phone", "status"] },
  classes: { title: "Classes & Section Management", eyebrow: "Dashboard / People", description: "Review academic divisions, section capacities, mentors, and room assignments.", endpoint: `/classes?academicYear=${CURRENT_ACADEMIC_YEAR}`, icon: BookOpen, columns: ["name", "section", "standard", "feeAmount", "academicYear", "teacherId"] },
  timetable: { title: "Weekly Timetable & Scheduling", eyebrow: "Dashboard / Academic Management", description: "Manage class schedules, teacher allocations, rooms, and conflict-aware schedule slots.", endpoint: "/timetables", icon: CalendarDays, columns: ["day", "startTime", "endTime", "subject", "room"] },
  attendance: { title: "Attendance Management & Monitoring", eyebrow: "Dashboard / Academic Management", description: "Campus-wide attendance verification with date, class, and status filters.", endpoint: "/attendance?date=2024-10-31", icon: ClipboardCheck, columns: ["date", "classId", "status", "markedBy"] },
  tests: { title: "Examinations & Assessments", eyebrow: "Dashboard / Academic Management", description: "Schedule tests, assign venues, and track assessment progress.", endpoint: "/tests", icon: FileText, columns: ["title", "subject", "date", "maxMarks", "classId"] },
  results: { title: "Examination Results & Gradebook", eyebrow: "Dashboard / Academic Management", description: "Review marks, class performance, grade distributions, and publication status.", endpoint: "/results", icon: BarChart3, columns: ["exam", "studentId", "classId", "subjects"] },
  fees: { title: "Fee Management & Accounts", eyebrow: "Dashboard / Finance", description: "Monitor fee collection, outstanding balances, receipts, and payment status.", endpoint: "/fees", icon: WalletCards, columns: ["studentId", "head", "amount", "dueDate", "status"] },
  salary: { title: "Staff Salary & Payroll", eyebrow: "Dashboard / Finance", description: "Manage payroll periods, salary records, deductions, and disbursement status.", endpoint: `/salary?month=${CURRENT_PAYROLL_MONTH}`, icon: DollarSign, columns: ["teacherId", "month", "amount", "status", "paidAt"] },
  notices: { title: "Notices & Institutional Circulars", eyebrow: "Dashboard / Communication", description: "Publish official announcements to students, guardians, and faculty.", endpoint: "/notices?limit=20", icon: Bell, columns: ["title", "audience", "type", "createdAt"] },
  complaints: { title: "Complaints & Grievance Redressal", eyebrow: "Dashboard / Communication", description: "Track, investigate, assign, and resolve institutional grievances.", endpoint: "/admin/complaints", icon: LifeBuoy, columns: ["subject", "category", "status", "createdAt"] },
  reports: { title: "Comprehensive School Reports", eyebrow: "Dashboard / Insights", description: "Inspect institution-wide enrollment, attendance, finance, and performance insights.", endpoint: "/admin/reports/school", icon: BarChart3 },
  settings: { title: "System & Institution Settings", eyebrow: "Dashboard / System", description: "Configure school profile, academic policies, security, and communication preferences.", icon: Settings2 },
};

function asText(value: RecordValue | object): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return Array.isArray(value) ? `${value.length} items` : "Configured";
  return String(value);
}

function responseRows(data: ResourceResponse | undefined): Row[] {
  if (Array.isArray(data)) return data;
  return data && "data" in data && Array.isArray(data.data) ? data.data : [];
}

function useResource(endpoint?: string) {
  return useQuery({ queryKey: ["admin-resource", endpoint], queryFn: () => api<ResourceResponse>(endpoint!), enabled: Boolean(endpoint) });
}

function Header({ title, eyebrow, description, icon: Icon = LayoutDashboard, action, onAction, onExport }: { title: string; eyebrow: string; description: string; icon?: typeof Users; action?: string; onAction?: () => void; onExport?: () => void }) {
  const buttonLabel = action ?? ({ "Students Directory": "Add Student", "Faculty & Teachers Directory": "Add Teacher", "Classes & Section Management": "Add Class", "Weekly Timetable & Scheduling": "Add Timetable", "Attendance Management & Monitoring": "Mark Attendance", "Examinations & Assessments": "Add Test", "Examination Results & Gradebook": "Add Result", "Fee Management & Accounts": "Add Fee Record", "Staff Salary & Payroll": "Add Salary Record", "Notices & Institutional Circulars": "Create Notice", "Complaints & Grievance Redressal": "Log Complaint" } as Record<string, string>)[title] ?? "Create New";
  return <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-[#e6e2f8] bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
    <div><div className="mb-2 text-xs font-semibold uppercase tracking-[.16em] text-[#77749d]">{eyebrow}</div><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-[#eeecff] text-[#272757]"><Icon size={22} /></div><h1 className="font-display text-2xl font-bold tracking-tight text-[#151444]">{title}</h1></div><p className="mt-2 max-w-2xl text-sm text-[#77748d]">{description}</p></div>
    <div className="flex shrink-0 gap-2"><button onClick={onExport ?? (() => window.print())} className="inline-flex items-center gap-2 rounded-xl border border-[#ddd9f4] px-4 py-2.5 text-sm font-semibold text-[#272757] hover:bg-[#f7f5ff]"><Download size={16} /> Export</button><button onClick={onAction ?? (() => toast.info("This action requires a backend workflow that is not exposed yet."))} className="inline-flex items-center gap-2 rounded-xl bg-[#272757] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1d1c45]"><Plus size={16} /> {buttonLabel}</button></div>
  </div>;
}

function Filters({ onSearch }: { onSearch: (value: string) => void }) {
  return <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#e6e2f8] bg-white p-4 sm:flex-row"><div className="relative flex-1"><Search size={17} className="absolute left-3 top-3 text-[#9793b1]" /><input onChange={(event) => onSearch(event.target.value)} placeholder="Search by name, ID, subject, or record..." className="h-10 w-full rounded-xl bg-[#f5f3ff] pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#aaa9dc]" /></div>{["All Grades", "All Statuses", `Academic Year ${CURRENT_ACADEMIC_YEAR}`].map((label) => <button key={label} className="inline-flex h-10 items-center justify-between gap-4 rounded-xl bg-[#f5f3ff] px-3 text-sm text-[#4f4c76]">{label}<ChevronDown size={15} /></button>)}</div>;
}

const createFields: Record<string, { name: string; label: string; type?: string; required?: boolean }[]> = {
  students: [{ name: "name", label: "Student name", required: true }, { name: "classId", label: "Classes", required: true }, { name: "gender", label: "Gender" }, { name: "phone", label: "Guardian phone" }],
  teachers: [{ name: "name", label: "Teacher name", required: true }, { name: "subject", label: "Subject", required: true }, { name: "phone", label: "Phone", required: true }, { name: "gender", label: "Gender" }, { name: "salaryAmount", label: "Monthly salary", type: "number" }],
  classes: [{ name: "name", label: "Class name", required: true }, { name: "section", label: "Section", required: true }, { name: "standard", label: "Standard", required: true }, { name: "feeAmount", label: "Monthly fee", type: "number", required: true }],
  timetable: [{ name: "classId", label: "Class", required: true }, { name: "subject", label: "Subject", required: true }, { name: "teacherId", label: "Teacher", required: true }, { name: "day", label: "Day", required: true }, { name: "startTime", label: "Start time", required: true }, { name: "endTime", label: "End time", required: true }, { name: "room", label: "Room", required: true }],
  tests: [{ name: "classId", label: "Class", required: true }, { name: "subject", label: "Subject", required: true }, { name: "title", label: "Assessment title", required: true }, { name: "date", label: "Date", type: "date", required: true }, { name: "maxMarks", label: "Maximum marks", type: "number", required: true }],
  fees: [{ name: "studentId", label: "Student ID", required: true }, { name: "amount", label: "Amount", type: "number", required: true }, { name: "dueDate", label: "Due date", type: "date", required: true }, { name: "head", label: "Fee head", required: true }],
  salary: [{ name: "teacherId", label: "Teacher ID", required: true }, { name: "month", label: "Payroll month", type: "month", required: true }, { name: "amount", label: "Amount", type: "number", required: true }],
  notices: [{ name: "title", label: "Notice title", required: true }, { name: "body", label: "Message body", required: true }, { name: "audience", label: "Audience", required: true }],
};

const createEndpoints: Record<string, string> = { students: "/admin/students", teachers: "/admin/teachers", classes: "/classes", timetable: "/timetables", tests: "/tests", fees: "/fees", salary: "/salary", notices: "/notices" };

function NoticeCreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const classesQuery = useQuery({ queryKey: ["notice-create-classes"], queryFn: () => api<ResourceResponse>(`/classes?academicYear=${CURRENT_ACADEMIC_YEAR}`) });
  const classes = responseRows(classesQuery.data);
  const [title, setTitle] = useState(""); const [body, setBody] = useState(""); const [audience, setAudience] = useState("all"); const [classIds, setClassIds] = useState<string[]>([]); const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (audience === "class" && !classIds.length) { toast.error("Select at least one target class"); return; } setSaving(true); try { await apiPost("/notices", { title, body, audience, ...(audience === "class" ? { classIds, classId: classIds[0] } : {}) }); toast.success("Notice created"); onCreated(); onClose(); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to create notice"); } finally { setSaving(false); } }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#0f0e47]/50 p-4"><form onSubmit={submit} className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><div className="text-xs font-semibold uppercase tracking-wider text-[#77749d]">Communication</div><h2 className="mt-1 font-display text-xl font-bold text-[#151444]">Create Notice</h2></div><button type="button" onClick={onClose} aria-label="Close dialog"><XCircle size={20} /></button></div><label className="mt-5 block text-sm font-semibold text-[#35325f]">Notice title<input required value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#ddd9f4] px-3 text-sm font-normal" /></label><label className="mt-4 block text-sm font-semibold text-[#35325f]">Notice body<textarea required value={body} onChange={(event) => setBody(event.target.value)} rows={6} className="mt-1.5 w-full resize-y rounded-xl border border-[#ddd9f4] px-3 py-3 text-sm font-normal" /></label><label className="mt-4 block text-sm font-semibold text-[#35325f]">Audience<select value={audience} onChange={(event) => { setAudience(event.target.value); if (event.target.value !== "class") setClassIds([]); }} className="mt-1.5 h-11 w-full rounded-xl border border-[#ddd9f4] px-3 text-sm font-normal"><option value="all">All classes</option><option value="class">Selected classes</option><option value="student">Students</option><option value="teacher">Teachers</option></select></label>{audience === "class" ? <label className="mt-4 block text-sm font-semibold text-[#35325f]">Target classes<select multiple required value={classIds} onChange={(event) => setClassIds(Array.from(event.target.selectedOptions).map((option) => option.value))} className="mt-1.5 h-28 w-full rounded-xl border border-[#ddd9f4] px-3 py-2 text-sm font-normal">{classes.map((item, index) => <option key={String(item.id ?? index)} value={asText(item.id)}>{asText(item.name)}{item.standard ? ` · Standard ${asText(item.standard)}` : ""}{item.section ? ` — Section ${asText(item.section)}` : ""}</option>)}</select></label> : null}<div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl bg-[#f0efff] px-4 py-2.5 text-sm font-semibold text-[#272757]">Cancel</button><button disabled={saving} className="rounded-xl bg-[#272757] px-4 py-2.5 text-sm font-semibold text-white">{saving ? "Saving…" : "Create notice"}</button></div></form></div>;
}

function TestCreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const classesQuery = useQuery({ queryKey: ["test-create-classes"], queryFn: () => api<ResourceResponse>(`/classes?academicYear=${CURRENT_ACADEMIC_YEAR}`) });
  const classes = responseRows(classesQuery.data); const [classId, setClassId] = useState(""); const [subject, setSubject] = useState(""); const [title, setTitle] = useState(""); const [date, setDate] = useState(""); const [maxMarks, setMaxMarks] = useState(""); const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); try { await apiPost("/tests", { classId, subject, title, date, maxMarks: Number(maxMarks) }); toast.success("Test created"); onCreated(); onClose(); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to create test"); } finally { setSaving(false); } }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#0f0e47]/50 p-4"><form onSubmit={submit} className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><h2 className="font-display text-xl font-bold text-[#151444]">Add Test</h2><button type="button" onClick={onClose} aria-label="Close dialog"><XCircle size={20} /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-[#35325f] sm:col-span-2">Class<select required value={classId} onChange={(event) => setClassId(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#ddd9f4] px-3 text-sm font-normal"><option value="">{classesQuery.isLoading ? "Loading classes…" : classes.length ? "Select a class" : "No classes available"}</option>{classes.map((item, index) => <option key={String(item.id ?? index)} value={asText(item.id)}>{asText(item.name)}{item.standard ? ` · Standard ${asText(item.standard)}` : ""}{item.section ? ` — Section ${asText(item.section)}` : ""}</option>)}</select></label><label className="text-sm font-semibold text-[#35325f]">Subject<input required value={subject} onChange={(event) => setSubject(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#ddd9f4] px-3 text-sm font-normal" /></label><label className="text-sm font-semibold text-[#35325f]">Title<input required value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#ddd9f4] px-3 text-sm font-normal" /></label><label className="text-sm font-semibold text-[#35325f]">Date<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#ddd9f4] px-3 text-sm font-normal" /></label><label className="text-sm font-semibold text-[#35325f]">Maximum marks<input required min="1" type="number" value={maxMarks} onChange={(event) => setMaxMarks(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#ddd9f4] px-3 text-sm font-normal" /></label></div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl bg-[#f0efff] px-4 py-2.5 text-sm font-semibold">Cancel</button><button disabled={saving || !classId} className="rounded-xl bg-[#272757] px-4 py-2.5 text-sm font-semibold text-white">{saving ? "Saving…" : "Add test"}</button></div></form></div>;
}

function ResultCreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const testsQuery = useQuery({ queryKey: ["result-create-tests"], queryFn: () => api<ResourceResponse>("/tests") });
  const studentsQuery = useQuery({ queryKey: ["result-create-students"], queryFn: () => api<ResourceResponse>("/admin/students?page=1&limit=100") });
  const tests = responseRows(testsQuery.data); const students = responseRows(studentsQuery.data);
  const [testId, setTestId] = useState(""); const [studentId, setStudentId] = useState(""); const [marks, setMarks] = useState(""); const [saving, setSaving] = useState(false);
  const test = tests.find((item) => asText(item.id) === testId);
  const classId = asText(test?.classId);
  const eligibleStudents = students.filter((student) => { const ids = Array.isArray(student.classIds) ? student.classIds.map(String) : [asText(student.classId)]; return ids.includes(classId); });
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (!test || !studentId) return; const value = Number(marks); if (!Number.isFinite(value) || value < 0 || value > Number(test.maxMarks)) { toast.error(`Marks must be between 0 and ${asText(test.maxMarks)}`); return; } setSaving(true); try { await apiPost("/results", { classId, exam: asText(test.title), studentId, subjects: [{ name: asText(test.subject), marks: value, max: Number(test.maxMarks) }] }); toast.success("Result uploaded"); onCreated(); onClose(); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to upload result"); } finally { setSaving(false); } }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#0f0e47]/50 p-4"><form onSubmit={submit} className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><div className="text-xs font-semibold uppercase tracking-wider text-[#77749d]">Assessment</div><h2 className="mt-1 font-display text-xl font-bold text-[#151444]">Upload Result</h2></div><button type="button" onClick={onClose} aria-label="Close dialog"><XCircle size={20} /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-[#35325f] sm:col-span-2">Scheduled test<select required value={testId} onChange={(event) => { setTestId(event.target.value); setStudentId(""); }} className="mt-1.5 h-11 w-full rounded-xl border border-[#ddd9f4] px-3 text-sm font-normal"><option value="">{testsQuery.isLoading ? "Loading tests…" : "Select a test"}</option>{tests.map((item, index) => <option key={String(item.id ?? index)} value={asText(item.id)}>{asText(item.title)} — {asText(item.subject)}</option>)}</select></label><label className="text-sm font-semibold text-[#35325f] sm:col-span-2">Student<select required value={studentId} onChange={(event) => setStudentId(event.target.value)} disabled={!test} className="mt-1.5 h-11 w-full rounded-xl border border-[#ddd9f4] px-3 text-sm font-normal"><option value="">{test ? "Select a student" : "Select a test first"}</option>{eligibleStudents.map((student, index) => <option key={String(student.id ?? index)} value={asText(student.id)}>{asText(student.name)}{student.loginId ? ` — ${asText(student.loginId)}` : ""}</option>)}</select></label><label className="text-sm font-semibold text-[#35325f]">Marks<input required min="0" max={asText(test?.maxMarks)} type="number" value={marks} onChange={(event) => setMarks(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#ddd9f4] px-3 text-sm font-normal" /></label><div className="rounded-xl bg-[#f5f3ff] p-3 text-sm text-[#535078]">Maximum marks<br /><strong>{asText(test?.maxMarks)}</strong></div></div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl bg-[#f0efff] px-4 py-2.5 text-sm font-semibold">Cancel</button><button disabled={saving || !test || !studentId} className="rounded-xl bg-[#272757] px-4 py-2.5 text-sm font-semibold text-white">{saving ? "Uploading…" : "Upload result"}</button></div></form></div>;
}

function EnhancedCreateModal({ kind, onClose, onCreated }: { kind: "students" | "teachers" | "timetable"; onClose: () => void; onCreated: () => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [days, setDays] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const classesQuery = useQuery({ queryKey: ["create-options", "classes"], queryFn: () => api<ResourceResponse>(`/classes?academicYear=${CURRENT_ACADEMIC_YEAR}`), enabled: kind === "students" || kind === "timetable" });
  const teachersQuery = useQuery({ queryKey: ["create-options", "teachers"], queryFn: () => api<ResourceResponse>("/admin/teachers?page=1&limit=100"), enabled: kind === "timetable" });
  const classOptions = responseRows(classesQuery.data);
  const teacherOptions = responseRows(teachersQuery.data);
  const fields = createFields[kind].filter((field) => field.name !== "day");
  const setValue = (name: string, value: string) => setValues((current) => ({ ...current, [name]: value }));
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (kind === "timetable" && days.length === 0) { toast.error("Select at least one weekday"); return; }
    setSaving(true);
    try {
      const payload: Record<string, string | number> = { ...values };
      if (kind === "timetable") {
        // Sequential per-day creates: one bad day (clash, inactive teacher) must not
        // silently void the rest, and each failure reports the backend reason.
        const saved: string[] = [];
        const failed: string[] = [];
        for (const day of days) {
          try {
            await apiPost(createEndpoints.timetable, { ...payload, day, type: "regular" });
            saved.push(day);
          } catch (error) {
            failed.push(`${day}${error instanceof Error ? `: ${error.message}` : ""}`);
          }
        }
        if (failed.length === 0) {
          toast.success(`${days.length} timetable slot${days.length > 1 ? "s" : ""} created`);
          onCreated(); onClose();
        } else if (saved.length === 0) {
          toast.error(`No slots saved — ${failed.join("; ")}`, { duration: 8000 });
        } else {
          toast.error(`Saved ${saved.join(", ")}; failed: ${failed.join("; ")}`, { duration: 8000 });
          onCreated(); onClose();
        }
        return;
      } else if (kind === "students") {
        const { classId, ...studentFields } = payload;
        const classIds = String(classId ?? "").split(",").filter(Boolean);
        await apiPost<{ id: string }>(createEndpoints.students, { ...studentFields, classId: classIds[0], classIds });
      } else {
        await apiPost(createEndpoints.teachers, payload);
      }
      toast.success(kind === "students" ? "Student created" : "Teacher created");
      onCreated(); onClose();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to save this record"); } finally { setSaving(false); }
  }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#0f0e47]/50 p-4"><form onSubmit={submit} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><div className="text-xs font-semibold uppercase tracking-wider text-[#77749d]">EduNest API action</div><h2 className="mt-1 font-display text-xl font-bold text-[#151444]">{routeConfig[kind].title}</h2></div><button type="button" onClick={onClose} aria-label="Close dialog" className="rounded-lg p-2 hover:bg-[#f5f3ff]"><XCircle size={20} /></button></div>{kind === "timetable" ? <div className="mt-5 rounded-2xl border border-[#e3dff7] bg-[#f8f7ff] p-4"><div className="flex items-center gap-2 text-sm font-bold text-[#272757]"><CalendarDays size={17} /> Select teaching days</div><p className="mt-1 text-xs text-[#77748d]">Choose one or more weekdays. A separate schedule slot will be saved for each.</p><div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <label key={day} className={`cursor-pointer rounded-xl border px-2 py-2 text-center text-sm font-semibold transition ${days.includes(day) ? "border-[#272757] bg-[#272757] text-white" : "border-[#ddd9f4] bg-white text-[#4f4c76] hover:border-[#aaa9dc]"}`}><input type="checkbox" className="sr-only" checked={days.includes(day)} onChange={() => setDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day])} />{day}</label>)}</div></div> : null}<div className="mt-5 grid gap-4 sm:grid-cols-2">{fields.map((field) => { const isClass = field.name === "classId"; const isTeacher = field.name === "teacherId"; const isGender = field.name === "gender"; const isTime = kind === "timetable" && (field.name === "startTime" || field.name === "endTime"); return <label key={field.name} className="text-sm font-semibold text-[#35325f]">{field.label}{field.required ? " *" : ""}{isClass ? <select required={field.required} value={values[field.name] ?? ""} onChange={(event) => setValue(field.name, event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#ddd9f4] bg-[#faf9ff] px-3 text-sm font-normal"><option value="">{classesQuery.isLoading ? "Loading classes…" : "Select a class"}</option>{classOptions.map((row, index) => <option key={String(row.id ?? index)} value={asText(row.id)}>{asText(row.name)}{row.section ? ` — ${asText(row.section)}` : ""}{row.standard ? ` · ${asText(row.standard)}` : ""}</option>)}</select> : isTeacher ? <select required={field.required} value={values[field.name] ?? ""} onChange={(event) => setValue(field.name, event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#ddd9f4] bg-[#faf9ff] px-3 text-sm font-normal"><option value="">{teachersQuery.isLoading ? "Loading teachers…" : "Select a teacher"}</option>{teacherOptions.map((row, index) => <option key={String(row.id ?? index)} value={asText(row.id)}>{asText(row.name)}{row.subject ? ` — ${asText(row.subject)}` : ""}</option>)}</select> : isGender ? <select value={values.gender ?? ""} onChange={(event) => setValue("gender", event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#ddd9f4] bg-[#faf9ff] px-3 text-sm font-normal"><option value="">Select gender</option><option value="M">Male</option><option value="F">Female</option><option value="O">Other</option></select> : <input required={field.required} type={isTime ? "time" : field.type ?? "text"} value={values[field.name] ?? ""} onChange={(event) => setValue(field.name, event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#ddd9f4] bg-[#faf9ff] px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-[#aaa9dc]" />}</label>; })}</div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl bg-[#f0efff] px-4 py-2.5 text-sm font-semibold text-[#272757]">Cancel</button><button disabled={saving} type="submit" className="rounded-xl bg-[#272757] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save record"}</button></div></form></div>;
}

function LegacyMultiStudentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [values, setValues] = useState({ name: "", classIds: [] as string[], gender: "", phone: "", feeAmount: "", feeDueDate: "", feeHead: "Tuition" });
  const [saving, setSaving] = useState(false);
  const classesQuery = useQuery({ queryKey: ["create-options", "classes"], queryFn: () => api<ResourceResponse>(`/classes?academicYear=${CURRENT_ACADEMIC_YEAR}`) });
  const classes = responseRows(classesQuery.data);
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (!values.classIds.length) { toast.error("Select at least one class"); return; } setSaving(true); try { await apiPost<{ id: string }>("/admin/students", { name: values.name, classId: values.classIds[0], classIds: values.classIds, gender: values.gender || undefined, phone: values.phone || undefined }); toast.success("Student created; monthly fee calculated from assigned classes"); onCreated(); onClose(); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to create student"); } finally { setSaving(false); } }
  const input = (name: keyof typeof values, label: string, type = "text") => <label className="text-sm font-semibold text-[#35325f]">{label}<input required={name === "name"} type={type} value={typeof values[name] === "string" ? values[name] as string : ""} onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-[#ddd9f4] bg-[#faf9ff] px-3 text-sm font-normal" /></label>;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#0f0e47]/50 p-4"><form onSubmit={submit} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><div className="text-xs font-semibold uppercase tracking-wider text-[#77749d]">EduNest API action</div><h2 className="mt-1 font-display text-xl font-bold text-[#151444]">Students Directory</h2></div><button type="button" onClick={onClose} aria-label="Close dialog"><XCircle size={20} /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2">{input("name", "Student name")}<label className="text-sm font-semibold text-[#35325f]">Classes<select multiple required value={values.classIds} onChange={(event) => setValues((current) => ({ ...current, classIds: Array.from(event.target.selectedOptions).map((option) => option.value) }))} className="mt-1.5 h-28 w-full rounded-xl border border-[#ddd9f4] bg-[#faf9ff] px-3 text-sm font-normal">{classes.map((row, index) => <option key={String(row.id ?? index)} value={asText(row.id)}>{asText(row.name)}{row.standard ? ` · Standard ${asText(row.standard)}` : ""}{row.section ? ` — Section ${asText(row.section)}` : ""}</option>)}</select></label><label className="text-sm font-semibold text-[#35325f]">Gender<select value={values.gender} onChange={(event) => setValues((current) => ({ ...current, gender: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-[#ddd9f4] bg-[#faf9ff] px-3 text-sm font-normal"><option value="">Select gender</option><option value="M">Male</option><option value="F">Female</option><option value="O">Other</option></select></label>{input("phone", "Guardian phone")}{input("feeAmount", "Initial fee amount", "number")}{input("feeDueDate", "Fee due date", "date")}{input("feeHead", "Fee head")}</div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl bg-[#f0efff] px-4 py-2.5 text-sm font-semibold text-[#272757]">Cancel</button><button disabled={saving} className="rounded-xl bg-[#272757] px-4 py-2.5 text-sm font-semibold text-white">{saving ? "Saving…" : "Save student"}</button></div></form></div>;
}

function MultiStudentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const params = useSearchParams();
  const classesQuery = useQuery({ queryKey: ["create-options", "classes"], queryFn: () => api<ResourceResponse>(`/classes?academicYear=${CURRENT_ACADEMIC_YEAR}`) });
  const classes = responseRows(classesQuery.data);
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [selected, setSelected] = useState<string[]>(() => params.get("classId") ? [params.get("classId") as string] : []);
  const [choice, setChoice] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (!name.trim() || !selected.length) { toast.error("Enter a name and add at least one class"); return; } setSaving(true); try { await apiPost("/admin/students", { name: name.trim(), classId: selected[0], classIds: selected, gender: gender || undefined, phone: phone || undefined }); toast.success("Student created; monthly fee calculated from assigned classes"); onCreated(); onClose(); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to create student"); } finally { setSaving(false); } }
  const addClass = () => { if (choice && !selected.includes(choice)) setSelected((items) => [...items, choice]); setChoice(""); };
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#0f0e47]/50 p-4"><form onSubmit={submit} className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><div className="text-xs font-semibold uppercase tracking-wider text-[#77749d]">EduNest API action</div><h2 className="mt-1 font-display text-xl font-bold text-[#151444]">Add student</h2></div><button type="button" onClick={onClose} aria-label="Close dialog"><XCircle size={20} /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-[#35325f]">Student name<input required value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#ddd9f4] bg-[#faf9ff] px-3 text-sm font-normal" /></label><label className="text-sm font-semibold text-[#35325f]">Gender<select value={gender} onChange={(event) => setGender(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#ddd9f4] bg-[#faf9ff] px-3 text-sm font-normal"><option value="">Select gender</option><option value="M">Male</option><option value="F">Female</option><option value="O">Other</option></select></label><label className="text-sm font-semibold text-[#35325f] sm:col-span-2">Add class<select value={choice} onChange={(event) => setChoice(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#ddd9f4] bg-[#faf9ff] px-3 text-sm font-normal"><option value="">Select a class</option>{classes.filter((item) => !selected.includes(asText(item.id))).map((item, index) => <option key={String(item.id ?? index)} value={asText(item.id)}>{asText(item.name)}{item.standard ? ` · Standard ${asText(item.standard)}` : ""}{item.section ? ` — Section ${asText(item.section)}` : ""}</option>)}</select><button type="button" onClick={addClass} className="mt-2 rounded-xl bg-[#f0efff] px-3 py-2 text-xs font-semibold text-[#272757]">+ Add another class</button><div className="mt-2 flex flex-wrap gap-2">{selected.map((id) => <span key={id} className="rounded-full bg-[#eeecff] px-3 py-1 text-xs font-semibold text-[#272757]">{asText(classes.find((item) => asText(item.id) === id)?.name ?? id)}<button type="button" onClick={() => setSelected((items) => items.filter((item) => item !== id))} className="ml-2 text-[#b42318]" aria-label="Remove class">×</button></span>)}</div></label><label className="text-sm font-semibold text-[#35325f] sm:col-span-2">Guardian phone<input value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#ddd9f4] bg-[#faf9ff] px-3 text-sm font-normal" /></label></div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl bg-[#f0efff] px-4 py-2.5 text-sm font-semibold text-[#272757]">Cancel</button><button disabled={saving} className="rounded-xl bg-[#272757] px-4 py-2.5 text-sm font-semibold text-white">{saving ? "Saving…" : "Save student"}</button></div></form></div>;
}

function AssignStudentModal({ classId, onClose, onCreated }: { classId: string; onClose: () => void; onCreated: () => void }) {
  const studentsQuery = useQuery({ queryKey: ["assign-students"], queryFn: () => api<ResourceResponse>("/admin/students?page=1&limit=100") });
  const [studentId, setStudentId] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (!studentId) return; setSaving(true); try { await apiPatch(`/admin/students/${studentId}/reassign`, { classId, classIds: [classId] }); toast.success("Student assigned to this class"); onCreated(); onClose(); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to assign student"); } finally { setSaving(false); } }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#0f0e47]/50 p-4"><form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><h2 className="font-display text-xl font-bold text-[#151444]">Assign existing student</h2><button type="button" onClick={onClose} aria-label="Close dialog"><XCircle size={20} /></button></div><label className="mt-5 block text-sm font-semibold text-[#35325f]">Student<select required value={studentId} onChange={(event) => setStudentId(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#ddd9f4] bg-[#faf9ff] px-3 text-sm font-normal"><option value="">Select a student</option>{responseRows(studentsQuery.data).map((student, index) => <option key={String(student.id ?? index)} value={asText(student.id)}>{asText(student.name)}{student.loginId ? ` — ${asText(student.loginId)}` : ""}</option>)}</select></label><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl bg-[#f0efff] px-4 py-2.5 text-sm font-semibold text-[#272757]">Cancel</button><button disabled={saving} className="rounded-xl bg-[#272757] px-4 py-2.5 text-sm font-semibold text-white">{saving ? "Assigning…" : "Assign student"}</button></div></form></div>;
}

function CreateModal({ kind, onClose, onCreated }: { kind: string; onClose: () => void; onCreated: () => void }) {
  const params = useSearchParams();
  const fields = createFields[kind];
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const classesQuery = useQuery({ queryKey: ["create-options", "classes"], queryFn: () => api<ResourceResponse>(`/classes?academicYear=${CURRENT_ACADEMIC_YEAR}`), enabled: kind === "students" || kind === "timetable" || kind === "tests" });
  const teachersQuery = useQuery({ queryKey: ["create-options", "teachers"], queryFn: () => api<ResourceResponse>("/admin/teachers?page=1&limit=100"), enabled: kind === "timetable" || kind === "salary" });
  const studentsQuery = useQuery({ queryKey: ["create-options", "students"], queryFn: () => api<ResourceResponse>("/admin/students?page=1&limit=100"), enabled: kind === "fees" });
  const classOptions = responseRows(classesQuery.data);
  const teacherOptions = responseRows(teachersQuery.data);
  const studentOptions = responseRows(studentsQuery.data);
  if (kind === "results") return <ResultCreateModal onClose={onClose} onCreated={onCreated} />;
  if (!fields) return <div className="fixed inset-0 z-50 grid place-items-center bg-[#0f0e47]/50 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h2 className="font-display text-lg font-bold">This action is not available yet</h2><p className="mt-2 text-sm text-[#77748d]">The current backend does not expose an administrator create endpoint for this section.</p><button onClick={onClose} className="mt-5 rounded-xl bg-[#272757] px-4 py-2 text-sm font-semibold text-white">Close</button></div></div>;
  if (kind === "notices") return <NoticeCreateModal onClose={onClose} onCreated={onCreated} />;
  if (kind === "tests") return <TestCreateModal onClose={onClose} onCreated={onCreated} />;
  if (kind === "students" && params.get("assign") === "1" && params.get("classId")) return <AssignStudentModal classId={params.get("classId") as string} onClose={onClose} onCreated={onCreated} />;
  if (kind === "students") return <MultiStudentModal onClose={onClose} onCreated={onCreated} />;
  if (kind === "teachers" || kind === "timetable") return <EnhancedCreateModal kind={kind} onClose={onClose} onCreated={onCreated} />;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, string | number> = { ...values };
      for (const field of fields) if (field.type === "number" && values[field.name]) payload[field.name] = Number(values[field.name]);
      if (kind === "classes") Object.assign(payload, { academicYear: CURRENT_ACADEMIC_YEAR, order: 1 });
      if (kind === "timetable") payload.type = "period";
      await apiPost(createEndpoints[kind], payload);
      toast.success(`${routeConfig[kind].title} record created`);
      onCreated();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save this record");
    } finally { setSaving(false); }
  }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#0f0e47]/50 p-4"><form onSubmit={submit} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><div className="text-xs font-semibold uppercase tracking-wider text-[#77749d]">EduNest API action</div><h2 className="mt-1 font-display text-xl font-bold text-[#151444]">{routeConfig[kind].title}</h2></div><button type="button" onClick={onClose} aria-label="Close dialog" className="rounded-lg p-2 hover:bg-[#f5f3ff]"><XCircle size={20} /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2">{fields.map((field) => { const isClassSelect = (kind === "students" || kind === "timetable") && field.name === "classId"; const isTeacherSelect = (kind === "timetable" || kind === "salary") && field.name === "teacherId"; const isStudentSelect = kind === "fees" && field.name === "studentId"; return <label key={field.name} className="text-sm font-semibold text-[#35325f] sm:last:col-span-2">{field.label}{field.required ? " *" : ""}{isClassSelect ? <select required={field.required} value={values[field.name] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-[#ddd9f4] bg-[#faf9ff] px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-[#aaa9dc]"><option value="">{classesQuery.isLoading ? "Loading classes…" : "Select a class"}</option>{classOptions.map((row, index) => <option key={String(row.id ?? index)} value={asText(row.id)}>{asText(row.name)}{row.section ? ` — Section ${asText(row.section)}` : ""}{row.standard ? ` · Grade ${asText(row.standard)}` : ""}</option>)}</select> : isStudentSelect ? <select required={field.required} value={values[field.name] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-[#ddd9f4] bg-[#faf9ff] px-3 text-sm font-normal"><option value="">{studentsQuery.isLoading ? "Loading students…" : "Select a student"}</option>{studentOptions.map((row, index) => <option key={String(row.id ?? index)} value={asText(row.id)}>{asText(row.name)}{row.loginId ? ` — ${asText(row.loginId)}` : ""}</option>)}</select> : isTeacherSelect ? <select required={field.required} value={values[field.name] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-[#ddd9f4] bg-[#faf9ff] px-3 text-sm font-normal"><option value="">{teachersQuery.isLoading ? "Loading teachers…" : "Select a teacher"}</option>{teacherOptions.map((row, index) => <option key={String(row.id ?? index)} value={asText(row.id)}>{asText(row.name)}{row.subject ? ` — ${asText(row.subject)}` : ""}</option>)}</select> : <input required={field.required} type={field.type ?? "text"} value={values[field.name] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-[#ddd9f4] bg-[#faf9ff] px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-[#aaa9dc]" />}</label>; })}</div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl bg-[#f0efff] px-4 py-2.5 text-sm font-semibold text-[#272757]">Cancel</button><button disabled={saving} type="submit" className="rounded-xl bg-[#272757] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save record"}</button></div></form></div>;
}

function InteractiveFilters({ onSearch, onStatus, onYear, classOptions, onClass, statuses, years, months }: { onSearch: (value: string) => void; onStatus: (value: string) => void; onYear: (value: string) => void; classOptions?: Row[]; onClass?: (value: string) => void; statuses?: string[]; years?: string[]; months?: string[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const isSalary = pathname.endsWith("/salary");
  const isFees = pathname.endsWith("/fees");
  const isStudents = pathname.endsWith("/students");
  const params = useSearchParams();
  const month = params.get("month") ?? CURRENT_PAYROLL_MONTH;
  const studentClassesQuery = useQuery({ queryKey: ["student-filter-classes"], queryFn: () => api<ResourceResponse>(`/classes?academicYear=${CURRENT_ACADEMIC_YEAR}`), enabled: isStudents });
  const storedSalaryQuery = useQuery({ queryKey: ["salary-filter-months"], queryFn: () => api<ResourceResponse>("/salary"), enabled: isSalary });
  const studentClasses = responseRows(studentClassesQuery.data);
  const availableStatuses = isSalary ? ["pending", "paid"] : statuses?.length ? statuses : ["active", "pending", "paid", "overdue", "resolved"];
  const availableYears = years?.length ? years : [CURRENT_ACADEMIC_YEAR];
  const storedMonths = Array.from(new Set(responseRows(storedSalaryQuery.data).map((row) => asText(row.month)).filter((value) => value !== "—")));
  const monthOptions = months?.length ? months : storedMonths.length ? storedMonths : [CURRENT_PAYROLL_MONTH];
  const handleClass = (value: string) => { onClass?.(value); if (isStudents && typeof window !== "undefined") window.dispatchEvent(new CustomEvent("edunest:student-class-filter", { detail: value })); };
  return <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#e6e2f8] bg-white p-4 sm:flex-row"><div className="relative flex-1"><Search size={17} className="absolute left-3 top-3 text-[#9793b1]" /><input onChange={(event) => onSearch(event.target.value)} placeholder="Search by name, ID, subject, or record..." className="h-10 w-full rounded-xl bg-[#f5f3ff] pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#aaa9dc]" /></div>{isSalary ? <label className="flex items-center gap-2 rounded-xl bg-[#f5f3ff] px-3 text-xs font-semibold text-[#4f4c76]">Payroll month<select value={month} onChange={(event) => router.push(`/admin/salary?month=${event.target.value}`)} className="h-10 bg-transparent text-sm font-normal outline-none">{monthOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label> : null}{isStudents ? <select onChange={(event) => handleClass(event.target.value)} className="h-10 rounded-xl bg-[#f5f3ff] px-3 text-sm text-[#4f4c76]"><option value="">All Classes</option>{studentClasses.map((item, index) => <option key={String(item.id ?? index)} value={asText(item.id)}>{asText(item.name)}{item.standard ? ` · ${asText(item.standard)}` : ""}{item.section ? ` — ${asText(item.section)}` : ""}</option>)}</select> : classOptions && onClass ? <select onChange={(event) => onClass(event.target.value)} className="h-10 rounded-xl bg-[#f5f3ff] px-3 text-sm text-[#4f4c76]"><option value="">All Classes</option>{classOptions.map((item, index) => <option key={String(item.id ?? index)} value={asText(item.id)}>{asText(item.name)}{item.standard ? ` · ${asText(item.standard)}` : ""}{item.section ? ` — ${asText(item.section)}` : ""}</option>)}</select> : null}<select onChange={(event) => onStatus(event.target.value)} className="h-10 rounded-xl bg-[#f5f3ff] px-3 text-sm text-[#4f4c76]"><option value="">All Statuses</option>{availableStatuses.map((item) => <option key={item} value={item}>{item}</option>)}</select>{!isSalary && !isFees ? <select onChange={(event) => onYear(event.target.value)} className="h-10 rounded-xl bg-[#f5f3ff] px-3 text-sm text-[#4f4c76]"><option value="">All Academic Years</option>{availableYears.map((item) => <option key={item} value={item}>{item}</option>)}</select> : null}</div>;
}

function ViewModal({ kind, row, onClose, classById = new Map(), teacherById = new Map(), studentById = new Map() }: { kind: string; row: Row; onClose: () => void; classById?: Map<string, string>; teacherById?: Map<string, string>; studentById?: Map<string, string> }) {
  const recordId = asText(row.id);
  const detailPath = recordId !== "—" && (kind === "students" || kind === "teachers") ? `/admin/users/${recordId}` : recordId !== "—" && kind === "classes" ? `/classes/${recordId}` : undefined;
  const detail = useQuery({ queryKey: ["admin-detail", kind, recordId], queryFn: () => api<Row>(detailPath!), enabled: Boolean(detailPath) });
  const values = detail.data ?? row;
  const detailValue = (key: string, value: RecordValue | object) => key === "classId" ? classById.get(asText(value)) ?? asText(value) : key === "teacherId" ? teacherById.get(asText(value)) ?? asText(value) : key === "studentId" ? studentById.get(asText(value)) ?? asText(value) : key === "gender" ? ({ M: "Male", F: "Female", O: "Other" }[asText(value)] ?? asText(value)) : asText(value);
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#0f0e47]/50 p-4"><section role="dialog" aria-modal="true" className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><div className="text-xs font-semibold uppercase tracking-wider text-[#77749d]">Record details</div><h2 className="mt-1 font-display text-xl font-bold text-[#151444]">{routeConfig[kind].title}</h2></div><button onClick={onClose} aria-label="Close details" className="rounded-lg p-2 hover:bg-[#f5f3ff]"><XCircle size={20} /></button></div>{detail.isLoading ? <Skeleton className="mt-6 h-32 w-full" /> : <div className="mt-6 grid gap-3 sm:grid-cols-2">{Object.entries(values).filter(([key]) => !["passwordHash", "canDelete", "feeStatus", "performancePercent", "instituteId"].includes(key)).map(([key, value]) => <div key={key} className="rounded-xl bg-[#f7f5ff] p-3"><div className="text-[11px] font-semibold uppercase tracking-wider text-[#77749d]">{key.replace(/([A-Z])/g, " $1")}</div><div className="mt-1 break-words text-sm font-semibold text-[#272757]">{detailValue(key, value)}</div></div>)}</div>}<div className="mt-6 flex justify-end"><button onClick={onClose} className="rounded-xl bg-[#272757] px-4 py-2.5 text-sm font-semibold text-white">Close</button></div></section></div>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyInteractiveResourcePage({ kind }: { kind: string }) {
  const config = routeConfig[kind];
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const query = useResource(config.endpoint);
  const classQuery = useQuery({ queryKey: ["resource-lookup", "classes"], queryFn: () => api<ResourceResponse>(`/classes?academicYear=${CURRENT_ACADEMIC_YEAR}`), enabled: kind === "students" || kind === "timetable" });
  const teacherQuery = useQuery({ queryKey: ["resource-lookup", "teachers"], queryFn: () => api<ResourceResponse>("/admin/teachers?page=1&limit=100"), enabled: kind === "classes" || kind === "timetable" });
  const classById = useMemo(() => new Map(responseRows(classQuery.data).map((row) => [asText(row.id), `${asText(row.name)}${row.section ? ` — ${asText(row.section)}` : ""}`])), [classQuery.data]);
  const teacherById = useMemo(() => new Map(responseRows(teacherQuery.data).map((row) => [asText(row.id), `${asText(row.name)}${row.subject ? ` — ${asText(row.subject)}` : ""}`])), [teacherQuery.data]);
  const rawRows = responseRows(query.data);
  const availableStatuses = useMemo(() => kind === "salary" ? Array.from(new Set(rawRows.map((row) => asText(row.status)).filter((value) => value !== "—"))) : undefined, [kind, rawRows]);
  const availableYears = useMemo(() => { const values = rawRows.map((row) => asText(row.academicYear)).filter((value) => value !== "—"); return values.length ? Array.from(new Set(values)) : undefined; }, [rawRows]);
  const availableMonths = useMemo(() => kind === "salary" ? Array.from(new Set(rawRows.map((row) => asText(row.month)).filter((value) => value !== "—"))).sort() : undefined, [kind, rawRows]);
  const rows = useMemo(() => rawRows.filter((row) => !search || JSON.stringify(row).toLowerCase().includes(search.toLowerCase())), [rawRows, search]);
  const columns = config.columns ?? [];
  const displayValue = (row: Row, column: string): string => {
    if (column === "classId") return classById.get(asText(row[column])) ?? asText(row[column]);
    if (column === "teacherId") return teacherById.get(asText(row[column])) ?? asText(row[column]);
    return asText(row[column]);
  };
  const label = (column: string) => ({ classId: "Class", teacherId: "Teacher" }[column] ?? column.replace(/([A-Z])/g, " $1"));
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ["admin-resource", config.endpoint] }); };
  return <div><Header title={config.title} eyebrow={config.eyebrow} description={config.description} icon={config.icon} onAction={() => setCreateOpen(true)} /><div className="grid grid-cols-2 gap-4 xl:grid-cols-4"><StatCard title="Records returned" value={query.data && !Array.isArray(query.data) && "total" in query.data && typeof query.data.total === "number" ? String(query.data.total) : query.isLoading ? "…" : String(rows.length)} hint="Scoped to the authenticated institute" /><StatCard title="Active filters" value={search ? "1" : "0"} hint="Search and API filters" /><StatCard title="Data source" value="Live API" hint="No browser-side database" /><StatCard title="Sync status" value={query.isError ? "Error" : "Ready"} hint={query.isError ? "Check API availability" : "Authenticated request"} /></div><Filters onSearch={setSearch} /><div className="overflow-hidden rounded-2xl border border-[#e6e2f8] bg-white shadow-sm"><div className="flex items-center justify-between border-b border-[#ece9f8] p-5"><div><h2 className="font-display text-lg font-bold text-[#151444]">{config.title.replace("Directory", "Ledger")}</h2><p className="text-xs text-[#77748d]">Server-side records from the EduNest API</p></div><button onClick={refresh} className="rounded-lg p-2 text-[#77749d] hover:bg-[#f5f3ff]" aria-label="Refresh records"><MoreHorizontal size={18} /></button></div>{query.isLoading ? <div className="space-y-3 p-5"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div> : query.isError ? <EmptyState title="Unable to load this resource" hint="The API request failed. Check the backend and try again." /> : rows.length === 0 ? <EmptyState title="No records available" hint="The backend returned an empty result for the current filters." /> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-[#f5f3ff] text-[11px] uppercase tracking-wider text-[#77749d]"><tr><th className="px-5 py-3">Select</th>{columns.map((column) => <th key={column} className="px-5 py-3">{label(column)}</th>)}<th className="px-5 py-3">Actions</th></tr></thead><tbody>{rows.map((row, index) => <tr key={String(row.id ?? index)} className="border-t border-[#efedf8] hover:bg-[#fbfaff]"><td className="px-5 py-4"><input type="checkbox" aria-label={`Select row ${index + 1}`} /></td>{columns.map((column) => <td key={column} className="max-w-[230px] truncate px-5 py-4 text-[#35325f]">{column === "status" ? <StatusBadge status={asText(row[column]).replaceAll("_", "-")} /> : displayValue(row, column)}</td>)}<td className="px-5 py-4"><button onClick={() => setSelectedRow(row)} className="font-semibold text-[#4f4c91] hover:underline">View <ArrowUpRight size={14} className="inline" /></button></td></tr>)}</tbody></table></div>}<div className="flex items-center justify-between border-t border-[#ece9f8] px-5 py-4 text-xs text-[#77748d]"><span>Showing {rows.length} records from the API</span><div className="flex gap-1"><button className="rounded-lg bg-[#272757] px-3 py-1.5 font-semibold text-white">1</button><button className="rounded-lg bg-[#f0efff] px-3 py-1.5">2</button><button className="rounded-lg bg-[#f0efff] px-3 py-1.5">Next</button></div></div></div>{createOpen ? <CreateModal kind={kind} onClose={() => setCreateOpen(false)} onCreated={refresh} /> : null}{selectedRow ? <ViewModal kind={kind} row={selectedRow} onClose={() => setSelectedRow(null)} /> : null}</div>;
}

function SetLedgerModal({ kind, row, onClose, onSaved }: { kind: "fees" | "salary"; row: Row; onClose: () => void; onSaved: () => void }) {
  const [values, setValues] = useState({ amount: "", dueDate: "", head: "Tuition", month: CURRENT_PAYROLL_MONTH });
  const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    try {
      const payload = kind === "fees" ? { studentId: asText(row.studentId), amount: Number(values.amount), dueDate: values.dueDate, head: values.head } : { teacherId: asText(row.teacherId), amount: Number(values.amount), month: values.month };
      await apiPost(kind === "fees" ? "/fees" : "/salary", payload);
      toast.success(kind === "fees" ? "Fee set for student" : "Salary record created"); onSaved(); onClose();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to create ledger record"); } finally { setSaving(false); }
  }
  return <div className="fixed inset-0 z-[60] grid place-items-center bg-[#0f0e47]/55 p-4"><form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h2 className="font-display text-xl font-bold text-[#151444]">{kind === "fees" ? `Set fee for ${asText(row.studentName)}` : `Set salary for ${asText(row.teacherName)}`}</h2><div className="mt-5 grid gap-4">{kind === "fees" ? <><label className="text-sm font-semibold text-[#35325f]">Fee head<input required value={values.head} onChange={(event) => setValues((current) => ({ ...current, head: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-[#ddd9f4] px-3 text-sm font-normal" /></label><label className="text-sm font-semibold text-[#35325f]">Due date<input required type="date" value={values.dueDate} onChange={(event) => setValues((current) => ({ ...current, dueDate: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-[#ddd9f4] px-3 text-sm font-normal" /></label></> : <label className="text-sm font-semibold text-[#35325f]">Payroll month<input required type="month" value={values.month} onChange={(event) => setValues((current) => ({ ...current, month: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-[#ddd9f4] px-3 text-sm font-normal" /></label>}<label className="text-sm font-semibold text-[#35325f]">Amount<input required min="0" type="number" value={values.amount} onChange={(event) => setValues((current) => ({ ...current, amount: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-[#ddd9f4] px-3 text-sm font-normal" /></label></div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl bg-[#f0efff] px-4 py-2.5 text-sm font-semibold text-[#272757]">Cancel</button><button disabled={saving} className="rounded-xl bg-[#272757] px-4 py-2.5 text-sm font-semibold text-white">{saving ? "Saving…" : "Save"}</button></div></form></div>;
}

function LegacyRecordActions({ kind, row, classOptions, teacherOptions, onRefresh, onView }: { kind: string; row: Row; classOptions: Row[]; teacherOptions: Row[]; onRefresh: () => void; onView: () => void }) {
  const id = asText(row.id);
  const [confirmOpen, setConfirmOpen] = useState(false);
  async function removeUser() {
    if (!id || id === "—") return;
    try { await api(`/admin/users/${id}`, { method: "DELETE" }); toast.success("User removed from the institute"); onRefresh(); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to remove user"); }
  }
  async function resetPassword() {
    if (!id || id === "—") return;
    try { const result = await apiPost<{ loginId: string; tempPassword: string }>(`/admin/users/${id}/reset-password`); toast.success(`Credentials — ${result.loginId} / ${result.tempPassword}`, { duration: 12000 }); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to reset password"); }
  }
  async function assignClass(classId: string) {
    try { await apiPatch(`/admin/students/${id}/reassign`, { classId }); toast.success("Student class updated"); onRefresh(); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to assign class"); }
  }
  async function assignTeacher(teacherId: string) {
    if (!teacherId) return;
    try { await apiPatch(`/admin/classes/${id}/teacher`, { teacherId }); toast.success("Class teacher updated"); onRefresh(); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to assign teacher"); }
  }
  async function changeFeeStatus(status: string) {
    try { await apiPatch(`/fees/${id}`, { status }); toast.success("Fee status updated"); onRefresh(); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to update fee status"); }
  }
  async function changeSalaryStatus(status: string) {
    try { await apiPatch(`/salary/${id}`, { status }); toast.success("Salary status updated"); onRefresh(); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to update salary status"); }
  }
  return <><div className="flex flex-wrap items-center gap-2"><button onClick={onView} className="font-semibold text-[#4f4c91] hover:underline">View <ArrowUpRight size={14} className="inline" /></button>{kind === "students" ? <><select value={asText(row.classId) === "—" ? "" : asText(row.classId)} onChange={(event) => void assignClass(event.target.value)} className="max-w-[150px] rounded-lg bg-[#f0efff] px-2 py-1 text-xs" aria-label="Assign student class"><option value="">Assign class</option>{classOptions.map((item, index) => <option key={String(item.id ?? index)} value={asText(item.id)}>{asText(item.name)}{item.section ? ` — ${asText(item.section)}` : ""}</option>)}</select><button onClick={() => void resetPassword()} className="rounded-lg bg-[#f0efff] px-2 py-1 text-xs font-semibold text-[#272757]">Credentials</button><button onClick={() => setConfirmOpen(true)} className="rounded-lg bg-[#fff0f0] px-2 py-1 text-xs font-semibold text-[#b42318]">Delete</button></> : null}{kind === "teachers" ? <button onClick={() => setConfirmOpen(true)} className="rounded-lg bg-[#fff0f0] px-2 py-1 text-xs font-semibold text-[#b42318]">Remove</button> : null}{kind === "classes" ? <select value={asText(row.teacherId) === "—" ? "" : asText(row.teacherId)} onChange={(event) => void assignTeacher(event.target.value)} className="max-w-[160px] rounded-lg bg-[#f0efff] px-2 py-1 text-xs" aria-label="Assign class teacher"><option value="">Assign teacher</option>{teacherOptions.map((item, index) => <option key={String(item.id ?? index)} value={asText(item.id)}>{asText(item.name)}{item.subject ? ` — ${asText(item.subject)}` : ""}</option>)}</select> : null}{kind === "fees" ? <select defaultValue={asText(row.status)} onChange={(event) => void changeFeeStatus(event.target.value)} className="rounded-lg bg-[#f0efff] px-2 py-1 text-xs" aria-label="Change fee status">{["pending", "submitted", "collected", "paid", "overdue"].map((status) => <option key={status} value={status}>{status}</option>)}</select> : null}{kind === "salary" ? <select defaultValue={asText(row.status)} onChange={(event) => void changeSalaryStatus(event.target.value)} className="rounded-lg bg-[#f0efff] px-2 py-1 text-xs" aria-label="Change salary status"><option value="pending">Pending</option><option value="paid">Paid</option></select> : null}</div>{confirmOpen ? <div className="fixed inset-0 z-[60] grid place-items-center bg-[#0f0e47]/55 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start gap-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-[#fff0f0] text-[#b42318]">!</div><div><h2 className="font-display text-lg font-bold text-[#151444]">{kind === "teachers" ? "Remove teacher?" : "Delete student?"}</h2><p className="mt-2 text-sm leading-6 text-[#77748d]">{kind === "teachers" ? "This deactivates the teacher and preserves their history in the institute." : "This removes the student account from the institute while preserving its history."}</p></div></div><div className="mt-6 flex justify-end gap-2"><button onClick={() => setConfirmOpen(false)} className="rounded-xl bg-[#f0efff] px-4 py-2.5 text-sm font-semibold text-[#272757]">Cancel</button><button onClick={() => { setConfirmOpen(false); void removeUser(); }} className="rounded-xl bg-[#b42318] px-4 py-2.5 text-sm font-semibold text-white">{kind === "teachers" ? "Remove teacher" : "Delete student"}</button></div></div></div> : null}</>;
}

function RecordActions(props: { kind: string; row: Row; classOptions: Row[]; teacherOptions: Row[]; onRefresh: () => void; onView: () => void }) {
  const { kind, row, onRefresh, onView } = props;
  const router = useRouter();
  const [ledgerOpen, setLedgerOpen] = useState(false);
  if (kind === "students") return <StudentActions row={row} onRefresh={onRefresh} onView={() => router.push(`/admin/students/${asText(row.id)}`)} />;
  const id = asText(row.id);
  if (kind === "teachers") return <TeacherActions row={row} onRefresh={onRefresh} onView={() => router.push(`/admin/teachers/${asText(row.id)}`)} />;
  if (kind !== "fees" && kind !== "salary") return <LegacyRecordActions {...props} />;
  async function changeStatus(status: string) {
    if (id.startsWith("student-") || id.startsWith("teacher-")) { setLedgerOpen(true); return; }
    try { await apiPatch(`/${kind}/${id}`, { status }); toast.success(`${kind === "fees" ? "Fee" : "Salary"} status updated`); onRefresh(); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to update status"); }
  }
  return <><div className="flex flex-wrap items-center gap-2"><button onClick={onView} className="font-semibold text-[#4f4c91] hover:underline">View <ArrowUpRight size={14} className="inline" /></button>{id.startsWith("student-") || id.startsWith("teacher-") ? <button onClick={() => setLedgerOpen(true)} className="rounded-lg bg-[#272757] px-2 py-1 text-xs font-semibold text-white">Set {kind === "fees" ? "fee" : "salary"}</button> : <select defaultValue={asText(row.status)} onChange={(event) => void changeStatus(event.target.value)} className="rounded-lg bg-[#f0efff] px-2 py-1 text-xs" aria-label={`Change ${kind} status`}>{kind === "fees" ? ["pending", "submitted", "collected", "paid", "overdue"].map((status) => <option key={status} value={status}>{status}</option>) : <><option value="pending">Pending</option><option value="paid">Paid</option></>}</select>}</div>{ledgerOpen ? <SetLedgerModal kind={kind as "fees" | "salary"} row={row} onClose={() => setLedgerOpen(false)} onSaved={onRefresh} /> : null}</>;
}

function CredentialAction({ row }: { row: Row }) {
  const [busy, setBusy] = useState(false);
  async function reset() { setBusy(true); try { const result = await apiPost<{ loginId: string; tempPassword: string }>(`/admin/users/${asText(row.id)}/reset-password`); toast.success(`Credentials — ${result.loginId} / ${result.tempPassword}`, { duration: 12000 }); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to reset credentials"); } finally { setBusy(false); } }
  return <button disabled={busy} onClick={() => void reset()} className="rounded-lg bg-[#f0efff] px-2 py-1 text-xs font-semibold text-[#272757]">{busy ? "Loading…" : "Credentials"}</button>;
}

function StudentClassAssignment({ row, classOptions, onRefresh }: { row: Row; classOptions: Row[]; onRefresh: () => void }) {
  const selected = Array.isArray(row.classIds) ? row.classIds.map(String) : asText(row.classId) === "—" ? [] : [asText(row.classId)];
  async function update(event: React.ChangeEvent<HTMLSelectElement>) {
    const classIds = Array.from(event.target.selectedOptions).map((option) => option.value);
    if (!classIds.length) return;
    try { await apiPatch(`/admin/students/${asText(row.id)}/reassign`, { classId: classIds[0], classIds }); toast.success("Student classes updated"); onRefresh(); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to update student classes"); }
  }
  return <select multiple defaultValue={selected} onChange={(event) => void update(event)} className="h-10 max-w-[170px] rounded-lg bg-[#f0efff] px-2 py-1 text-xs" aria-label="Assign multiple student classes">{classOptions.map((item, index) => <option key={String(item.id ?? index)} value={asText(item.id)}>{asText(item.name)}{item.section ? ` — ${asText(item.section)}` : ""}</option>)}</select>;
}

function InteractiveResourcePage({ kind }: { kind: string }) {
  const config = routeConfig[kind];
  const searchParams = useSearchParams();
  const resourceEndpoint = kind === "salary" ? `/salary?month=${searchParams.get("month") ?? CURRENT_PAYROLL_MONTH}` : config.endpoint;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  useEffect(() => {
    const onClassFilter = (event: Event) => setClassFilter(String((event as CustomEvent<string>).detail ?? ""));
    window.addEventListener("edunest:student-class-filter", onClassFilter);
    return () => window.removeEventListener("edunest:student-class-filter", onClassFilter);
  }, []);
  const query = useResource(resourceEndpoint);
  const classQuery = useQuery({ queryKey: ["resource-lookup", "classes"], queryFn: () => api<ResourceResponse>(`/classes?academicYear=${CURRENT_ACADEMIC_YEAR}`), enabled: kind === "students" || kind === "timetable" });
  const teacherQuery = useQuery({ queryKey: ["resource-lookup", "teachers"], queryFn: () => api<ResourceResponse>("/admin/teachers?page=1&limit=100"), enabled: kind === "classes" || kind === "timetable" || kind === "salary" });
  const studentQuery = useQuery({ queryKey: ["resource-lookup", "students"], queryFn: () => api<ResourceResponse>("/admin/students?page=1&limit=100"), enabled: kind === "fees" || kind === "results" });
  const classOptions = responseRows(classQuery.data);
  const teacherOptions = responseRows(teacherQuery.data);
  const classById = useMemo(() => new Map(classOptions.map((row) => [asText(row.id), `${asText(row.name)}${row.standard ? ` · Standard ${asText(row.standard)}` : ""}${row.section ? ` — Section ${asText(row.section)}` : ""}`])), [classOptions]);
  const teacherById = useMemo(() => new Map(teacherOptions.map((row) => [asText(row.id), `${asText(row.name)}${row.subject ? ` — ${asText(row.subject)}` : ""}`])), [teacherOptions]);
  const studentById = useMemo(() => new Map(responseRows(studentQuery.data).map((row) => [asText(row.id), asText(row.name)])), [studentQuery.data]);
  const rawRows = responseRows(query.data);
  const mergedRows = useMemo(() => {
    const rosterRows = kind === "fees" ? responseRows(studentQuery.data) : kind === "salary" ? teacherOptions : [];
    if (kind === "fees") {
      const feeByStudent = new Map(rawRows.map((fee) => [asText(fee.studentId), fee]));
      return rosterRows.map((student) => ({ ...(feeByStudent.get(asText(student.id)) ?? {}), id: feeByStudent.get(asText(student.id))?.id ?? `student-${asText(student.id)}`, studentId: student.id, studentName: student.name, status: feeByStudent.get(asText(student.id))?.status ?? "not-set", amount: feeByStudent.get(asText(student.id))?.amount ?? "—", dueDate: feeByStudent.get(asText(student.id))?.dueDate ?? "—", head: feeByStudent.get(asText(student.id))?.head ?? "—" }));
    }
    if (kind === "salary") {
      const salaryByTeacher = new Map(rawRows.map((salary) => [asText(salary.teacherId), salary]));
      const selectedMonth = searchParams.get("month") ?? CURRENT_PAYROLL_MONTH;
      return rosterRows.map((teacher) => ({ ...(salaryByTeacher.get(asText(teacher.id)) ?? {}), id: salaryByTeacher.get(asText(teacher.id))?.id ?? `teacher-${asText(teacher.id)}`, teacherId: teacher.id, teacherName: teacher.name, month: salaryByTeacher.get(asText(teacher.id))?.month ?? selectedMonth, amount: salaryByTeacher.get(asText(teacher.id))?.amount ?? teacher.salaryAmount ?? "—", status: salaryByTeacher.get(asText(teacher.id))?.status ?? "not-set", paidAt: salaryByTeacher.get(asText(teacher.id))?.paidAt ?? "—" }));
    }
    return rawRows;
  }, [kind, rawRows, searchParams, studentQuery.data, teacherOptions]);
  const rows = useMemo(() => mergedRows.filter((row) => (!search.trim() || JSON.stringify(row).toLowerCase().includes(search.trim().toLowerCase())) && (!statusFilter || asText(row.status).toLowerCase() === statusFilter) && (!yearFilter || asText(row.academicYear) === yearFilter) && (!classFilter || asText(row.classId) === classFilter || (Array.isArray(row.classIds) && row.classIds.map(String).includes(classFilter)))), [mergedRows, search, statusFilter, yearFilter, classFilter]);
  const columns = config.columns ?? [];
  const displayValue = (row: Row, column: string): string => column === "classId" ? (Array.isArray(row.classIds) ? row.classIds.map((id) => classById.get(asText(id)) ?? asText(id)).join(" • ") : classById.get(asText(row[column])) ?? asText(row[column])) : column === "teacherId" ? teacherById.get(asText(row[column])) ?? asText(row[column]) : column === "studentId" ? studentById.get(asText(row[column])) ?? asText(row[column]) : asText(row[column]);
  const label = (column: string) => ({ classId: "Class", teacherId: "Teacher", studentId: "Student", status: kind === "salary" ? "Salary Status" : kind === "fees" ? "Fee Status" : "Status" }[column] ?? column.replace(/([A-Z])/g, " $1"));
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ["admin-resource", resourceEndpoint] }); void queryClient.invalidateQueries({ queryKey: ["admin-notices"] }); };
  const actionLabel = ({ students: "Add Student", teachers: "Add Teacher", classes: "Add Class", tests: "Add Test", fees: "Add Fee Record", salary: "Add Salary Record", notices: "Create Notice", timetable: "Add Timetable", attendance: "Mark Attendance", results: "Add Result" } as Record<string, string>)[kind] ?? "Create";
  return <div><Header title={config.title} eyebrow={config.eyebrow} description={config.description} icon={config.icon} onAction={() => setCreateOpen(true)} /><div className="grid grid-cols-2 gap-4 xl:grid-cols-4"><StatCard title="Records returned" value={query.data && !Array.isArray(query.data) && "total" in query.data && typeof query.data.total === "number" ? String(query.data.total) : query.isLoading ? "…" : String(rows.length)} hint="Scoped to the authenticated institute" /><StatCard title="Active filters" value={[search, statusFilter, yearFilter].filter(Boolean).length.toString()} hint="Search and dropdown filters" /><StatCard title="Data source" value="Live API" hint="No browser-side database" /><StatCard title="Sync status" value={query.isError ? "Error" : "Ready"} hint={query.isError ? "Check API availability" : "Authenticated request"} /></div><InteractiveFilters onSearch={setSearch} onStatus={setStatusFilter} onYear={setYearFilter} /><div className="overflow-hidden rounded-2xl border border-[#e6e2f8] bg-white shadow-sm"><div className="flex items-center justify-between border-b border-[#ece9f8] p-5"><div><h2 className="font-display text-lg font-bold text-[#151444]">{config.title.replace("Directory", "Ledger")}</h2><p className="text-xs text-[#77748d]">Server-side records from the EduNest API</p></div><button onClick={refresh} className="rounded-lg p-2 text-[#77749d] hover:bg-[#f5f3ff]" aria-label="Refresh records"><MoreHorizontal size={18} /></button></div>{query.isLoading ? <div className="space-y-3 p-5"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div> : query.isError ? <EmptyState title="Unable to load this resource" hint="The API request failed. Check the backend and try again." /> : rows.length === 0 ? <EmptyState title="No records available" hint="The backend returned an empty result for the current filters." /> : <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-[#f5f3ff] text-[11px] uppercase tracking-wider text-[#77749d]"><tr><th className="px-5 py-3">Select</th>{columns.map((column) => <th key={column} className="px-5 py-3">{label(column)}</th>)}<th className="px-5 py-3">Actions</th></tr></thead><tbody>{rows.map((row, index) => <tr key={String(row.id ?? index)} className="border-t border-[#efedf8] hover:bg-[#fbfaff]"><td className="px-5 py-4"><input type="checkbox" aria-label={`Select row ${index + 1}`} /></td>{columns.map((column) => <td key={column} className="max-w-[230px] truncate px-5 py-4 text-[#35325f]">{column === "status" ? <StatusBadge status={asText(row[column]).replaceAll("_", "-")} /> : displayValue(row, column)}</td>)}<td className="px-5 py-4"><RecordActions kind={kind} row={row} classOptions={classOptions} teacherOptions={teacherOptions} onRefresh={refresh} onView={() => kind === "classes" ? router.push(`/admin/classes/${asText(row.id)}`) : setSelectedRow(row)} /></td></tr>)}</tbody></table></div>}<div className="flex items-center justify-between border-t border-[#ece9f8] px-5 py-4 text-xs text-[#77748d]"><span>Showing {rows.length} records from the API</span><div className="flex gap-1"><button className="rounded-lg bg-[#272757] px-3 py-1.5 font-semibold text-white">1</button><button className="rounded-lg bg-[#f0efff] px-3 py-1.5">2</button><button className="rounded-lg bg-[#f0efff] px-3 py-1.5">Next</button></div></div></div>{createOpen ? <CreateModal kind={kind} onClose={() => setCreateOpen(false)} onCreated={refresh} /> : null}{selectedRow ? <ViewModal kind={kind} row={selectedRow} classById={classById} teacherById={teacherById} studentById={studentById} onClose={() => setSelectedRow(null)} /> : null}</div>;
}

// Kept as a compatibility fallback for older callers while the interactive
// resource renderer above handles the current admin routes.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ResourcePage({ kind }: { kind: string }) {
  const config = routeConfig[kind];
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const { data, isLoading, isError } = useResource(config.endpoint);
  const [search, setSearch] = useState("");
  const rows = useMemo(() => {
    const source = Array.isArray(data) ? data : data && "data" in data && Array.isArray(data.data) ? data.data : [];
    if (!search) return source;
    return source.filter((row) => JSON.stringify(row).toLowerCase().includes(search.toLowerCase()));
  }, [data, search]);
  const columns = config.columns ?? [];
  function refresh() { void queryClient.invalidateQueries({ queryKey: ["admin-resource", config.endpoint] }); }
  return <div><Header title={config.title} eyebrow={config.eyebrow} description={config.description} icon={config.icon} onAction={() => setCreateOpen(true)} /><div className="grid grid-cols-2 gap-4 xl:grid-cols-4"><StatCard title="Records returned" value={data && !Array.isArray(data) && "total" in data && typeof data.total === "number" ? String(data.total) : isLoading ? "…" : String(rows.length)} hint="Scoped to the authenticated institute" /><StatCard title="Active filters" value={search ? "1" : "0"} hint="Search and API filters" /><StatCard title="Data source" value="Live API" hint="No browser-side database" /><StatCard title="Sync status" value={isError ? "Error" : "Ready"} hint={isError ? "Check API availability" : "Authenticated request"} /></div><Filters onSearch={setSearch} /><div className="overflow-hidden rounded-2xl border border-[#e6e2f8] bg-white shadow-sm"><div className="flex items-center justify-between border-b border-[#ece9f8] p-5"><div><h2 className="font-display text-lg font-bold text-[#151444]">{config.title.replace("Directory", "Ledger")}</h2><p className="text-xs text-[#77748d]">Server-side records from the EduNest API</p></div><button onClick={() => void queryClient.invalidateQueries({ queryKey: ["admin-resource", config.endpoint] })} className="rounded-lg p-2 text-[#77749d] hover:bg-[#f5f3ff]" aria-label="Refresh records"><MoreHorizontal size={18} /></button></div>{isLoading ? <div className="space-y-3 p-5"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div> : isError ? <EmptyState title="Unable to load this resource" hint="The API request failed. Check the backend and try again." /> : rows.length === 0 ? <EmptyState title="No records available" hint="The backend returned an empty result for the current filters." /> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-[#f5f3ff] text-[11px] uppercase tracking-wider text-[#77749d]"><tr><th className="px-5 py-3">Select</th>{columns.map((column) => <th key={column} className="px-5 py-3">{column.replace(/([A-Z])/g, " $1")}</th>)}<th className="px-5 py-3">Actions</th></tr></thead><tbody>{rows.map((row, index) => <tr key={String(row.id ?? index)} className="border-t border-[#efedf8] hover:bg-[#fbfaff]"><td className="px-5 py-4"><input type="checkbox" aria-label={`Select row ${index + 1}`} /></td>{columns.map((column) => <td key={column} className="max-w-[230px] truncate px-5 py-4 text-[#35325f]">{column === "status" ? <StatusBadge status={asText(row[column]).replaceAll("_", "-")} /> : asText(row[column])}</td>)}<td className="px-5 py-4"><button onClick={() => toast.info("Record details are available from the backend detail endpoint; this list does not invent a profile view.")} className="font-semibold text-[#4f4c91] hover:underline">View <ArrowUpRight size={14} className="inline" /></button></td></tr>)}</tbody></table></div>}<div className="flex items-center justify-between border-t border-[#ece9f8] px-5 py-4 text-xs text-[#77748d]"><span>Showing {rows.length} records from the API</span><div className="flex gap-1"><button className="rounded-lg bg-[#272757] px-3 py-1.5 font-semibold text-white">1</button><button className="rounded-lg bg-[#f0efff] px-3 py-1.5">2</button><button className="rounded-lg bg-[#f0efff] px-3 py-1.5">Next</button></div></div></div>{createOpen ? <CreateModal kind={kind} onClose={() => setCreateOpen(false)} onCreated={refresh} /> : null}</div>;
}

function DashboardPage() {
  const report = useQuery({ queryKey: ["admin-report"], queryFn: () => api<Report>("/admin/reports/school") });
  const notices = useQuery({ queryKey: ["admin-notices"], queryFn: () => api<ListResponse>("/notices?limit=5") });
  const r = report.data;
  const gender = r ? ["M", "F", "O"].map((name) => ({ name: name === "M" ? "Male" : name === "F" ? "Female" : "Other", value: r.gender[name] ?? 0 })) : [];
  const trend = r ? [{ name: "Enrolled", value: r.headcounts.students }, { name: "Teachers", value: r.headcounts.teachers }, { name: "Classes", value: r.headcounts.classes }] : [];
  return <div><Header title="Admin Dashboard" eyebrow="EduNest / Admin Workspace" description="A live overview of your institution’s people, academic operations, and financial health." action="Quick Action" /><div className="grid grid-cols-2 gap-4 xl:grid-cols-5">{[["Total Students", r?.headcounts.students], ["Total Teachers", r?.headcounts.teachers], ["Total Classes", r?.headcounts.classes], ["Fee Collection", r ? `${r.fees.percent}%` : undefined], ["Complaints", r?.complaints]].map(([title, value]) => <StatCard key={String(title)} title={String(title)} value={value === undefined ? "…" : String(value)} hint={report.isError ? "API unavailable" : "Live school report"} />)}</div><div className="mt-5 grid gap-5 xl:grid-cols-[1.7fr_1fr]"><ChartCard title="Institution Headcount"><div className="h-64">{report.isLoading ? <Skeleton className="h-full w-full" /> : <ResponsiveContainer width="100%" height="100%"><AreaChart data={trend}><CartesianGrid stroke="#ebe8fa" vertical={false} /><XAxis dataKey="name" stroke="#8783a7" /><YAxis stroke="#8783a7" /><Tooltip /><Area type="monotone" dataKey="value" stroke="#272757" fill="#dfddfa" strokeWidth={3} /></AreaChart></ResponsiveContainer>}</div></ChartCard><ChartCard title="Student profile"><div className="h-64">{gender.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={gender} dataKey="value" nameKey="name" innerRadius={64} outerRadius={92} paddingAngle={4}>{gender.map((entry, index) => <Cell key={entry.name} fill={["#3B82F6", "#EC4899", "#8B5CF6"][index % 3]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer> : <EmptyState title="No gender data" />}</div></ChartCard></div><div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_1fr]"><ChartCard title="Financial health" action={<span className="text-xs text-[#13855b]">{r ? `${r.fees.percent}% realized` : "Awaiting data"}</span>}><div className="h-56">{r ? <ResponsiveContainer width="100%" height="100%"><BarChart data={[{ name: "Collected", amount: r.fees.collected }, { name: "Outstanding", amount: Math.max(0, r.fees.totalDue - r.fees.collected) }]}><CartesianGrid stroke="#ebe8fa" vertical={false} /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="amount" fill="#272757" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer> : <EmptyState title="No fee aggregation available" hint="The report API did not return fee totals." />}</div></ChartCard><ChartCard title="Recent notices" action={<button className="text-xs font-semibold text-[#4f4c91]">View all</button>}>{notices.isLoading ? <Skeleton className="h-40 w-full" /> : notices.data?.data?.length ? <div className="space-y-3">{notices.data.data.slice(0, 4).map((notice, index) => <div key={String(notice.id ?? index)} className="rounded-xl bg-[#f7f5ff] p-3"><div className="font-semibold text-[#272757]">{asText(notice.title)}</div><div className="mt-1 line-clamp-2 text-xs text-[#77748d]">{asText(notice.body)}</div></div>)}</div> : <EmptyState title="No notices returned" />}</ChartCard></div><div className="mt-5 rounded-2xl border border-[#e6e2f8] bg-[#272757] p-5 text-white"><div className="flex items-start gap-3"><ShieldAlert className="mt-0.5 text-[#bdbaff]" /><div><h2 className="font-display text-lg font-bold">Backend-connected workspace</h2><p className="mt-1 text-sm text-[#d0cef1]">Every value above is sourced from the authenticated EduNest API. Unsupported aggregations remain explicitly unavailable until their backend contracts are added.</p></div></div></div></div>;
}

function ReportsPage() {
  const query = useQuery({ queryKey: ["reports-page"], queryFn: () => api<Report>("/admin/reports/school") });
  const report = query.data;
  return <div><Header title="Comprehensive School Reports" eyebrow="Dashboard / Insights" description="Institutional performance, academic trends, student retention, and financial sustainability metrics." action="Export Report" /><div className="grid grid-cols-2 gap-4 xl:grid-cols-5"><StatCard title="Enrollment" value={report ? String(report.headcounts.students) : "…"} /><StatCard title="Faculty Staff" value={report ? String(report.headcounts.teachers) : "…"} /><StatCard title="Fee Realization" value={report ? `${report.fees.percent}%` : "…"} /><StatCard title="Average Marks" value={report ? `${report.avgMarks}%` : "…"} /><StatCard title="Attendance Docs" value={report ? String(report.attendanceDocs) : "…"} /></div><div className="mt-5 grid gap-5 xl:grid-cols-2"><ChartCard title="Enrollment and staffing"><div className="h-72">{report ? <ResponsiveContainer width="100%" height="100%"><BarChart data={[{ name: "Students", value: report.headcounts.students }, { name: "Teachers", value: report.headcounts.teachers }, { name: "Classes", value: report.headcounts.classes }]}><CartesianGrid stroke="#ebe8fa" vertical={false} /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="value" fill="#272757" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer> : <Skeleton className="h-full w-full" />}</div></ChartCard><ChartCard title="Report coverage"><div className="space-y-4 pt-5">{[["Headcount", report?.headcounts.students ? 100 : 0], ["Financial ledger", report?.fees.totalDue ? report.fees.percent : 0], ["Academic results", report?.avgMarks ?? 0]].map(([label, value]) => <div key={String(label)}><div className="mb-2 flex justify-between text-sm"><span>{label}</span><span className="font-semibold">{value}%</span></div><div className="h-2 rounded-full bg-[#ebe9fb]"><div className="h-2 rounded-full bg-[#272757]" style={{ width: `${value}%` }} /></div></div>)}</div></ChartCard></div><div className="mt-5 rounded-2xl border border-dashed border-[#cbc7ed] bg-white p-6"><div className="flex items-start gap-3"><CheckCircle2 className="text-[#13855b]" /><div><h2 className="font-display font-bold text-[#272757]">Authoritative report source</h2><p className="mt-1 text-sm text-[#77748d]">The current backend provides institute-level headcounts, fee realization, gender distribution, attendance document count, complaints, and average marks. Trend series, PDF generation, and additional breakdowns require dedicated aggregation endpoints before they can be shown accurately.</p></div></div></div></div>;
}

function TimetableCalendarPage() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [createOpen, setCreateOpen] = useState(false);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["timetable-calendar", month], queryFn: () => api<ResourceResponse>("/timetables") });
  const slots = responseRows(query.data);
  const classQuery = useQuery({ queryKey: ["timetable-calendar-classes"], queryFn: () => api<ResourceResponse>(`/classes?academicYear=${CURRENT_ACADEMIC_YEAR}`) });
  const teacherQuery = useQuery({ queryKey: ["timetable-calendar-teachers"], queryFn: () => api<ResourceResponse>("/admin/teachers?page=1&limit=100") });
  const classNames = useMemo(() => new Map(responseRows(classQuery.data).map((row) => [asText(row.id), `${asText(row.name)}${row.standard ? ` · Standard ${asText(row.standard)}` : ""}${row.section ? ` — Section ${asText(row.section)}` : ""}`])), [classQuery.data]);
  const teacherNames = useMemo(() => new Map(responseRows(teacherQuery.data).map((row) => [asText(row.id), `${asText(row.name)}${row.subject ? ` — ${asText(row.subject)}` : ""}`])), [teacherQuery.data]);
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const daySlots = (day: string) => slots.filter((slot) => asText(slot.day).toLowerCase().startsWith(day.slice(0, 3).toLowerCase()));
  return <div><Header title="Monthly Timetable Calendar" eyebrow="Dashboard / Academic Management" description="View every scheduled class by teaching day, subject, room, and time." action="Create Schedule Slot" onAction={() => setCreateOpen(true)} /><div className="mb-5 flex items-center justify-between rounded-2xl border border-[#e6e2f8] bg-white p-4"><label className="text-sm font-semibold text-[#35325f]">Calendar month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="ml-3 h-10 rounded-xl border border-[#ddd9f4] bg-[#f8f7ff] px-3 text-sm font-normal" /></label><button onClick={() => void queryClient.invalidateQueries({ queryKey: ["timetable-calendar", month] })} className="rounded-xl bg-[#272757] px-4 py-2.5 text-sm font-semibold text-white">Refresh</button></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{days.map((day) => <section key={day} className="min-h-[230px] rounded-2xl border border-[#e6e2f8] bg-white p-4 shadow-sm"><div className="flex items-center justify-between border-b border-[#efedf8] pb-3"><h2 className="font-display font-bold text-[#272757]">{day}</h2><span className="rounded-full bg-[#eeecff] px-2 py-1 text-xs text-[#4f4c91]">{daySlots(day).length} slots</span></div><div className="mt-3 space-y-2">{daySlots(day).map((slot, index) => <div key={String(slot.id ?? index)} className="rounded-xl bg-[#f5f3ff] p-3"><div className="flex justify-between text-xs font-bold text-[#272757]"><span>{asText(slot.startTime)} – {asText(slot.endTime)}</span><span>{asText(slot.room)}</span></div><div className="mt-1 text-sm font-semibold text-[#35325f]">{asText(slot.subject)}</div><div className="mt-1 text-xs text-[#77748d]">{classNames.get(asText(slot.classId)) ?? "Class unavailable"} · {teacherNames.get(asText(slot.teacherId)) ?? "Teacher unavailable"}</div></div>)}{!daySlots(day).length ? <p className="py-8 text-center text-sm text-[#9995b1]">No classes scheduled</p> : null}</div></section>)}</div>{createOpen ? <CreateModal kind="timetable" onClose={() => setCreateOpen(false)} onCreated={() => void queryClient.invalidateQueries({ queryKey: ["timetable-calendar", month] })} /> : null}</div>;
}

function ClassDashboardContent({ classId }: { classId: string }) {
  const router = useRouter();
  const classQuery = useQuery({ queryKey: ["class-dashboard", classId], queryFn: () => api<Row>(`/classes/${classId}`) });
  const studentsQuery = useQuery({ queryKey: ["class-dashboard-students", classId], queryFn: () => api<ResourceResponse>(`/admin/students?page=1&limit=100&classId=${classId}`) });
  const attendanceQuery = useQuery({ queryKey: ["class-dashboard-attendance", classId], queryFn: () => api<ResourceResponse>(`/attendance?classId=${classId}`) });
  const resultsQuery = useQuery({ queryKey: ["class-dashboard-results", classId], queryFn: () => api<ResourceResponse>(`/results?classId=${classId}`) });
  const testsQuery = useQuery({ queryKey: ["class-dashboard-tests", classId], queryFn: () => api<ResourceResponse>(`/tests?classId=${classId}`) });
  const klass = classQuery.data ?? {};
  const students = responseRows(studentsQuery.data);
  const attendance = responseRows(attendanceQuery.data);
  const results = responseRows(resultsQuery.data);
  const tests = responseRows(testsQuery.data);
  void tests;
  const present = attendance.filter((row) => ["present", "late"].includes(asText(row.status).toLowerCase())).length;
  const absent = attendance.filter((row) => asText(row.status).toLowerCase() === "absent").length;
  const attendanceTotal = present + absent;
  const attendanceData = [{ name: "Present", value: present }, { name: "Absent", value: absent }, { name: "No record", value: Math.max(0, students.length - attendanceTotal) }];
  const genderData = ["M", "F", "O"].map((gender) => ({ name: gender === "M" ? "Male" : gender === "F" ? "Female" : "Other", value: students.filter((student) => asText(student.gender) === gender).length }));
  const percentages = results.map((row) => Number(row.percentage ?? row.percent ?? row.score ?? 0)).filter((value) => Number.isFinite(value) && value > 0);
  const average = percentages.length ? percentages.reduce((sum, value) => sum + value, 0) / percentages.length : 0;
  return <div><div className="mb-5 flex items-center justify-between rounded-2xl border border-[#e6e2f8] bg-white p-5 shadow-sm"><div><button onClick={() => router.push("/admin/classes")} className="mb-3 text-sm font-semibold text-[#4f4c91] hover:underline">← Back to classes</button><div className="text-xs font-semibold uppercase tracking-[.16em] text-[#77749d]">Dashboard / Classes / Class dashboard</div><h1 className="mt-1 font-display text-2xl font-bold text-[#151444]">{asText(klass.name)}{klass.section ? ` — Section ${asText(klass.section)}` : ""}</h1><p className="mt-1 text-sm text-[#77748d]">Standard {asText(klass.standard)} · Academic year {asText(klass.academicYear)} · Monthly fee ₹{asText(klass.feeAmount)}</p></div><button onClick={() => void Promise.all([classQuery.refetch(), studentsQuery.refetch(), attendanceQuery.refetch(), resultsQuery.refetch()])} className="rounded-xl bg-[#272757] px-4 py-2.5 text-sm font-semibold text-white">Refresh dashboard</button></div>{classQuery.isLoading ? <Skeleton className="h-48 w-full" /> : <><div className="grid grid-cols-2 gap-4 xl:grid-cols-4"><StatCard title="Total students" value={String(students.length)} hint="Active class roster" /><StatCard title="Attendance" value={attendanceTotal ? `${Math.round((present / attendanceTotal) * 100)}%` : "—"} hint={`${present} present records`} /><StatCard title="Average performance" value={average ? `${average.toFixed(1)}%` : "—"} hint={`${results.length} result records`} /><StatCard title="Class fee" value={`₹${asText(klass.feeAmount)}`} hint="Per assigned class / month" /></div><div className="mt-5 grid gap-5 xl:grid-cols-2"><ChartCard title="Attendance overview"><div className="h-64">{attendanceTotal ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={attendanceData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={90} paddingAngle={4}>{attendanceData.map((entry, index) => <Cell key={entry.name} fill={["#13855b", "#d64545", "#dcd9f4"][index]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer> : <EmptyState title="No attendance records" hint="Attendance will appear here once records are marked for this class." />}</div></ChartCard><ChartCard title="Student gender profile"><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={genderData}><CartesianGrid stroke="#ebe8fa" vertical={false} /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#272757" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div></ChartCard></div><div className="mt-5 rounded-2xl border border-[#e6e2f8] bg-white shadow-sm"><div className="flex items-center justify-between border-b border-[#ece9f8] p-5"><div><h2 className="font-display text-lg font-bold text-[#151444]">Class roster & performance</h2><p className="text-xs text-[#77748d]">Student names, status, attendance and academic result data</p></div><span className="rounded-full bg-[#eeecff] px-3 py-1 text-xs font-semibold text-[#272757]">{students.length} students</span></div>{students.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-[#f5f3ff] text-[11px] uppercase tracking-wider text-[#77749d]"><tr><th className="px-5 py-3">Student</th><th className="px-5 py-3">Roll no</th><th className="px-5 py-3">Gender</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Actions</th></tr></thead><tbody>{students.map((student, index) => <tr key={String(student.id ?? index)} className="border-t border-[#efedf8]"><td className="px-5 py-4 font-semibold text-[#272757]">{asText(student.name)}</td><td className="px-5 py-4">{asText(student.rollNo)}</td><td className="px-5 py-4">{({ M: "Male", F: "Female", O: "Other" }[asText(student.gender)] ?? "—")}</td><td className="px-5 py-4"><StatusBadge status={asText(student.status)} /></td><td className="px-5 py-4"><button onClick={() => router.push("/admin/students")} className="font-semibold text-[#4f4c91] hover:underline">Open student</button></td></tr>)}</tbody></table></div> : <EmptyState title="No students assigned" hint="Assign students to this class to populate the dashboard." />}</div></>}</div>;
}

function StudentActions({ row, onRefresh, onView }: { row: Row; onRefresh: () => void; onView: () => void }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const id = asText(row.id);
  async function remove() { try { await api(`/admin/users/${id}`, { method: "DELETE" }); toast.success("Student removed from the institute"); onRefresh(); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to remove student"); } }
  async function credentials() { try { const result = await apiPost<{ loginId: string; tempPassword: string }>(`/admin/users/${id}/reset-password`); toast.success(`Credentials — ${result.loginId} / ${result.tempPassword}`, { duration: 12000 }); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to reset credentials"); } }
  return <><div className="flex flex-wrap items-center gap-2"><button onClick={onView} className="font-semibold text-[#4f4c91] hover:underline">View <ArrowUpRight size={14} className="inline" /></button><button onClick={() => void credentials()} className="rounded-lg bg-[#f0efff] px-2 py-1 text-xs font-semibold text-[#272757]">Credentials</button><button onClick={() => setConfirmOpen(true)} className="rounded-lg bg-[#fff0f0] px-2 py-1 text-xs font-semibold text-[#b42318]">Delete</button></div>{confirmOpen ? <ConfirmDialog title="Delete student?" body="This removes the student account from the institute while preserving its history." confirmLabel="Delete student" onCancel={() => setConfirmOpen(false)} onConfirm={() => { setConfirmOpen(false); void remove(); }} /> : null}</>;
}

function TeacherActions({ row, onRefresh, onView }: { row: Row; onRefresh: () => void; onView: () => void }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const id = asText(row.id);
  async function remove() { try { await api(`/admin/users/${id}`, { method: "DELETE" }); toast.success("Teacher removed from the institute"); onRefresh(); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to remove teacher"); } }
  return <><div className="flex flex-wrap items-center gap-2"><button onClick={onView} className="font-semibold text-[#4f4c91] hover:underline">View <ArrowUpRight size={14} className="inline" /></button><CredentialAction row={row} /><button onClick={() => setConfirmOpen(true)} className="rounded-lg bg-[#fff0f0] px-2 py-1 text-xs font-semibold text-[#b42318]">Remove</button></div>{confirmOpen ? <ConfirmDialog title="Remove teacher?" body="This deactivates the teacher and preserves their history in the institute." confirmLabel="Remove teacher" onCancel={() => setConfirmOpen(false)} onConfirm={() => { setConfirmOpen(false); void remove(); }} /> : null}</>;
}

function ConfirmDialog({ title, body, confirmLabel, onCancel, onConfirm }: { title: string; body: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void }) {
  return <div className="fixed inset-0 z-[60] grid place-items-center bg-[#0f0e47]/55 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h2 className="font-display text-lg font-bold text-[#151444]">{title}</h2><p className="mt-2 text-sm leading-6 text-[#77748d]">{body}</p><div className="mt-6 flex justify-end gap-2"><button onClick={onCancel} className="rounded-xl bg-[#f0efff] px-4 py-2.5 text-sm font-semibold text-[#272757]">Cancel</button><button onClick={onConfirm} className="rounded-xl bg-[#b42318] px-4 py-2.5 text-sm font-semibold text-white">{confirmLabel}</button></div></div></div>;
}

function ClassAssignmentModal({ classId, onClose, onCreated }: { classId: string; onClose: () => void; onCreated: () => void }) {
  const studentsQuery = useQuery({ queryKey: ["class-assignment-students"], queryFn: () => api<ResourceResponse>("/admin/students?page=1&limit=100") });
  const [studentId, setStudentId] = useState("");
  const [saving, setSaving] = useState(false);
  const available = responseRows(studentsQuery.data).filter((student) => {
    const ids = Array.isArray(student.classIds) ? student.classIds.map(String) : [asText(student.classId)];
    return !ids.includes(classId);
  });
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!studentId) return;
    setSaving(true);
    try { await apiPatch(`/admin/students/${studentId}/reassign`, { classId }); toast.success("Student assigned to this class"); onCreated(); onClose(); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to assign student"); } finally { setSaving(false); }
  }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#0f0e47]/50 p-4"><form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><div className="text-xs font-semibold uppercase tracking-wider text-[#77749d]">Class dashboard</div><h2 className="mt-1 font-display text-xl font-bold text-[#151444]">Assign existing student</h2></div><button type="button" onClick={onClose} aria-label="Close dialog"><XCircle size={20} /></button></div><p className="mt-2 text-sm text-[#77748d]">Choose an existing student to add to this class. Their other class assignments remain unchanged.</p><label className="mt-5 block text-sm font-semibold text-[#35325f]">Student<select required value={studentId} onChange={(event) => setStudentId(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#ddd9f4] bg-[#faf9ff] px-3 text-sm font-normal"><option value="">{studentsQuery.isLoading ? "Loading students…" : "Select a student"}</option>{available.map((student, index) => <option key={String(student.id ?? index)} value={asText(student.id)}>{asText(student.name)}{student.loginId ? ` — ${asText(student.loginId)}` : ""}</option>)}</select></label><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl bg-[#f0efff] px-4 py-2.5 text-sm font-semibold text-[#272757]">Cancel</button><button disabled={saving || !studentId} className="rounded-xl bg-[#272757] px-4 py-2.5 text-sm font-semibold text-white">{saving ? "Assigning…" : "Assign student"}</button></div></form></div>;
}

function SetClassFeeModal({ classId, currentFee, onClose, onSaved }: { classId: string; currentFee: string; onClose: () => void; onSaved: () => void }) {
  const [fee, setFee] = useState(currentFee === "—" ? "" : currentFee);
  const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(fee);
    if (!Number.isFinite(amount) || amount < 0) { toast.error("Enter a valid non-negative fee"); return; }
    setSaving(true);
    try { await apiPatch(`/classes/${classId}`, { feeAmount: amount }); toast.success("Class fee updated"); onSaved(); onClose(); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to update class fee"); } finally { setSaving(false); }
  }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#0f0e47]/50 p-4"><form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><div className="text-xs font-semibold uppercase tracking-wider text-[#77749d]">Class dashboard</div><h2 className="mt-1 font-display text-xl font-bold text-[#151444]">Set monthly fee</h2></div><button type="button" onClick={onClose} aria-label="Close dialog"><XCircle size={20} /></button></div><label className="mt-5 block text-sm font-semibold text-[#35325f]">Monthly fee<input required min="0" step="0.01" type="number" value={fee} onChange={(event) => setFee(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#ddd9f4] px-3 text-sm font-normal" /></label><p className="mt-2 text-xs text-[#77748d]">Current fee: ₹{currentFee}</p><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl bg-[#f0efff] px-4 py-2.5 text-sm font-semibold text-[#272757]">Cancel</button><button disabled={saving} className="rounded-xl bg-[#272757] px-4 py-2.5 text-sm font-semibold text-white">{saving ? "Saving…" : "Save fee"}</button></div></form></div>;
}

function ClassDashboardExtras({ classId }: { classId: string }) {
  const studentsQuery = useQuery({ queryKey: ["class-dashboard-students", classId], queryFn: () => api<ResourceResponse>(`/admin/students?page=1&limit=100&classId=${classId}`) });
  const testsQuery = useQuery({ queryKey: ["class-dashboard-tests", classId], queryFn: () => api<ResourceResponse>(`/tests?classId=${classId}`) });
  const students = responseRows(studentsQuery.data); const tests = responseRows(testsQuery.data);
  const gender = ["M", "F", "O"].map((code) => ({ name: code === "M" ? "Male" : code === "F" ? "Female" : "Other", value: students.filter((student) => asText(student.gender) === code).length }));
  return <div className="mt-5 grid gap-5 xl:grid-cols-2"><ChartCard title="Student gender profile"><div className="h-64">{students.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={gender} dataKey="value" nameKey="name" innerRadius={62} outerRadius={90} paddingAngle={4}><Cell fill="#3b82f6" /><Cell fill="#ec4899" /><Cell fill="#8b5cf6" /></Pie><Tooltip /></PieChart></ResponsiveContainer> : <EmptyState title="No student gender data" />}</div></ChartCard><div className="rounded-2xl border border-[#e6e2f8] bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-display text-lg font-bold text-[#151444]">Tests & assessments</h2><span className="rounded-full bg-[#eeecff] px-3 py-1 text-xs font-semibold text-[#272757]">{tests.length} tests</span></div><p className="mt-1 text-sm text-[#77748d]">Tests scheduled for this class.</p><div className="mt-4 space-y-2">{tests.slice(0, 5).map((test, index) => <div key={String(test.id ?? index)} className="flex items-center justify-between rounded-xl bg-[#f7f5ff] px-3 py-2 text-sm"><span className="font-semibold text-[#35325f]">{asText(test.title)}</span><span className="text-xs text-[#77749d]">{asText(test.subject)} · {asText(test.maxMarks)} marks</span></div>)}{!tests.length ? <EmptyState title="No tests scheduled" hint="Create a test for this class to see it here." /> : null}</div></div></div>;
}

export function ClassDashboard({ classId }: { classId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [assignOpen, setAssignOpen] = useState(false);
  const [feeOpen, setFeeOpen] = useState(false);
  const classQuery = useQuery({ queryKey: ["class-dashboard", classId], queryFn: () => api<Row>(`/classes/${classId}`) });
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ["class-dashboard", classId] }); void queryClient.invalidateQueries({ queryKey: ["class-dashboard-students", classId] }); };
  return <div><div className="mb-4 flex justify-end gap-2"><button onClick={() => router.push(`/admin/students?classId=${classId}&create=1`)} className="rounded-xl bg-[#272757] px-4 py-2.5 text-sm font-semibold text-white">Add new student</button><button onClick={() => setAssignOpen(true)} className="rounded-xl bg-[#f0efff] px-4 py-2.5 text-sm font-semibold text-[#272757]">Assign existing student</button><button onClick={() => setFeeOpen(true)} className="rounded-xl border border-[#ddd9f4] bg-white px-4 py-2.5 text-sm font-semibold text-[#272757]">Set Fee</button></div><ClassDashboardContent classId={classId} /><ClassDashboardExtras classId={classId} />{assignOpen ? <ClassAssignmentModal classId={classId} onClose={() => setAssignOpen(false)} onCreated={refresh} /> : null}{feeOpen ? <SetClassFeeModal classId={classId} currentFee={asText(classQuery.data?.feeAmount)} onClose={() => setFeeOpen(false)} onSaved={refresh} /> : null}</div>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function SettingsPage() {
  return <div><Header title="System & Institution Settings" eyebrow="Dashboard / System" description="Configure supported school profile, academic, security, and communication settings." action="Save Configuration" /><div className="grid gap-5 lg:grid-cols-[240px_1fr]"><div className="rounded-2xl border border-[#e6e2f8] bg-white p-3"><div className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-[#77749d]">Configuration modules</div>{["School Profile", "Academic & Grading", "Admin & Security", "Gateways & Automation", "Audit Logs"].map((item, index) => <button key={item} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm ${index === 0 ? "bg-[#272757] font-semibold text-white" : "text-[#535078] hover:bg-[#f5f3ff]"}`}><Settings2 size={16} />{item}</button>)}</div><div className="space-y-5"><section className="rounded-2xl border border-[#e6e2f8] bg-white p-6"><h2 className="font-display text-lg font-bold">School profile & affiliation</h2><p className="mt-1 text-sm text-[#77748d]">Editable institution metadata must be backed by a settings API before it is persisted.</p><div className="mt-5 grid gap-4 md:grid-cols-2">{["Institution name", "Affiliation identification", "Official contact email", "Central helpdesk phone", "Campus address"].map((label) => <label key={label} className="text-xs font-semibold uppercase tracking-wider text-[#77749d]">{label}<input disabled placeholder="Not provided by current API" className="mt-2 h-11 w-full rounded-xl bg-[#f5f3ff] px-3 text-sm normal-case tracking-normal text-[#77748d]" /></label>)}</div></section><section className="rounded-2xl border border-[#e6e2f8] bg-white p-6"><h2 className="font-display text-lg font-bold">Academic year & policy configuration</h2><div className="mt-5 grid gap-4 md:grid-cols-2">{["Active academic session", "Current term", "Passing marks threshold", "Attendance eligibility quorum"].map((label) => <div key={label} className="rounded-xl bg-[#f5f3ff] p-4"><div className="text-xs uppercase tracking-wider text-[#77749d]">{label}</div><div className="mt-2 font-semibold text-[#272757]">Backend setting not exposed</div></div>)}</div></section></div></div></div>;
}

type ConsoleSettings = {
  institutionName: string;
  affiliationId: string;
  contactEmail: string;
  helpdeskPhone: string;
  campusAddress: string;
  academicYear: string;
  currentTerm: string;
  passingMarks: string;
  attendanceQuorum: string;
  dailyAbsenteeSms: boolean;
  automatedFeeReminders: boolean;
};

const defaultConsoleSettings: ConsoleSettings = {
  institutionName: "EduNest International Academy",
  affiliationId: "",
  contactEmail: "",
  helpdeskPhone: "",
  campusAddress: "",
  academicYear: CURRENT_ACADEMIC_YEAR,
  currentTerm: "Term 2",
  passingMarks: "40",
  attendanceQuorum: "75",
  dailyAbsenteeSms: true,
  automatedFeeReminders: true,
};

function AssignClassesModal({ studentId, assigned, classById, onClose, onSaved }: { studentId: string; assigned: string[]; classById: Map<string, string>; onClose: () => void; onSaved: () => void }) {
  const options = Array.from(classById.entries()).filter(([id]) => !assigned.includes(id));
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected.length) return;
    setSaving(true);
    try {
      await apiPatch(`/admin/students/${studentId}/reassign`, { classId: selected[0], classIds: selected });
      toast.success(selected.length > 1 ? `Student assigned to ${selected.length} classes` : "Student assigned to class");
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to assign class");
    } finally {
      setSaving(false);
    }
  }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#0f0e47]/50 p-4"><form onSubmit={(event) => void submit(event)} className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><div className="text-xs font-semibold uppercase tracking-wider text-[#77749d]">Assign classes</div><h2 className="mt-1 font-display text-xl font-bold text-[#151444]">Add to classes</h2><p className="mt-1 text-sm text-[#77748d]">Tick one or more classes. A new roll number is assigned per class.</p></div><button type="button" onClick={onClose} aria-label="Close assign dialog" className="rounded-lg p-2 hover:bg-[#f5f3ff]"><XCircle size={20} /></button></div>{options.length === 0 ? <p className="mt-5 rounded-xl bg-[#f7f5ff] p-4 text-sm text-[#535078]">Already assigned to every class. Nothing left to add.</p> : <div className="mt-5 space-y-2">{options.map(([id, name]) => <label key={id} className="flex cursor-pointer items-center gap-3 rounded-xl bg-[#f7f5ff] px-4 py-3 text-sm font-semibold text-[#272757] hover:bg-[#f0efff]"><input type="checkbox" checked={selected.includes(id)} onChange={() => toggle(id)} className="h-4 w-4 accent-[#272757]" />{name}</label>)}</div>}<div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl bg-[#f0efff] px-4 py-2.5 text-sm font-semibold text-[#272757]">Cancel</button><button disabled={saving || !selected.length} className="rounded-xl bg-[#272757] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Assigning…" : `Assign${selected.length > 1 ? ` (${selected.length})` : ""}`}</button></div></form></div>;
}

export function PersonDashboard({ personId, role }: { personId: string; role: "student" | "teacher" }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [assignOpen, setAssignOpen] = useState(false);
  const userQuery = useQuery({ queryKey: ["person-dashboard", role, personId], queryFn: () => api<Row>(`/admin/users/${personId}`) });
  const user = userQuery.data ?? {};
  const classesQuery = useQuery({ queryKey: ["person-classes"], queryFn: () => api<ResourceResponse>(`/classes?academicYear=${CURRENT_ACADEMIC_YEAR}`), enabled: role === "student" });
  const classById = useMemo(() => new Map(responseRows(classesQuery.data).map((row) => [asText(row.id), `${asText(row.name)}${row.section ? ` — ${asText(row.section)}` : ""}`])), [classesQuery.data]);
  const assignedIds = role === "student" ? (Array.isArray(user.classIds) ? user.classIds.map(String) : asText(user.classId) === "—" ? [] : [asText(user.classId)]) : [];
  const primaryClassId = role === "student" ? (asText(user.classId) === "—" ? (assignedIds[0] ?? "") : asText(user.classId)) : "";
  const primaryClassName = role === "student" ? (primaryClassId ? (classById.get(primaryClassId) ?? primaryClassId) : "Unassigned") : "";
  const refreshPerson = () => { void queryClient.invalidateQueries({ queryKey: ["person-dashboard", role, personId] }); };
  const resultsQuery = useQuery({ queryKey: ["person-results", personId], queryFn: () => api<ResourceResponse>(`/results?${role}Id=${personId}`) });
  const attendanceQuery = useQuery({ queryKey: ["person-attendance", personId], queryFn: () => api<ResourceResponse>(`/attendance?${role}Id=${personId}`) });
  const results = responseRows(resultsQuery.data);
  const attendance = responseRows(attendanceQuery.data);
  const present = attendance.filter((row) => ["present", "late"].includes(asText(row.status).toLowerCase())).length;
  const scores = results.map((row) => Number(row.percentage ?? row.percent ?? row.score ?? 0)).filter((value) => value > 0);
  const average = scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0;
  return <div><div className="mb-5 rounded-2xl border border-[#e6e2f8] bg-white p-6 shadow-sm"><button onClick={() => router.back()} className="mb-3 text-sm font-semibold text-[#4f4c91]">← Back</button><div className="text-xs font-semibold uppercase tracking-[.16em] text-[#77749d]">Dashboard / {role}</div><h1 className="mt-1 font-display text-2xl font-bold text-[#151444]">{asText(user.name)}</h1><div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-[#77748d]"><span>Login ID: {asText(user.loginId)}</span><span aria-hidden="true">·</span>{role === "teacher" ? <span>{asText(user.subject)}</span> : <span>Class {primaryClassName}</span>}{role === "student" ? <button onClick={() => setAssignOpen(true)} className="rounded-xl bg-[#272757] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1f1e52]">Assign Class</button> : null}</div>{role === "student" && assignedIds.length > 1 ? <div className="mt-3 flex flex-wrap gap-2">{assignedIds.map((id) => <span key={id} className="rounded-full bg-[#f0efff] px-3 py-1 text-xs font-semibold text-[#35336f]">{classById.get(id) ?? id}</span>)}</div> : null}</div>{role === "student" && assignOpen ? <AssignClassesModal studentId={personId} assigned={assignedIds} classById={classById} onClose={() => setAssignOpen(false)} onSaved={refreshPerson} /> : null}<div className="grid grid-cols-2 gap-4 xl:grid-cols-4"><StatCard title="Attendance" value={attendance.length ? `${Math.round((present / attendance.length) * 100)}%` : "—"} hint={`${attendance.length} marked records`} /><StatCard title="Performance" value={average ? `${average.toFixed(1)}%` : "—"} hint={`${results.length} result records`} /><StatCard title="Role" value={role} hint="Authenticated profile" /><StatCard title="Status" value={asText(user.status)} hint={asText(user.active) === "true" ? "Active account" : "Inactive account"} /></div><div className="mt-5 grid gap-5 xl:grid-cols-2"><ChartCard title="Performance representation"><div className="h-64">{results.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={results.slice(0, 8).map((row, index) => ({ name: asText(row.subject ?? row.exam ?? `Record ${index + 1}`), score: Number(row.percentage ?? row.percent ?? row.score ?? 0) }))}><CartesianGrid stroke="#ebe8fa" vertical={false} /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="score" fill="#272757" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer> : <EmptyState title="No performance records" hint="Published results will appear here." />}</div></ChartCard><ChartCard title="Attendance overview"><div className="h-64">{attendance.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{ name: "Present", value: present }, { name: "Absent", value: attendance.length - present }]} dataKey="value" nameKey="name" innerRadius={62} outerRadius={90}><Cell fill="#13855b" /><Cell fill="#d64545" /></Pie><Tooltip /></PieChart></ResponsiveContainer> : <EmptyState title="No attendance records" />}</div></ChartCard></div></div>;
}

function WorkingSettingsPage() {
  const [settings, setSettings] = useState<ConsoleSettings>(() => {
    if (typeof window === "undefined") return defaultConsoleSettings;
    const stored = window.localStorage.getItem("edunest-console-settings");
    if (!stored) return defaultConsoleSettings;
    try { return { ...defaultConsoleSettings, ...JSON.parse(stored) }; } catch { return defaultConsoleSettings; }
  });
  const [saved, setSaved] = useState(false);
  function update(name: keyof ConsoleSettings, value: string | boolean) { setSaved(false); setSettings((current) => ({ ...current, [name]: value })); }
  function save() { window.localStorage.setItem("edunest-console-settings", JSON.stringify(settings)); setSaved(true); toast.success("Settings saved on this device"); }
  function reset() { setSettings(defaultConsoleSettings); window.localStorage.removeItem("edunest-console-settings"); setSaved(true); toast.success("Settings reset to defaults"); }
  const textField = (name: keyof ConsoleSettings, label: string) => <label className="text-xs font-semibold uppercase tracking-wider text-[#77749d]">{label}<input value={String(settings[name])} onChange={(event) => update(name, event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[#ddd9f4] bg-white px-3 text-sm font-normal normal-case tracking-normal text-[#272757] outline-none focus:ring-2 focus:ring-[#aaa9dc]" /></label>;
  return <div><Header title="System & Institution Settings" eyebrow="Dashboard / System" description="Configure school profile, academic policies, and automated communication preferences." action="Save Configuration" onAction={save} /><div className="grid gap-5 lg:grid-cols-[240px_1fr]"><aside className="rounded-2xl border border-[#e6e2f8] bg-white p-3"><div className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-[#77749d]">Configuration modules</div>{["School Profile", "Academic & Grading", "Gateways & Automation"].map((item, index) => <button key={item} type="button" onClick={() => document.getElementById(["school-profile", "academic-policy", "automation"][index])?.scrollIntoView({ behavior: "smooth" })} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm ${index === 0 ? "bg-[#272757] font-semibold text-white" : "text-[#535078] hover:bg-[#f5f3ff]"}`}><Settings2 size={16} />{item}</button>)}</aside><div className="space-y-5"><section id="school-profile" className="rounded-2xl border border-[#e6e2f8] bg-white p-6"><h2 className="font-display text-lg font-bold">School profile & affiliation</h2><p className="mt-1 text-sm text-[#77748d]">These values are saved as administrator preferences on this device.</p><div className="mt-5 grid gap-4 md:grid-cols-2">{textField("institutionName", "Institution name")}{textField("affiliationId", "Affiliation identification")}{textField("contactEmail", "Official contact email")}{textField("helpdeskPhone", "Central helpdesk phone")}{textField("campusAddress", "Campus address")}</div></section><section id="academic-policy" className="rounded-2xl border border-[#e6e2f8] bg-white p-6"><h2 className="font-display text-lg font-bold">Academic year & policy configuration</h2><div className="mt-5 grid gap-4 md:grid-cols-2">{textField("academicYear", "Active academic session")}{textField("currentTerm", "Current term")}{textField("passingMarks", "Passing marks threshold (%)")}{textField("attendanceQuorum", "Attendance eligibility quorum (%)")}</div></section><section id="automation" className="rounded-2xl border border-[#e6e2f8] bg-white p-6"><h2 className="font-display text-lg font-bold">Gateway & automation preferences</h2><div className="mt-5 grid gap-4 md:grid-cols-2">{(["dailyAbsenteeSms", "automatedFeeReminders"] as const).map((name) => <label key={name} className="flex items-center justify-between rounded-xl bg-[#f5f3ff] p-4 text-sm font-semibold text-[#272757]"><span>{name === "dailyAbsenteeSms" ? "Daily absentee SMS dispatch" : "Automated fee reminders"}<span className="mt-1 block text-xs font-normal text-[#77749d]">Toggle this workflow for the administrator console.</span></span><input type="checkbox" checked={settings[name]} onChange={(event) => update(name, event.target.checked)} className="h-5 w-5 accent-[#272757]" /></label>)}</div></section><div className="flex items-center justify-between rounded-2xl border border-[#e6e2f8] bg-white p-4"><span className="text-sm text-[#77748d]">{saved ? "Changes saved" : "Unsaved changes"}</span><div className="flex gap-2"><button type="button" onClick={reset} className="rounded-xl bg-[#f0efff] px-4 py-2.5 text-sm font-semibold text-[#272757]">Reset defaults</button><button type="button" onClick={save} className="rounded-xl bg-[#272757] px-4 py-2.5 text-sm font-semibold text-white">Save configuration</button></div></div></div></div></div>;
}

export default function AdminWorkspace({ kind }: { kind: string }) {
  if (kind === "dashboard") return <DashboardPage />;
  if (kind === "reports") return <ReportsPage />;
  if (kind === "timetable") return <TimetableCalendarPage />;
  if (kind === "settings") return <WorkingSettingsPage />;
  return <InteractiveResourcePage kind={kind} />;
}
