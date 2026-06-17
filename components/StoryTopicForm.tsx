"use client";

import { useEffect, useState } from "react";
import {
  getStoryType,
  storyGeneratedStorageKeys,
  storyStorageKeys
} from "@/lib/story-types";

function clearGeneratedStoryState() {
  storyGeneratedStorageKeys.forEach((key) => {
    localStorage.removeItem(key);
  });
}

const storySuggestions: Record<string, string[]> = {
  fakta: [
    "Misteri kehilangan MH370",
    "Kenapa Titanic tenggelam walaupun dikatakan mustahil",
    "Rahsia Piramid Mesir yang masih jadi tanda tanya",
    "Kisah benar letupan Chernobyl",
    "Bagaimana telefon pintar mengubah dunia"
  ],
  seram: [
    "Rumah lama yang lampunya menyala sendiri",
    "Lif kosong yang berhenti di tingkat terlarang",
    "Suara misteri dari bilik sebelah",
    "Kampung sunyi selepas tengah malam",
    "Rakaman CCTV yang tidak patut wujud"
  ],
  motivasi: [
    "Kisah Elon Musk bangkit selepas hampir gagal",
    "Pelajar biasa yang ubah hidup dengan disiplin kecil",
    "Peniaga kecil yang mula semula selepas rugi besar",
    "Kenapa gagal sekali bukan bermaksud tamat",
    "Cara bangkit bila semua orang tidak percaya"
  ],
  "stoic-dialog": [
    "Bila hati terlalu berharap pada orang",
    "Bila dia pergi tanpa penjelasan",
    "Bila orang hina kita tapi kita pilih diam",
    "Bila rasa tak cukup baik untuk sesiapa",
    "Bila anxiety buat kita takut mula semula",
    "Bila cemburu merosakkan hati sendiri"
  ],
  islamic: [
    "Kisah Nabi Musa AS berdepan Firaun",
    "Pengajaran dari kisah Ashabul Kahfi",
    "Kisah Nabi Yunus AS dalam perut ikan",
    "Kenapa sabar itu kekuatan besar",
    "Kisah taubat yang memberi harapan"
  ],
  "kisah-benar": [
    "Mangsa scam online hilang RM50k",
    "Pekerja biasa jumpa rahsia besar syarikat",
    "Kisah pemandu e-hailing bantu penumpang cemas",
    "Ibu tunggal bina hidup semula dari kosong",
    "Kisah benar orang hilang yang akhirnya ditemui"
  ]
};

export function StoryTopicForm() {
  const [storyType, setStoryType] = useState(getStoryType());
  const [topic, setTopic] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setStoryType(getStoryType(localStorage.getItem(storyStorageKeys.type)));
  }, []);

  async function suggestStory() {
    setSuggesting(true);
    setError("");

    try {
      let list = suggestions;

      if (!list.length) {
        const response = await fetch("/api/suggest-story-topics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storyType: storyType.id,
            currentTopic: topic
          })
        });
        const data = await response.json();

        list = Array.isArray(data.suggestions) && data.suggestions.length
          ? data.suggestions
          : storySuggestions[storyType.id] || storySuggestions.fakta;
        setSuggestions(list);
      }

      const nextTopic = list[suggestionIndex % list.length];

      setTopic(nextTopic);
      setSuggestionIndex((current) => current + 1);
    } catch {
      const list =
        storySuggestions[storyType.id] ||
        storySuggestions.fakta;
      const nextTopic = list[suggestionIndex % list.length];

      setTopic(nextTopic);
      setSuggestionIndex((current) => current + 1);
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <form
      className="space-y-5 rounded-2xl border border-border bg-surface p-5"
      onSubmit={(event) => {
        event.preventDefault();
        const clean = topic.trim();

        if (!clean) {
          setError("Masukkan topik cerita dulu.");
          return;
        }

        clearGeneratedStoryState();
        localStorage.setItem(storyStorageKeys.topic, clean.slice(0, 100));
        window.location.href = "/cerita/skrip";
      }}
    >
      <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
          Kategori dipilih
        </p>
        <p className="mt-1 text-lg font-black text-white">{storyType.label}</p>
      </div>

      <label className="block">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
          Topik cerita
        </span>
        <input
          value={topic}
          maxLength={100}
          onChange={(event) => setTopic(event.target.value)}
          placeholder={storyType.placeholder}
          className="mt-2 min-h-12 w-full rounded-xl border border-border bg-slate-950 px-4 text-base text-white outline-none focus:border-primary"
        />
      </label>

      <button
        type="button"
        onClick={() => void suggestStory()}
        disabled={suggesting}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-primary px-5 text-sm font-black text-primary disabled:opacity-60"
      >
        {suggesting ? "Semak dengan Gemini..." : "Suggest Cerita"}
      </button>

      <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-500">
        <span>Maksimum 100 karakter</span>
        <span>{topic.length}/100</span>
      </div>

      {error ? <p className="text-sm font-bold text-red-200">{error}</p> : null}

      <button
        type="submit"
        className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-6 text-sm font-black text-slate-950 shadow-glow"
      >
        Jana Cerita
      </button>
    </form>
  );
}
