"use client";

import { useEffect, useState } from "react";
import { getFriendlyErrorMessage } from "@/lib/friendly-error";
import type { StoryScript } from "@/lib/story-types";
import {
  getStoryType,
  storySceneDurationSeconds,
  storySceneLimit,
  storyStorageKeys
} from "@/lib/story-types";

export function StoryScriptEditor() {
  const [script, setScript] = useState<StoryScript | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generateScript() {
    const storyType = getStoryType(localStorage.getItem(storyStorageKeys.type));
    const topic = localStorage.getItem(storyStorageKeys.topic) || storyType.example;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/generate-story-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyType: storyType.id, topic })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Skrip cerita gagal dijana.");
      }

      setScript(data.script);
      localStorage.setItem(storyStorageKeys.script, JSON.stringify(data.script));
    } catch (generateError) {
      setError(getFriendlyErrorMessage(generateError, "Skrip cerita gagal dijana. Cuba sekali lagi."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const stored = localStorage.getItem(storyStorageKeys.script);

    if (stored) {
      try {
        setScript(JSON.parse(stored) as StoryScript);
        return;
      } catch {
        localStorage.removeItem(storyStorageKeys.script);
      }
    }

    void generateScript();
  }, []);

  function updateScene(index: number, field: "narration" | "subtitle", value: string) {
    setScript((current) => {
      if (!current) {
        return current;
      }

      const next = {
        ...current,
        scenes: current.scenes.map((scene, sceneIndex) =>
          sceneIndex === index ? { ...scene, [field]: value } : scene
        )
      };

      localStorage.setItem(storyStorageKeys.script, JSON.stringify(next));
      return next;
    });
  }

  if (loading && !script) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-5 text-center">
        <p className="text-sm font-black text-white">Sila tunggu</p>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Skrip {storySceneLimit} scene sedang disediakan.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-white">
            {script?.title || "Skrip cerita"}
          </p>
          <p className="text-sm leading-6 text-slate-400">
            Semak narration dan subtitle sebelum pilih gaya visual.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void generateScript()}
            disabled={loading}
            className="rounded-full border border-border px-4 py-2 text-xs font-black text-white disabled:opacity-60"
          >
            {loading ? "Menjana..." : "Jana Semula"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (script) {
                localStorage.setItem(storyStorageKeys.script, JSON.stringify(script));
              }
              window.location.href = "/cerita/gaya";
            }}
            disabled={!script}
            className="rounded-full bg-primary px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-60"
          >
            Teruskan
          </button>
        </div>
      </div>

      {error ? <p className="text-sm font-bold text-red-200">{error}</p> : null}

      {script?.character_profile ? (
        <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
            Watak konsisten
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {script.character_profile}
          </p>
        </div>
      ) : null}

      <div className="grid gap-4">
        {script?.scenes.map((scene, index) => (
          <div
            key={scene.scene_number}
            className="rounded-2xl border border-border bg-surface p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full bg-primary px-3 py-1 text-xs font-black text-slate-950">
                Scene {scene.scene_number}
              </span>
              <span className="text-xs font-bold text-slate-500">
                {storySceneDurationSeconds} saat
              </span>
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-black text-white">
                Image prompt
              </summary>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {scene.image_prompt}
              </p>
            </details>
            <label className="mt-3 block">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                Narration
              </span>
              <textarea
                value={scene.narration}
                onChange={(event) =>
                  updateScene(index, "narration", event.target.value)
                }
                rows={2}
                className="mt-2 w-full rounded-xl border border-border bg-slate-950 p-3 text-sm leading-6 text-white outline-none focus:border-primary"
              />
            </label>
            <label className="mt-3 block">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                Subtitle
              </span>
              <input
                value={scene.subtitle}
                onChange={(event) =>
                  updateScene(index, "subtitle", event.target.value)
                }
                className="mt-2 min-h-11 w-full rounded-xl border border-border bg-slate-950 px-3 text-sm text-white outline-none focus:border-primary"
              />
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
