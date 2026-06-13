"use client";

import { useMemo, useState } from "react";

const storyModes = [
  {
    id: "problem_solution",
    label: "Problem → Solution",
    bestFor: "Produk yang selesaikan masalah jelas.",
    beats: [
      "Hook masalah yang orang pernah rasa",
      "Situasi harian sebelum guna produk",
      "Produk muncul sebagai jalan mudah",
      "Watak cuba produk dengan aksi ringkas",
      "Result lega + CTA pendek"
    ]
  },
  {
    id: "showcase",
    label: "Showcase",
    bestFor: "Fashion, aksesori, beg, jam, kasut.",
    beats: [
      "Hook gaya/status",
      "Watak bersiap atau masuk scene lifestyle",
      "Produk dipakai/dipegang dengan jelas",
      "Close-up detail yang nampak premium",
      "Confidence result + CTA"
    ]
  },
  {
    id: "demo",
    label: "Demo Use",
    bestFor: "Gadget, tool, appliance, beauty tool.",
    beats: [
      "Hook fungsi utama",
      "Tunjuk keadaan sebelum guna",
      "Tangan/watak guna produk step-by-step",
      "Tunjuk hasil yang mudah difahami",
      "CTA try sekarang"
    ]
  },
  {
    id: "lifestyle",
    label: "Lifestyle Story",
    bestFor: "Produk harian yang nak nampak natural.",
    beats: [
      "Hook situasi real life",
      "Watak guna produk dalam rutin biasa",
      "Produk nampak clear tapi tidak terlalu hard sell",
      "Mood jadi lebih senang/kemas/selesa",
      "Caption soft sell"
    ]
  }
] as const;

const audiences = [
  "seller TikTok Shop Malaysia",
  "ibu bekerja",
  "student",
  "office worker",
  "owner rumah kecil",
  "orang selalu rushing"
];

function buildStoryPack({
  productName,
  audience,
  mode,
  problem,
  benefit,
  style
}: {
  productName: string;
  audience: string;
  mode: (typeof storyModes)[number];
  problem: string;
  benefit: string;
  style: string;
}) {
  const product = productName.trim() || "produk ini";
  const target = audience.trim() || "buyer Malaysia";
  const pain = problem.trim() || "situasi harian yang menyusahkan";
  const result = benefit.trim() || "hidup rasa lebih mudah";

  return {
    flow: [
      `0-2s: Hook - ${target} sedang hadap ${pain}.`,
      `2-5s: Scene story - tunjuk situasi real, watak adult sahaja, produk ${product} jelas dalam frame.`,
      `5-10s: Product moment - watak notice/guna/pegang ${product}, aksi simple dan selamat.`,
      `10-14s: Result - ${result}, ekspresi lega/confident.`,
      "14-16s: CTA - ayat pendek, natural, tak terlalu hard sell."
    ],
    imagePrompt: `Create one vertical 9:16 ${style} TikTok Shop Malaysia story image. Product: ${product}. Audience: ${target}. Story method: ${mode.label}. Scene must show an adult Malaysian character in a clean home or work lifestyle setting facing this situation: ${pain}. The product must be visible and recognizable in the frame, with shape and color preserved from the uploaded product reference. Mood should be relatable and commercial-friendly, not extreme. Leave clean empty space at the top for caption. No readable text, no logo, no watermark.`,
    videoPrompt: `Create one 8-second vertical 9:16 image-to-video clip using the story image as the first frame. Product: ${product}. Method: ${mode.label}. The adult presenter naturally interacts with the product in a calm product advertisement scene. Motion: 0-2s show the relatable situation, 2-5s notice or use the product, 5-8s show a simple positive result: ${result}. The presenter speaks one short natural Malay line with visible lip movement: "${product} ni memang buat kerja jadi lagi senang." Keep the same character, same product, same room, same lighting, and same camera style. No subtitles, no on-screen text, no logo, no watermark.`,
    caption: `${pain} memang biasa jadi kan? ${product} boleh jadi pilihan mudah untuk ${result}.`,
    cta: "Klik tengok sekarang"
  };
}

export function StoryLab() {
  const [productName, setProductName] = useState("");
  const [audience, setAudience] = useState(audiences[0]);
  const [modeId, setModeId] = useState<(typeof storyModes)[number]["id"]>(
    "problem_solution"
  );
  const [problem, setProblem] = useState("");
  const [benefit, setBenefit] = useState("");
  const [style, setStyle] = useState("polished 3D cartoon");

  const mode = storyModes.find((item) => item.id === modeId) || storyModes[0];
  const storyPack = useMemo(
    () =>
      buildStoryPack({
        productName,
        audience,
        mode,
        problem,
        benefit,
        style
      }),
    [audience, benefit, mode, problem, productName, style]
  );

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        <div>
          <p className="text-sm font-black text-white">Story Builder</p>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            Susun flow cerita dulu sebelum burn credit. Bila story rasa kuat,
            copy prompt ke Manual Lab atau guna sebagai rujukan untuk flow utama.
          </p>
        </div>

        <label className="block">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
            Nama produk
          </span>
          <input
            value={productName}
            onChange={(event) => setProductName(event.target.value)}
            placeholder="Contoh: kipas portable biru"
            className="mt-2 min-h-11 w-full rounded-xl border border-border bg-slate-950 px-4 text-sm text-white outline-none focus:border-primary"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              Audience
            </span>
            <select
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-border bg-slate-950 px-4 text-sm text-white outline-none focus:border-primary"
            >
              {audiences.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              Visual style
            </span>
            <select
              value={style}
              onChange={(event) => setStyle(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-border bg-slate-950 px-4 text-sm text-white outline-none focus:border-primary"
            >
              <option>polished 3D cartoon</option>
              <option>realistic UGC</option>
              <option>clean product lifestyle</option>
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              Masalah/situasi
            </span>
            <textarea
              value={problem}
              onChange={(event) => setProblem(event.target.value)}
              rows={4}
              placeholder="Contoh: panas sampai susah fokus buat kerja"
              className="mt-2 w-full resize-y rounded-xl border border-border bg-slate-950 p-4 text-sm leading-6 text-white outline-none focus:border-primary"
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              Benefit/result
            </span>
            <textarea
              value={benefit}
              onChange={(event) => setBenefit(event.target.value)}
              rows={4}
              placeholder="Contoh: rasa lebih sejuk dan boleh sambung kerja"
              className="mt-2 w-full resize-y rounded-xl border border-border bg-slate-950 p-4 text-sm leading-6 text-white outline-none focus:border-primary"
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {storyModes.map((item) => {
            const selected = item.id === modeId;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setModeId(item.id)}
                className={`rounded-2xl border p-4 text-left transition ${
                  selected
                    ? "border-primary bg-primary/10 shadow-glow"
                    : "border-border bg-black/20 hover:border-primary/60"
                }`}
              >
                <span className="block text-sm font-black text-white">
                  {item.label}
                </span>
                <span className="mt-1 block text-sm leading-6 text-slate-400">
                  {item.bestFor}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-5">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-sm font-black text-white">Cadangan Flow</p>
          <div className="mt-4 grid gap-3">
            {storyPack.flow.map((item) => (
              <p
                key={item}
                className="rounded-xl border border-border bg-slate-950 p-3 text-sm leading-6 text-slate-200"
              >
                {item}
              </p>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-black text-white">Image Prompt</p>
            <button
              type="button"
              onClick={() => copy(storyPack.imagePrompt)}
              className="rounded-full border border-border px-4 py-2 text-xs font-black text-white"
            >
              Copy
            </button>
          </div>
          <pre className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-slate-950 p-4 text-sm leading-6 text-slate-200">
            {storyPack.imagePrompt}
          </pre>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-black text-white">Video Prompt</p>
            <button
              type="button"
              onClick={() => copy(storyPack.videoPrompt)}
              className="rounded-full border border-border px-4 py-2 text-xs font-black text-white"
            >
              Copy
            </button>
          </div>
          <pre className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-slate-950 p-4 text-sm leading-6 text-slate-200">
            {storyPack.videoPrompt}
          </pre>
        </div>

        <div className="rounded-2xl border border-primary/30 bg-primary/10 p-5">
          <p className="text-sm font-black text-white">Caption + CTA</p>
          <p className="mt-3 text-sm leading-6 text-slate-200">
            {storyPack.caption}
          </p>
          <p className="mt-3 text-sm font-black text-primary">
            {storyPack.cta}
          </p>
        </div>
      </section>
    </div>
  );
}
