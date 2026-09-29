"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@edunest/shared";
import { homeFor, login } from "@/lib/auth";
import { toast } from "sonner";

function ConsoleLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, setPending] = useState(false);
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setPending(true);
    try {
      const user = await login(values.identifier, values.password);
      toast.success(`Welcome, ${user.name}`);
      router.replace(homeFor(user.role));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col justify-center">
      <h1 className="font-display text-2xl font-bold">Console login</h1>
      <p className="mt-1 text-sm text-[#78716C]">Admin / Super-Admin — email only.</p>
      {params.get("error") === "use-portal" ? (
        <p className="mt-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-800">That account uses portal login.</p>
      ) : null}
      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 flex flex-col gap-3">
        <input
          {...form.register("identifier")}
          placeholder="Email"
          className="rounded-xl border border-[#F5F5F4] p-3"
          autoComplete="username"
        />
        <input
          {...form.register("password")}
          type="password"
          placeholder="Password"
          className="rounded-xl border border-[#F5F5F4] p-3"
          autoComplete="current-password"
        />
        <button
          disabled={pending}
          className="rounded-xl bg-[#EA580C] p-3 font-medium text-white hover:bg-[#C2410C] disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <Link href="/request-access" className="mt-3 text-center text-sm text-[#EA580C]">
        New school? Request access
      </Link>
    </div>
  );
}

export default function ConsoleLoginPage() {
  return (
    <Suspense>
      <ConsoleLoginForm />
    </Suspense>
  );
}
