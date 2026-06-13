import { ScriptPreview } from "@/components/ScriptPreview";

export default function ScriptPage() {
  return (
    <main className="min-h-screen px-4 py-6 sm:px-5 sm:py-8">
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <header className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <a href="/" className="text-base font-bold text-white">
            VideoProduk.my
          </a>
          <div className="flex max-w-full flex-wrap items-center gap-2">
            <a
              href="/"
              className="rounded-full border border-border px-3 py-1 text-xs font-bold text-slate-300 transition hover:border-primary hover:text-white"
            >
              Home
            </a>
            <a
              href="/upload"
              className="rounded-full border border-border px-3 py-1 text-xs font-bold text-slate-300 transition hover:border-primary hover:text-white"
            >
              Upload Product
            </a>
            <a
              href="/details"
              className="rounded-full border border-border px-3 py-1 text-xs font-bold text-slate-300 transition hover:border-primary hover:text-white"
            >
              Kembali
            </a>
            <span className="rounded-full border border-border px-3 py-1 text-xs font-bold text-slate-300">
              Langkah 3/6
            </span>
          </div>
        </header>

        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Review skrip
          </p>
          <h1 className="text-2xl font-black leading-tight text-white sm:text-4xl">
            Semak hook, subtitle, CTA dan caption.
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
            Skrip boleh dijana semula percuma. Kredit hanya digunakan bila
            render video final.
          </p>
        </div>

        <ScriptPreview />

        <a
          href="/details"
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-border px-6 text-sm font-black text-white"
        >
          Kembali ke Detail Produk
        </a>
      </section>
    </main>
  );
}
