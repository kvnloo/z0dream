import { randomUUID } from "node:crypto";
import { chooseDeepestContainingNode, equivalentPixels, formatPixels, localizeRegion, normalizeRegion } from "./geometry.js";

export class DreamEngine {
  constructor({ store, provider, publicBaseUrl = "http://localhost:8787" }) {
    this.store = store;
    this.provider = provider;
    this.publicBaseUrl = publicBaseUrl.replace(/\/$/, "");
  }

  async createDream({ prompt, title }) {
    const cleanPrompt = this.#cleanPrompt(prompt);
    return this.#createWithRoot({
      prompt: cleanPrompt,
      title,
      providerName: this.provider.name,
      rootFactory: ({ dreamId, nodeId }) => this.provider.generateRoot({ dreamId, nodeId, prompt: cleanPrompt }),
    });
  }

  async createDreamFromImage({ prompt = "Imported image", title, rootFactory }) {
    const cleanPrompt = this.#cleanPrompt(prompt || "Imported image");
    if (typeof rootFactory !== "function") throw new Error("root image importer is required");
    return this.#createWithRoot({
      prompt: cleanPrompt,
      title: title || "Imported dream",
      providerName: `imported+${this.provider.name}`,
      rootFactory,
    });
  }

  async dreamDeeper({ dreamId, region, prompt = "" }) {
    const dream = await this.store.get(dreamId);
    if (dream.nodes.length >= 24) throw new Error("this dream reached the v0 node limit (24)");
    const rootRegion = normalizeRegion(region);
    const parent = chooseDeepestContainingNode(dream.nodes, rootRegion);
    const localRegion = localizeRegion(rootRegion, parent.rootBounds);
    const depth = parent.depth + 1;
    const nodeId = `n${dream.nodes.length}_${randomUUID().slice(0, 6)}`;
    const effectivePrompt = String(prompt || dream.prompt).trim().slice(0, 4000);
    const image = await this.provider.generateDeeper({
      dreamId,
      nodeId,
      prompt: effectivePrompt,
      parent,
      localRegion,
      rootRegion,
      depth,
    });
    const child = this.#node({ id: nodeId, parentId: parent.id, depth, prompt: effectivePrompt, rootBounds: rootRegion, image });
    dream.nodes.push(child);
    dream.updatedAt = new Date().toISOString();
    await this.store.save(dream);
    return this.present(dream);
  }

  async getDream(dreamId) {
    return this.present(await this.store.get(dreamId));
  }

  present(dream) {
    const nodes = dream.nodes.map((node) => ({
      ...node,
      image: { ...node.image, url: this.#assetUrl(dream.id, node.image.filename) },
    }));
    const peak = nodes.reduce((max, node) => Math.max(max, node.equivalentPixels), 0);
    return {
      ...dream,
      nodes,
      stats: {
        nodeCount: nodes.length,
        maxDepth: Math.max(...nodes.map((n) => n.depth)),
        peakEquivalentPixels: peak,
        peakEquivalentLabel: formatPixels(peak),
      },
    };
  }

  async #createWithRoot({ prompt, title, providerName, rootFactory }) {
    const id = `dream_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
    const nodeId = "root";
    const image = await rootFactory({ dreamId: id, nodeId });
    const now = new Date().toISOString();
    const rootBounds = { x: 0, y: 0, width: 1, height: 1 };
    const root = this.#node({ id: nodeId, parentId: null, depth: 0, prompt, rootBounds, image });
    const dream = {
      id, title: String(title || prompt).slice(0, 80), prompt, provider: providerName,
      createdAt: now, updatedAt: now, nodes: [root],
    };
    await this.store.save(dream);
    return this.present(dream);
  }

  #cleanPrompt(prompt) {
    const cleanPrompt = String(prompt || "").trim();
    if (!cleanPrompt) throw new Error("prompt is required");
    if (cleanPrompt.length > 4000) throw new Error("prompt is too long");
    return cleanPrompt;
  }

  #assetUrl(dreamId, filename) {
    return `${this.publicBaseUrl}/assets/${encodeURIComponent(dreamId)}/${encodeURIComponent(filename)}`;
  }

  #node({ id, parentId, depth, prompt, rootBounds, image }) {
    return {
      id,
      parentId,
      depth,
      prompt,
      rootBounds,
      image,
      equivalentPixels: equivalentPixels(image.width, image.height, rootBounds),
      createdAt: new Date().toISOString(),
    };
  }
}
