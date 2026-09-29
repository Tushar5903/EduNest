"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { adminRequestSchema, type AdminRequestInput } from "@edunest/shared";
import { requestAccess } from "@/lib/auth";
import { toast } from "sonner";

export default function RequestAccessPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const form = useForm<AdminRequestInput>({
    resolver: zodResolver(adminRequestSchema),
    defaultValues: { name: "", email: "", password: "", schoolName: "", address: "", phone: "" },
  });

  async function onSubmit(values: AdminRequestInput) {
    setPending(true);
    try {
      await requestAccess(values);
      toast.success("Request submitted — pending super-admin approval");
      router.replace("/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md py-10">
      <h1 className="font-display text-2xl font-bold">Request admin access</h1>
      <p className="mt-1 text-sm text-[#78716C]">Creates a pending institute + admin. No login until approved.</p>
      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 flex flex-col gap-3">
        <input {...form.register("name")} placeholder="Your name" className="rounded-xl border p-3" />
        <input {...form.register("email")} placeholder="Email" className="rounded-xl border p-3" />
        <input {...form.register("password")} type="password" placeholder="Password (min 8)" className="rounded-xl border p-3" />
        <input {...form.register("schoolName")} placeholder="School name" className="rounded-xl border p-3" />
        <input {...form.register("address")} placeholder="Address (optional)" className="rounded-xl border p-3" />
        <input {...form.register("phone")} placeholder="Phone (optional)" className="rounded-xl border p-3" />
        <button disabled={pending} className="rounded-xl bg-[#EA580C] p-3 font-medium text-white hover:bg-[#C2410C] disabled:opacity-60">
          {pending ? "Submitting…" : "Submit request"}
        </button>
      </form>
    </div>
  );
}
