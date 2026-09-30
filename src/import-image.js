import path from "node:path";
import sharp from "sharp";

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export async function importRootImage({ store, dreamId, nodeId = "root", file }) {
  if (!file || typeof file !== "object") throw new Error("image file is required");
  if (!String(file.file_id || "").startsWith("file_")) throw new Error("invalid ChatGPT file id");
  const url = new URL(file.download_url);
  if (url.protocol !== "https:") throw new Error("image download URL must use HTTPS");
  if (file.mime_type && !ALLOWED_MIME.has(file.mime_type)) throw new Error(`unsupported image type: ${file.mime_type}`);

  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`image download failed (${response.status})`);
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > MAX_BYTES) throw new Error("image is larger than 25 MB");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_BYTES) throw new Error("image is larger than 25 MB");

  const dir = await store.ensureDreamDir(dreamId);
  const filename = `${nodeId}.png`;
  await sharp(buffer, { animated: false })
    .rotate()
    .resize(1024, 1024, { fit: "contain", background: { r: 8, g: 8, b: 11, alpha: 1 } })
    .png()
    .toFile(path.join(dir, filename));
  return { filename, mimeType: "image/png", width: 1024, height: 1024 };
}
