import { writeFile } from "node:fs/promises";
import path from "node:path";
import OpenAI, { toFile } from "openai";
import sharp from "sharp";

const SIZE = 1024;

function dataFromResult(result) {
  const item = result?.data?.[0];
  if (!item?.b64_json) throw new Error("image provider returned no image data");
  return Buffer.from(item.b64_json, "base64");
}

export class OpenAIImageProvider {
  constructor({ store, model = process.env.Z0DREAM_IMAGE_MODEL || "gpt-image-2.5-sunburst" }) {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for Z0DREAM_PROVIDER=openai");
    this.store = store;
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.model = model;
    this.name = "openai";
  }

  async generateRoot({ dreamId, nodeId, prompt }) {
    const result = await this.client.images.generate({
      model: this.model,
      prompt: `${prompt}\n\nCompose this as an exceptionally coherent, detail-rich image designed for recursive zooming. Preserve clear local structure and many plausible micro-scenes.`,
      size: "1024x1024",
      quality: "high",
    });
    return this.#writePng(dreamId, nodeId, dataFromResult(result));
  }

  async generateDeeper({ dreamId, nodeId, prompt, parent, localRegion, depth }) {
    const parentPath = path.join(this.store.root, "dreams", dreamId, parent.image.filename);
    const meta = await sharp(parentPath).metadata();
    const width = meta.width || SIZE;
    const height = meta.height || SIZE;
    const left = Math.max(0, Math.floor(localRegion.x * width));
    const top = Math.max(0, Math.floor(localRegion.y * height));
    const cropWidth = Math.max(1, Math.min(width - left, Math.floor(localRegion.width * width)));
    const cropHeight = Math.max(1, Math.min(height - top, Math.floor(localRegion.height * height)));

    const crop = await sharp(parentPath)
      .extract({ left, top, width: cropWidth, height: cropHeight })
      .resize(SIZE, SIZE, { fit: "fill" })
      .png()
      .toBuffer();

    const result = await this.client.images.edit({
      model: this.model,
      image: await toFile(crop, `zoom-${depth}.png`, { type: "image/png" }),
      prompt: [
        "This image is a magnified crop from a larger scene. Render the SAME place as if the camera resolved dramatically more genuine detail.",
        "Preserve geometry, lighting, palette, object identity, and boundary continuity. Do not redesign the scene.",
        "Add physically plausible detail that would become visible at this zoom level.",
        prompt ? `User intent: ${prompt}` : "",
      ].filter(Boolean).join("\n"),
      size: "1024x1024",
      quality: "high",
    });

    return this.#writePng(dreamId, nodeId, dataFromResult(result));
  }

  async #writePng(dreamId, nodeId, buffer) {
    const dir = await this.store.ensureDreamDir(dreamId);
    const filename = `${nodeId}.png`;
    await writeFile(path.join(dir, filename), buffer);
    return { filename, mimeType: "image/png", width: SIZE, height: SIZE };
  }
}
