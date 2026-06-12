"use client";

export type QualityCheck = {
  label: string;
  passed: boolean;
  detail: string;
};

type QualityGateProps = {
  checks: QualityCheck[];
  isChecking: boolean;
};

export function QualityGate({ checks, isChecking }: QualityGateProps) {
  if (isChecking) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-sm font-semibold text-white">Semak gambar...</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
        </div>
      </div>
    );
  }

  if (checks.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">Quality gate</p>
        <p className="text-xs font-semibold text-slate-400">
          {checks.filter((check) => check.passed).length}/{checks.length} lulus
        </p>
      </div>
      <div className="mt-4 space-y-3">
        {checks.map((check) => (
          <div key={check.label} className="flex gap-3">
            <div
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                check.passed
                  ? "bg-primary text-slate-950"
                  : "bg-red-500 text-white"
              }`}
            >
              {check.passed ? "OK" : "!"}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{check.label}</p>
              <p className="text-xs leading-5 text-slate-400">{check.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
