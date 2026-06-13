import { ImagePreview } from "@/components/ImagePreview";

export default function PreviewPage() {
  return (
    <main className="min-h-screen px-4 py-6 sm:px-5 sm:py-8">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
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
              href="/script"
              className="rounded-full border border-border px-3 py-1 text-xs font-bold text-slate-300 transition hover:border-primary hover:text-white"
            >
              Kembali
            </a>
            <span className="rounded-full border border-border px-3 py-1 text-xs font-bold text-slate-300">
              Langkah 4/6
            </span>
          </div>
        </header>

        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Preview percuma
          </p>
          <h1 className="text-2xl font-black leading-tight text-white sm:text-3xl">
            Semak satu image video.
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-300">
            AI jana satu image Problem dengan produk dalam frame. Image ini
            jadi first frame untuk video 16 saat: susah, nampak produk, ambil,
            cuba, dan lega dalam sambungan video.
          </p>
        </div>

        <ImagePreview />

        <a
          href="/script"
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-border px-6 text-sm font-black text-white"
        >
          Kembali ke Skrip
        </a>
      </section>
    </main>
  );
}
