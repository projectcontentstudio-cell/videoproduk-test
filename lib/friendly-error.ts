export function getFriendlyErrorMessage(error: unknown, fallback: string) {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : fallback;
  const lower = message.toLowerCase();

  if (
    lower.includes("401") ||
    lower.includes("unauthenticated") ||
    lower.includes("invalid authentication") ||
    lower.includes("access_token_type_unsupported") ||
    lower.includes("token")
  ) {
    return "Token Google tamat atau tidak valid. Update token dan cuba lagi.";
  }

  if (
    lower.includes("429") ||
    lower.includes("resource exhausted") ||
    lower.includes("quota")
  ) {
    return "Kuota atau server AI sedang penuh. Cuba lagi sebentar lagi.";
  }

  if (
    lower.includes("high load") ||
    lower.includes("busy") ||
    lower.includes("try again later")
  ) {
    return "Server AI sedang sibuk. Cuba lagi sebentar lagi.";
  }

  if (lower.includes("safety") || lower.includes("blocked")) {
    return "Prompt kena block safety. Cuba guna scene dewasa dan lebih neutral.";
  }

  if (lower.includes("not found") || lower.includes("404")) {
    return "Model AI tidak tersedia untuk project ini. Semak setting model.";
  }

  if (message.length > 180 || message.includes("{") || message.includes("}")) {
    return fallback;
  }

  return message;
}
