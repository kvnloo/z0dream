import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export class DreamStore {
  constructor(root = path.resolve("storage")) {
    this.root = root;
    this.dreamsDir = path.join(root, "dreams");
  }

  async init() {
    await mkdir(this.dreamsDir, { recursive: true });
  }

  dreamDir(id) {
    assertSafeId(id);
    return path.join(this.dreamsDir, id);
  }

  async ensureDreamDir(id) {
    const dir = this.dreamDir(id);
    await mkdir(dir, { recursive: true });
    return dir;
  }

  async save(dream) {
    const dir = await this.ensureDreamDir(dream.id);
    await writeFile(path.join(dir, "dream.json"), JSON.stringify(dream, null, 2));
    return dream;
  }

  async get(id) {
    const raw = await readFile(path.join(this.dreamDir(id), "dream.json"), "utf8");
    return JSON.parse(raw);
  }
}

export function assertSafeId(id) {
  if (!/^[a-zA-Z0-9_-]+$/.test(String(id))) throw new Error("invalid id");
}
