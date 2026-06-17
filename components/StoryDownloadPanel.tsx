"use client";

import { useEffect, useState } from "react";
import type { StoryScript } from "@/lib/story-types";
import { storyStorageKeys } from "@/lib/story-types";

const storyVideoDbName = "videoproduk_story_video";
const storyVideoStoreName = "videos";
const storyZoomVideoKey = "latest_zoom_video";

type StoryRenderResult = {
  videoUrl?: string;
  videoMimeType?: string;
  videoSize?: number;
  caption?: string;
  hashtags?: string[];
  mock?: boolean;
  zoomOnly?: boolean;
};

function openStoryVideoDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(storyVideoDbName, 1);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(storyVideoStoreName);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readStoryVideoBlob() {
  const db = await openStoryVideoDb();

  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const transaction = db.transaction(storyVideoStoreName, "readonly");
      const request = transaction.objectStore(storyVideoStoreName).get(storyZoomVideoKey);

      request.onsuccess = () => resolve((request.result as Blob | undefined) || null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export function StoryDownloadPanel() {
  const [script, setScript] = useState<StoryScript | null>(null);
  const [render, setRender] = useState<StoryRenderResult | null>(null);
  const [videoObjectUrl, setVideoObjectUrl] = useState("");
  const [videoError, setVideoError] = useState("");
  const [copied, setCopied] = useState("");
  const [downloadStatus, setDownloadStatus] = useState("");

  useEffect(() => {
    const scriptRaw = localStorage.getItem(storyStorageKeys.script);
    const renderRaw = localStorage.getItem(storyStorageKeys.render);

    if (scriptRaw) {
      try {
        setScript(JSON.parse(scriptRaw) as StoryScript);
      } catch {
        localStorage.removeItem(storyStorageKeys.script);
      }
    }

    if (renderRaw) {
      try {
        setRender(JSON.parse(renderRaw) as StoryRenderResult);
      } catch {
        localStorage.removeItem(storyStorageKeys.render);
      }
    }
  }, []);

  useEffect(() => {
    let objectUrl = "";

    async function loadIndexedDbVideo() {
      setVideoError("");

      if (!render?.videoUrl?.startsWith("indexeddb:")) {
        setVideoObjectUrl(render?.videoUrl || "");
        return;
      }

      const blob = await readStoryVideoBlob();

      if (!blob || blob.size < 1024) {
        setVideoObjectUrl("");
        setVideoError("Video belum dijumpai atau file kosong. Render semula video cerita.");
        return;
      }

      objectUrl = URL.createObjectURL(blob);
      setVideoObjectUrl(objectUrl);
    }

    void loadIndexedDbVideo();

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [render]);

  async function copyText(label: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(`${label} disalin.`);
    window.setTimeout(() => setCopied(""), 1800);
  }

  async function downloadVideo() {
    if (!videoObjectUrl) {
      return;
    }

    setDownloadStatus("");

    try {
      const mimeType = render?.videoMimeType || "";
      const extension =
        mimeType.includes("mp4") || videoObjectUrl.includes("/api/generated-videos/")
          ? "mp4"
          : "webm";
      const fileName = `video-cerita.${extension}`;
      let downloadUrl = videoObjectUrl;
      let shouldRevoke = false;

      if (!videoObjectUrl.startsWith("blob:")) {
        const response = await fetch(videoObjectUrl);

        if (!response.ok) {
          throw new Error("Video gagal disediakan untuk download.");
        }

        const blob = await response.blob();
        downloadUrl = URL.createObjectURL(blob);
        shouldRevoke = true;
      }

      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();

      if (shouldRevoke) {
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1500);
      }

      setDownloadStatus("Download dimulakan.");
    } catch {
      setDownloadStatus("Browser ini tidak benarkan download terus. Tekan menu video dan pilih download/save.");
    }
  }

  const caption = render?.caption || script?.caption || "";
  const hashtags = (render?.hashtags || script?.hashtags || []).join(" ");

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="aspect-[9/16] bg-slate-950">
          {videoObjectUrl ? (
            <video src={videoObjectUrl} controls className="h-full w-full" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center">
              <p className="text-lg font-black text-white">Preview zoom belum tersedia</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {videoError || "Video zoom belum dijana. Pergi ke halaman render dan tekan render."}
              </p>
            </div>
          )}
        </div>
        {videoObjectUrl ? (
          <button
            type="button"
            onClick={() => void downloadVideo()}
            className="flex min-h-12 items-center justify-center bg-primary text-sm font-black text-slate-950"
          >
            Download Video
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="flex min-h-12 w-full items-center justify-center bg-slate-800 text-sm font-black text-slate-500"
          >
            Download belum tersedia
          </button>
        )}
        {videoObjectUrl ? (
          <div className="border-t border-border px-4 py-3 text-center">
            <p className="text-xs font-bold text-slate-400">
              Format {render?.videoMimeType?.includes("mp4") ? "MP4" : "WebM"} {render?.videoSize ? `- ${(render.videoSize / 1024 / 1024).toFixed(2)} MB` : ""}
            </p>
            {downloadStatus ? (
              <p className="mt-2 text-xs font-bold text-primary">{downloadStatus}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <article className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-sm font-black text-white">Caption</p>
          <p className="mt-3 text-sm leading-6 text-slate-300">{caption}</p>
          <button
            type="button"
            onClick={() => void copyText("Caption", caption)}
            className="mt-4 min-h-10 rounded-full border border-border px-4 text-xs font-black text-white"
          >
            Salin Caption
          </button>
        </article>

        <article className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-sm font-black text-white">Hashtags</p>
          <p className="mt-3 text-sm leading-6 text-primary">{hashtags}</p>
          <button
            type="button"
            onClick={() => void copyText("Hashtag", hashtags)}
            className="mt-4 min-h-10 rounded-full border border-border px-4 text-xs font-black text-white"
          >
            Salin Hashtag
          </button>
        </article>

        {copied ? <p className="text-sm font-bold text-primary">{copied}</p> : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href="/cerita/skrip"
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-border px-5 text-sm font-black text-white"
          >
            Edit Skrip
          </a>
          <a
            href="/cerita"
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-primary px-5 text-sm font-black text-slate-950"
          >
            Cerita Baru
          </a>
        </div>
      </div>
    </div>
  );
}
