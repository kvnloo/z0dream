import { createServer as createHttpServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { createEngine } from "./src/create-engine.js";
import { importRootImage } from "./src/import-image.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadLocalEnv() {
  try {
    const text = await readFile(path.join(__dirname, ".env"), "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

await loadLocalEnv();
const viewerHtml = await readFile(path.join(__dirname, "public", "dream-viewer.html"), "utf8");
const engine = await createEngine();
const port = Number(process.env.PORT || 8787);
const publicBaseUrl = (process.env.PUBLIC_BASE_URL || `http://localhost:${port}`).replace(/\/$/, "");
const VIEW_URI = "ui://z0dream/dream-viewer.html";
const MCP_PATH = "/mcp";

const regionSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().positive().max(1),
  height: z.number().positive().max(1),
});
const boundsSchema = regionSchema;
const imageSchema = z.object({ filename: z.string(), mimeType: z.string(), width: z.number(), height: z.number(), url: z.string() });
const nodeSchema = z.object({
  id: z.string(), parentId: z.string().nullable(), depth: z.number(), prompt: z.string(), rootBounds: boundsSchema,
  image: imageSchema, equivalentPixels: z.number(), createdAt: z.string(),
});
const dreamSchema = z.object({
  id: z.string(), title: z.string(), prompt: z.string(), provider: z.string(), createdAt: z.string(), updatedAt: z.string(),
  nodes: z.array(nodeSchema),
  stats: z.object({ nodeCount: z.number(), maxDepth: z.number(), peakEquivalentPixels: z.number(), peakEquivalentLabel: z.string() }),
});

const outputSchema = { dream: dreamSchema.nullable() };
const openAIFileSchema = z.object({
  download_url: z.string().url(),
  file_id: z.string(),
  mime_type: z.string().optional(),
  file_name: z.string().optional(),
}).strict();
const uiMeta = { ui: { resourceUri: VIEW_URI } };
const launchUiMeta = {
  ui: { resourceUri: VIEW_URI },
  "openai/ui": { entrypoints: [{ type: "global" }, { type: "thread" }] },
};

function toolReply(dream, text) {
  return { content: text ? [{ type: "text", text }] : [], structuredContent: { dream } };
}
function toolError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return { isError: true, content: [{ type: "text", text: `z0dream error: ${message}` }], structuredContent: { dream: null } };
}

function makeMcpServer() {
  const server = new McpServer({ name: "z0dream", version: "0.1.0" });

  registerAppResource(server, "z0dream-viewer", VIEW_URI, {}, async () => ({
    contents: [{
      uri: VIEW_URI,
      mimeType: RESOURCE_MIME_TYPE,
      text: viewerHtml,
      _meta: {
        ui: {
          prefersBorder: false,
          ...(publicBaseUrl.startsWith("https://") ? { domain: new URL(publicBaseUrl).origin } : {}),
          csp: { resourceDomains: [publicBaseUrl], connectDomains: [publicBaseUrl] },
        },
        "openai/ui": { availableDisplayModes: ["inline", "fullscreen", "pip"] },
      },
    }],
  }));

  registerAppTool(server, "open_z0dream", {
    title: "Open z0dream",
    description: "Opens the z0dream recursive-resolution image explorer. Use when the user wants to launch or explore z0dream without creating an image yet.",
    inputSchema: {}, outputSchema, _meta: launchUiMeta,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async () => toolReply(null, "Opened z0dream. Create an image, then select any region to dream deeper."));

  registerAppTool(server, "dream_image", {
    title: "Dream image",
    description: "Creates a new z0dream root image designed for recursive zooming. Use for requests to create a dream, zoomable image, recursively detailed image, or high-resolution generative scene.",
    inputSchema: { prompt: z.string().min(1).max(4000), title: z.string().max(80).optional() }, outputSchema, _meta: uiMeta,
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  }, async (args) => { try { const dream = await engine.createDream(args); return toolReply(dream, `Created “${dream.title}”. Peak resolved detail: ${dream.stats.peakEquivalentLabel}.`); } catch (e) { return toolError(e); } });

  registerAppTool(server, "dream_from_image", {
    title: "Dream from image",
    description: "Imports a user-provided image as the root of a z0dream so any region can be recursively regenerated at higher detail. Use when the user wants to zoom deeper into an existing or ChatGPT-generated image.",
    inputSchema: { file: openAIFileSchema, prompt: z.string().max(4000).optional(), title: z.string().max(80).optional() },
    outputSchema,
    _meta: { ...uiMeta, "openai/fileParams": ["file"] },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  }, async (args) => {
    try {
      const dream = await engine.createDreamFromImage({
        prompt: args.prompt || "Imported image",
        title: args.title,
        rootFactory: ({ dreamId, nodeId }) => importRootImage({ store: engine.store, dreamId, nodeId, file: args.file }),
      });
      return toolReply(dream, "Imported image into z0dream. Select any region to dream deeper.");
    } catch (e) { return toolError(e); }
  });

  registerAppTool(server, "dream_deeper", {
    title: "Dream deeper",
    description: "Recursively regenerates a selected normalized region of an existing z0dream at higher detail while preserving its parent scene. Region coordinates x/y/width/height are normalized from 0 to 1 over the root image.",
    inputSchema: { dream_id: z.string().min(1), region: regionSchema, prompt: z.string().max(4000).optional() }, outputSchema, _meta: uiMeta,
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  }, async (args) => { try { const dream = await engine.dreamDeeper({ dreamId: args.dream_id, region: args.region, prompt: args.prompt }); return toolReply(dream, `Dreamed one level deeper. Peak resolved detail: ${dream.stats.peakEquivalentLabel}.`); } catch (e) { return toolError(e); } });

  registerAppTool(server, "get_dream", {
    title: "Get dream",
    description: "Loads an existing z0dream by id, including its recursive image layers and resolution statistics.",
    inputSchema: { dream_id: z.string().min(1) }, outputSchema, _meta: uiMeta,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async (args) => { try { const dream = await engine.getDream(args.dream_id); return toolReply(dream, `Loaded “${dream.title}”.`); } catch (e) { return toolError(e); } });

  return server;
}

const storageRoot = path.resolve(__dirname, "storage", "dreams");
function safeAssetPath(urlPath) {
  const raw = urlPath.slice("/assets/".length).split("/").map(decodeURIComponent);
  if (raw.length !== 2 || !raw.every((part) => /^[a-zA-Z0-9_.-]+$/.test(part))) return null;
  const full = path.resolve(storageRoot, raw[0], raw[1]);
  return full.startsWith(storageRoot + path.sep) ? full : null;
}
function mimeFor(file) {
  if (file.endsWith(".svg")) return "image/svg+xml";
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

const httpServer = createHttpServer(async (req, res) => {
  if (!req.url) return res.writeHead(400).end("Missing URL");
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "OPTIONS" && url.pathname === MCP_PATH) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, mcp-session-id",
      "Access-Control-Expose-Headers": "Mcp-Session-Id",
    });
    return res.end();
  }

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    return res.end(JSON.stringify({ name: "z0dream", status: "ok", provider: process.env.Z0DREAM_PROVIDER || "mock", mcp: "/mcp" }));
  }

  if (req.method === "GET" && url.pathname.startsWith("/assets/")) {
    const file = safeAssetPath(url.pathname);
    if (!file) return res.writeHead(400).end("Bad asset path");
    try {
      const bytes = await readFile(file);
      res.writeHead(200, { "content-type": mimeFor(file), "cache-control": "public, max-age=31536000, immutable", "Access-Control-Allow-Origin": "*" });
      return res.end(bytes);
    } catch { return res.writeHead(404).end("Not Found"); }
  }

  if (url.pathname === MCP_PATH && req.method && new Set(["POST", "GET", "DELETE"]).has(req.method)) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
    const server = makeMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => { transport.close(); server.close(); });
    try { await server.connect(transport); await transport.handleRequest(req, res); }
    catch (error) { console.error(error); if (!res.headersSent) res.writeHead(500).end("Internal server error"); }
    return;
  }

  res.writeHead(404).end("Not Found");
});

httpServer.listen(port, () => console.log(`z0dream MCP listening on http://localhost:${port}${MCP_PATH} (${process.env.Z0DREAM_PROVIDER || "mock"})`));
