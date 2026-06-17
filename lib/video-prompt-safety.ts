const riskyReplacements: Array<[RegExp, string]> = [
  [/\bboy\b/gi, "adult man"],
  [/\bgirl\b/gi, "adult woman"],
  [/\bschool\b/gi, "workplace"],
  [/\bstudent\b/gi, "adult worker"],
  [/\bteen(ager)?s?\b/gi, "adults"],
  [/\byoung woman\b/gi, "adult woman aged 30"],
  [/\byoung man\b/gi, "adult man aged 30"],
  [/\byoung adult(s)?\b/gi, "adult person aged 30"],
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
  [/\btears\b/gi, "concerned expression"],
  [/\bsad\b/gi, "concerned"],
  [/\bangry\b/gi, "focused"],
  [/\bargument\b/gi, "calm discussion"],
  [/\bfight(ing)?\b/gi, "calm discussion"],
  [/\bstruggling\b/gi, "having a small everyday issue"],
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
    "Safety constraints: all visible people are clearly adults aged 30 or older. No babies, children, teenagers, school uniforms, childlike faces, or child bodies.",
    "Avoid close-up face transformation. Keep faces stable, medium shot, and commercially safe.",
    "Keep the scene adult-only with mature adult proportions, adult wardrobe, and adult workplace or home-lifestyle context.",
    "Keep emotions mild and commercial-friendly: everyday inconvenience, then calm relief. No panic, fear, crying, injury, sickness, conflict, or distress.",
    "Keep every action calm, safe, simple, and suitable for a family-friendly product advertisement.",
    "Use natural small motion only, with clear product interaction. If dialogue is included, keep speech short and calm with subtle mouth movement.",
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
    "Show one clearly adult presenter aged 30 or older in a clean home or work setting.",
    "Keep the same visual style, product, room, lighting, and camera angle.",
    "Use a medium shot or hands-and-product framing. Avoid close-up face changes.",
    "The presenter calmly holds or points to the product, then shows a simple positive result.",
    "If a face is visible, the presenter says one short friendly Malay product line with subtle mouth movement.",
    "Use only gentle hand movement, natural facial expression, and slight camera push-in.",
    "Keep the scene calm, safe, simple, family-friendly, and product-focused. No children, babies, teenagers, distress, sickness, injury, crying, conflict, or medical claims.",
    "No subtitles, no on-screen text, no logo, no watermark."
  ].join(" ");
}

export function makeProductOnlyVeoPrompt(kind: "base" | "extend") {
  const action =
    kind === "extend"
      ? "Continue from the current frame as a smooth hands-only product demo."
      : "Create one smooth hands-only product demo from the supplied image.";

  return [
    action,
    "Vertical 9:16 TikTok Shop Malaysia style.",
    "Show the product clearly as the hero object in a clean home, desk, kitchen, or lifestyle setup.",
    "Use only adult hands if needed. Do not show any face, child, baby, teenager, celebrity, or identifiable person.",
    "Motion should be simple: hand enters frame, points to the product, rotates or uses it gently, then shows the positive result.",
    "Use a calm off-screen adult Malay voiceover if audio is supported, but do not show lip movement or a speaking face.",
    "Keep product shape, color, and details as close as possible to the reference image.",
    "No subtitles, no on-screen text, no logo, no watermark, no medical claims, no distress."
  ].join(" ");
}
