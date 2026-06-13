import { StoryLab } from "@/components/StoryLab";

export default function StoryPage() {
  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-7 lg:px-8">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <a href="/" className="text-base font-bold text-white">
            VideoProduk.my
          </a>
          <div className="flex max-w-full flex-wrap gap-2 sm:gap-3">
            <a
              href="/manual"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-black text-white"
            >
              Manual Lab
            </a>
            <a
              href="/upload"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-black text-white"
            >
              Upload Flow
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
            Story lab
          </p>
          <h1 className="mt-3 text-2xl font-black text-white sm:text-4xl">
            Susun cerita sebelum generate.
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
            Page ini untuk plan story, image prompt, video prompt, caption dan
            CTA sebelum guna credit. Flow yang paling selamat sekarang ialah
            satu image kuat, kemudian video 8s yang bergerak dari situasi ke
            product moment.
          </p>
        </div>

        <StoryLab />
      </section>
    </main>
  );
}
