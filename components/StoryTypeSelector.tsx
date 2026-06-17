"use client";

import {
  storyGeneratedStorageKeys,
  storyStorageKeys,
  storyTypes
} from "@/lib/story-types";

function clearGeneratedStoryState() {
  storyGeneratedStorageKeys.forEach((key) => {
    localStorage.removeItem(key);
  });
}

export function StoryTypeSelector() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {storyTypes.map((type) => (
        <button
          key={type.id}
          type="button"
          onClick={() => {
            clearGeneratedStoryState();
            localStorage.setItem(storyStorageKeys.type, type.id);
            window.location.href = "/cerita/topik";
          }}
          className="rounded-2xl border border-border bg-surface p-5 text-left transition hover:border-primary hover:shadow-glow"
        >
          <div className="flex items-center justify-between gap-4">
            <p className="text-lg font-black text-white">{type.label}</p>
            <span className="rounded-full border border-primary/40 px-3 py-1 text-xs font-black text-primary">
              {type.icon}
            </span>
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-400">Contoh</p>
          <p className="mt-1 text-sm leading-6 text-slate-200">
            {type.example}
          </p>
        </button>
      ))}
    </div>
  );
}
