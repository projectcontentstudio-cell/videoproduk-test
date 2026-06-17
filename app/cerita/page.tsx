import { StoryPageShell } from "@/components/StoryPageShell";
import { StoryTypeSelector } from "@/components/StoryTypeSelector";

export default function CeritaPage() {
  return (
    <StoryPageShell
      eyebrow="Video cerita"
      title="Pilih jenis cerita."
      description="Flow ini untuk video naratif ringkas: skrip, gambar, suara, render, dan download."
    >
      <StoryTypeSelector />
    </StoryPageShell>
  );
}
