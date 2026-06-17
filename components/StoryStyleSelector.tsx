"use client";

import { useEffect, useState } from "react";
import type { StoryScript, StoryStyleId } from "@/lib/story-types";
import { getStoryStyle, storyStorageKeys, storyStyles } from "@/lib/story-types";

export function StoryStyleSelector() {
  const [selected, setSelected] = useState<StoryStyleId>("sinematik-3d");

  useEffect(() => {
    setSelected(getStoryStyle(localStorage.getItem(storyStorageKeys.style)).id);
  }, []);

  function chooseStyle(styleId: StoryStyleId) {
    const style = getStoryStyle(styleId);
    const storedScript = localStorage.getItem(storyStorageKeys.script);

    localStorage.setItem(storyStorageKeys.style, style.id);
    localStorage.setItem(storyStorageKeys.stylePrompt, style.style_prompt);

    if (storedScript) {
      try {
        const script = JSON.parse(storedScript) as StoryScript;
        const updated = {
          ...script,
          scenes: script.scenes.map((scene) => ({
            ...scene,
            image_prompt: [
              script.character_profile
                ? `Use this exact same character in every scene: ${script.character_profile}.`
                : "Use the exact same main character in every scene.",
              scene.image_prompt,
              `Visual style: ${style.style_prompt}`
            ].join(" ")
          }))
        };
        localStorage.setItem(storyStorageKeys.script, JSON.stringify(updated));
      } catch {
        localStorage.removeItem(storyStorageKeys.script);
      }
    }

    window.location.href = "/cerita/gambar";
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {storyStyles.map((style) => (
        <button
          key={style.id}
          type="button"
          onClick={() => chooseStyle(style.id)}
          className={`rounded-2xl border bg-surface p-5 text-left transition hover:border-primary hover:shadow-glow ${
            selected === style.id ? "border-primary" : "border-border"
          }`}
        >
          <div className="flex items-center justify-between gap-4">
            <p className="text-lg font-black text-white">{style.label}</p>
            <span className="rounded-full border border-primary/40 px-3 py-1 text-xs font-black text-primary">
              Style
            </span>
          </div>
          <p className="mt-3 text-sm font-bold text-slate-300">{style.sample}</p>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            {style.style_prompt}
          </p>
        </button>
      ))}
    </div>
  );
}
