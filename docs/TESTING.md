# Testing z0dream

## 1. Pure engine tests

```bash
npm test
npm run check
```

Acceptance:
- normalized region validation works
- nested selections route to the deepest containing image node
- equivalent-resolution math increases monotonically with recursive detail
- a recursive branch can exceed 1 GP equivalent resolved detail

## 2. MCP contract

```bash
npm start
npx @modelcontextprotocol/inspector@latest
```

Connect Inspector to `http://127.0.0.1:8787/mcp` and verify all five tools, malformed inputs, persistence, and UI resources.

## 3. Native UI

Use the mock provider first. For full viewer testing, expose the server through public HTTPS so the iframe can load `/assets/...`; Secure MCP Tunnel alone is sufficient for MCP/tool testing but does not expose those asset URLs. Register the public `/mcp` endpoint in ChatGPT Developer mode.

Acceptance:
- global/sidebar and thread entrypoints open;
- landing page can create a dream;
- wheel zoom and drag pan remain smooth;
- **Dream deeper** creates a child through `tools/call`;
- child detail fades in at the intended scale;
- node rail focuses branches;
- fullscreen works where supported;
- mobile layout remains usable.

## 4. Real-generation smoke

Set `Z0DREAM_PROVIDER=openai` and an API key. Use one root + two nested passes.

Evaluate identity preservation, geometry, seams, actual new detail, latency, cost, and retry rate.

## 5. Store-review eval set

Positive: renaissance library, dense night market, fantasy city, world inside a mechanical watch, botanical greenhouse.

Negative: empty prompt, <2% selection, nonexistent dream id, and node-limit exhaustion.
