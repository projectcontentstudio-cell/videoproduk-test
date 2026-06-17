import { ManualLab } from "@/components/ManualLab";

export default function ManualPage() {
  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-7 lg:px-8">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <a href="/" className="text-base font-bold text-white">
            VideoProduk.my
          </a>
          <div className="flex max-w-full flex-wrap gap-2 sm:gap-3">
            <a
              href="/cerita"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-black text-white"
            >
              Video Cerita
            </a>
            <a
              href="/upload"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-black text-white"
            >
              Upload Flow
            </a>
            <a
              href="/videos"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-black text-white"
            >
              List Video
            </a>
            <a
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-black text-white"
            >
              Home
            </a>
          </div>
        </header>

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Manual test
          </p>
          <h1 className="mt-3 text-2xl font-black text-white sm:text-4xl">
            Image + Video API Lab
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Upload reference, paste prompt, generate image. Prompt tidak
            dipaksa realistic atau 3D. Lepas image ok, paste prompt video dan
            generate video. Ini page test berasingan daripada storyboard utama.
          </p>
        </div>

        <ManualLab />
      </section>
    </main>
  );
}
