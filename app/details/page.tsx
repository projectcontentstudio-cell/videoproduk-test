import { ProductForm } from "@/components/ProductForm";

export default function DetailsPage() {
  return (
    <main className="min-h-screen px-4 py-6 sm:px-5 sm:py-8">
      <section className="mx-auto flex w-full max-w-xl flex-col gap-8">
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
              href="/upload"
              className="rounded-full border border-border px-3 py-1 text-xs font-bold text-slate-300 transition hover:border-primary hover:text-white"
            >
              Kembali
            </a>
            <span className="rounded-full border border-border px-3 py-1 text-xs font-bold text-slate-300">
              Langkah 2/6
            </span>
          </div>
        </header>

        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Detail produk
          </p>
          <h1 className="text-3xl font-black leading-tight text-white sm:text-4xl">
            Isi nama produk.
          </h1>
          <p className="text-sm leading-6 text-slate-300 sm:text-base">
            AI akan baca gambar produk bersama nama ini untuk jana skrip video
            Bahasa Melayu.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-black/20 p-4">
          <ProductForm />
        </div>

        <a
          href="/upload"
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-border px-6 text-sm font-black text-white"
        >
          Kembali ke Upload
        </a>
      </section>
    </main>
  );
}
