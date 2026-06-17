import { DownloadPanel } from "@/components/DownloadPanel";

export default function DownloadPage() {
  return (
    <main className="min-h-screen px-4 py-6 sm:px-5 sm:py-8">
      <section className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="min-w-0 space-y-6">
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
                href="/videos"
                className="rounded-full border border-border px-3 py-1 text-xs font-bold text-slate-300 transition hover:border-primary hover:text-white"
              >
                List Video
              </a>
              <a
                href="/render"
                className="rounded-full border border-border px-3 py-1 text-xs font-bold text-slate-300 transition hover:border-primary hover:text-white"
              >
                Kembali
              </a>
              <span className="rounded-full border border-border px-3 py-1 text-xs font-bold text-slate-300">
                Langkah 6/6
              </span>
            </div>
          </header>

          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              Preview video
            </p>
            <h1 className="text-2xl font-black leading-tight text-white sm:text-4xl">
              Video siap untuk semakan.
            </h1>
            <p className="text-sm leading-6 text-slate-300">
              Semak video yang sudah dijana. Selepas selesai, boleh kembali ke
              halaman utama untuk upload produk seterusnya.
            </p>
          </div>
        </div>

        <div className="min-w-0">
          <DownloadPanel />
        </div>
      </section>
    </main>
  );
}
