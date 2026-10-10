import { api, apiPatch, apiPost } from "./api";

export type TeacherClass = { id: string; name: string; section?: string; standard?: string; teacherId?: string; academicYear?: string; studentCount?: number };
export type ClassDashboard = { classId: string; total: number; genderCounts: { M: number; F: number; O: number }; attendanceSummary: { averagePercent: number; studentsWithData: number }; performanceSummary: { averagePercent: number; studentsWithData: number }; roster: Array<{ id: string; rollNo?: number; name: string; loginId?: string; gender?: string; feeStatus: string | null; performancePercent: number; attendancePercent: number }> };
export type ScheduleSlot = { id: string; classId: string; subject: string; day: string; startTime: string; endTime: string; room?: string; state: "LIVE" | "UPCOMING" | "DONE"; covering?: boolean };
/** Local (device) calendar date as YYYY-MM-DD — UTC slicing shows yesterday 00:00–05:30 IST. */
export function localISODate(d = new Date()): string {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export const teacherApi = {
  classes: () => api<TeacherClass[]>("/teacher/classes"),
  classDashboard: (id: string) => api<ClassDashboard>("/teacher/classes/" + id + "/dashboard"),
  schedule: (date: string, now: string) => api<{ date: string; day: string; now: string; data: ScheduleSlot[] }>("/teacher/today-schedule?date=" + encodeURIComponent(date) + "&now=" + encodeURIComponent(now)),
  attendance: (params: { classId?: string; date?: string; month?: string; studentId?: string }) => api<Array<{ id: string; classId: string; date: string; periodId: string; records: Array<{ studentId: string; studentName: string; status: "present" | "absent" | "leave" }> }>>("/attendance?" + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)) as Record<string, string>).toString()),
  markAttendance: (body: { classId: string; date: string; periodId: string; records: Array<{ studentId: string; status: "present" | "absent" | "leave" }> }) => apiPost("/attendance", body),
  updateAttendance: (id: string, records: Array<{ studentId: string; status: "present" | "absent" | "leave" }>) => apiPatch("/attendance/" + id, { records }),
  tests: (classId?: string) => api<Array<{ id: string; classId: string; subject: string; title: string; date: string; maxMarks: number }>>("/tests" + (classId ? "?classId=" + encodeURIComponent(classId) : "")),
  createTest: (body: { classId: string; subject: string; title: string; date: string; maxMarks: number }) => apiPost("/tests", body),
  saveMarks: (id: string, marks: Array<{ studentId: string; marks: number }>) => apiPost("/tests/" + id + "/marks", { marks }),
  results: (params?: { classId?: string; exam?: string; studentId?: string }) => api<Array<Record<string, unknown>>>("/results?" + new URLSearchParams(params ?? {}).toString()),
  publishResult: (body: { classId: string; exam: string; studentId: string; subjects: Array<{ name: string; marks: number; max: number }> }) => apiPost("/results", body),
  createStudent: (body: { name: string; classId: string; gender?: "M" | "F" | "O"; phone?: string }) => apiPost<{ id: string; loginId: string; tempPassword: string; rollNo: number; classId: string }>("/teacher/students", body),
  fees: (params?: { classId?: string; studentId?: string; status?: string }) => api<Array<Record<string, unknown>>>("/fees?" + new URLSearchParams(params as Record<string, string> ?? {}).toString()),
  updateFee: (id: string, body: { status: "paid"; remark?: string }) => apiPatch("/teacher/fees/" + id + "/status", body),
  salary: (params?: { month?: string; status?: string }) => api<Array<Record<string, unknown>>>("/salary?" + new URLSearchParams(params as Record<string, string> ?? {}).toString()),
  notices: () => api<{ data: Array<Record<string, unknown>>; page: number; total: number }>("/notices?limit=100"),
  createNotice: (body: { title: string; body: string; audience: "class"; classId: string }) => apiPost("/notices", body),
  createClassInfo: (body: { classId: string; title: string; body: string; type: "extra" | "cancelled" }) => apiPost("/teacher/class-info", body),
  complaints: () => api<Array<Record<string, unknown>>>("/teacher/complaints"),
  updateComplaint: (id: string, body: { status: "in-review" | "resolved" | "rejected" | "escalated"; reply?: string }) => apiPatch("/complaints/" + id, body),
};
