# z0dream

**Zoom into anything.**

z0dream is a native ChatGPT/Codex plugin that turns image generation into a recursive-resolution medium. Generate a root scene, drag over any detail, and **dream deeper**: z0dream regenerates that region as a higher-detail child while preserving its place in the parent scene.

The result is not a conventional upscaler and it does not pretend a stretched bitmap is a gigapixel image. It is a hierarchical generative image tree whose **equivalent resolved detail** grows as smaller regions receive fresh pixels.

## v0

- native MCP Apps viewer inside ChatGPT
- OpenAI plugin extension entrypoints for global sidebar + thread panel
- pan/zoom exploration
- drag-to-select **Dream deeper**
- recursive parent selection: deeper passes refine the deepest existing region
- live `MP` / `GP` equivalent-resolution counter
- deterministic `mock` provider for free end-to-end testing
- OpenAI Images provider for real recursive synthesis
- ChatGPT file-input support for turning an existing image into a recursive dream
- local JSON/image persistence

### MCP tools

| Tool | Purpose |
| --- | --- |
| `open_z0dream` | Open the native viewer without creating anything |
| `dream_image` | Create a recursive-ready root image |
| `dream_from_image` | Import an existing/ChatGPT image as a dream root |
| `dream_deeper` | Regenerate a normalized region at higher detail |
| `get_dream` | Reload an existing dream tree |

## Run locally

```bash
cp .env.example .env
npm install
npm test
npm start
```

The MCP endpoint is `http://127.0.0.1:8787/mcp`.

The default provider is `mock`, so the complete app works without an API key.

## Test the MCP server

```bash
npx @modelcontextprotocol/inspector@latest
```

Select **Streamable HTTP** and connect to `http://127.0.0.1:8787/mcp`.

Call `dream_image`, then `dream_deeper` with:

```json
{
  "dream_id": "<returned id>",
  "region": { "x": 0.25, "y": 0.25, "width": 0.25, "height": 0.25 }
}
```

## Test inside ChatGPT

1. Start z0dream locally with the `mock` provider.
2. Expose port `8787` with Secure MCP Tunnel or `ngrok http 8787`.
3. Set `PUBLIC_BASE_URL` to that public HTTPS origin and restart.
4. In ChatGPT: **Settings → Security and login → Developer mode**.
5. Open **ChatGPT Plugins → +** and register `https://<your-host>/mcp`.
6. Start a new **Work** chat and invoke `@z0dream`, or open its sidebar entrypoint.
7. Create a scene → pan/zoom → **Dream deeper** → drag a rectangle.

After changing tool metadata, refresh the plugin connection in ChatGPT.

## Real image generation

```bash
export Z0DREAM_PROVIDER=openai
export OPENAI_API_KEY=...
export Z0DREAM_IMAGE_MODEL=gpt-image-2.5-sunburst
npm start
```

The root is generated from the prompt. A recursive pass crops the deepest parent image containing the selection, enlarges that crop, and asks the image model to resolve the **same place** with additional detail and boundary continuity.

## Resolution semantics

For a generated node of `W × H` pixels covering normalized root area `A`:

```text
equivalent resolved pixels = (W × H) / A
```

A 1024² child covering a 25% × 25% region represents ~16.8 MP equivalent local detail. Recursing into smaller regions quickly crosses 100 MP and 1 GP without allocating a monolithic gigapixel bitmap.

This metric is deliberately called **equivalent resolved detail**, not literal flattened bitmap resolution.

## Production TODO

Before public store launch:
- object storage + database
- account/session ownership
- quotas / abuse controls
- async partial image streaming
- seam-aware overlap + automatic visual verification/retry
- shareable dream links
- literal tile-pyramid export for completed branches
- submission screenshots and evaluator receipts

## Plugin package

`plugin.json` follows the portable Agent Plugins format. `mcp.json` points to the local server for development. Once the MCP endpoint is registered in ChatGPT, use OpenAI's `@plugin-creator` to create the `.app.json` mapping for the resulting `plugin_asdk_app_...` id.

## License

MIT
