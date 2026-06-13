const riskyReplacements: Array<[RegExp, string]> = [
  [/\bchildren\b/gi, "young adults"],
  [/\bchild\b/gi, "adult"],
  [/\bbabies\b/gi, "adult family props"],
  [/\bbaby\b/gi, "family product context"],
  [/\btoddlers\b/gi, "adults"],
  [/\btoddler\b/gi, "adult"],
  [/\bminors\b/gi, "adults"],
  [/\bminor\b/gi, "adult"],
  [/\bkids\b/gi, "adult users"],
  [/\bkid\b/gi, "adult user"],
  [/\bprofusely\b/gi, "lightly"],
  [/\bvigorously\b/gi, "gently"],
  [/\bdesperately\b/gi, "carefully"],
  [/\bdistress(ed)?\b/gi, "mildly concerned"],
  [/\bpanic(ked|king)?\b/gi, "concerned"],
  [/\bscared\b/gi, "concerned"],
  [/\bterrified\b/gi, "concerned"],
  [/\bcrying\b/gi, "looking concerned"],
  [/\bsick\b/gi, "uncomfortable"],
  [/\bpain\b/gi, "discomfort"],
  [/\bmedical\b/gi, "wellness"],
  [/\bcure(s|d)?\b/gi, "helps"],
  [/\btreat(s|ed|ment)?\b/gi, "supports"],
  [/\bheal(s|ed|ing)?\b/gi, "helps"],
  [/\bdisease(s)?\b/gi, "issue"]
];

export function makeVeoPromptSafetySafe(prompt: string) {
  let safePrompt = prompt.trim();

  for (const [pattern, replacement] of riskyReplacements) {
    safePrompt = safePrompt.replace(pattern, replacement);
  }

  return [
    safePrompt,
    "Safety constraints: all visible people are adults aged 25 or older.",
    "Keep the scene adult-only with mature adult proportions, adult wardrobe, and adult workplace or home-lifestyle context.",
    "Keep emotions mild and commercial-friendly: relatable discomfort, then calm relief.",
    "Keep every action calm, safe, simple, and suitable for a family-friendly product advertisement.",
    "Use natural small motion only, with clear product interaction and visible lip movement if dialogue is included.",
    "No subtitles, no on-screen text, no logo, no watermark."
  ].join(" ");
}

export function makeUltraSafeVeoPrompt(kind: "base" | "extend") {
  const action =
    kind === "extend"
      ? "Continue from the current frame as one smooth product advertisement scene."
      : "Create one smooth product advertisement scene from the supplied image.";

  return [
    action,
    "Vertical 9:16 TikTok Shop Malaysia style.",
    "Show one adult presenter aged 25 or older in a clean home or work setting.",
    "Keep the same visual style, product, room, lighting, and camera angle.",
    "The presenter calmly holds or points to the product, then shows a simple positive result.",
    "The presenter says one short friendly Malay product line with visible lip movement.",
    "Use only gentle hand movement, natural facial expression, and slight camera push-in.",
    "Keep the scene calm, safe, simple, family-friendly, and product-focused.",
    "No subtitles, no on-screen text, no logo, no watermark."
  ].join(" ");
}
