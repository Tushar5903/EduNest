import { api, apiPost } from "./api";

export type StudentProfile = {
  id: string; name: string; loginId?: string; classId: string | null; class: { id: string; name: string; section?: string } | null;
  rollNo?: number; gender?: string; status: string;
};
export type AttendanceData = { days: { date: string; classId: string; periodId: string; status: "present" | "absent" | "leave" }[]; present: number; absent: number; leave: number; total: number; percent: number };
export type TimetableData = { week: string; classId?: string; days: Record<string, { subject: string; teacher: string; startTime: string; endTime: string; room?: string; type: string }[]>; overrides: { id: string; title: string; body: string; type: string; createdAt: string }[] };
export type ResultSubject = { name: string; marks: number; max: number; percent: number; teacher?: string };
export type ResultRow = { exam: string; classId: string; subjects: ResultSubject[]; total: number; maxTotal: number; percent: number };
export type ResultsData = { data: ResultRow[]; exams: string[] };
export type FeeRow = { id: string; studentId: string; amount: number; dueDate: string; head?: string; status: string; paidAt: string | null; overdue: boolean };
export type FeesData = { data: FeeRow[]; due: number; paid: number; total: number };
export type Notice = { id: string; title: string; body: string; audience: string; classId: string | null; classIds: string[]; type: string; createdAt: string };
export type Complaint = { id: string; toType: "teacher" | "admin"; status: "open" | "in-review" | "resolved" | "rejected" | "escalated"; subject: string; category: string; replies: { role: string; body: string; at: string }[]; createdAt: string; updatedAt: string };
export type Teacher = { id: string; loginId?: string; name: string; subject: string; class: string };
export type DashboardData = { profile: StudentProfile; attendancePercent: number; feeDue: number; latestNotices: Notice[]; todayOverrides: TimetableData["overrides"]; resultsPercent: number };

export const studentApi = {
  profile: () => api<StudentProfile>("/students/me"),
  dashboard: () => api<DashboardData>("/students/me/dashboard"),
  attendance: (month?: string) => api<AttendanceData>(`/students/me/attendance${month ? `?month=${encodeURIComponent(month)}` : ""}`),
  timetable: (week?: string) => api<TimetableData>(`/students/me/timetable${week ? `?week=${encodeURIComponent(week)}` : ""}`),
  teachers: () => api<Teacher[]>("/students/me/teachers"),
  results: (exam?: string) => api<ResultsData>(`/students/me/results${exam ? `?exam=${encodeURIComponent(exam)}` : ""}`),
  fees: () => api<FeesData>("/students/me/fees"),
  notices: () => api<Notice[]>("/notices?limit=100"),
  complaints: () => api<Complaint[]>("/complaints/mine"),
  createComplaint: (body: { toType: "teacher" | "admin"; toTeacherId?: string; category: "against-student" | "against-teacher" | "other"; subject: string; body: string }) => apiPost<{ id: string; status: string }>("/complaints", body),
};
