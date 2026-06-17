import { StoryPageShell } from "@/components/StoryPageShell";
import { StoryStyleSelector } from "@/components/StoryStyleSelector";

export default function CeritaGayaPage() {
  return (
    <StoryPageShell
      eyebrow="Gaya visual"
      title="Pilih style gambar."
      description="Style ini akan digabung dengan prompt setiap scene supaya semua gambar nampak konsisten."
    >
      <StoryStyleSelector />
    </StoryPageShell>
  );
}
