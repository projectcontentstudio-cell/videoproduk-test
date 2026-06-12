"use client";

import { useEffect, useState } from "react";
import type { GeneratedScript } from "@/lib/gemini";
import { getFriendlyErrorMessage } from "@/lib/friendly-error";

type ScriptState =
  | { status: "idle" | "loading"; script: null; error: "" }
  | { status: "success"; script: GeneratedScript; error: "" }
  | { status: "error"; script: null; error: string };

function clearPreviewFlow() {
  localStorage.removeItem("videoproduk_scene_images");
  localStorage.removeItem("videoproduk_selected_scene");
  localStorage.removeItem("videoproduk_render_result");
}

function getScriptCacheKey(productName: string, style: string) {
  const image = localStorage.getItem("videoproduk_product_image") || "";
  const productAnalysis =
    localStorage.getItem("videoproduk_product_analysis") || "";
  return JSON.stringify({
    productName,
    style,
    imageLength: image.length,
    imageHead: image.slice(0, 80),
    imageTail: image.slice(-80),
    productAnalysisHead: productAnalysis.slice(0, 120)
  });
}

function getStoredImagePayload() {
  const image = localStorage.getItem("videoproduk_product_image");

  if (!image || image.startsWith("blob:")) {
    throw new Error(
      "Gambar produk belum valid. Sila upload semula gambar produk dulu."
    );
  }

  const [header, data] = image.split(",");
  const mimeType = header?.includes("image/jpeg") ? "image/jpeg" : "image/png";

  if (!header?.startsWith("data:image/") || !data || data.length < 1000) {
    throw new Error(
      "Gambar produk tidak lengkap. Sila upload semula gambar produk."
    );
  }

  return {
    productImageBase64: data,
    productImageMimeType: mimeType
  };
}

function parseStoredScript(script: string) {
  try {
    return JSON.parse(script) as GeneratedScript;
  } catch {
    localStorage.removeItem("videoproduk_script");
    localStorage.removeItem("videoproduk_script_cache_key");
    return null;
  }
}

function buildExtendPromptPreview(script: GeneratedScript) {
  return [
    "Continue this exact vertical 9:16 product video from the final frame.",
    "The output should feel like one complete 16-second TikTok Shop product video, continuing the same scene without a hard reset.",
    "Keep the same adult character, same product, same room/location, same lighting, same camera style, and same visual identity.",
    script.scene2_video_prompt || script.scene2_description,
    `The main adult character speaks/says this Malay line with visible lip movement and mouth movement: "${script.scene2_video_script}".`,
    "Show the product benefit clearly with natural hand movement, product interaction, facial expression, and slight camera push-in.",
    "No subtitles, no on-screen text, no logo, no watermark."
  ].join(" ");
}

export function ScriptPreview() {
  const [state, setState] = useState<ScriptState>({
    status: "idle",
    script: null,
    error: ""
  });

  async function generateScript() {
    const productName =
      localStorage.getItem("videoproduk_product_name") || "Mini Chopper Pro";
    const productPrice =
      localStorage.getItem("videoproduk_product_price") || "RM0";
    const style = localStorage.getItem("videoproduk_image_style") || "3d-character";

    setState({ status: "loading", script: null, error: "" });

    try {
      const imagePayload = getStoredImagePayload();
      const response = await fetch("/api/generate-script", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          productName,
          productPrice,
          style,
          productAnalysis:
            localStorage.getItem("videoproduk_product_analysis") || "",
          ...imagePayload
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Skrip gagal dijana.");
      }

      clearPreviewFlow();
      localStorage.setItem("videoproduk_script", JSON.stringify(data.script));
      localStorage.setItem(
        "videoproduk_script_cache_key",
        getScriptCacheKey(productName, style)
      );
      setState({ status: "success", script: data.script, error: "" });
    } catch (error) {
      setState({
        status: "error",
        script: null,
        error: getFriendlyErrorMessage(error, "Skrip gagal dijana. Cuba lagi.")
      });
    }
  }

  useEffect(() => {
    const productName =
      localStorage.getItem("videoproduk_product_name") || "Mini Chopper Pro";
    const style = localStorage.getItem("videoproduk_image_style") || "3d-character";
    const storedScript = localStorage.getItem("videoproduk_script");
    const storedCacheKey = localStorage.getItem("videoproduk_script_cache_key");
    const currentCacheKey = getScriptCacheKey(productName, style);

    const parsedScript =
      storedScript && storedCacheKey === currentCacheKey
        ? parseStoredScript(storedScript)
        : null;

    if (parsedScript) {
      setState({
        status: "success",
        script: parsedScript,
        error: ""
      });
      return;
    }

    void generateScript();
  }, []);

  if (state.status === "loading" || state.status === "idle") {
    return (
      <>
        <div className="fixed inset-0 z-50 bg-black/70 text-center backdrop-blur-sm">
          <div className="fixed left-1/2 top-1/2 w-[min(16rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-primary/40 bg-slate-950 px-4 py-3 shadow-glow">
            <p className="text-sm font-black text-white">Sila tunggu</p>
            <p className="mt-2 text-xs leading-5 text-slate-300">
              Sedang jana skrip.
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-sm font-bold text-white">Sila tunggu</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
          </div>
        </div>
      </>
    );
  }

  if (state.status === "error") {
    return (
      <div className="space-y-4 rounded-2xl border border-red-500/40 bg-red-500/10 p-4">
        <p className="text-sm font-black text-red-100">Gagal jana skrip.</p>
        <p className="text-sm leading-6 text-red-100/90">{state.error}</p>
        <button
          type="button"
          onClick={() => void generateScript()}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-black text-slate-950"
        >
          Jana Semula
        </button>
        <a
          href="/upload"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/20 px-5 text-sm font-black text-white"
        >
          Upload Semula
        </a>
      </div>
    );
  }

  if (!state.script) {
    return null;
  }

  const script = state.script;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-surface p-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
          Hook
        </p>
        <h2 className="mt-2 text-2xl font-black leading-tight text-white">
          {script.hook}
        </h2>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
          Method
        </p>
        <p className="mt-2 text-lg font-black text-white">
          {script.visual_method?.replace(/_/g, " ") || "problem solution"}
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          {script.visual_method_reason ||
            "Gemini pilih method ini berdasarkan produk."}
        </p>
      </section>

      <div className="grid gap-4">
        <section className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-sm font-black text-white">Video scene</p>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            {script.scene1_description}
          </p>
          <p className="mt-4 rounded-2xl bg-black/30 p-3 text-sm font-bold text-white">
            {script.scene1_subtitle}
          </p>
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-primary">
            Dialog base video
          </p>
          <p className="mt-2 rounded-2xl border border-border bg-black/20 p-3 text-sm font-semibold leading-6 text-slate-200">
            {script.scene1_video_script}
          </p>
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-primary">
            Prompt base 8s
          </p>
          <p className="mt-2 rounded-2xl border border-border bg-black/20 p-3 text-sm leading-6 text-slate-300">
            {script.scene1_video_prompt}
          </p>
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-primary">
            Dialog sambung video
          </p>
          <p className="mt-2 rounded-2xl border border-border bg-black/20 p-3 text-sm font-semibold leading-6 text-slate-200">
            {script.scene2_video_script}
          </p>
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-primary">
            Prompt sambung ke 16s
          </p>
          <p className="mt-2 rounded-2xl border border-border bg-black/20 p-3 text-sm leading-6 text-slate-300">
            {buildExtendPromptPreview(script)}
          </p>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <p className="text-sm font-black text-white">CTA</p>
        <p className="mt-2 text-lg font-black text-primary">
          {script.cta}
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <p className="text-sm font-black text-white">Caption</p>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          {script.caption}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {script.hashtags.map((hashtag) => (
            <span
              key={hashtag}
              className="rounded-full border border-border px-3 py-1 text-xs font-bold text-slate-200"
            >
              {hashtag}
            </span>
          ))}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void generateScript()}
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-border px-6 text-sm font-black text-white"
        >
          Jana Semula
        </button>
        <a
          href="/preview"
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-black text-slate-950 shadow-glow"
        >
          Teruskan
        </a>
      </div>
    </div>
  );
}
