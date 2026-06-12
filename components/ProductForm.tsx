"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

const visualStyles = [
  {
    id: "3d-character",
    label: "3D Cartoon",
    detail: "Style aktif untuk image dan script scene sekarang.",
    enabled: true
  },
  {
    id: "realistic-ugc",
    label: "Realistic UGC",
    detail: "Disable dulu.",
    enabled: false
  },
  {
    id: "bold-comic",
    label: "Bold Comic",
    detail: "Disable dulu.",
    enabled: false
  },
  {
    id: "clean-studio",
    label: "Clean Studio",
    detail: "Disable dulu.",
    enabled: false
  }
] as const;

function clearGeneratedFlow() {
  localStorage.removeItem("videoproduk_scene_images");
  localStorage.removeItem("videoproduk_selected_scene");
  localStorage.removeItem("videoproduk_render_result");
  localStorage.removeItem("videoproduk_script");
  localStorage.removeItem("videoproduk_script_cache_key");
  localStorage.removeItem("videoproduk_shop_watermark_enabled");
  localStorage.removeItem("videoproduk_shop_watermark_name");
}

export function ProductForm() {
  const [productName, setProductName] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("3d-character");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const storedStyle = localStorage.getItem("videoproduk_image_style");

    if (storedStyle === "3d-character") {
      setSelectedStyle(storedStyle);
    } else {
      localStorage.setItem("videoproduk_image_style", "3d-character");
    }
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!productName.trim()) {
      setError("Nama produk wajib diisi.");
      return;
    }

    const productImage = localStorage.getItem("videoproduk_product_image");

    if (
      !productImage ||
      productImage.startsWith("blob:") ||
      !productImage.startsWith("data:image/") ||
      !productImage.includes(",")
    ) {
      setError("Gambar produk belum valid. Sila kembali dan upload semula.");
      return;
    }

    setIsSubmitting(true);
    const previousName = localStorage.getItem("videoproduk_product_name");
    const previousStyle = localStorage.getItem("videoproduk_image_style");
    const nextName = productName.trim();
    const nextStyle = "3d-character";

    if (previousName !== nextName || previousStyle !== nextStyle) {
      clearGeneratedFlow();
    }

    localStorage.setItem("videoproduk_product_name", nextName);
    localStorage.setItem("videoproduk_product_price", "RM0");
    localStorage.setItem("videoproduk_image_style", nextStyle);
    window.location.href = "/script";
  }

  return (
    <form onSubmit={handleSubmit} className="relative space-y-5">
      {isSubmitting ? (
        <div className="fixed inset-0 z-50 bg-black/70 text-center backdrop-blur-sm">
          <div className="fixed left-1/2 top-1/2 w-[min(16rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-primary/40 bg-slate-950 px-4 py-3 shadow-glow">
            <p className="text-sm font-black text-white">Sila tunggu</p>
            <p className="mt-2 text-xs leading-5 text-slate-300">
              Sedang buka skrip.
            </p>
          </div>
        </div>
      ) : null}
      <div className="space-y-2">
        <label htmlFor="product_name" className="text-sm font-bold text-white">
          Nama produk
        </label>
        <input
          id="product_name"
          name="product_name"
          type="text"
          required
          disabled={isSubmitting}
          value={productName}
          onChange={(event) => setProductName(event.target.value)}
          placeholder="cth: Mini Chopper Pro"
          className="min-h-12 w-full rounded-2xl border border-border bg-surface px-4 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-primary"
        />
      </div>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-sm font-black text-white">Style</p>
        <p className="mt-1 text-sm leading-6 text-slate-300">
          Style dipilih sebelum jana skrip supaya scene dan prompt ikut format
          yang sama.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {visualStyles.map((style) => {
            const selected = selectedStyle === style.id;

            return (
              <button
                key={style.id}
                type="button"
                disabled={!style.enabled || isSubmitting}
                onClick={() => {
                  if (!style.enabled) {
                    return;
                  }
                  setSelectedStyle(style.id);
                  localStorage.setItem("videoproduk_image_style", style.id);
                }}
                className={`rounded-2xl border p-4 text-left transition ${
                  selected
                    ? "border-primary bg-primary/10 shadow-glow"
                    : "border-border bg-black/20"
                } ${
                  style.enabled
                    ? "hover:border-primary/60"
                    : "cursor-not-allowed opacity-45"
                }`}
              >
                <span className="block text-sm font-black text-white">
                  {style.label}
                </span>
                <span className="mt-1 block text-sm leading-6 text-slate-300">
                  {style.detail}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm font-semibold text-red-100">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-6 text-sm font-black text-slate-950 shadow-glow transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Sediakan skrip..." : "Jana Skrip"}
      </button>
    </form>
  );
}
