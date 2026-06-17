"use client";

import { useEffect, useState } from "react";
import {
  getVideoLibrary,
  removeVideoLibraryItem,
  type VideoLibraryItem
} from "@/lib/video-library";

function formatDate(value: number) {
  return new Intl.DateTimeFormat("ms-MY", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatSize(value?: number) {
  if (!value) {
    return "";
  }

  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

export function VideoLibraryPanel() {
  const [items, setItems] = useState<VideoLibraryItem[]>([]);
  const [active, setActive] = useState<VideoLibraryItem | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const videos = getVideoLibrary();

    setItems(videos);
    setActive(videos[0] || null);
  }, []);

  async function downloadVideo(item: VideoLibraryItem) {
    try {
      setStatus("Sediakan download...");
      const response = await fetch(item.videoUrl);

      if (!response.ok) {
        throw new Error("Video gagal dimuat untuk download.");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = objectUrl;
      link.download = `${item.title || "video"}.mp4`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
      setStatus("Download dimulakan.");
    } catch {
      setStatus("Download gagal. Buka preview dan cuba menu video.");
    }
  }

  async function copyCaption(item: VideoLibraryItem) {
    const text = [item.caption, ...(item.hashtags || [])].filter(Boolean).join("\n\n");

    if (!text.trim()) {
      setStatus("Caption belum tersedia.");
      return;
    }

    await navigator.clipboard.writeText(text);
    setStatus("Caption disalin.");
  }

  function removeItem(id: string) {
    const next = removeVideoLibraryItem(id);

    setItems(next);
    setActive((current) => {
      if (current?.id !== id) {
        return current;
      }

      return next[0] || null;
    });
  }

  if (!items.length) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <p className="text-lg font-black text-white">Belum ada video</p>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Bila render siap, video akan muncul di sini untuk preview dan download balik.
        </p>
        <a
          href="/cerita"
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-black text-slate-950"
        >
          Buat Video Cerita
        </a>
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="aspect-[9/16] bg-slate-950">
          {active ? (
            <video src={active.videoUrl} controls playsInline className="h-full w-full" />
          ) : null}
        </div>
        {active ? (
          <div className="border-t border-border p-4">
            <p className="line-clamp-2 text-sm font-black text-white">{active.title}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">
              {formatDate(active.createdAt)} {formatSize(active.videoSize) ? `| ${formatSize(active.videoSize)}` : ""} {active.storage === "gcs" ? "| Cloud saved" : "| Local"}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void downloadVideo(active)}
                className="min-h-11 rounded-full bg-primary px-5 text-sm font-black text-slate-950"
              >
                Download Video
              </button>
              <button
                type="button"
                onClick={() => void copyCaption(active)}
                className="min-h-11 rounded-full border border-border px-5 text-sm font-black text-white"
              >
                Salin Caption
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-black text-white">{items.length} video</p>
          {status ? <p className="text-xs font-bold text-primary">{status}</p> : null}
        </div>
        <div className="space-y-3">
          {items.map((item) => (
            <article
              key={item.id}
              className={`rounded-2xl border p-4 transition ${
                active?.id === item.id
                  ? "border-primary bg-primary/10"
                  : "border-border bg-surface"
              }`}
            >
              <button
                type="button"
                onClick={() => setActive(item)}
                className="block w-full text-left"
              >
                <p className="line-clamp-1 text-sm font-black text-white">{item.title}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  {formatDate(item.createdAt)} {formatSize(item.videoSize) ? `| ${formatSize(item.videoSize)}` : ""} {item.storage === "gcs" ? "| Cloud" : "| Local"}
                </p>
                {item.caption ? (
                  <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-400">
                    {item.caption}
                  </p>
                ) : null}
              </button>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => void downloadVideo(item)}
                  className="min-h-9 flex-1 rounded-full border border-border px-3 text-xs font-black text-white"
                >
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="min-h-9 rounded-full border border-red-500/40 px-3 text-xs font-black text-red-100"
                >
                  Buang
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
