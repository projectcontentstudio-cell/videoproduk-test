import type { GeneratedScript } from "./gemini";
import { getGoogleAccessToken } from "./google-auth";

export type GenerateImagesInput = {
  productName: string;
  productPrice: string;
  productImageBase64: string;
  productImageMimeType: "image/jpeg" | "image/png";
  script: Pick<
    GeneratedScript,
    | "visual_method"
    | "visual_method_reason"
    | "scene1_description"
    | "scene1_video_script"
    | "scene2_description"
    | "scene2_video_script"
    | "cta"
  >;
  quality?: "preview" | "final";
  style?: string;
  shopWatermark?: string;
};

export type GeneratedImages = {
  problemImageUrl: string;
  solutionImageUrl: string;
  problemPromptUsed?: string;
  solutionPromptUsed?: string;
  problemVideoPrompt?: string;
  solutionVideoPrompt?: string;
  size: 512 | 1024;
  creditBurned: false;
};

export type GeneratedProblemImage = {
  problemImageUrl: string;
  problemPromptUsed?: string;
  problemVideoPrompt?: string;
  size: 512 | 1024;
  creditBurned: false;
};

export type GeneratedSolutionImage = {
  solutionImageUrl: string;
  solutionPromptUsed?: string;
  solutionVideoPrompt?: string;
  size: 512 | 1024;
  creditBurned: false;
};

export type GeneratedManualImage = {
  imageUrl: string;
  size: 512 | 1024;
  creditBurned: false;
  promptUsed?: string;
};

const imagenModel =
  process.env.IMAGEN_MODEL ?? "imagen-4.0-fast-generate-001";
const imagenReferenceModel =
  process.env.IMAGEN_REFERENCE_MODEL ?? "imagen-3.0-capability-001";
const geminiImageModel =
  process.env.GEMINI_IMAGE_MODEL ?? "gemini-3.1-flash-image";
const geminiImageFallbackModel =
  process.env.GEMINI_IMAGE_FALLBACK_MODEL ?? "gemini-2.5-flash-image";
const geminiPromptModel =
  process.env.GEMINI_PROMPT_MODEL ?? "gemini-2.5-flash";
const geminiPromptFallbackModel =
  process.env.GEMINI_PROMPT_FALLBACK_MODEL ?? process.env.GEMINI_MODEL;

function isEnabled(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

function shouldUseGeminiImageEngine() {
  return process.env.IMAGE_ENGINE?.trim().toLowerCase() === "gemini";
}

function getShopWatermarkRule(input: Pick<GenerateImagesInput, "shopWatermark">) {
  const watermark = input.shopWatermark?.trim();

  if (!watermark) {
    return {
      image:
        "Do not add any shop watermark, brand name, readable text, fake writing, caption, logo, or typography.",
      video:
        "Do not add subtitles, on-screen text, logos, watermarks, captions, or typography."
    };
  }

  return {
    image: `Add only one subtle shop-name watermark text: "${watermark}" in the upper-center area, around 12-15% down from the top edge with safe margin. It must be small, semi-transparent, low contrast, and not distract from the product. Do not place it touching the top border. Do not add any other text, fake writing, logo, caption, price, or typography.`,
    video: `Preserve the existing subtle shop-name watermark "${watermark}" in the upper-center area if it appears in the first frame. Keep it away from the top border. Do not create any other subtitles, text, logos, captions, or typography.`
  };
}

function getVertexPredictUrl() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const region = process.env.GOOGLE_CLOUD_REGION ?? "asia-southeast1";

  if (!projectId) {
    throw new Error("GOOGLE_CLOUD_PROJECT_ID belum ditetapkan.");
  }

  return `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${imagenModel}:predict`;
}

function getVertexReferencePredictUrl() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const region = process.env.GOOGLE_CLOUD_REGION ?? "asia-southeast1";

  if (!projectId) {
    throw new Error("GOOGLE_CLOUD_PROJECT_ID belum ditetapkan.");
  }

  return `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${imagenReferenceModel}:predict`;
}

function getVertexGenerateImageUrl(model = geminiImageModel) {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const region = process.env.GEMINI_IMAGE_REGION ?? "us-central1";

  if (!projectId) {
    throw new Error("GOOGLE_CLOUD_PROJECT_ID belum ditetapkan.");
  }

  return `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:generateContent`;
}

function getVertexPromptTextUrl(model = geminiPromptModel) {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const region =
    process.env.GEMINI_PROMPT_REGION ??
    process.env.GEMINI_IMAGE_REGION ??
    process.env.GOOGLE_CLOUD_REGION ??
    "us-central1";

  if (!projectId) {
    throw new Error("GOOGLE_CLOUD_PROJECT_ID belum ditetapkan.");
  }

  return `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:generateContent`;
}

function svgDataUrl(label: string, description: string) {
  const shortDescription =
    description.length > 28 ? `${description.slice(0, 25)}...` : description;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <rect width="512" height="512" fill="#11131a"/>
    <rect x="28" y="28" width="456" height="456" rx="28" fill="#171b24" stroke="#2dd4bf" stroke-opacity="0.45"/>
    <text x="256" y="210" text-anchor="middle" fill="#f8fafc" font-family="Arial" font-size="34" font-weight="700">${label}</text>
    <text x="256" y="260" text-anchor="middle" fill="#94a3b8" font-family="Arial" font-size="16">${shortDescription}</text>
    <text x="256" y="318" text-anchor="middle" fill="#2dd4bf" font-family="Arial" font-size="22" font-weight="700">Preview Watermark</text>
  </svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function getStylePrompt(style?: string) {
  switch (style) {
    case "3d-character":
      return "stylized 3D animated character style, polished Pixar-like commercial render, soft studio lighting, realistic product material, expressive human character, clean TikTok vertical composition";
    case "clean-studio":
      return "clean studio product ad, bright commercial lighting, polished e-commerce look";
    case "realistic-ugc":
      return "realistic TikTok UGC scene, natural creator lighting, handheld social commerce feel";
    case "bold-comic":
      return "bold comic poster style, expressive shapes, punchy colors, viral social media composition";
    default:
      return "stylized 3D animated character style, polished commercial render, expressive human character, clean TikTok vertical composition";
  }
}

type ProblemStrategy = {
  category: string;
  problemObjectMode:
    | "exclude_category_object"
    | "show_mess_without_category_object"
    | "show_old_bad_generic_object";
  oldBadObjectDescription: string;
  painScene: string;
  safeProps: string;
  mustShow: string;
  exclusions: string[];
};

type GeminiProblemAnalysis = {
  category?: string;
  problem_object_mode?: string;
  old_bad_object_description?: string;
  customer_problem?: string;
  problem_scene?: string;
  safe_props?: string[];
  must_show?: string[];
  blocked_objects?: string[];
};

type GeminiProblemPromptPlan = {
  category?: string;
  buyer_pain?: string;
  image_prompt?: string;
  negative_prompt?: string;
  qa_checklist?: string[];
  blocked_objects?: string[];
};

type GeminiAutoPromptPlan = {
  image_prompt?: string;
  video_prompt?: string;
};

const genericExclusions = [
  "product",
  "product package",
  "packaging",
  "brand",
  "logo",
  "label",
  "box",
  "packet",
  "pouch",
  "tin",
  "jar",
  "bottle with label",
  "branded container"
];

function getProductKeywords(input: GenerateImagesInput) {
  const source = `${input.productName} ${input.script.scene1_description} ${input.script.scene2_description}`.toLowerCase();

  return new Set(
    source
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .map((word) => word.trim())
      .filter((word) => word.length >= 3)
  );
}

function hasAnyKeyword(keywords: Set<string>, terms: string[]) {
  return terms.some((term) => keywords.has(term));
}

function hasAnyProductNamePhrase(input: GenerateImagesInput, terms: string[]) {
  const source = input.productName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ");

  return terms.some((term) => source.includes(term.toLowerCase()));
}

function inferProblemStrategy(input: GenerateImagesInput): ProblemStrategy {
  const keywords = getProductKeywords(input);
  const productNameKeywords = new Set(
    input.productName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .map((word) => word.trim())
      .filter((word) => word.length >= 3)
  );
  const productWords = input.productName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3);

  if (
    hasAnyKeyword(productNameKeywords, [
      "oat",
      "oats",
      "cereal",
      "flakes",
      "porridge",
      "granola",
      "baby",
      "sarapan",
      "breakfast",
      "makanan",
      "food",
      "beras",
      "bubur",
      "susu",
      "milk",
      "snack",
      "kids",
      "child",
      "kanak",
      "bayi"
    ])
  ) {
    return {
      category: "breakfast food",
      problemObjectMode: "exclude_category_object",
      oldBadObjectDescription: "",
      painScene:
        "A rushed adult Malaysian mother in a pastel pink hijab is late for work while an empty breakfast setup on the table shows breakfast is not ready.",
      safeProps:
        "A white bowl is completely empty and clean inside, with an unused spoon, a plain cup of milk, one whole banana, one apple, a crumpled napkin, a plain unmarked handbag, and a plain unmarked school bag placed as context only. The table is sparse and unfinished, not ingredient-heavy. No child, baby, toddler, minor, or child face.",
      mustShow:
        "must show the adult mother wearing a pastel pink hijab, must show a clean empty white bowl with nothing inside, must show only whole banana and apple as unprepared fruit, must not show children or babies",
      exclusions: [
        ...genericExclusions,
        ...productWords,
        "oat",
        "oats",
        "oat flakes",
        "cereal",
        "cereal flakes",
        "flakes",
        "grain",
        "grains",
        "granola",
        "muesli",
        "porridge",
        "baby food",
        "powder",
        "food inside bowl",
        "full bowl"
      ]
    };
  }

  if (
    hasAnyKeyword(productNameKeywords, [
      "bag",
      "beg",
      "backpack",
      "sling",
      "tote",
      "pouch",
      "wallet",
      "dompet"
    ])
  ) {
    return {
      category: "bag convenience",
      problemObjectMode: "show_old_bad_generic_object",
      oldBadObjectDescription:
        "one old messy generic handbag or backpack, plain, worn, too small, not stylish, not similar in shape/color/material to the uploaded product, not the hero",
      painScene:
        "A Malaysian working woman in a pastel pink hijab looks stressed while searching for daily items before leaving home because her old bag is messy and too small.",
      safeProps:
        "Show loose keys, phone, wallet, charger, papers, and small daily items scattered neatly around the old generic bag. The scene should feel disorganized but clean.",
      mustShow:
        "must show the woman wearing a pastel pink hijab, must show scattered daily items, must show one old messy generic bag as the problem object, must show searching/stressed expression",
      exclusions: [
        ...genericExclusions,
        ...productWords,
        "bag",
        "backpack",
        "organizer",
        "storage box",
        "lunch box",
        "container",
        "case"
      ]
    };
  }

  if (
    hasAnyKeyword(productNameKeywords, [
      "fan",
      "kipas",
      "cooler",
      "cooling",
      "sejuk",
      "panas",
      "heat",
      "angin",
      "humidifier",
      "aircond",
      "ac"
    ]) ||
    hasAnyProductNamePhrase(input, [
      "air cooler",
      "aircond",
      "air conditioner",
      "portable fan",
      "mini fan",
      "usb fan",
      "desk fan",
      "table fan",
      "kipas mini",
      "kipas meja",
      "kipas portable",
      "kipas angin"
    ])
  ) {
    return {
      category: "cooling appliance",
      problemObjectMode: "exclude_category_object",
      oldBadObjectDescription: "",
      painScene:
        "An adult Malaysian woman in a pastel pink hijab sits in a warm small apartment room looking uncomfortable and sweaty while trying to continue her daily routine in the heat.",
      safeProps:
        "Show bright afternoon heat through the window, still curtains, a handkerchief, water glass, and light clothing. Make the room feel stuffy and warm without showing any cooling device.",
      mustShow:
        "must show the adult woman wearing a pastel pink hijab, must show warm uncomfortable room mood, must show sweat or heat discomfort without any cooling appliance, must not show children or babies",
      exclusions: [
        ...genericExclusions,
        ...productWords,
        "fan",
        "kipas",
        "air cooler",
        "cooler",
        "air conditioner",
        "ac unit",
        "portable fan",
        "cooling device",
        "ventilator"
      ]
    };
  }

  if (
    hasAnyKeyword(productNameKeywords, [
      "blender",
      "blend",
      "juicer",
      "smoothie",
      "juice",
      "portable",
      "pengisar",
      "kisar",
      "jus",
      "buah",
      "fruit",
      "shake",
      "protein",
      "drink",
      "minuman",
      "rechargeable",
      "travel",
      "gym",
      "cup",
      "botol"
    ])
  ) {
    return {
      category: "kitchen appliance",
      problemObjectMode: "exclude_category_object",
      oldBadObjectDescription: "",
      painScene:
        "A Malaysian working woman in a pastel pink hijab looks tired and rushed in a morning kitchen, holding her phone and work bag while healthy breakfast prep is unfinished.",
      safeProps:
        "Show whole fruits like banana, apple, berries, an empty glass, a cutting board, and a clean but slightly messy counter. The fruits are not prepared and no drink is ready.",
      mustShow:
        "must show the woman wearing a pastel pink hijab, must show whole unprepared fruits, must show no drink is ready",
      exclusions: [
        ...genericExclusions,
        ...productWords,
        "blender",
        "mini blender",
        "portable blender",
        "juicer",
        "mixer",
        "smoothie machine",
        "blending cup",
        "blade base"
      ]
    };
  }

  if (
    hasAnyKeyword(productNameKeywords, [
      "skincare",
      "serum",
      "cream",
      "toner",
      "cleanser",
      "sunscreen",
      "moisturizer",
      "pelembap",
      "pencuci",
      "sabun",
      "jerawat",
      "acne",
      "glow",
      "skin",
      "kulit",
      "muka",
      "face",
      "lotion",
      "mask",
      "beauty"
    ])
  ) {
    return {
      category: "beauty skincare",
      problemObjectMode: "exclude_category_object",
      oldBadObjectDescription: "",
      painScene:
        "A Malaysian working woman in a pastel pink hijab looks worried in front of a bathroom mirror before leaving for work, noticing dull or oily skin and feeling rushed.",
      safeProps:
        "Show a clean bathroom mirror, towel, soft morning light, handbag, and phone. Keep the counter mostly empty so the concern is visible without showing any solution product.",
      mustShow:
        "must show the woman wearing a pastel pink hijab, must show mirror concern, must show mostly empty bathroom counter",
      exclusions: [
        ...genericExclusions,
        ...productWords,
        "serum",
        "cream",
        "toner",
        "cleanser",
        "sunscreen",
        "moisturizer",
        "skincare bottle",
        "cosmetic tube",
        "beauty jar"
      ]
    };
  }

  if (
    hasAnyKeyword(productNameKeywords, [
      "bag",
      "beg",
      "backpack",
      "sling",
      "tote",
      "pouch",
      "wallet",
      "dompet",
      "organizer",
      "organiser",
      "storage",
      "simpan",
      "travel",
      "lunch",
      "box",
      "container",
      "bekas",
      "case",
      "holder"
    ])
  ) {
    return {
      category: "storage or daily convenience",
      problemObjectMode: "show_mess_without_category_object",
      oldBadObjectDescription: "",
      painScene:
        "A Malaysian working woman in a pastel pink hijab looks stressed because small daily items are scattered and hard to organize.",
      safeProps:
        "Show loose keys, phone, wallet, charger, makeup, papers, cables, and small daily items scattered neatly on a table or shelf. The scene should feel disorganized but clean. Do not show any storage box, organizer, container, case, pouch, or solution object.",
      mustShow:
        "must show the woman wearing a pastel pink hijab, must show scattered daily items, must show searching/stressed expression, must not show any organizing product",
      exclusions: [
        ...genericExclusions,
        ...productWords,
        "bag",
        "backpack",
        "organizer",
        "storage box",
        "lunch box",
        "container",
        "case"
      ]
    };
  }

  return {
    category: "daily lifestyle product",
    problemObjectMode: "exclude_category_object",
    oldBadObjectDescription: "",
    painScene:
      input.script.scene1_description ||
      "A Malaysian working woman in a pastel pink hijab looks stressed during a busy daily routine before the solution is introduced.",
    safeProps:
      "Use only neutral lifestyle props that show the problem context, such as phone, work bag, clock-like time pressure without readable numbers, empty table space, and clean home details.",
    mustShow:
      "must show the woman wearing a pastel pink hijab, must show stress or inconvenience, must keep the solution product absent",
    exclusions: [...genericExclusions, ...productWords]
  };
}

function dedupe(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function parseJsonObject(text: string) {
  const cleaned = cleanPromptText(text);
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  const json = jsonMatch ? jsonMatch[0] : cleaned;

  return JSON.parse(json) as GeminiProblemAnalysis;
}

function parseProblemPromptPlan(text: string) {
  const cleaned = cleanPromptText(text);
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  const json = jsonMatch ? jsonMatch[0] : cleaned;

  return JSON.parse(json) as GeminiProblemPromptPlan;
}

function unquoteLooseJsonString(value: string) {
  return value
    .trim()
    .replace(/^"/, "")
    .replace(/",?$/, "")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n")
    .trim();
}

function matchLooseJsonField(text: string, key: string) {
  const nextFieldPattern = String.raw`(?:,\s*"(?:category|buyer_pain|image_prompt|negative_prompt|qa_checklist|blocked_objects)"\s*:|\s*\})`;
  const match = text.match(
    new RegExp(String.raw`"${key}"\s*:\s*([\s\S]*?)${nextFieldPattern}`, "i")
  );

  return match ? unquoteLooseJsonString(match[1]) : "";
}

function coerceProblemPromptPlanFromText(
  text: string,
  fallbackNegativePrompt: string
) {
  const cleaned = cleanPromptText(text);
  const imagePrompt = matchLooseJsonField(cleaned, "image_prompt") || cleaned;
  const negativePrompt =
    matchLooseJsonField(cleaned, "negative_prompt") || fallbackNegativePrompt;
  const blockedObjectsText = matchLooseJsonField(cleaned, "blocked_objects");
  const qaChecklistText = matchLooseJsonField(cleaned, "qa_checklist");

  return validPromptPlan({
    category: matchLooseJsonField(cleaned, "category"),
    buyer_pain: matchLooseJsonField(cleaned, "buyer_pain"),
    image_prompt: imagePrompt,
    negative_prompt: negativePrompt,
    blocked_objects: blockedObjectsText
      .replace(/[\[\]"]/g, "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    qa_checklist: qaChecklistText
      .replace(/[\[\]"]/g, "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  });
}

function toStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 1);
}

function includesAnyTerm(text: string, terms: string[]) {
  const lowered = text.toLowerCase();

  return terms.some((term) => lowered.includes(term.toLowerCase()));
}

function filterSafePhrases(phrases: string[], blockedObjects: string[]) {
  return phrases.filter((phrase) => !includesAnyTerm(phrase, blockedObjects));
}

function buildGeminiProblemStrategy(
  input: GenerateImagesInput,
  fallback: ProblemStrategy,
  analysis: GeminiProblemAnalysis
): ProblemStrategy {
  const category =
    typeof analysis.category === "string" && analysis.category.trim()
      ? analysis.category.trim()
      : fallback.category;
  const customerProblem =
    typeof analysis.customer_problem === "string"
      ? analysis.customer_problem.trim()
      : "";
  const problemScene =
    typeof analysis.problem_scene === "string"
      ? analysis.problem_scene.trim()
      : "";
  const safeProps = toStringList(analysis.safe_props);
  const mustShow = toStringList(analysis.must_show);
  const blockedObjects = toStringList(analysis.blocked_objects);
  const mode =
    analysis.problem_object_mode === "show_old_bad_generic_object" ||
    analysis.problem_object_mode === "show_mess_without_category_object" ||
    analysis.problem_object_mode === "exclude_category_object"
      ? analysis.problem_object_mode
      : fallback.problemObjectMode;
  const oldBadObjectDescription =
    typeof analysis.old_bad_object_description === "string"
      ? analysis.old_bad_object_description.trim()
      : "";
  const exclusions = dedupe([
    ...fallback.exclusions,
    ...genericExclusions,
    ...blockedObjects
  ]);
  const safeGeminiProps = filterSafePhrases(safeProps, exclusions);
  const safeGeminiMustShow = filterSafePhrases(mustShow, exclusions);

  return {
    category,
    problemObjectMode: mode,
    oldBadObjectDescription:
      mode === "show_old_bad_generic_object"
        ? oldBadObjectDescription || fallback.oldBadObjectDescription
        : "",
    painScene:
      problemScene ||
      customerProblem ||
      input.script.scene1_description ||
      fallback.painScene,
    safeProps: safeGeminiProps.length
      ? safeGeminiProps.join(", ")
      : fallback.safeProps,
    mustShow: safeGeminiMustShow.length
      ? safeGeminiMustShow.join(", ")
      : fallback.mustShow,
    exclusions
  };
}

async function requestProblemStrategyWithGemini(
  input: GenerateImagesInput,
  fallback: ProblemStrategy
): Promise<ProblemStrategy> {
  const response = await fetch(getVertexPromptTextUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await getGoogleAccessToken()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text:
              "You are a TikTok Shop Malaysia product strategist. Analyze the uploaded product and return strict JSON only. Do not write markdown. The app code will build the final prompt, so your job is category analysis and blocked-object selection."
          }
        ]
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Analyze this product for a BEFORE/PROBLEM ad image. The product name typed by the user is the primary source for category and customer situation. Use the uploaded product image only to understand product appearance/details. If the old script context conflicts with the product name, ignore the old script context. Decide product category, customer pain, problem object mode, safe props, required visual elements, and blocked objects.

Problem object mode rules:
- "exclude_category_object": use when showing the category object would reveal the solution, for example baby oat/cereal/food ingredient, fan/cooler, blender/juicer, skincare bottle.
- "show_mess_without_category_object": use when the problem can be shown by clutter/mess without showing the solution object, for example storage box, organizer, container.
- "show_old_bad_generic_object": use when an old bad generic version makes the pain clearer, for example bag, shoes, wallet. It must be worn/plain/generic and not similar to the uploaded product.

The problem image must never show the new product, uploaded product, hero product, product packaging, brand, or logo.

Product name typed by user: ${input.productName}
Product price: ${input.productPrice}
Script problem scene: ${input.script.scene1_description}
Script solution scene: ${input.script.scene2_description}
Fallback category guess: ${fallback.category}

Return JSON only in this exact shape:
{
  "category": "short category slug or phrase",
  "problem_object_mode": "exclude_category_object | show_mess_without_category_object | show_old_bad_generic_object",
  "old_bad_object_description": "only if mode is show_old_bad_generic_object, describe the old generic problem object and how it must differ from uploaded product",
  "customer_problem": "one sentence customer pain",
  "problem_scene": "one visual scene sentence without product",
  "safe_props": ["objects allowed in problem scene that do not reveal product"],
  "must_show": ["required visual elements for the problem image"],
  "blocked_objects": ["product name", "new product", "uploaded product", "packaging", "category clues and product-related objects to forbid"]
}`
            },
            {
              inlineData: {
                mimeType: input.productImageMimeType,
                data: input.productImageBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 700,
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    throw new Error(
      `Gemini product analysis gagal. Status ${
        response.status
      }.${await readVertexError(response)}`
    );
  }

  const analysis = parseJsonObject(extractGeminiText(await response.json()));

  return buildGeminiProblemStrategy(input, fallback, analysis);
}

async function getProblemStrategy(input: GenerateImagesInput) {
  const fallback = inferProblemStrategy(input);

  if (process.env.GEMINI_PRODUCT_ANALYSIS === "false") {
    return fallback;
  }

  try {
    return await requestProblemStrategyWithGemini(input, fallback);
  } catch {
    return fallback;
  }
}

function buildNegativePrompt(exclusions: string[]) {
  return dedupe([
    "text",
    "word",
    "words",
    "letters",
    "typography",
    "label",
    "sign",
    "number",
    "symbol",
    "question mark",
    "icon",
    "caption",
    "speech bubble",
    "overlay",
    "instruction sheet",
    "rules page",
    "document page",
    "paper full of text",
    "poster full of text",
    "watermark",
    "logo",
    "brand",
    "advertisement layout",
    "border",
    "framed card",
    "square image",
    "real photo",
    "realistic human",
    "scary child",
    "dirty unsafe scene",
    ...exclusions
  ]).join(", ");
}

function buildStoryboardPrompts(
  input: GenerateImagesInput,
  problemStrategy: ProblemStrategy
) {
  const stylePrompt = getStylePrompt(input.style);
  const productReferencePrompt = `Use product reference [1] as the exact product design source for ${input.productName}. Preserve the product shape, compact size, main color, transparent cup/container or visible body details, lid/top, base/bottom, button/control area, material feel, and recognizable silhouette from the reference image. Do not copy any printed words, labels, logos, symbols, or brand marks from the reference image; keep the product surface clean and unbranded. Show the product as a real usable product object, never as a mascot, never with arms, legs, eyes, mouth, or a face.`;
  const problemExclusions = dedupe(problemStrategy.exclusions);
  const isBreakfastFood = problemStrategy.category
    .toLowerCase()
    .includes("breakfast");
  const loweredCategory = problemStrategy.category.toLowerCase();
  const isBag = loweredCategory.includes("bag");
  const isStorage =
    loweredCategory.includes("storage") ||
    loweredCategory.includes("organizer") ||
    loweredCategory.includes("container");
  const isCooling =
    loweredCategory.includes("cooling") ||
    loweredCategory.includes("fan") ||
    loweredCategory.includes("kipas");
  const modeInstruction =
    problemStrategy.problemObjectMode === "show_old_bad_generic_object"
      ? `Problem object mode: show exactly one old/bad generic category object as the pain point: ${problemStrategy.oldBadObjectDescription}. It must look worn, plain, unbranded, not attractive, not the hero, and clearly different from the uploaded product. Do not show the new product or any object matching the uploaded product design.`
      : problemStrategy.problemObjectMode === "show_mess_without_category_object"
        ? "Problem object mode: show the mess/clutter/problem only. Do not show any category object, organizer, container, storage product, or solution object."
        : "Problem object mode: exclude the product category object completely. Show only the surrounding pain/context before the solution appears.";
  const problemPrompt = isBreakfastFood
    ? `Full-bleed vertical 9:16 polished cute 3D cartoon TikTok Shop Malaysia image, premium commercial 3D animation. Problem scene only, before the solution appears. No product, no packaging, no brand, no solution item, no breakfast ingredient clue.

Scene: bright Malaysian apartment kitchen during a busy rushed morning. A young adult Malaysian mother in her early 30s wears a modest casual home outfit with a soft pastel pink hijab. She looks worried and late while looking at an unfinished breakfast setup on the table. No child, baby, toddler, minor, or child face appears anywhere.

Show the struggle visually only: a large white breakfast bowl is tilted toward the camera so the blank white empty interior is clearly visible, nothing inside the bowl, no spoon inside the bowl. Put an unused spoon beside the bowl, a plain cup of milk, one whole banana, one whole apple, a crumpled napkin, a plain unmarked handbag, and a plain unmarked school bag. The table is sparse and unfinished, not full of ingredients. Do not show oats, cereal, porridge, flakes, grains, granola, powder, baby food, food pouches, packets, boxes, tins, jars, branded containers, or any food inside the bowl.

Composition: adult mother visible with emotional worried glance, full kitchen fills the vertical frame, natural blank cabinet or wall area near the top for future TikTok caption. Every prop must be plain and unmarked with no readable text or fake letters. ${stylePrompt}. No text, no readable marks, no logo, no watermark, no real people, no children, no babies.`
    : isCooling
      ? `Full-bleed vertical 9:16 polished cute 3D cartoon TikTok Shop Malaysia problem image, premium commercial 3D animation. Problem scene only, before the solution appears. No fan, no kipas, no air cooler, no air conditioner, no AC unit, no cooling machine, no portable device, no product.

Scene: a hot Malaysian afternoon in a small home living area or balcony corner with strong sunlight, still curtains, and warm orange light. An adult Malaysian woman in a soft pastel pink hijab looks uncomfortable and sweaty while trying to continue her daily routine in the heat. Show heat discomfort through sweat, flushed face, still air, water glass, and sunlight. Do not show any cooling appliance or machine anywhere. No child, baby, toddler, minor, or child face appears anywhere.

Composition: adult woman visible, no devices in foreground, no aircond on wall, no cooler on floor, no fan, no vents, no product. Keep top area clean for future caption. Every prop must be plain and unmarked with no text or fake letters. ${stylePrompt}. No children, no babies.`
      : isBag
        ? `Full-bleed vertical 9:16 polished cute 3D cartoon TikTok Shop Malaysia problem image, premium commercial 3D animation. Problem scene only, before the solution appears. Do not show the uploaded/new product bag, do not show a stylish new bag, do not show matching color/shape/material from the uploaded product.

Scene: a Malaysian working woman in a soft pastel pink hijab is rushing before leaving home, stressed because her daily items are hard to find. Show exactly one old bad generic handbag/backpack as the problem object: worn, plain, slightly saggy, too small, messy, not attractive, unbranded, clearly different from the uploaded product and not the hero. Items like keys, phone, wallet, charger, receipts, and papers are scattered around it.

Composition: woman searching with stressed expression, old generic bag low on table or floor, clutter visible, no new product hero. Keep top area clean for future caption. Every prop must be plain and unmarked with no readable text or fake letters. ${stylePrompt}.`
        : isStorage
          ? `Full-bleed vertical 9:16 polished cute 3D cartoon TikTok Shop Malaysia problem image, premium commercial 3D animation. Problem scene only, before the solution appears. Do not show any storage box, organizer, container, case, pouch, basket, drawer divider, or solution object.

Scene: a Malaysian woman in a soft pastel pink hijab feels stressed because small household items are scattered everywhere and hard to organize. Show clutter only: cables, keys, toys, makeup, papers, charger, remote, stationery, and small items spread across a table/shelf. The mess is clean and family-friendly, but clearly frustrating.

Composition: woman searching through clutter, no organizing product visible, no boxes or containers. Keep top area clean for future caption. Every prop must be plain and unmarked with no readable text or fake letters. ${stylePrompt}.`
    : `Create one full-bleed vertical 9:16 polished cute 3D cartoon TikTok Shop Malaysia problem scene only, premium commercial 3D animation, not photorealistic, not a toy figurine. This is before the solution appears. Category inferred from product: ${problemStrategy.category}.

Scene and emotion: ${problemStrategy.painScene}

${modeInstruction}

Required visual elements: ${problemStrategy.mustShow}. ${problemStrategy.safeProps}

Composition: full scene fills the entire vertical frame, family-friendly Malaysian lifestyle, expressive human character, natural blank cabinet/wall/air space near the top for future TikTok caption. Keep the upper 25 percent clean and mostly empty. Every prop, bag, notebook, screen, wall item, cup, and container must be completely plain and unmarked with no readable text or fake letters. Do not show ${input.productName}, the uploaded product reference, product packaging, or any direct product-category clue. Exclude: ${problemExclusions.join(", ")}. ${stylePrompt}. No readable marks, no fake letters, no logo, no watermark, no WhatsApp, no real people, no brand name.`;
  const solutionPrompt = `Create one tall vertical 9:16 polished cute 3D cartoon TikTok Shop Malaysia SOLUTION product image, portrait canvas, full height composition, high-end 3D animation look, not a toy figurine. ${productReferencePrompt} Continue from reference [2] only for the same Malaysian character, same soft pastel pink hijab, same face impression, same body proportions, and same polished 3D animation style. Change the mood clearly: she is now happy, fresh, relieved, and confident, no longer stressed.

Scene: bright clean Malaysian lifestyle setting that solves the earlier ${problemStrategy.category} problem. Put ${input.productName} large and clearly visible in the foreground as the main hero product. Show the product actively solving the problem described here: ${input.script.scene2_description}. The background should look tidier, brighter, and more organized than the problem image. Add only relevant lifestyle props nearby; do not duplicate the product and do not show extra product clones.

Important solution rules: make the product visibly new/clean/appealing, make the character smiling or relieved, make the problem feel solved. Mood is cheerful, simple, clean, and direct TikTok Shop Malaysia seller style. Keep the upper 25 percent clean and mostly empty for TikTok caption overlay. ${stylePrompt}. No text, no readable marks, no fake letters, no logo, no watermark, no WhatsApp, no real people, no brand name.`;

  return {
    problemPrompt,
    solutionPrompt,
    problemNegativePrompt: buildNegativePrompt(problemExclusions)
  };
}

function extractGeminiText(data: {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}) {
  return (
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .filter(Boolean)
      .join("\n")
      .trim() ?? ""
  );
}

function cleanPromptText(text: string) {
  return text
    .trim()
    .replace(/^```(?:text|markdown)?\s*/i, "")
    .replace(/```$/i, "")
    .replace(/^["']|["']$/g, "")
    .trim();
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isBusyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes("429") ||
    message.toLowerCase().includes("resource exhausted") ||
    message.toLowerCase().includes("high load") ||
    message.toLowerCase().includes("unterminated string in json") ||
    message.toLowerCase().includes("gemini auto prompt pulangkan")
  );
}

function toFriendlyGenerationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (isBusyError(error)) {
    return "Server cloud untuk AI sedang busy. Sistem sudah retry 5 kali. Cuba lagi sebentar lagi.";
  }

  if (message.includes("401") || message.includes("UNAUTHENTICATED")) {
    return "Token AI sudah tamat atau tidak valid. Update token dan cuba lagi.";
  }

  return message;
}

async function requestCoachedImagePrompt(
  draftPrompt: string,
  mode: "problem" | "solution"
) {
  const response = await fetch(getVertexPromptTextUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await getGoogleAccessToken()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text:
              "You are an expert prompt engineer for product advertising image generation. Rewrite the user prompt into one concise production-ready English image prompt. Preserve every hard constraint. Do not add text overlays, logos, brand names, watermarks, or claims. Return only the final prompt, no explanation."
          }
        ]
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Rewrite this ${mode} image prompt for image generation. Keep reference markers [1] and [2] exactly when present. Make it look like a polished cute 3D cartoon TikTok Shop Malaysia image with a human Malaysian working woman, not toy-like. For problem mode, product and direct product-category clues must NOT appear. For solution mode, same character from [2] must be used and product is the hero.\n\n${draftPrompt}`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 900
      }
    })
  });

  if (!response.ok) {
    throw new Error(
      `Gemini prompt coach gagal. Status ${
        response.status
      }.${await readVertexError(response)}`
    );
  }

  const text = cleanPromptText(extractGeminiText(await response.json()));

  if (text.length <= 80) {
    throw new Error("Gemini prompt coach pulangkan prompt terlalu pendek.");
  }

  return text;
}

async function coachImagePromptWithGemini(
  draftPrompt: string,
  mode: "problem" | "solution"
) {
  if (process.env.GEMINI_PROMPT_COACH === "false") {
    return draftPrompt;
  }

  try {
    return await requestCoachedImagePrompt(draftPrompt, mode);
  } catch (firstError) {
    await wait(20_000);

    try {
      return await requestCoachedImagePrompt(draftPrompt, mode);
    } catch {
      const message =
        firstError instanceof Error
          ? firstError.message
          : "Gemini prompt coach gagal.";

      throw new Error(
        `${message} Tiada image dijana. Sistem sudah tunggu 20 saat dan retry sekali.`
      );
    }
  }
}

function parseAutoPromptPlan(text: string) {
  const cleaned = cleanPromptText(text);
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  let parsed: GeminiAutoPromptPlan;

  try {
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned) as GeminiAutoPromptPlan;
  } catch {
    parsed = {
      image_prompt: unquoteLooseJsonString(
        matchLooseJsonField(cleaned, "image_prompt") ||
          cleaned
            .replace(/^\{\s*/g, "")
            .replace(/"video_prompt"[\s\S]*$/i, "")
            .replace(/"image_prompt"\s*:\s*/i, "")
      ),
      video_prompt: unquoteLooseJsonString(
        matchLooseJsonField(cleaned, "video_prompt") ||
          "Create one 8-second vertical 9:16 image-to-video clip using this image as the first frame. Use natural small motion only. No subtitles, no text, no logo, no watermark."
      )
    };
  }

  const imagePrompt =
    typeof parsed.image_prompt === "string" ? parsed.image_prompt.trim() : "";
  const videoPrompt =
    typeof parsed.video_prompt === "string" ? parsed.video_prompt.trim() : "";

  if (imagePrompt.length < 40) {
    throw new Error("Gemini auto prompt pulangkan image_prompt terlalu pendek.");
  }

  if (videoPrompt.length < 40) {
    throw new Error("Gemini auto prompt pulangkan video_prompt terlalu pendek.");
  }

  return {
    imagePrompt,
    videoPrompt
  };
}

function buildSingleSceneImagePrompt(input: GenerateImagesInput) {
  const method = input.script.visual_method || "problem_solution";
  const watermarkRule = getShopWatermarkRule(input);

  return [
    `Create one vertical 9:16 ${getStylePrompt(input.style)} image for a TikTok Shop Malaysia seller video.`,
    `Gemini selected visual method: ${method}. Reason: ${
      input.script.visual_method_reason || "Use the method that best fits the product."
    }`,
    `Use this exact base scene: ${input.script.scene1_description}`,
    `The product is ${input.productName}. The uploaded product reference must appear clearly in the same scene. Preserve the exact main color, color blocking, shape, pack/form factor, silhouette, label layout, and overall visual identity from the reference image as clearly as possible. Do not recolor the product. If the reference product is dark blue, black, pink, white, or any other color, keep that same dominant color on the product.`,
    "Follow the selected visual method, not a fixed problem-solution formula. If the method is problem_solution or before_after, show the customer pain with the product visible nearby. If the method is showcase, make the product the attractive hero in a lifestyle/fashion/product-focus scene. If the method is demo or lifestyle_use, show the product ready to be used naturally in context.",
    "For showcase specifically: create one single coherent lifestyle scene only. Do not create a catalog layout, split-screen, collage, product-only top section, multiple color variants, floating cutout, ecommerce poster, or product grid. Show one main product naturally worn, held, placed, or displayed in the scene with an adult character or lifestyle setting.",
    "Veo safety: do not show babies, children, toddlers, minors, child faces, or child bodies. If family/baby product context is needed, show adult caregiver focus with neutral props only.",
    "Composition: polished full-bleed vertical scene, empty clean space at the top for TikTok caption, product clear in the frame with its reference color still recognizable, adult character or lifestyle context as appropriate for the selected method, Malaysian home/kitchen/work/lifestyle setting as appropriate.",
    watermarkRule.image,
    "Strict negatives: no extra ad text, no TikTok Shop words, no speech bubble, no captions, no price overlay, no poster typography, no ad headline, no split layout, no collage, no multiple product variants, no floating product cutout. Product packaging details from the uploaded reference are allowed."
  ].join(" ");
}

function buildSingleSceneVideoPrompt(input: GenerateImagesInput) {
  const method = input.script.visual_method || "problem_solution";
  const watermarkRule = getShopWatermarkRule(input);

  return [
    "Create one 8-second vertical 9:16 image-to-video BASE clip using this image as the first frame.",
    `Product: ${input.productName}.`,
    `Selected visual method: ${method}.`,
    `Full scene setup: ${input.script.scene1_description}`,
    "Write the motion like a production prompt, not a generic scene. Clearly describe the adult character, the room/location, the emotion, the hand/body action, and where the product is visible in the frame.",
    "For problem_solution/before_after: show the pain first, make the product clearly visible nearby, then the character notices the product with hope. Do not fully solve everything in this base clip because the extension clip will continue the solution.",
    "For showcase/demo/lifestyle_use: introduce the product and begin the natural use/showcase action, leaving room for the extension to finish the benefit.",
    `The main adult character speaks/says this natural Malay line with visible lip movement and mouth movement: "${input.script.scene1_video_script || "Produk ni memang nampak sesuai untuk aku."}"`,
    "Keep the same character, same outfit, same room, and same product from the first frame. Use natural motion for 8 seconds: facial expression, mouth movement, gentle hand movement, product glance/touch when relevant, and slight camera push-in.",
    watermarkRule.video
  ].join(" ");
}

function buildExtendSceneVideoPrompt(input: GenerateImagesInput) {
  const method = input.script.visual_method || "problem_solution";
  const watermarkRule = getShopWatermarkRule(input);

  return [
    "EXTEND VIDEO PROMPT: Continue this exact vertical 9:16 product video from the final frame of the base clip.",
    "The extended output should feel like one complete 16-second TikTok Shop Malaysia video, not a new scene and not a hard reset.",
    `Product: ${input.productName}.`,
    `Selected visual method: ${method}.`,
    `Continuation scene: ${input.script.scene2_description || input.script.scene1_description}`,
    "Keep the same adult character, same outfit, same room/location, same lighting, same camera angle/style, and same product appearance.",
    "Now continue into the product benefit/action. The adult character should naturally pick up, hold, wear, open, use, press, spray, point to, organize with, or demonstrate the product according to what the product actually is.",
    "Make the product action clear and specific, with natural hand movement and facial expression changing from problem/interest into relief/confidence.",
    `The main adult character speaks/says this natural Malay line with visible lip movement and mouth movement: "${input.script.scene2_video_script || input.script.cta || "Ha, ini baru senang, cepat terus boleh guna."}"`,
    watermarkRule.video
  ].join(" ");
}

function completeAutoPromptPlan(
  input: GenerateImagesInput,
  mode: "problem" | "solution",
  plan: { imagePrompt: string; videoPrompt: string }
) {
  if (mode !== "problem") {
    return plan;
  }

  const imagePrompt =
    plan.imagePrompt.length < 220 ||
    !/product|uploaded|reference/i.test(
      plan.imagePrompt
    )
      ? buildSingleSceneImagePrompt(input)
      : [
          plan.imagePrompt,
          `This is the only storyboard image for the video. Follow the Gemini-selected visual method (${input.script.visual_method || "problem_solution"}), not a fixed problem-solution formula. The uploaded product must be visible and recognizable. Preserve exact dominant product color, packaging, shape, label layout, silhouette, and color blocking as clearly as possible. Do not recolor the product. If method is showcase, it must be one coherent lifestyle scene, not a catalog, split-screen, collage, product-only cutout, or multiple variants. ${getShopWatermarkRule(input).image}`
        ].join(" ");

  const baseVideoPrompt =
    plan.videoPrompt.length < 180 ||
    !/8-second|8 seconds|speak|lip/i.test(plan.videoPrompt)
      ? buildSingleSceneVideoPrompt(input)
      : [
          plan.videoPrompt,
          `The clip must follow the Gemini-selected visual method (${input.script.visual_method || "problem_solution"}). This is only the base 8-second clip. It must be a complete production prompt with character, location, emotion, product visible in frame, product-specific action, and one Malay spoken line with visible lip movement. ${getShopWatermarkRule(input).video}`
        ].join(" ");
  const extendPrompt = buildExtendSceneVideoPrompt(input);

  return {
    imagePrompt,
    videoPrompt: [
      "BASE 8s PROMPT:",
      baseVideoPrompt,
      "",
      "EXTEND / CONTINUATION PROMPT FOR FINAL 16s:",
      extendPrompt
    ].join("\n")
  };
}

async function requestAutoPromptWithGemini(
  input: GenerateImagesInput,
  mode: "problem" | "solution",
  problemImageUrl: string | undefined,
  model: string
) {
  const problemImage = problemImageUrl
    ? await imageUrlToInlineData(problemImageUrl)
    : null;
  const response = await fetch(getVertexPromptTextUrl(model), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await getGoogleAccessToken()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text:
              "You are Gemini acting as the best prompt writer for TikTok Shop Malaysia seller creatives. Return strict JSON only. Do not explain. The app will use your image_prompt and video_prompt exactly, so include all needed visual rules inside the prompt."
          }
        ]
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Create prompts for the ${mode.toUpperCase()} scene.

Product name typed by seller: ${input.productName}
Product price: ${input.productPrice}
Single image scene from app. Use this as the exact base scene, do not replace it with a different situation: ${input.script.scene1_description}
Product action/result context for the video, only to guide what the character may do later: ${input.script.scene2_description}
Malay dialogue line from script, use this exact line in video_prompt: ${input.script.scene1_video_script || "Produk ni memang nampak sesuai untuk aku."}
Gemini-selected visual method from script: ${input.script.visual_method || "problem_solution"}
Reason for method: ${input.script.visual_method_reason || "Method selected by script planner."}
Selected style: ${input.style || "3d-character"}

Use the uploaded product/reference image to understand the product. Use the app structure above, but write the final prompt naturally like Gemini browser would.
Shop watermark rule:
- ${getShopWatermarkRule(input).image}
- ${getShopWatermarkRule(input).video}

Rules for image_prompt:
- One vertical 9:16 image.
- Cute polished 3D cartoon TikTok Shop Malaysia style if style is 3d-character.
- Follow the shop watermark rule exactly.
- Keep it product-ad friendly and family-safe.
- Follow the Gemini-selected visual method from the script. Do not force problem-solution if the method is showcase, demo, or lifestyle_use.
- For problem_solution or before_after: show customer pain plus the uploaded product clearly inside the same scene at the side / on table / within reach.
- For showcase: show the product attractively as the hero in a lifestyle/product-focus scene; no fake problem is needed.
- Showcase must be one natural scene only, not a catalog, not split-screen, not collage, not product-only top half, not multiple variants, not floating product cutout. Show one main product naturally worn, held, placed, or displayed.
- For demo or lifestyle_use: show the product naturally ready to be used or being presented in context.
- Preserve the product's visible shape/color/design from the uploaded reference, but do not copy readable labels/logos. Do not swap to another product category.

Rules for video_prompt:
- One 8-second vertical image-to-video prompt using this generated image as first frame.
- The video action/timing must follow the Gemini-selected visual method from the script, not a fixed problem-solution formula.
- If method is problem_solution/before_after, use problem > notice product > use product > relief.
- If method is showcase, use introduce product > show/wear/hold product > confident product close-up.
- If method is demo/lifestyle_use, use context > simple product use > satisfying result.
- The main adult character must speak one short natural Malay line with visible lip movement.
- Use the exact Malay dialogue line from the script. Do not replace it with a generic line.
- Use natural small motion only.
- Veo safety: avoid children, babies, toddlers, minors, child faces, and child bodies. Prefer adult-only scenes; for baby/kids products show only adult caregiver and neutral props.
- Follow the shop watermark rule exactly.

Return JSON only:
{
  "image_prompt": "final image generation prompt",
  "video_prompt": "final Veo image-to-video prompt"
}`
            },
            {
              inlineData: {
                mimeType: input.productImageMimeType,
                data: input.productImageBase64
              }
            },
            ...(problemImage
              ? [
                  {
                    inlineData: problemImage
                  }
                ]
              : [])
          ]
        }
      ],
      generationConfig: {
        temperature: 0.45,
        maxOutputTokens: 1200,
        responseMimeType: "application/json"
      }
    })
  });

    if (!response.ok) {
      throw new Error(
      `Gemini auto prompt gagal (${model}). Status ${
        response.status
      }.${await readVertexError(response)}`
      );
  }

  return completeAutoPromptPlan(
    input,
    mode,
    parseAutoPromptPlan(extractGeminiText(await response.json()))
  );
}

async function planAutoPromptWithGemini(
  input: GenerateImagesInput,
  mode: "problem" | "solution",
  problemImageUrl?: string
) {
  const tryPlan = (model: string) =>
    requestAutoPromptWithGemini(input, mode, problemImageUrl, model);
  let lastError: unknown = null;
  const models = dedupe([
    geminiPromptModel,
    geminiPromptFallbackModel || geminiPromptModel
  ]);
  const maxAttempts = mode === "solution" ? 4 : 6;
  const retryDelay = mode === "solution" ? 20_000 : 30_000;

  for (const model of models) {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await tryPlan(model);
      } catch (error) {
        lastError = error;

        if (!isBusyError(error) || attempt >= maxAttempts) {
          break;
        }

        await wait(retryDelay);
      }
    }
  }

  throw new Error(toFriendlyGenerationError(lastError));
}

async function generateImageWithGeminiRetry(
  prompt: string,
  input: GenerateImagesInput,
  referenceImageUrl?: string,
  includeProductReference = true,
  options?: { maxAttempts?: number; retryDelayMs?: number }
) {
  let lastError: unknown = null;
  const maxAttempts = options?.maxAttempts ?? 6;
  const retryDelay = options?.retryDelayMs ?? 30_000;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await generateSingleImageWithGeminiFallback(
        prompt,
        input,
        referenceImageUrl,
        includeProductReference
      );
    } catch (error) {
      lastError = error;

      if (!isBusyError(error) || attempt >= maxAttempts) {
        break;
      }

      await wait(retryDelay);
    }
  }

  throw new Error(toFriendlyGenerationError(lastError));
}

async function requestRealisticScenePrompt(
  input: GenerateImagesInput,
  scenePrompt: string,
  model: string
) {
  const response = await fetch(getVertexPromptTextUrl(model), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await getGoogleAccessToken()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text:
              "You are a TikTok Shop Malaysia visual director. Turn a short Malay seller scene into one natural realistic 9:16 image prompt. Return only the final prompt text, no markdown and no explanation."
          }
        ]
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Seller scene prompt:
${scenePrompt}

Product name: ${input.productName}
Product price: ${input.productPrice}

Use the attached product image as reference to understand the product category and what the new product looks like. For a problem/before scene, do NOT show the new uploaded product as the hero. If the scene mentions an old item, make it an old generic item that is clearly different from the uploaded product.

Create a realistic vertical 9:16 Malaysian social-commerce image prompt, natural phone-camera ad style, not 3D, not cartoon. Keep it practical and direct, like a good Gemini image prompt:
- one main Malaysian person or small lifestyle scene only
- relatable emotion from the seller scene
- realistic home/school/work setting in Malaysia
- if product should not appear, say clearly "do not show the new product"
- no text overlays, logos, brand names, labels, watermarks, fake writing, or readable words
- leave some clean empty space near the top for TikTok caption
- no exaggerated cinematic fantasy, no illustration, no 3D cartoon`
            },
            {
              inlineData: {
                mimeType: input.productImageMimeType,
                data: input.productImageBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 900
      }
    })
  });

  if (!response.ok) {
    throw new Error(
      `Gemini realistic prompt gagal (${model}). Status ${
        response.status
      }.${await readVertexError(response)}`
    );
  }

  const text = cleanPromptText(extractGeminiText(await response.json()));

  if (text.length < 120) {
    throw new Error("Gemini realistic prompt terlalu pendek.");
  }

  return text;
}

async function planRealisticScenePromptWithGemini(
  input: GenerateImagesInput,
  scenePrompt: string
) {
  try {
    return await requestRealisticScenePrompt(
      input,
      scenePrompt,
      geminiPromptModel
    );
  } catch (firstError) {
    await wait(20_000);

    try {
      return await requestRealisticScenePrompt(
        input,
        scenePrompt,
        geminiPromptModel
      );
    } catch {
      if (
        geminiPromptFallbackModel &&
        geminiPromptFallbackModel !== geminiPromptModel
      ) {
        return await requestRealisticScenePrompt(
          input,
          scenePrompt,
          geminiPromptFallbackModel
        );
      }

      const message =
        firstError instanceof Error
          ? firstError.message
          : "Gemini realistic prompt gagal.";

      throw new Error(
        `${message} Sistem sudah tunggu 20 saat dan retry sekali.`
      );
    }
  }
}

function validPromptPlan(plan: GeminiProblemPromptPlan) {
  const imagePrompt =
    typeof plan.image_prompt === "string" ? plan.image_prompt.trim() : "";
  const negativePrompt =
    typeof plan.negative_prompt === "string"
      ? plan.negative_prompt.trim()
      : "";

  if (imagePrompt.length < 400) {
    throw new Error("Gemini prompt planner pulangkan image_prompt terlalu pendek.");
  }

  if (negativePrompt.length < 80) {
    throw new Error("Gemini prompt planner pulangkan negative_prompt terlalu pendek.");
  }

  return {
    imagePrompt,
    negativePrompt,
    qaChecklist: toStringList(plan.qa_checklist),
    blockedObjects: toStringList(plan.blocked_objects),
    category:
      typeof plan.category === "string" && plan.category.trim()
        ? plan.category.trim()
        : "product problem"
  };
}

async function requestProblemPromptPlanWithGemini(
  input: GenerateImagesInput,
  draftPrompt: string,
  draftNegativePrompt: string,
  model: string
) {
  const response = await fetch(getVertexPromptTextUrl(model), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await getGoogleAccessToken()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text:
              "You are the best available Gemini prompt strategist for TikTok Shop Malaysia product ads. Return strict JSON only. Your job is to design a problem-image prompt that will be sent to Imagen. You must protect credits by avoiding prompts likely to fail QA."
          }
        ]
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Create the FINAL Imagen prompt for a BEFORE/PROBLEM storyboard image.

Product name typed by seller: ${input.productName}
Product price: ${input.productPrice}
Seller's problem context: ${input.script.scene1_description}
Seller's solution context: ${input.script.scene2_description}
Selected visual style: ${getStylePrompt(input.style)}

Use the attached product image only to understand what product must NOT appear in the problem image. The problem image is not a catalog shot and not a product demo.

Core method:
- The product name is the primary category signal.
- Decide the buyer pain dynamically from product name + product image.
- Show the relatable problem BEFORE the solution.
- If showing the product category would reveal the solution, do not show it at all.
- If an old/bad generic object is useful, allow only an old plain generic version that is clearly not the uploaded product.
- For food, supplement, baby food, cereal, oat, drink powder, blender/juicer, fan/cooler, skincare, appliance, and any obvious solution object: exclude the product and exclude direct category clues in the problem image.
- Prefer an adult Malaysian working woman in a soft pastel pink hijab as the recurring character.
- For video safety, never include children, babies, toddlers, minors, child faces, or child bodies. Prefer adult-only problem scenes with neutral props.
- Avoid text, logos, labels, numbers, readable writing, brand marks, watermarks, fake letters, and packaging.
- Make it polished cute 3D cartoon, TikTok Shop Malaysia, full-bleed vertical 9:16, top caption space.

Hard QA goal:
The image should pass manual QA before video. It must clearly show the problem, but not accidentally show the solution/product.

Fallback draft from app, for reference only. Improve or replace it:
${draftPrompt}

Fallback negative prompt:
${draftNegativePrompt}

Return JSON only:
{
  "category": "short category",
  "buyer_pain": "one sentence",
  "image_prompt": "final detailed Imagen prompt in English, 500-1200 words, no markdown",
  "negative_prompt": "comma-separated negative prompt for Imagen",
  "qa_checklist": ["manual QA item 1", "manual QA item 2", "manual QA item 3", "manual QA item 4"],
  "blocked_objects": ["things that must not appear"]
}`
            },
            {
              inlineData: {
                mimeType: input.productImageMimeType,
                data: input.productImageBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 1800,
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    throw new Error(
      `Gemini prompt planner gagal (${model}). Status ${
        response.status
      }.${await readVertexError(response)}`
    );
  }

  const text = extractGeminiText(await response.json());

  try {
    return validPromptPlan(parseProblemPromptPlan(text));
  } catch {
    return coerceProblemPromptPlanFromText(text, draftNegativePrompt);
  }
}

async function planProblemPromptWithGemini(
  input: GenerateImagesInput,
  draftPrompt: string,
  draftNegativePrompt: string
) {
  if (process.env.GEMINI_PROBLEM_PROMPT_PLAN === "false") {
    return {
      imagePrompt: draftPrompt,
      negativePrompt: draftNegativePrompt,
      qaChecklist: [],
      blockedObjects: [],
      category: "fallback"
    };
  }

  const tryPlan = (model: string) =>
    requestProblemPromptPlanWithGemini(
      input,
      draftPrompt,
      draftNegativePrompt,
      model
    );

  try {
    return await tryPlan(geminiPromptModel);
  } catch (firstError) {
    await wait(20_000);

    try {
      return await tryPlan(geminiPromptModel);
    } catch (secondError) {
      if (
        geminiPromptFallbackModel &&
        geminiPromptFallbackModel !== geminiPromptModel
      ) {
        return await tryPlan(geminiPromptFallbackModel);
      }

      const message =
        secondError instanceof Error
          ? secondError.message
          : firstError instanceof Error
            ? firstError.message
            : "Gemini prompt planner gagal.";

      throw new Error(
        `${message} Tiada image dijana. Sistem sudah tunggu 20 saat dan retry sekali.`
      );
    }
  }
}

async function readVertexError(response: Response) {
  const text = await response.text();
  const compact = text.replace(/\s+/g, " ").trim();

  return compact ? ` ${compact.slice(0, 500)}` : "";
}

async function generateSingleImage(
  prompt: string,
  input: GenerateImagesInput,
  size: 512 | 1024,
  negativePrompt?: string
) {
  const response = await fetch(getVertexPredictUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await getGoogleAccessToken()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      instances: [
        {
          prompt
        }
      ],
      parameters: {
        sampleCount: 1,
        aspectRatio: "9:16",
        sampleImageSize: String(size),
        personGeneration: "allow_all",
        negativePrompt:
          negativePrompt ??
          "text, words, letters, numbers, captions, labels, logo, watermark, price tag, UI, poster layout, advertisement layout, speech bubble, signboard"
      }
    })
  });

  if (!response.ok) {
    throw new Error(
      `Imagen gagal jana preview. Status ${response.status}.${await readVertexError(
        response
      )}`
    );
  }

  const data = await response.json();
  const image = data?.predictions?.[0]?.bytesBase64Encoded;

  if (!image) {
    throw new Error("Imagen tidak pulangkan preview image.");
  }

  return `data:image/png;base64,${image}`;
}

function dataUrlToInlineData(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg));base64,(.+)$/);

  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    data: match[2]
  };
}

async function imageUrlToInlineData(imageUrl: string) {
  const inlineData = dataUrlToInlineData(imageUrl);

  if (inlineData) {
    return inlineData;
  }

  const response = await fetch(imageUrl);

  if (!response.ok) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "image/png";
  const mimeType = contentType.includes("jpeg") ? "image/jpeg" : "image/png";
  const bytes = Buffer.from(await response.arrayBuffer()).toString("base64");

  return {
    mimeType,
    data: bytes
  };
}

async function generateSingleImageWithGemini(
  prompt: string,
  input: GenerateImagesInput,
  referenceImageUrl?: string,
  includeProductReference = true,
  model = geminiImageModel
) {
  const referenceImage = referenceImageUrl
    ? await imageUrlToInlineData(referenceImageUrl)
    : null;
  const response = await fetch(getVertexGenerateImageUrl(model), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await getGoogleAccessToken()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            ...(includeProductReference
              ? [
                  {
                    inlineData: {
                      mimeType: input.productImageMimeType,
                      data: input.productImageBase64
                    }
                  }
                ]
              : []),
            ...(referenceImage
              ? [
                  {
                    inlineData: referenceImage
                  }
                ]
              : [])
          ]
        }
      ],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        temperature: 0.55,
        imageConfig: {
          aspectRatio: "9:16"
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(
      `Gemini image gagal jana preview. Status ${
        response.status
      } (${model}).${await readVertexError(response)}`
    );
  }

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find(
    (part: { inlineData?: { data?: string; mimeType?: string } }) =>
      part.inlineData?.data && part.inlineData?.mimeType?.startsWith("image/")
  );

  if (!imagePart?.inlineData?.data || !imagePart.inlineData.mimeType) {
    throw new Error("Gemini image tidak pulangkan image preview.");
  }

  return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
}

async function generateSingleImageWithGeminiFallback(
  prompt: string,
  input: GenerateImagesInput,
  referenceImageUrl?: string,
  includeProductReference = true
) {
  try {
    return await generateSingleImageWithGemini(
      prompt,
      input,
      referenceImageUrl,
      includeProductReference,
      geminiImageModel
    );
  } catch (primaryError) {
    if (geminiImageFallbackModel && geminiImageFallbackModel !== geminiImageModel) {
      return generateSingleImageWithGemini(
        prompt,
        input,
        referenceImageUrl,
        includeProductReference,
        geminiImageFallbackModel
      );
    }

    throw primaryError;
  }
}

async function generateSingleImageWithReferences(
  prompt: string,
  input: GenerateImagesInput,
  firstImageUrl?: string,
  negativePrompt?: string
) {
  const firstImage = firstImageUrl
    ? await imageUrlToInlineData(firstImageUrl)
    : null;
  const referenceImages = [
    {
      referenceType: "REFERENCE_TYPE_SUBJECT",
      referenceId: 1,
      referenceImage: {
        bytesBase64Encoded: input.productImageBase64
      },
      subjectImageConfig: {
        subjectType: "SUBJECT_TYPE_PRODUCT",
        subjectDescription: input.productName
      }
    },
    ...(firstImage
      ? [
          {
            referenceType: "REFERENCE_TYPE_SUBJECT",
            referenceId: 2,
            referenceImage: {
              bytesBase64Encoded: firstImage.data
            },
            subjectImageConfig: {
              subjectType: "SUBJECT_TYPE_PERSON",
              subjectDescription:
                "same stylized 3D human seller character and same 3D animation style"
            }
          }
        ]
      : [])
  ];
  const response = await fetch(getVertexReferencePredictUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await getGoogleAccessToken()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      instances: [
        {
          prompt,
          referenceImages
        }
      ],
      parameters: {
        sampleCount: 1,
        aspectRatio: "9:16",
        sampleImageSize: "1024",
        personGeneration: "allow_all",
        negativePrompt:
          negativePrompt ??
          "square image, horizontal image, landscape, text, words, letters, numbers, logo, brand mark, watermark, label, UI, poster, collage, split panel, product mascot, product with face, product with arms, product with legs"
      }
    })
  });

  if (!response.ok) {
    throw new Error(
      `Imagen reference gagal jana preview. Status ${
        response.status
      }.${await readVertexError(response)}`
    );
  }

  const data = await response.json();
  const image = data?.predictions?.[0]?.bytesBase64Encoded;

  if (!image) {
    throw new Error("Imagen reference tidak pulangkan image preview.");
  }

  return `data:image/png;base64,${image}`;
}

async function generateSingleImageWithProductReference(
  prompt: string,
  input: GenerateImagesInput,
  negativePrompt?: string
) {
  const response = await fetch(getVertexReferencePredictUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await getGoogleAccessToken()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      instances: [
        {
          prompt,
          referenceImages: [
            {
              referenceType: "REFERENCE_TYPE_SUBJECT",
              referenceId: 1,
              referenceImage: {
                bytesBase64Encoded: input.productImageBase64
              },
              subjectImageConfig: {
                subjectType: "SUBJECT_TYPE_PRODUCT",
                subjectDescription: input.productName
              }
            }
          ]
        }
      ],
      parameters: {
        sampleCount: 1,
        aspectRatio: "9:16",
        sampleImageSize: "1024",
        personGeneration: "allow_all",
        negativePrompt:
          negativePrompt ??
          "3D, cartoon, animation, clay, toy, illustration, anime, CGI, text, words, letters, readable writing, logo, watermark, brand name, label, packaging text, UI, poster, split panel, collage, border, square image, landscape image"
      }
    })
  });

  if (!response.ok) {
    throw new Error(
      `Imagen reference gagal jana realistic image. Status ${
        response.status
      }.${await readVertexError(response)}`
    );
  }

  const data = await response.json();
  const image = data?.predictions?.[0]?.bytesBase64Encoded;

  if (!image) {
    throw new Error("Imagen reference tidak pulangkan realistic image.");
  }

  return `data:image/png;base64,${image}`;
}

export async function generateImagesWithImagen(
  input: GenerateImagesInput
): Promise<GeneratedImages> {
  const size = 1024;

  if (isEnabled(process.env.IMAGEN_MOCK)) {
    return {
      problemImageUrl: svgDataUrl("Problem", input.script.scene1_description),
      solutionImageUrl: svgDataUrl("Solution", input.script.scene2_description),
      size,
      creditBurned: false
    };
  }

  const problemPlan = await planAutoPromptWithGemini(input, "problem");
  const problemImageUrl = await generateImageWithGeminiRetry(
    problemPlan.imagePrompt,
    input,
    undefined,
    true
  );
  const solutionPlan = await planAutoPromptWithGemini(
    input,
    "solution",
    problemImageUrl
  );
  const solutionImageUrl = await generateImageWithGeminiRetry(
    solutionPlan.imagePrompt,
    input,
    problemImageUrl,
    true,
    { maxAttempts: 4, retryDelayMs: 20_000 }
  );

  return {
    problemImageUrl,
    solutionImageUrl,
    problemPromptUsed: problemPlan.imagePrompt,
    solutionPromptUsed: solutionPlan.imagePrompt,
    problemVideoPrompt: problemPlan.videoPrompt,
    solutionVideoPrompt: solutionPlan.videoPrompt,
    size,
    creditBurned: false
  };
}

export async function generateProblemImageWithImagen(
  input: GenerateImagesInput
): Promise<GeneratedProblemImage> {
  const size = 1024;

  if (isEnabled(process.env.IMAGEN_MOCK)) {
    return {
      problemImageUrl: svgDataUrl("Problem", input.script.scene1_description),
      size,
      creditBurned: false
    };
  }

  const problemPlan = await planAutoPromptWithGemini(input, "problem");
  const problemImageUrl = await generateImageWithGeminiRetry(
    problemPlan.imagePrompt,
    input,
    undefined,
    true
  );

  return {
    problemImageUrl,
    problemPromptUsed: problemPlan.imagePrompt,
    problemVideoPrompt: problemPlan.videoPrompt,
    size,
    creditBurned: false
  };
}

export async function generateSolutionImageWithImagen(
  input: GenerateImagesInput,
  problemImageUrl: string
): Promise<GeneratedSolutionImage> {
  const size = 1024;

  if (isEnabled(process.env.IMAGEN_MOCK)) {
    return {
      solutionImageUrl: svgDataUrl("Solution", input.script.scene2_description),
      size,
      creditBurned: false
    };
  }

  const solutionPlan = await planAutoPromptWithGemini(
    input,
    "solution",
    problemImageUrl
  );
  const solutionImageUrl = await generateImageWithGeminiRetry(
    solutionPlan.imagePrompt,
    input,
    problemImageUrl,
    true,
    { maxAttempts: 4, retryDelayMs: 20_000 }
  );

  return {
    solutionImageUrl,
    solutionPromptUsed: solutionPlan.imagePrompt,
    solutionVideoPrompt: solutionPlan.videoPrompt,
    size,
    creditBurned: false
  };
}

export async function generateManualImageWithImagen(
  input: GenerateImagesInput,
  prompt: string
): Promise<GeneratedManualImage> {
  const size = 1024;
  const trimmedPrompt = prompt.trim();

  if (!trimmedPrompt) {
    throw new Error("Prompt manual wajib diisi.");
  }

  if (trimmedPrompt.length < 30) {
    throw new Error("Prompt manual terlalu pendek.");
  }

  if (isEnabled(process.env.IMAGEN_MOCK)) {
    return {
      imageUrl: svgDataUrl("Manual", trimmedPrompt),
      size,
      creditBurned: false
    };
  }

  const imageUrl = await generateImageWithGeminiRetry(
    trimmedPrompt,
    input,
    undefined,
    true
  );

  return {
    imageUrl,
    size,
    creditBurned: false
  };
}

export async function generateRealisticSceneImageWithImagen(
  input: GenerateImagesInput,
  scenePrompt: string
): Promise<GeneratedManualImage> {
  const size = 1024;
  const trimmedPrompt = scenePrompt.trim();

  if (!trimmedPrompt) {
    throw new Error("Prompt scene wajib diisi.");
  }

  if (trimmedPrompt.length < 20) {
    throw new Error("Prompt scene terlalu pendek.");
  }

  if (isEnabled(process.env.IMAGEN_MOCK)) {
    return {
      imageUrl: svgDataUrl("Realistic", trimmedPrompt),
      size,
      creditBurned: false,
      promptUsed: trimmedPrompt
    };
  }

  const plannedPrompt = await planRealisticScenePromptWithGemini(
    input,
    trimmedPrompt
  );
  const imageUrl = await generateImageWithGeminiRetry(
    plannedPrompt,
    input,
    undefined,
    true
  );

  return {
    imageUrl,
    size,
    creditBurned: false,
    promptUsed: plannedPrompt
  };
}

export async function generateReferencePromptImageWithImagen(
  input: GenerateImagesInput,
  prompt: string
): Promise<GeneratedManualImage> {
  const trimmedPrompt = prompt.trim();

  if (!trimmedPrompt) {
    throw new Error("Prompt image wajib diisi.");
  }

  if (trimmedPrompt.length < 10) {
    throw new Error("Prompt image terlalu pendek.");
  }

  if (isEnabled(process.env.IMAGEN_MOCK)) {
    return {
      imageUrl: svgDataUrl("QA", trimmedPrompt),
      size: 1024,
      creditBurned: false,
      promptUsed: trimmedPrompt
    };
  }

  const imageUrl = await generateImageWithGeminiRetry(
    trimmedPrompt,
    input,
    undefined,
    true
  );

  return {
    imageUrl,
    size: 1024,
    creditBurned: false,
    promptUsed: trimmedPrompt
  };
}
