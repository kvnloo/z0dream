import { writeFile } from "node:fs/promises";
import path from "node:path";

const SIZE = 1024;

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function hashString(value) {
  let h = 2166136261;
  for (const ch of String(value)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mockSvg({ prompt, depth, nodeId }) {
  const seed = hashString(`${prompt}|${depth}|${nodeId}`);
  const hue = seed % 360;
  const hue2 = (hue + 68 + depth * 17) % 360;
  const circles = Array.from({ length: 44 + depth * 18 }, (_, i) => {
    const s = hashString(`${seed}:${i}`);
    const x = 40 + (s % 944);
    const y = 40 + ((s >>> 7) % 944);
    const r = 3 + ((s >>> 15) % (28 + depth * 6));
    const op = 0.12 + ((s % 60) / 100);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="hsla(${(hue + i * 13) % 360},90%,72%,${op.toFixed(2)})"/>`;
  }).join("");
  const grid = 32 / Math.max(1, depth + 1);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue},55%,9%)"/><stop offset="1" stop-color="hsl(${hue2},62%,15%)"/>
    </linearGradient>
    <pattern id="grid" width="${grid}" height="${grid}" patternUnits="userSpaceOnUse">
      <path d="M ${grid} 0 L 0 0 0 ${grid}" fill="none" stroke="rgba(255,255,255,.055)" stroke-width="1"/>
    </pattern>
    <filter id="glow"><feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <rect width="1024" height="1024" fill="url(#grid)"/>
  ${circles}
  <g filter="url(#glow)">
    <path d="M90 ${760-depth*22} C270 ${360+depth*19}, 570 ${860-depth*31}, 936 ${220+depth*27}" fill="none" stroke="hsla(${hue2},90%,72%,.66)" stroke-width="${10+depth*2}"/>
  </g>
  <rect x="54" y="54" width="916" height="916" rx="42" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="2"/>
  <text x="70" y="910" fill="white" font-family="ui-monospace, monospace" font-size="26" opacity=".95">${escapeXml(prompt.slice(0, 58))}</text>
  <text x="70" y="950" fill="white" font-family="ui-monospace, monospace" font-size="18" opacity=".55">z0dream · depth ${depth} · ${escapeXml(nodeId)}</text>
</svg>`;
}

export class MockImageProvider {
  constructor({ store }) {
    this.store = store;
    this.name = "mock";
  }

  async generateRoot({ dreamId, nodeId, prompt }) {
    return this.#writeSvg({ dreamId, nodeId, prompt, depth: 0 });
  }

  async generateDeeper({ dreamId, nodeId, prompt, depth }) {
    return this.#writeSvg({ dreamId, nodeId, prompt, depth });
  }

  async #writeSvg({ dreamId, nodeId, prompt, depth }) {
    const dir = await this.store.ensureDreamDir(dreamId);
    const filename = `${nodeId}.svg`;
    await writeFile(path.join(dir, filename), mockSvg({ prompt, depth, nodeId }), "utf8");
    return { filename, mimeType: "image/svg+xml", width: SIZE, height: SIZE };
  }
}
