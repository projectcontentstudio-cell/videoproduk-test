import { Queue } from "bullmq";
import type { RenderJobPayload, RenderJobResult } from "./render-types";

export const renderQueueName = "video-render";
export const renderFinalVideoJobName = "render-final-video";

let queue: Queue<
  RenderJobPayload,
  RenderJobResult,
  typeof renderFinalVideoJobName,
  RenderJobPayload,
  RenderJobResult,
  typeof renderFinalVideoJobName
> | null = null;

function getRedisConnectionOptions(url: string) {
  const parsed = new URL(url);

  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    maxRetriesPerRequest: null
  };
}

export function getRenderQueue() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error("REDIS_URL belum ditetapkan.");
  }

  queue ??= new Queue<
    RenderJobPayload,
    RenderJobResult,
    typeof renderFinalVideoJobName,
    RenderJobPayload,
    RenderJobResult,
    typeof renderFinalVideoJobName
  >(renderQueueName, {
    connection: getRedisConnectionOptions(redisUrl),
    defaultJobOptions: {
      attempts: 1,
      backoff: {
        type: "exponential",
        delay: 3000
      },
      removeOnComplete: {
        age: 60 * 60 * 24,
        count: 100
      },
      removeOnFail: {
        age: 60 * 60 * 24 * 3
      }
    }
  });

  return queue;
}
