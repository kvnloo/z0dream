const EPS = 1e-9;

export function normalizeRegion(input) {
  if (!input || typeof input !== "object") throw new Error("region is required");
  let x = Number(input.x);
  let y = Number(input.y);
  let width = Number(input.width);
  let height = Number(input.height);
  if (![x, y, width, height].every(Number.isFinite)) throw new Error("region values must be finite numbers");
  if (width <= 0 || height <= 0) throw new Error("region width and height must be positive");

  x = clamp(x, 0, 1);
  y = clamp(y, 0, 1);
  width = Math.min(width, 1 - x);
  height = Math.min(height, 1 - y);
  if (width < 0.02 || height < 0.02) throw new Error("region is too small; minimum width/height is 0.02");
  return { x, y, width, height };
}

export function contains(outer, inner) {
  return (
    inner.x + EPS >= outer.x &&
    inner.y + EPS >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width + EPS &&
    inner.y + inner.height <= outer.y + outer.height + EPS
  );
}

export function area(region) {
  return region.width * region.height;
}

export function localizeRegion(rootRegion, parentRootBounds) {
  if (!contains(parentRootBounds, rootRegion)) throw new Error("region is outside parent bounds");
  return {
    x: (rootRegion.x - parentRootBounds.x) / parentRootBounds.width,
    y: (rootRegion.y - parentRootBounds.y) / parentRootBounds.height,
    width: rootRegion.width / parentRootBounds.width,
    height: rootRegion.height / parentRootBounds.height,
  };
}

export function projectRegion(parentRootBounds, localRegion) {
  return {
    x: parentRootBounds.x + localRegion.x * parentRootBounds.width,
    y: parentRootBounds.y + localRegion.y * parentRootBounds.height,
    width: localRegion.width * parentRootBounds.width,
    height: localRegion.height * parentRootBounds.height,
  };
}

export function chooseDeepestContainingNode(nodes, region) {
  const candidates = nodes.filter((node) => contains(node.rootBounds, region));
  if (!candidates.length) throw new Error("no node contains selected region");
  return candidates.sort((a, b) => {
    if ((b.depth ?? 0) !== (a.depth ?? 0)) return (b.depth ?? 0) - (a.depth ?? 0);
    return area(a.rootBounds) - area(b.rootBounds);
  })[0];
}

export function equivalentPixels(width, height, rootBounds) {
  return Math.round((width * height) / Math.max(area(rootBounds), EPS));
}

export function formatPixels(count) {
  if (count >= 1e9) return `${(count / 1e9).toFixed(count >= 10e9 ? 0 : 1)} GP`;
  if (count >= 1e6) return `${(count / 1e6).toFixed(count >= 10e6 ? 0 : 1)} MP`;
  if (count >= 1e3) return `${(count / 1e3).toFixed(0)} KP`;
  return `${count} px`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
