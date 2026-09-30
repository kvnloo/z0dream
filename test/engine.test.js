import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DreamStore } from "../src/store.js";
import { MockImageProvider } from "../src/providers/mock.js";
import { DreamEngine } from "../src/dream-engine.js";

async function harness(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "z0dream-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new DreamStore(dir);
  await store.init();
  return new DreamEngine({ store, provider: new MockImageProvider({ store }), publicBaseUrl: "https://dream.test" });
}

test("creates a root dream with one layer", async (t) => {
  const engine = await harness(t);
  const dream = await engine.createDream({ prompt: "a city inside a pearl" });
  assert.match(dream.id, /^dream_/);
  assert.equal(dream.nodes.length, 1);
  assert.equal(dream.nodes[0].depth, 0);
  assert.equal(dream.nodes[0].image.url, `https://dream.test/assets/${dream.id}/root.svg`);
  assert.equal(dream.stats.maxDepth, 0);
});

test("dream deeper nests into the deepest existing region", async (t) => {
  const engine = await harness(t);
  let dream = await engine.createDream({ prompt: "a clockwork forest" });
  dream = await engine.dreamDeeper({ dreamId: dream.id, region: { x: .25, y: .25, width: .25, height: .25 } });
  const first = dream.nodes.at(-1);
  assert.equal(first.depth, 1);
  assert.equal(first.parentId, "root");
  assert.equal(dream.stats.peakEquivalentPixels, 16777216);

  dream = await engine.dreamDeeper({ dreamId: dream.id, region: { x: .3, y: .3, width: .0625, height: .0625 } });
  const second = dream.nodes.at(-1);
  assert.equal(second.depth, 2);
  assert.equal(second.parentId, first.id);
  assert.equal(dream.stats.peakEquivalentPixels, 268435456);
});

test("three quarter-scale recursive dives cross one gigapixel equivalent", async (t) => {
  const engine = await harness(t);
  let dream = await engine.createDream({ prompt: "infinite museum" });
  for (const region of [
    { x: .25, y: .25, width: .25, height: .25 },
    { x: .30, y: .30, width: .0625, height: .0625 },
    { x: .31, y: .31, width: .015625, height: .015625 },
  ]) {
    if (region.width < .02) continue;
    dream = await engine.dreamDeeper({ dreamId: dream.id, region });
  }
  dream = await engine.dreamDeeper({ dreamId: dream.id, region: { x: .305, y: .305, width: .02, height: .02 } });
  assert.ok(dream.stats.peakEquivalentPixels > 1_000_000_000);
});
