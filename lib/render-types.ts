export type RenderTier = "free" | "paid";

export type RenderJobPayload = {
  generationId: string;
  userId: string;
  tier: RenderTier;
  sceneKind?: "problem" | "solution";
  productImageUrl: string;
  referenceSceneUrl: string;
  productName: string;
  productPrice: string;
  hook: string;
  subtitle: string;
  dialogueLine?: string;
  sceneDescription?: string;
  manualVideoPrompt?: string;
  cta: string;
  caption: string;
  hashtags: string[];
};

export type RenderJobResult = {
  videoUrl: string;
  videoStoreKey?: string;
  watermarked: boolean;
  downloadable: boolean;
};

export type PreviewPolicy = {
  watermarked: true;
  downloadable: false;
  message: string;
};
