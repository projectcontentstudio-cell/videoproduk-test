"use client";

import { useEffect, useState } from "react";
import { getStoryVoice, storyStorageKeys, storyVoices } from "@/lib/story-types";
import type { StoryScript, StoryVoiceId } from "@/lib/story-types";

export function StoryVoiceSelector() {
  const [selected, setSelected] = useState<StoryVoiceId>("wanita");
  const [previewing, setPreviewing] = useState<StoryVoiceId | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setSelected(getStoryVoice(localStorage.getItem(storyStorageKeys.voice)).id);
  }, []);

  async function previewVoice(voiceId: StoryVoiceId) {
    const voice = getStoryVoice(voiceId);
    const storedScript = localStorage.getItem(storyStorageKeys.script);
    let text = "Ini preview suara untuk video cerita.";

    if (storedScript) {
      try {
        const script = JSON.parse(storedScript) as StoryScript;
        text = script.scenes[0]?.narration || text;
      } catch {
        localStorage.removeItem(storyStorageKeys.script);
      }
    }

    setPreviewing(voiceId);
    setMessage("");

    try {
      const response = await fetch("/api/generate-story-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceName: voice.voiceName, preview: true })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Preview suara gagal.");
      }

      if (data.audioUrl) {
        const audio = new Audio(data.audioUrl);
        void audio.play().catch(() => setMessage("Preview suara mock tersedia."));
      } else {
        setMessage("Preview suara mock tersedia.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Preview suara gagal.");
    } finally {
      setPreviewing(null);
    }
  }

  function continueRender() {
    localStorage.setItem(storyStorageKeys.voice, selected);
    window.location.href = "/cerita/render";
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {storyVoices.map((voice) => (
          <article
            key={voice.id}
            className={`rounded-2xl border bg-surface p-5 ${
              selected === voice.id ? "border-primary" : "border-border"
            }`}
          >
            <button
              type="button"
              onClick={() => setSelected(voice.id)}
              className="block w-full text-left"
            >
              <p className="text-lg font-black text-white">{voice.label}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{voice.detail}</p>
            </button>
            <button
              type="button"
              onClick={() => void previewVoice(voice.id)}
              disabled={Boolean(previewing)}
              className="mt-4 min-h-10 w-full rounded-full border border-border px-4 text-xs font-black text-white disabled:opacity-60"
            >
              {previewing === voice.id ? "Preview..." : "Dengar Preview"}
            </button>
          </article>
        ))}
      </div>

      {message ? <p className="text-sm font-bold text-slate-300">{message}</p> : null}

      <button
        type="button"
        onClick={continueRender}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-6 text-sm font-black text-slate-950 shadow-glow"
      >
        Teruskan Render
      </button>
    </div>
  );
}
