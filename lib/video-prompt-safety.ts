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
    "Do not show babies, children, toddlers, minors, child faces, school uniforms, or child-like bodies.",
    "Keep emotions mild and commercial-friendly: relatable discomfort, then calm relief.",
    "Avoid intense distress, panic, crying, injury, medical claims, dangerous actions, or unsafe product use.",
    "Use natural small motion only, with clear product interaction and visible lip movement if dialogue is included.",
    "No subtitles, no on-screen text, no logo, no watermark."
  ].join(" ");
}
