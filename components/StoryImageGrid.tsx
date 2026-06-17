"use client";

import { useEffect, useMemo, useState } from "react";
import type { StoryScript, StoryScene } from "@/lib/story-types";
import {
  storySceneDurationSeconds,
  storySceneLimit,
  storyStorageKeys
} from "@/lib/story-types";

type StoryImage = {
  scene_number: number;
  imageUrl: string;
};

export function StoryImageGrid() {
  const [script, setScript] = useState<StoryScript | null>(null);
  const [images, setImages] = useState<StoryImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeScene, setActiveScene] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const imageMap = useMemo(() => {
    return new Map(images.map((image) => [image.scene_number, image.imageUrl]));
  }, [images]);

  useEffect(() => {
    const storedScript = localStorage.getItem(storyStorageKeys.script);
    const storedImages = localStorage.getItem(storyStorageKeys.images);

    if (storedScript) {
      try {
        setScript(JSON.parse(storedScript) as StoryScript);
      } catch {
        localStorage.removeItem(storyStorageKeys.script);
      }
    }

    if (storedImages) {
      try {
        setImages(JSON.parse(storedImages) as StoryImage[]);
      } catch {
        localStorage.removeItem(storyStorageKeys.images);
      }
    }
  }, []);

  async function generateSingleScene(scene: StoryScene, masterCharacterImageUrl?: string) {
    if (!script) {
      throw new Error("Skrip belum tersedia.");
    }

    const stylePrompt = localStorage.getItem(storyStorageKeys.stylePrompt) || "";
    const response = await fetch("/api/generate-story-images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenes: [scene],
        stylePrompt,
        sceneNumber: scene.scene_number,
        masterCharacterImageUrl
      })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Image cerita gagal dijana.");
    }

    const generatedImage = (data.images as StoryImage[])[0];

    setImages((current) => {
      const merged = new Map(current.map((item) => [item.scene_number, item]));
      if (generatedImage) {
        merged.set(generatedImage.scene_number, generatedImage);
      }
      const next = Array.from(merged.values()).sort(
        (a, b) => a.scene_number - b.scene_number
      );
      localStorage.setItem(storyStorageKeys.images, JSON.stringify(next));
      return next;
    });

    return generatedImage;
  }

  async function generateImages(scene?: StoryScene) {
    if (!script) {
      setError("Skrip belum tersedia.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (scene) {
        setActiveScene(scene.scene_number);
        setStatus(`Scene ${scene.scene_number} sedang dijana...`);
        const masterImageUrl =
          scene.scene_number > 1
            ? imageMap.get(1) || images.find((image) => image.scene_number === 1)?.imageUrl
            : undefined;

        if (scene.scene_number > 1 && !masterImageUrl) {
          throw new Error("Jana Scene 1 dulu sebagai master character.");
        }

        await generateSingleScene(scene, masterImageUrl);
        setStatus(`Scene ${scene.scene_number} siap.`);
        return;
      }

      let masterImageUrl =
        imageMap.get(1) || images.find((image) => image.scene_number === 1)?.imageUrl;

      for (const item of scenes) {
        setActiveScene(item.scene_number);
        setStatus(`Jana scene ${item.scene_number}/${storySceneLimit}. Sila tunggu, jangan refresh.`);
        const generatedImage = await generateSingleScene(
          item,
          item.scene_number > 1 ? masterImageUrl : undefined
        );

        if (item.scene_number === 1 && generatedImage?.imageUrl) {
          masterImageUrl = generatedImage.imageUrl;
        }

        if (item.scene_number > 1 && !masterImageUrl) {
          throw new Error("Scene 1 gagal jadi master character. Jana semula Scene 1.");
        }

        await new Promise((resolve) => setTimeout(resolve, 1200));
      }

      setStatus(`Semua ${storySceneLimit} gambar siap.`);
    } catch (generateError) {
      const message =
        generateError instanceof Error
          ? generateError.message
          : "Image cerita gagal dijana.";
      setError(
        message.includes("429") || message.toLowerCase().includes("resource exhausted")
          ? "Server image sedang busy atau quota terlalu laju. Sistem sudah cuba retry. Tunggu sebentar dan tekan Jana Scene Ini untuk sambung dari scene yang gagal."
          : message
      );
    } finally {
      setLoading(false);
      setActiveScene(null);
    }
  }

  const scenes = script?.scenes.slice(0, storySceneLimit) || [];
  const progress = scenes.length
    ? Math.round((images.length / scenes.length) * 100)
    : 0;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-white">Progress gambar</p>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              {images.length}/{storySceneLimit} scene siap. Tekan scene untuk jana semula satu gambar.
            </p>
            {status ? (
              <p className="mt-2 text-sm font-bold text-primary">{status}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void generateImages()}
            disabled={!script || loading}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-black text-slate-950 disabled:opacity-60"
          >
            {loading ? "Sila tunggu..." : images.length ? "Jana Semula Semua" : `Jana ${storySceneLimit} Gambar`}
          </button>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-900">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {error ? <p className="text-sm font-bold text-red-200">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {scenes.map((scene) => {
          const imageUrl = imageMap.get(scene.scene_number);
          return (
            <article
              key={scene.scene_number}
              className="overflow-hidden rounded-2xl border border-border bg-surface"
            >
              <div className="aspect-[9/16] bg-slate-950">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl}
                    alt={`Scene ${scene.scene_number}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center p-5 text-center text-sm font-bold text-slate-500">
                    Belum dijana
                  </div>
                )}
              </div>
              <div className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-primary px-3 py-1 text-xs font-black text-slate-950">
                    Scene {scene.scene_number}
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    {scene.duration || storySceneDurationSeconds}s
                  </span>
                </div>
                <p className="line-clamp-3 text-sm leading-6 text-slate-300">
                  {scene.subtitle}
                </p>
                <button
                  type="button"
                  onClick={() => void generateImages(scene)}
                  disabled={loading}
                  className="min-h-10 w-full rounded-full border border-border px-4 text-xs font-black text-white disabled:opacity-60"
                >
                  {activeScene === scene.scene_number ? "Menjana..." : "Jana Scene Ini"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <button
        type="button"
        disabled={images.length < storySceneLimit}
        onClick={() => {
          window.location.href = "/cerita/suara";
        }}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-6 text-sm font-black text-slate-950 shadow-glow disabled:opacity-50"
      >
        Pilih Suara
      </button>
    </div>
  );
}
