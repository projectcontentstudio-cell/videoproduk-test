"use client";

import { useEffect } from "react";

export default function HomePage() {
  useEffect(() => {
    window.location.replace("/upload");
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <div className="rounded-2xl border border-border bg-surface p-5 text-center shadow-glow">
        <p className="text-sm font-black text-white">Sila tunggu</p>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Membuka halaman upload produk.
        </p>
      </div>
    </main>
  );
}
