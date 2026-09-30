import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseDeepestContainingNode,
  equivalentPixels,
  localizeRegion,
  normalizeRegion,
  projectRegion,
} from "../src/geometry.js";

test("normalizeRegion clamps to root bounds", () => {
  const r = normalizeRegion({ x: .9, y: .8, width: .5, height: .5 });
  assert.equal(r.x, .9);
  assert.equal(r.y, .8);
  assert.ok(Math.abs(r.width - .1) < 1e-10);
  assert.ok(Math.abs(r.height - .2) < 1e-10);
});

test("normalizeRegion rejects microscopic selections", () => {
  assert.throws(() => normalizeRegion({ x: .2, y: .2, width: .01, height: .2 }), /too small/);
});

test("localize/project round trip", () => {
  const parent = { x: .25, y: .25, width: .5, height: .5 };
  const root = { x: .375, y: .4, width: .125, height: .2 };
  const local = localizeRegion(root, parent);
  const projected = projectRegion(parent, local);
  for (const key of ["x", "y", "width", "height"]) assert.ok(Math.abs(projected[key] - root[key]) < 1e-10);
});

test("deepest containing node wins", () => {
  const nodes = [
    { id: "root", depth: 0, rootBounds: { x: 0, y: 0, width: 1, height: 1 } },
    { id: "child", depth: 1, rootBounds: { x: .2, y: .2, width: .4, height: .4 } },
  ];
  assert.equal(chooseDeepestContainingNode(nodes, { x: .3, y: .3, width: .1, height: .1 }).id, "child");
});

test("equivalent pixels grows as covered root area shrinks", () => {
  assert.equal(equivalentPixels(1024, 1024, { x: 0, y: 0, width: 1, height: 1 }), 1048576);
  assert.equal(equivalentPixels(1024, 1024, { x: 0, y: 0, width: .25, height: .25 }), 16777216);
  assert.equal(equivalentPixels(1024, 1024, { x: 0, y: 0, width: .0625, height: .0625 }), 268435456);
});
