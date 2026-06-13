import { getGoogleAccessToken } from "./google-auth";

export type ProductAnalysis = {
  productType: string;
  visibleName: string;
  colors: string[];
  shape: string;
  keyFeatures: string[];
  usageFacts: string[];
  mustPreserve: string[];
  avoidMistakes: string[];
  searchMatched: boolean;
  confidence: "low" | "medium" | "high";
  summary: string;
};

export type AnalyzeProductInput = {
  productImageBase64: string;
  productImageMimeType: "image/jpeg" | "image/png";
};

const productAnalysisModel =
  process.env.GEMINI_PRODUCT_ANALYSIS_MODEL ??
  process.env.GEMINI_MODEL ??
  "gemini-2.5-flash";

function getVertexGenerateContentUrl() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const region = process.env.GOOGLE_CLOUD_REGION ?? "asia-southeast1";

  if (!projectId) {
    throw new Error("GOOGLE_CLOUD_PROJECT_ID belum ditetapkan.");
  }

  return `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${productAnalysisModel}:generateContent`;
}

async function readVertexError(response: Response) {
  const text = await response.text();
  const compact = text.replace(/\s+/g, " ").trim();

  return compact ? ` ${compact.slice(0, 500)}` : "";
}

function parseJsonText(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  return JSON.parse(cleaned) as Partial<ProductAnalysis>;
}

function normalizeList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeAnalysis(value: Partial<ProductAnalysis>): ProductAnalysis {
  return {
    productType: value.productType?.trim() || "Produk tidak pasti",
    visibleName: value.visibleName?.trim() || "",
    colors: normalizeList(value.colors),
    shape: value.shape?.trim() || "",
    keyFeatures: normalizeList(value.keyFeatures),
    usageFacts: normalizeList(value.usageFacts),
    mustPreserve: normalizeList(value.mustPreserve),
    avoidMistakes: normalizeList(value.avoidMistakes),
    searchMatched: Boolean(value.searchMatched),
    confidence:
      value.confidence === "low" ||
      value.confidence === "medium" ||
      value.confidence === "high"
        ? value.confidence
        : "medium",
    summary: value.summary?.trim() || ""
  };
}

export function stringifyProductAnalysis(analysis?: ProductAnalysis | null) {
  if (!analysis) {
    return "";
  }

  const lines = [
    `Product type: ${analysis.productType}`,
    analysis.visibleName ? `Visible name/text: ${analysis.visibleName}` : "",
    analysis.colors.length ? `Colors: ${analysis.colors.join(", ")}` : "",
    analysis.shape ? `Shape/form: ${analysis.shape}` : "",
    analysis.keyFeatures.length
      ? `Key visible features: ${analysis.keyFeatures.join("; ")}`
      : "",
    analysis.usageFacts.length
      ? `Usage/power facts: ${analysis.usageFacts.join("; ")}`
      : "",
    analysis.mustPreserve.length
      ? `Must preserve: ${analysis.mustPreserve.join("; ")}`
      : "",
    analysis.avoidMistakes.length
      ? `Avoid mistakes: ${analysis.avoidMistakes.join("; ")}`
      : "",
    `Search matched: ${analysis.searchMatched ? "yes" : "no"}`,
    `Confidence: ${analysis.confidence}`,
    analysis.summary ? `Summary: ${analysis.summary}` : ""
  ].filter(Boolean);

  return lines.join("\n");
}

export async function analyzeProductWithGemini(input: AnalyzeProductInput) {
  async function parseResponse(response: Response) {
    if (!response.ok) {
      throw new Error(
        `Analisis produk gagal. Status ${response.status}.${await readVertexError(
          response
        )}`
      );
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text || typeof text !== "string" || !text.trim()) {
      throw new Error("Analisis produk tidak pulangkan teks.");
    }

    return normalizeAnalysis(parseJsonText(text));
  }

  function fallbackAnalysis(): ProductAnalysis {
    return {
      productType: "Produk daripada gambar upload",
      visibleName: "",
      colors: [],
      shape: "",
      keyFeatures: [],
      usageFacts: [],
      mustPreserve: [
        "Ikut rupa produk dalam gambar upload sebagai rujukan utama"
      ],
      avoidMistakes: [
        "Jangan tambah ciri produk yang tidak jelas kelihatan"
      ],
      searchMatched: false,
      confidence: "low",
      summary:
        "Semakan automatik tidak lengkap, jadi sistem akan guna gambar upload sebagai rujukan utama."
    };
  }

  async function requestAnalysis(useGoogleSearch: boolean) {
    return fetch(getVertexGenerateContentUrl(), {
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
                "You analyze product reference images for TikTok Shop creative generation. Return strict JSON only. Be conservative. Do not invent invisible features. If no cable is visible, say no visible cable instead of assuming wired. If a product appears portable/rechargeable, include that as a fact and add avoidMistakes such as no power cable/wall plug when appropriate. If Google Search is available, use it only to confirm visible brand/name/model facts, not to invent details."
            }
          ]
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Analyze this product image so future image/video prompts do not misrepresent the product.

If readable text, brand, model, or packaging detail is visible, use Google Search to match or confirm likely public product details. If no reliable text is visible, do visual analysis only and set searchMatched false.

Return JSON only:
{
  "productType": "specific product category",
  "visibleName": "any readable product/brand/model text if visible, else empty string",
  "colors": ["dominant visible colors"],
  "shape": "short description of the physical shape/form factor",
  "keyFeatures": ["visible physical features only"],
  "usageFacts": ["facts such as portable, rechargeable, battery powered, no visible cable, spray bottle, pouch packaging, etc"],
  "mustPreserve": ["details future prompts must preserve"],
  "avoidMistakes": ["wrong things future prompts must not add, such as cable/wall plug if not visible"],
  "searchMatched": true or false,
  "confidence": "low" | "medium" | "high",
  "summary": "one short Malay summary for seller"
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
        ...(useGoogleSearch ? { tools: [{ googleSearch: {} }] } : {}),
        generationConfig: {
          temperature: 0.15,
          maxOutputTokens: 900,
          responseMimeType: "application/json"
        }
      })
    });
  }

  try {
    return await parseResponse(await requestAnalysis(true));
  } catch {
    try {
      return await parseResponse(await requestAnalysis(false));
    } catch {
      return fallbackAnalysis();
    }
  }
}
