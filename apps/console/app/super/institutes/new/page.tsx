"use client";

import { useMutation } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { createInstitute, type DirectInstituteInput } from "@/lib/super";

export default function NewInstitutePage() {
  const [form, setForm] = useState<DirectInstituteInput>({ schoolName: "", adminName: "", adminEmail: "", address: "", phone: "" });
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const mutation = useMutation({ mutationFn: () => createInstitute(form), onSuccess: (result) => { setCredentials({ email: result.adminEmail, password: result.tempPassword }); toast.success("Institute created"); }, onError: (error) => toast.error(error instanceof Error ? error.message : "Institute creation failed") });
  function update(field: keyof DirectInstituteInput, value: string) { setForm((current) => ({ ...current, [field]: value })); }
  return <div className="mx-auto max-w-3xl space-y-5"><Link href="/super/institutes" className="inline-flex items-center gap-2 text-sm font-semibold text-[#555282]"><ArrowLeft size={17} />Back to Institutes</Link><div><h1 className="font-display text-3xl font-bold">Manual institute filing</h1><p className="mt-1 text-sm text-[#77748d]">Creates an active institute through the existing Super Admin onboarding endpoint.</p></div><form onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }} className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-[#e7e4f5]"><div className="grid gap-4 sm:grid-cols-2"><Field label="School name" value={form.schoolName} onChange={(value) => update("schoolName", value)} required /><Field label="Administrator name" value={form.adminName} onChange={(value) => update("adminName", value)} required /><Field label="Administrator email" type="email" value={form.adminEmail} onChange={(value) => update("adminEmail", value)} required /><Field label="Phone" value={form.phone ?? ""} onChange={(value) => update("phone", value)} /><Field label="Address" value={form.address ?? ""} onChange={(value) => update("address", value)} /></div><button disabled={mutation.isPending} className="mt-5 rounded-lg bg-[#272757] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{mutation.isPending ? "Creating…" : "Create institute"}</button></form>{credentials ? <div className="rounded-xl border border-[#a9ddc3] bg-[#e7f7f0] p-5 text-sm text-[#137451]"><div className="font-semibold">Temporary credentials — shown once</div><div className="mt-3 grid gap-2 font-mono sm:grid-cols-2"><span>Email: {credentials.email}</span><span>Password: {credentials.password}</span></div></div> : null}</div>;
}
function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) { return <label className="text-sm font-semibold text-[#555282]">{label}<input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full rounded-lg bg-[#f6f4ff] px-3 font-normal text-[#17164b] outline-none ring-[#cbc8f3] focus:ring-2" /></label>; }
