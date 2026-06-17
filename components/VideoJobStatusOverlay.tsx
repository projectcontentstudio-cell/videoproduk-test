"use client";

import { useEffect, useState } from "react";
import {
  clearPersistentVideoJob,
  continuePersistentVideoJob,
  getPersistentVideoJob,
  onVideoJobUpdate,
  type PersistentVideoJob
} from "@/lib/persistent-video-job";

function getPhaseText(job: PersistentVideoJob) {
  if (job.phase === "start-base") {
    return "Mula jana video 8 saat pertama...";
  }

  if (job.phase === "poll-base") {
    return "Video pertama sedang dijana di cloud...";
  }

  if (job.phase === "start-extend") {
    return "Sediakan sambungan video kedua...";
  }

  if (job.phase === "poll-extend") {
    return "Sambung video untuk jadikan 16 saat...";
  }

  return "Semak status video...";
}

export function VideoJobStatusOverlay() {
  const [job, setJob] = useState<PersistentVideoJob | null>(null);

  function goTo(path: string) {
    clearPersistentVideoJob();
    window.location.href = path;
  }

  useEffect(() => {
    function syncJob() {
      setJob(getPersistentVideoJob());
    }

    syncJob();
    const cleanup = onVideoJobUpdate(syncJob);
    const current = getPersistentVideoJob();

    if (current?.status === "active") {
      void continuePersistentVideoJob();
    }

    return cleanup;
  }, []);

  if (!job || job.status === "done") {
    if (job?.status !== "done") {
      return null;
    }
  }

  if (job.status === "done") {
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 px-5 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-2xl border border-primary/50 bg-slate-950 p-5 text-center shadow-glow">
          <p className="text-lg font-black text-white">Video siap.</p>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Video 16 saat sudah disimpan. Boleh preview, download, atau buka
            List Video.
          </p>
          <div className="mt-5 grid gap-3">
            <button
              type="button"
              onClick={() => goTo("/download")}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-5 text-sm font-black text-slate-950"
            >
              Preview / Download
            </button>
            <button
              type="button"
              onClick={() => goTo("/videos")}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-border px-5 text-sm font-black text-white"
            >
              List Video
            </button>
            <button
              type="button"
              onClick={clearPersistentVideoJob}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-5 text-xs font-black text-slate-300"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (job.status === "error") {
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 px-5 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-2xl border border-red-500/40 bg-slate-950 p-5 text-center shadow-glow">
          <p className="text-lg font-black text-white">Video gagal.</p>
          <p className="mt-3 text-sm leading-6 text-red-100">
            {job.error || "Video gagal dijana. Cuba lagi sebentar lagi."}
          </p>
          <div className="mt-5 grid gap-3">
            <button
              type="button"
              onClick={() => goTo("/render")}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-5 text-sm font-black text-slate-950"
            >
              Cuba Lagi
            </button>
            <button
              type="button"
              onClick={clearPersistentVideoJob}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-5 text-xs font-black text-slate-300"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-primary/40 bg-slate-950 p-5 text-center shadow-glow">
        <p className="text-lg font-black text-white">Video sedang dijana</p>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {getPhaseText(job)} Kalau browser ditutup, buka semula app dan sistem
          akan sambung semak status video.
        </p>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: job.phase === "poll-extend" ? "72%" : "38%" }}
          />
        </div>
        <a
          href="/videos"
          className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-border px-5 text-xs font-black text-white"
        >
          Buka List Video
        </a>
      </div>
    </div>
  );
}
