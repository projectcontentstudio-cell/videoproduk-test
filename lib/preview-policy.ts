import type { PreviewPolicy } from "./render-types";

export const freePreviewPolicy: PreviewPolicy = {
  watermarked: true,
  downloadable: false,
  message: "Preview percuma ada watermark dan tidak boleh dimuat turun."
};
