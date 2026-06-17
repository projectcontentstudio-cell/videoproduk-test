import { StoryPageShell } from "@/components/StoryPageShell";
import { StoryTopicForm } from "@/components/StoryTopicForm";

export default function CeritaTopikPage() {
  return (
    <StoryPageShell
      eyebrow="Topik cerita"
      title="Masukkan topik pendek."
      description="Tulis satu topik jelas. Sistem akan susun menjadi skrip 8 scene untuk video 40 saat."
    >
      <div className="max-w-2xl">
        <StoryTopicForm />
      </div>
    </StoryPageShell>
  );
}
