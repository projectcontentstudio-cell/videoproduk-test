import { RenderProgress } from "@/components/RenderProgress";

export default function RenderPage() {
  return (
    <main className="min-h-screen px-5 py-8">
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="flex items-center justify-between gap-4">
          <a href="/" className="text-base font-bold text-white">
            VideoProduk.my
          </a>
          <div className="flex items-center gap-2">
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
              href="/preview"
              className="rounded-full border border-border px-3 py-1 text-xs font-bold text-slate-300 transition hover:border-primary hover:text-white"
            >
              Kembali
            </a>
            <span className="rounded-full border border-border px-3 py-1 text-xs font-bold text-slate-300">
              Langkah 5/6
            </span>
          </div>
        </header>

        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Render final
          </p>
          <h1 className="text-3xl font-black leading-tight text-white sm:text-4xl">
            Jana satu video 16 saat.
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
            Sistem guna image yang dipilih sebagai reference frame, jana base
            video, kemudian sambung video supaya final lebih panjang.
          </p>
        </div>

        <RenderProgress />

        <a
          href="/preview"
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-border px-6 text-sm font-black text-white"
        >
          Kembali ke Preview
        </a>
      </section>
    </main>
  );
}
