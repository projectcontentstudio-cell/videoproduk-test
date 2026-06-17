import type { ReactNode } from "react";

export function StoryPageShell({
  eyebrow,
  title,
  description,
  children
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-7 lg:px-8">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <a href="/upload" className="text-base font-bold text-white">
            VideoProduk.my
          </a>
          <div className="flex max-w-full flex-wrap gap-2">
            <a
              href="/upload"
              className="rounded-full border border-border px-4 py-2 text-xs font-black text-white"
            >
              Upload Produk
            </a>
            <a
              href="/manual"
              className="rounded-full border border-border px-4 py-2 text-xs font-black text-white"
            >
              Manual
            </a>
            <a
              href="/cerita"
              className="rounded-full border border-primary px-4 py-2 text-xs font-black text-primary"
            >
              Video Cerita
            </a>
          </div>
        </header>

        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-2xl font-black leading-tight text-white sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-300 sm:text-base">
            {description}
          </p>
        </div>

        {children}
      </section>
    </main>
  );
}
