import path from "node:path";
import { DreamEngine } from "./dream-engine.js";
import { DreamStore } from "./store.js";
import { MockImageProvider } from "./providers/mock.js";
import { OpenAIImageProvider } from "./providers/openai.js";

export async function createEngine() {
  const store = new DreamStore(path.resolve("storage"));
  await store.init();
  const providerName = (process.env.Z0DREAM_PROVIDER || "mock").toLowerCase();
  const provider = providerName === "openai"
    ? new OpenAIImageProvider({ store })
    : new MockImageProvider({ store });
  return new DreamEngine({
    store,
    provider,
    publicBaseUrl: process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 8787}`,
  });
}
