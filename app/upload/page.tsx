import { UploadZone } from "@/components/UploadZone";

export default function UploadPage() {
  return (
    <main className="min-h-screen px-4 py-6 sm:px-5 sm:py-8">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8">
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
            <span className="rounded-full border border-border px-3 py-1 text-xs font-bold text-slate-300">
              Langkah 1/6
            </span>
          </div>
        </header>

        <div className="max-w-2xl space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Upload produk
          </p>
          <h1 className="text-2xl font-black leading-tight text-white sm:text-4xl">
            Masukkan gambar produk yang jelas.
          </h1>
          <p className="text-sm leading-6 text-slate-300 sm:text-base">
            Sistem akan semak gambar dahulu. Kalau gambar kurang jelas, sistem
            akan beritahu sebab dalam Bahasa Melayu.
          </p>
        </div>

        <UploadZone />
      </section>
    </main>
  );
}
