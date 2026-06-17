"use client";

import { useState } from "react";
import { getFriendlyErrorMessage } from "@/lib/friendly-error";
import type { StoryScript } from "@/lib/story-types";
import {
  getStoryVoice,
  storySceneDurationSeconds,
  storySceneLimit,
  storyStorageKeys
} from "@/lib/story-types";
import { saveVideoLibraryItem } from "@/lib/video-library";

const storyVideoDbName = "videoproduk_story_video";
const storyVideoStoreName = "videos";
const storyZoomVideoKey = "latest_zoom_video";

type StoryImage = {
  scene_number: number;
  imageUrl: string;
};

function withTimeout<T>(promise: Promise<T>, ms: number, message: string) {
  let timer: number | undefined;

  const timeout = new Promise<never>((_resolve, reject) => {
    timer = window.setTimeout(() => reject(new Error(message)), ms);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) {
      window.clearTimeout(timer);
    }
  });
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function isRetryableVoiceError(message: string) {
  const lower = message.toLowerCase();

  return (
    message.includes("429") ||
    message.includes("500") ||
    lower.includes("resource exhausted") ||
    lower.includes("busy") ||
    lower.includes("high load") ||
    lower.includes("internal")
  );
}

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

async function storeStoryVideoBlob(blob: Blob) {
  const db = await openStoryVideoDb();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storyVideoStoreName, "readwrite");
    transaction.objectStore(storyVideoStoreName).put(blob, storyZoomVideoKey);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });

  db.close();
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Gambar scene gagal dibaca untuk render zoom."));
    image.src = src;
  });
}

function drawCoverImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
  progress: number,
  sceneIndex: number
) {
  const imageRatio = image.width / image.height;
  const canvasRatio = width / height;
  const zoom = 1.04 + progress * 0.1;
  let drawWidth = width * zoom;
  let drawHeight = height * zoom;

  if (imageRatio > canvasRatio) {
    drawHeight = height * zoom;
    drawWidth = drawHeight * imageRatio;
  } else {
    drawWidth = width * zoom;
    drawHeight = drawWidth / imageRatio;
  }

  const panX = (sceneIndex % 2 === 0 ? -1 : 1) * width * 0.018 * progress;
  const panY = (sceneIndex % 3 === 0 ? 1 : -1) * height * 0.012 * progress;
  const x = (width - drawWidth) / 2 + panX;
  const y = (height - drawHeight) / 2 + panY;

  context.fillStyle = "#020617";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, x, y, drawWidth, drawHeight);
}

function getRecorderMimeType(hasAudio: boolean) {
  const candidates = hasAudio
    ? [
        "video/webm;codecs=vp8,opus",
        "video/webm;codecs=vp9,opus",
        "video/webm"
      ]
    : [
        "video/webm;codecs=vp8",
        "video/webm;codecs=vp9",
        "video/webm"
      ];

  return (
    candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ||
    "video/webm"
  );
}

async function makeAudioSource(audioUrl: string) {
  if (!audioUrl) {
    return null;
  }

  const audioContext = new AudioContext();
  const response = await fetch(audioUrl);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const destination = audioContext.createMediaStreamDestination();
  const source = audioContext.createBufferSource();
  const gain = audioContext.createGain();

  gain.gain.value = 0.95;
  source.buffer = audioBuffer;
  source.connect(gain);
  gain.connect(destination);

  return {
    audioContext,
    source,
    stream: destination.stream
  };
}

async function generateZoomVideo(
  images: StoryImage[],
  setProgress: (value: number) => void,
  setStatus: (value: string) => void,
  audioUrl = ""
) {
  if (!("MediaRecorder" in window)) {
    throw new Error("Browser ini belum support render video zoom. Cuba guna Chrome/Edge terbaru.");
  }

  setStatus(`Muat ${storySceneLimit} gambar...`);
  const loadedImages = await withTimeout(
    Promise.all(
      images
        .slice(0, storySceneLimit)
        .sort((a, b) => a.scene_number - b.scene_number)
        .map((image) => loadImage(image.imageUrl))
    ),
    45_000,
    "Gambar lambat dimuat. Refresh dan cuba render semula."
  );
  const canvas = document.createElement("canvas");
  const width = 720;
  const height = 1280;
  const fps = 30;
  const sceneDurationMs = storySceneDurationSeconds * 1000;
  const totalDurationMs = loadedImages.length * sceneDurationMs;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas render gagal dimulakan.");
  }

  const canvasContext = context;

  canvas.width = width;
  canvas.height = height;
  drawCoverImage(canvasContext, loadedImages[0], width, height, 0, 0);

  const stream = canvas.captureStream(fps);
  setStatus(audioUrl ? "Sediakan audio..." : "Render tanpa audio...");
  const audioSource = audioUrl
    ? await withTimeout(
        makeAudioSource(audioUrl),
        30_000,
        "Audio lambat diproses. Cuba render semula atau guna render tanpa suara."
      )
    : null;

  audioSource?.stream.getAudioTracks().forEach((track) => {
    stream.addTrack(track);
  });
  const mimeType = getRecorderMimeType(Boolean(audioSource));
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 4_000_000
  });
  const chunks: BlobPart[] = [];

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });

      if (blob.size < 1024) {
        reject(new Error("Video zoom siap tetapi file kosong. Cuba render semula."));
        return;
      }

      resolve(blob);
    };
    recorder.onerror = () => reject(new Error("Render video zoom gagal."));
  });

  recorder.start(1000);

  if (audioSource) {
    if (audioSource.audioContext.state === "suspended") {
      await audioSource.audioContext.resume();
    }
    audioSource.source.start(0);
  }

  setStatus("Render zoom video. Jangan tutup halaman ini...");
  await withTimeout(
    (async () => {
      const frameDelay = Math.round(1000 / fps);
      const start = performance.now();

      while (true) {
        const elapsed = Math.min(performance.now() - start, totalDurationMs);
        const sceneIndex = Math.min(
          loadedImages.length - 1,
          Math.floor(elapsed / sceneDurationMs)
        );
        const sceneElapsed = elapsed - sceneIndex * sceneDurationMs;
        const sceneProgress = Math.min(1, sceneElapsed / sceneDurationMs);

        drawCoverImage(
          canvasContext,
          loadedImages[sceneIndex],
          width,
          height,
          sceneProgress,
          sceneIndex
        );
        setProgress(Math.max(10, Math.round((elapsed / totalDurationMs) * 100)));

        if (elapsed >= totalDurationMs) {
          break;
        }

        await wait(frameDelay);
      }
    })(),
    totalDurationMs + 20_000,
    "Render video mengambil masa terlalu lama. Refresh halaman ini dan cuba render tanpa suara."
  );

  await new Promise((resolve) => window.setTimeout(resolve, 250));

  if (recorder.state === "recording") {
    recorder.requestData();
    recorder.stop();
  }

  try {
    audioSource?.source.stop();
  } catch {
    // Audio may have ended naturally before recording stops.
  }

  const blob = await withTimeout(
    done,
    10_000,
    "Video sudah dirender tetapi browser lambat menutup file. Cuba render tanpa suara."
  );

  stream.getTracks().forEach((track) => track.stop());
  await audioSource?.audioContext.close();

  return blob;
}

export function StoryRenderPanel() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function startRender(options?: { skipAudio?: boolean }) {
    const scriptRaw = localStorage.getItem(storyStorageKeys.script);
    const imagesRaw = localStorage.getItem(storyStorageKeys.images);

    if (!scriptRaw || !imagesRaw) {
      setError("Skrip atau gambar belum lengkap.");
      return;
    }

    setLoading(true);
    setError("");
    setStatus("Semak skrip dan gambar...");
    setProgress(5);

    try {
      const script = JSON.parse(scriptRaw) as StoryScript;
      const images = JSON.parse(imagesRaw) as StoryImage[];

      if (images.length < storySceneLimit) {
        throw new Error(`Jana ${storySceneLimit} gambar dulu sebelum render.`);
      }

      const sceneAudioUrls: string[] = [];

      if (!options?.skipAudio) {
        const selectedVoice = getStoryVoice(localStorage.getItem(storyStorageKeys.voice));
        const scenes = script.scenes.slice(0, storySceneLimit);

        for (let index = 0; index < scenes.length; index += 1) {
          const scene = scenes[index];

          setProgress(8 + Math.round((index / scenes.length) * 24));
          setStatus(`Jana suara scene ${index + 1}/${storySceneLimit}...`);

          let sceneAudioUrl = "";
          let lastVoiceError = "";

          for (let attempt = 1; attempt <= 3; attempt += 1) {
            const voiceResponse = await withTimeout(
              fetch("/api/generate-story-voice", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  text: scene.narration,
                  voiceName: selectedVoice.voiceName,
                  preview: false
                })
              }),
              75_000,
              `Suara scene ${index + 1} terlalu lama dijana. Cuba render tanpa suara dahulu.`
            );
            const voiceData = await voiceResponse.json();

            if (voiceResponse.ok && voiceData.audioUrl) {
              sceneAudioUrl = voiceData.audioUrl;
              break;
            }

            lastVoiceError = voiceData.error || `Suara scene ${index + 1} gagal dijana.`;

            if (attempt >= 3 || !isRetryableVoiceError(lastVoiceError)) {
              throw new Error(lastVoiceError);
            }

            setStatus(`Suara scene ${index + 1} busy. Retry ${attempt}/3 dalam 20 saat...`);
            await wait(20_000);
          }

          sceneAudioUrls.push(sceneAudioUrl);
        }
      }

      setProgress(sceneAudioUrls.length ? 36 : 12);
      setStatus(sceneAudioUrls.length ? "Gabung semua suara scene dan gambar ke MP4..." : "Render MP4 stabil di server. Sila tunggu...");
      const renderResponse = await withTimeout(
        fetch("/api/render-story-zoom", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            script,
            images,
            sceneAudioUrls
          })
        }),
        180_000,
        "Render MP4 terlalu lama. Cuba semula sebentar lagi."
      );
      const renderData = await renderResponse.json();

      if (!renderResponse.ok || !renderData?.result?.videoUrl) {
        throw new Error(renderData.error || "Render MP4 cerita gagal.");
      }

      setProgress(100);
      const renderResult = {
        videoUrl: renderData.result.videoUrl,
        videoMimeType: renderData.result.videoMimeType || "video/mp4",
        videoSize: renderData.result.videoSize,
        caption: script.caption,
        hashtags: script.hashtags,
        mock: false,
        zoomOnly: false,
        serverRender: true,
        hasAudio: Boolean(renderData.result.hasAudio),
        sceneAudio: sceneAudioUrls.length,
        storage: renderData.result.storage,
        gcsUri: renderData.result.gcsUri,
        renderedAt: Date.now()
      };

      localStorage.setItem(
        storyStorageKeys.render,
        JSON.stringify(renderResult)
      );
      saveVideoLibraryItem({
        title: script.title || "Video Cerita",
        type: "story",
        videoUrl: renderResult.videoUrl,
        videoMimeType: renderResult.videoMimeType,
        videoSize: renderResult.videoSize,
        caption: script.caption,
        hashtags: script.hashtags,
        storage: renderResult.storage === "gcs" ? "gcs" : "local",
        gcsUri: renderResult.gcsUri
      });
      window.setTimeout(() => {
        window.location.href = "/cerita/download";
      }, 700);
    } catch (renderError) {
      setError(getFriendlyErrorMessage(renderError, "Render cerita gagal. Cuba sekali lagi."));
      setStatus("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5 rounded-2xl border border-border bg-surface p-5">
      <div>
        <p className="text-lg font-black text-white">Render video cerita</p>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Versi ini gabungkan gambar yang sudah dijana menjadi MP4 stabil.
          Tiada caj video Veo.
        </p>
      </div>

      <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4">
        <p className="text-sm font-black text-white">Method zoom sahaja</p>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Sistem akan gabungkan {storySceneLimit} gambar dalam format 9:16 selama
          {" "}{storySceneDurationSeconds} saat setiap gambar. Render dibuat di server supaya download lebih stabil.
        </p>
      </div>

      <div className="h-3 overflow-hidden rounded-full bg-slate-900">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      {status ? <p className="text-sm font-bold text-primary">{status}</p> : null}
      {error ? <p className="text-sm font-bold text-red-200">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void startRender({ skipAudio: true })}
          disabled={loading}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-6 text-sm font-black text-slate-950 shadow-glow disabled:opacity-60"
        >
          {loading ? "Sila tunggu..." : "Render Video Cepat"}
        </button>
        <button
          type="button"
          onClick={() => void startRender()}
          disabled={loading}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-border px-6 text-sm font-black text-white disabled:opacity-60"
        >
          Render MP4 Stabil
        </button>
      </div>
    </div>
  );
}
