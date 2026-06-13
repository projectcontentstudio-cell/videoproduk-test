# videoproduk.my MVP

Next.js app untuk jana skrip, image preview, dan video produk pendek.

## Local

```bash
npm install
npm run dev
```

## Environment

Jangan commit `.env.local`. Untuk Vercel, masukkan secret di:

```text
Vercel Project > Settings > Environment Variables
```

Variables utama:

```text
APP_PASSWORD=
GOOGLE_CLOUD_PROJECT_ID=
GOOGLE_CLOUD_REGION=asia-southeast1
GOOGLE_SERVICE_ACCOUNT_JSON=
GOOGLE_AUTH_METHOD=service-account

GEMINI_MODEL=gemini-2.5-flash
GEMINI_PROMPT_MODEL=gemini-2.5-flash
GEMINI_PROMPT_REGION=us-central1
GEMINI_IMAGE_REGION=us-central1
GEMINI_IMAGE_MODEL=gemini-2.5-flash-image
GEMINI_IMAGE_FALLBACK_MODEL=gemini-2.5-flash-image

VEO_REGION=us-central1
VEO_MODEL=veo-3.1-lite-generate-001
VIDEO_RENDER_MOCK=false
IMAGEN_MOCK=false

REDIS_URL=
```

Auth Google sekarang guna service account dahulu jika `GOOGLE_SERVICE_ACCOUNT_JSON` ada. Paste JSON service account sebagai satu env value di Vercel. `GOOGLE_VERTEX_ACCESS_TOKEN` masih boleh digunakan sebagai fallback token 1 jam, atau paksa dengan `GOOGLE_AUTH_METHOD=access-token`.

## Deploy Vercel

1. Push repo ke GitHub.
2. Import repo dalam Vercel.
3. Tambah environment variables di atas.
4. Deploy.

Nota penting: generated image/video sekarang disimpan dalam temp runtime storage supaya deploy awal boleh jalan. Untuk production serius, pindahkan media output ke durable storage seperti Vercel Blob, Google Cloud Storage, atau Supabase Storage.
