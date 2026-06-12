"use client";

import { useState } from "react";

type ManualReference = {
  productImageBase64: string;
  productImageMimeType: "image/jpeg" | "image/png";
};

type ManualPromptTesterProps = {
  getRequestBody: () => Record<string, unknown>;
};

function PreviewCard({
  title,
  label,
  imageUrl
}: {
  title: string;
  label: string;
  imageUrl: string;
}) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-primary bg-surface shadow-glow">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={`${title} preview`}
        className="aspect-[9/16] w-full object-cover"
      />
      <div className="absolute right-3 top-3 rounded-full bg-primary px-3 py-1 text-xs font-black text-slate-950">
        {label}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rotate-[-18deg] border-y border-white/20 bg-black/50 py-3 text-center text-xl font-black uppercase tracking-[0.2em] text-white/80">
        Preview
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-4">
        <p className="text-sm font-black text-white">{title}</p>
      </div>
    </article>
  );
}

function readManualReference(file: File) {
  return new Promise<ManualReference>((resolve, reject) => {
    if (file.type !== "image/jpeg" && file.type !== "image/png") {
      reject(new Error("Manual reference mesti JPG atau PNG."));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;

      if (typeof result !== "string") {
        reject(new Error("Gagal baca manual reference image."));
        return;
      }

      const [header, data] = result.split(",");

      if (!header?.startsWith("data:image/") || !data) {
        reject(new Error("Manual reference image tidak valid."));
        return;
      }

      resolve({
        productImageBase64: data,
        productImageMimeType: header.includes("image/jpeg")
          ? "image/jpeg"
          : "image/png"
      });
    };
    reader.onerror = () =>
      reject(new Error("Gagal baca manual reference image."));
    reader.readAsDataURL(file);
  });
}

export function ManualPromptTester({ getRequestBody }: ManualPromptTesterProps) {
  const [prompt, setPrompt] = useState("");
  const [reference, setReference] = useState<ManualReference | null>(null);
  const [previewName, setPreviewName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function generateManualImage(mode: "manual" | "realistic-scene") {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/generate-images", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...getRequestBody(),
          ...(reference ?? {}),
          mode,
          prompt
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Manual image gagal dijana.");
      }

      setImageUrl(data.images.imageUrl);
    } catch (manualError) {
      setError(
        manualError instanceof Error
          ? manualError.message
          : "Manual image gagal dijana."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-surface p-5">
      <div>
        <p className="text-sm font-black text-white">Manual Realistic Scene</p>
        <p className="mt-1 text-sm leading-6 text-slate-400">
          Paste scene pendek macam Gemini chat. Product image/reference dihantar
          sekali untuk bantu AI faham produk, tapi output hanya 1 realistic
          image.
        </p>
        <p className="mt-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs font-semibold leading-5 text-amber-100">
          Disclaimer: Imej AI mungkin tidak sama 100% dengan produk sebenar.
          Semak rupa produk dulu sebelum guna untuk iklan.
        </p>
      </div>

      <label className="block">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
          Product/reference image
        </span>
        <input
          type="file"
          accept="image/png,image/jpeg"
          onChange={async (event) => {
            const file = event.target.files?.[0];

            if (!file) {
              setReference(null);
              setPreviewName("");
              return;
            }

            try {
              setReference(await readManualReference(file));
              setPreviewName(file.name);
              setError("");
            } catch (uploadError) {
              setReference(null);
              setPreviewName("");
              setError(
                uploadError instanceof Error
                  ? uploadError.message
                  : "Manual reference image gagal dibaca."
              );
            }
          }}
          className="mt-2 block w-full rounded-xl border border-border bg-slate-950 p-3 text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-black file:text-slate-950"
        />
      </label>

      {previewName ? (
        <p className="text-xs font-semibold text-primary">
          Reference aktif: {previewName}
        </p>
      ) : (
        <p className="text-xs font-semibold text-slate-500">
          Tiada reference tambahan. Test akan guna gambar produk utama.
        </p>
      )}

      <textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Contoh: Seorang pelajar perempuan nampak sedih, struggling dengan beg sekolah lama yang dah lusuh, zip rosak, atau nampak tak stylo langsung. Dia mengeluh."
        rows={8}
        className="w-full resize-y rounded-xl border border-border bg-slate-950 p-4 text-sm leading-6 text-white outline-none transition focus:border-primary"
      />

      {error ? <p className="text-sm font-bold text-red-200">{error}</p> : null}

      <button
        type="button"
        onClick={() => void generateManualImage("realistic-scene")}
        disabled={loading || prompt.trim().length < 30}
        className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Jana Realistic Scene..." : "Jana Realistic Scene"}
      </button>

      {imageUrl ? (
        <div className="border-t border-border pt-4">
          <p className="mb-3 text-sm font-black text-white">
            Manual preview result
          </p>
          <p className="mb-3 text-xs font-semibold leading-5 text-amber-100">
            Product image mungkin tidak sama dengan produk sebenar.
          </p>
          <div className="max-w-sm">
            <PreviewCard title="Manual test" label="Manual" imageUrl={imageUrl} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
