"use client";

type ProgressBarProps = {
  value: number;
  label?: string;
};

export function ProgressBar({ value, label }: ProgressBarProps) {
  const safeValue = Math.min(100, Math.max(0, Math.round(value)));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-300">
        <span>{label ?? "Progress render"}</span>
        <span>{safeValue}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}
