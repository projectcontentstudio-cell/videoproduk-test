"use client";

import { useEffect, useState } from "react";
import type { GeneratedScript } from "@/lib/gemini";
import type { RenderJobResult } from "@/lib/render-types";
import { readVideoDataUrl } from "@/lib/client-video-store";
import { VideoPlayer } from "./VideoPlayer";

type DownloadState = {
  result: RenderJobResult | null;
  script: GeneratedScript | null;
};

export function DownloadPanel() {
  const [state, setState] = useState<DownloadState>({
    result: null,
    script: null
  });

  useEffect(() => {
    let cancelled = false;
    const result = localStorage.getItem("videoproduk_render_result");
    const script = localStorage.getItem("videoproduk_script");
    const parsedResult = result ? (JSON.parse(result) as RenderJobResult) : null;
    const parsedScript = script ? (JSON.parse(script) as GeneratedScript) : null;

    setState({
      result: parsedResult,
      script: parsedScript
    });

    if (parsedResult?.videoStoreKey && !parsedResult.videoUrl) {
      readVideoDataUrl(parsedResult.videoStoreKey).then((videoUrl) => {
        if (!cancelled && videoUrl) {
          setState({
            result: {
              ...parsedResult,
              videoUrl
            },
            script: parsedScript
          });
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, []);

  const downloadable =
    state.result?.videoUrl &&
    (state.result.videoUrl.startsWith("http") ||
      state.result.videoUrl.startsWith("/") ||
      state.result.videoUrl.startsWith("data:video"));

  const hashtags = state.script?.hashtags.join(" ") ?? "";

  return (
    <div className="space-y-5">
      <VideoPlayer
        videoUrl={state.result?.videoUrl}
        watermarked={state.result?.watermarked}
      />

      <div className="rounded-2xl border border-border bg-surface p-5">
        <p className="text-sm font-black text-white">Caption + Hashtags</p>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {state.script?.caption ??
            "Caption akan muncul selepas render final selesai."}
        </p>
        {hashtags ? (
          <p className="mt-4 text-sm font-bold text-primary">{hashtags}</p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {downloadable ? (
          <a
            href={state.result?.videoUrl ?? ""}
            download
            className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-6 text-sm font-black text-slate-950 shadow-glow"
          >
            Download Video
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center rounded-full bg-slate-700 px-6 text-sm font-black text-slate-300"
          >
            Download Video
          </button>
        )}
        <a
          href="/"
          className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-border px-6 text-sm font-black text-white"
        >
          Ke Halaman Utama
        </a>
      </div>

      {!state.result?.videoUrl ? (
        <p className="text-center text-xs leading-5 text-slate-500">
          Video belum tersedia. Sila render dahulu.
        </p>
      ) : null}
    </div>
  );
}
