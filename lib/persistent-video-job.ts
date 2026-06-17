"use client";

import type { RenderJobResult } from "@/lib/render-types";
import { trackSuccessfulVideoGeneration } from "@/lib/client-usage-store";
import { saveVideoLibraryItem } from "@/lib/video-library";
import {
  makeProductOnlyVeoPrompt,
  makeUltraSafeVeoPrompt
} from "@/lib/video-prompt-safety";

export const videoJobStorageKey = "videoproduk_active_video_job_v1";
const videoJobEventName = "videoproduk-video-job-update";

export type PersistentVideoJob = {
  id: string;
  title: string;
  status: "active" | "done" | "error";
  phase: "start-base" | "poll-base" | "start-extend" | "poll-extend" | "done" | "error";
  referenceSceneUrl: string;
  basePrompt: string;
  extendPrompt: string;
  caption?: string;
  hashtags?: string[];
  baseOperationName?: string;
  extendOperationName?: string;
  baseSafetyFallbackUsed?: boolean;
  extendSafetyFallbackUsed?: boolean;
  baseProductOnlyFallbackUsed?: boolean;
  extendProductOnlyFallbackUsed?: boolean;
  baseVideoGcsUri?: string;
  extendedVideoGcsUri?: string;
  videoUrl?: string;
  videoSize?: number;
  error?: string;
  createdAt: number;
  updatedAt: number;
};

let isRunning = false;

function emitJobUpdate() {
  window.dispatchEvent(new CustomEvent(videoJobEventName));
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function onVideoJobUpdate(callback: () => void) {
  window.addEventListener(videoJobEventName, callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener(videoJobEventName, callback);
    window.removeEventListener("storage", callback);
  };
}

export function getPersistentVideoJob() {
  try {
    const raw = localStorage.getItem(videoJobStorageKey);

    return raw ? (JSON.parse(raw) as PersistentVideoJob) : null;
  } catch {
    localStorage.removeItem(videoJobStorageKey);
    return null;
  }
}

export function savePersistentVideoJob(job: PersistentVideoJob) {
  localStorage.setItem(
    videoJobStorageKey,
    JSON.stringify({
      ...job,
      updatedAt: Date.now()
    })
  );
  emitJobUpdate();
}

export function clearPersistentVideoJob() {
  localStorage.removeItem(videoJobStorageKey);
  emitJobUpdate();
}

export function createPersistentVideoJob(job: Omit<PersistentVideoJob, "id" | "status" | "phase" | "createdAt" | "updatedAt">) {
  const now = Date.now();
  const next: PersistentVideoJob = {
    ...job,
    id: `${now}-${Math.random().toString(36).slice(2, 9)}`,
    status: "active",
    phase: "start-base",
    createdAt: now,
    updatedAt: now
  };

  savePersistentVideoJob(next);
  return next;
}

function isSafetyBlock(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  return (
    lower.includes("safety") ||
    lower.includes("responsible ai") ||
    lower.includes("sensitive") ||
    message.includes('"code":3')
  );
}

async function callVideoJobApi(body: Record<string, unknown>) {
  const response = await fetch("/api/video-job", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Video job gagal.");
  }

  return data as {
    done?: boolean;
    operationName?: string;
    videoUrl?: string;
    gcsUri?: string;
    videoSize?: number;
  };
}

function finishJob(job: PersistentVideoJob, result: RenderJobResult, videoSize?: number) {
  localStorage.setItem("videoproduk_render_result", JSON.stringify(result));
  saveVideoLibraryItem({
    title: job.title || "Video Produk",
    type: "product",
    videoUrl: result.videoUrl,
    videoMimeType: "video/mp4",
    videoSize,
    caption: job.caption,
    hashtags: job.hashtags,
    storage: result.extendedVideoGcsUri ? "gcs" : "local",
    gcsUri: result.extendedVideoGcsUri
  });
  trackSuccessfulVideoGeneration();
  savePersistentVideoJob({
    ...job,
    status: "done",
    phase: "done",
    videoUrl: result.videoUrl,
    videoSize,
    extendedVideoGcsUri: result.extendedVideoGcsUri
  });
}

export async function continuePersistentVideoJob() {
  if (isRunning) {
    return getPersistentVideoJob();
  }

  isRunning = true;

  try {
    while (true) {
      const job = getPersistentVideoJob();

      if (!job || job.status !== "active") {
        return job;
      }

      try {
        if (job.phase === "start-base") {
          const data = await callVideoJobApi({
            action: "start-base",
            referenceSceneUrl: job.referenceSceneUrl,
            prompt: job.basePrompt
          });

          savePersistentVideoJob({
            ...job,
            phase: "poll-base",
            baseOperationName: data.operationName
          });
          continue;
        }

        if (job.phase === "poll-base") {
          if (!job.baseOperationName) {
            throw new Error("Operation base video belum disimpan.");
          }

          const data = await callVideoJobApi({
            action: "poll-base",
            operationName: job.baseOperationName
          });

          if (!data.done) {
            await wait(10_000);
            continue;
          }

          if (!data.gcsUri) {
            throw new Error("Base video siap tetapi GCS URI tidak tersedia untuk sambung video.");
          }

          savePersistentVideoJob({
            ...job,
            phase: "start-extend",
            baseVideoGcsUri: data.gcsUri
          });
          continue;
        }

        if (job.phase === "start-extend") {
          if (!job.baseVideoGcsUri) {
            throw new Error("Base video GCS URI belum tersedia.");
          }

          const data = await callVideoJobApi({
            action: "start-extend",
            baseVideoGcsUri: job.baseVideoGcsUri,
            prompt: job.extendPrompt
          });

          savePersistentVideoJob({
            ...job,
            phase: "poll-extend",
            extendOperationName: data.operationName
          });
          continue;
        }

        if (job.phase === "poll-extend") {
          if (!job.extendOperationName) {
            throw new Error("Operation sambung video belum disimpan.");
          }

          const data = await callVideoJobApi({
            action: "poll-extend",
            operationName: job.extendOperationName
          });

          if (!data.done) {
            await wait(10_000);
            continue;
          }

          if (!data.videoUrl) {
            throw new Error("Video siap tetapi URL tidak tersedia.");
          }

          finishJob(
            job,
            {
              videoUrl: data.videoUrl,
              baseVideoGcsUri: job.baseVideoGcsUri,
              extendedVideoGcsUri: data.gcsUri,
              watermarked: true,
              downloadable: false
            },
            data.videoSize
          );
          return getPersistentVideoJob();
        }

        return job;
      } catch (error) {
        if (
          isSafetyBlock(error) &&
          (job.phase === "start-base" || job.phase === "poll-base") &&
          !job.baseSafetyFallbackUsed
        ) {
          savePersistentVideoJob({
            ...job,
            phase: "start-base",
            basePrompt: makeUltraSafeVeoPrompt("base"),
            baseOperationName: undefined,
            baseSafetyFallbackUsed: true,
            error: undefined
          });
          continue;
        }

        if (
          isSafetyBlock(error) &&
          (job.phase === "start-base" || job.phase === "poll-base") &&
          job.baseSafetyFallbackUsed &&
          !job.baseProductOnlyFallbackUsed
        ) {
          savePersistentVideoJob({
            ...job,
            phase: "start-base",
            basePrompt: makeProductOnlyVeoPrompt("base"),
            baseOperationName: undefined,
            baseProductOnlyFallbackUsed: true,
            error: undefined
          });
          continue;
        }

        if (
          isSafetyBlock(error) &&
          (job.phase === "start-extend" || job.phase === "poll-extend") &&
          !job.extendSafetyFallbackUsed
        ) {
          savePersistentVideoJob({
            ...job,
            phase: "start-extend",
            extendPrompt: makeUltraSafeVeoPrompt("extend"),
            extendOperationName: undefined,
            extendSafetyFallbackUsed: true,
            error: undefined
          });
          continue;
        }

        if (
          isSafetyBlock(error) &&
          (job.phase === "start-extend" || job.phase === "poll-extend") &&
          job.extendSafetyFallbackUsed &&
          !job.extendProductOnlyFallbackUsed
        ) {
          savePersistentVideoJob({
            ...job,
            phase: "start-extend",
            extendPrompt: makeProductOnlyVeoPrompt("extend"),
            extendOperationName: undefined,
            extendProductOnlyFallbackUsed: true,
            error: undefined
          });
          continue;
        }

        savePersistentVideoJob({
          ...job,
          status: "error",
          phase: "error",
          error: error instanceof Error ? error.message : "Video gagal dijana."
        });
        return getPersistentVideoJob();
      }
    }
  } finally {
    isRunning = false;
  }
}
