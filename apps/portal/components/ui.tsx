import type { ReactNode } from "react";

export function StatCard({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-[#F5F5F4] bg-white p-4 shadow-sm">
      <div className="text-sm text-[#78716C]">{title}</div>
      <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-[#1C1917]">{value}</div>
      {hint ? <div className="mt-1 text-xs text-[#78716C]">{hint}</div> : null}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-green-50 text-green-700",
    pending: "bg-amber-50 text-amber-700",
    paid: "bg-teal-50 text-teal-700",
    submitted: "bg-amber-50 text-amber-700",
    collected: "bg-amber-50 text-amber-700",
    overdue: "bg-amber-50 text-[#D97706]",
    open: "bg-rose-50 text-rose-700",
    "in-review": "bg-blue-50 text-blue-700",
    resolved: "bg-green-50 text-green-700",
    rejected: "bg-stone-100 text-stone-600",
    escalated: "bg-rose-50 text-rose-700",
    suspended: "bg-stone-100 text-stone-600",
  };
  const cls = map[status] ?? "bg-stone-100 text-stone-600";
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#F5F5F4] bg-white p-8 text-center">
      <div className="font-medium text-[#1C1917]">{title}</div>
      {hint ? <div className="mt-1 text-sm text-[#78716C]">{hint}</div> : null}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-[#F5F5F4] ${className}`} />;
}

export function ChartCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="@container rounded-xl border border-[#F5F5F4] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display font-semibold text-[#1C1917]">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-md">
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-[#78716C]">{body}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg border px-3 py-2 text-sm">
            Cancel
          </button>
          <button onClick={onConfirm} className="rounded-lg bg-[#EA580C] px-3 py-2 text-sm font-medium text-white hover:bg-[#C2410C]">
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export function ShowOnceCredentialModal({
  open,
  loginId,
  tempPassword,
  extra,
  onClose,
}: {
  open: boolean;
  loginId: string;
  tempPassword: string;
  extra?: string;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-md print:shadow-none">
        <h3 className="font-semibold">Credentials — shown once</h3>
        <p className="mt-1 text-sm text-[#78716C]">Copy/print now. Afterwards use Reset only.</p>
        <div className="mt-3 rounded-lg bg-[#FFF7ED] p-3 font-mono text-sm tabular-nums">
          <div>ID: {loginId}</div>
          <div>Password: {tempPassword}</div>
          {extra ? <div>{extra}</div> : null}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => window.print()} className="rounded-lg border px-3 py-2 text-sm">
            Print
          </button>
          <button onClick={onClose} className="rounded-lg bg-[#EA580C] px-3 py-2 text-sm font-medium text-white hover:bg-[#C2410C]">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
