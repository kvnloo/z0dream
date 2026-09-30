# OpenAI plugin implementation notes — 2026-09-30

z0dream follows the current OpenAI plugin path:

1. expose capabilities through an MCP Streamable HTTP endpoint, typically `/mcp`;
2. expose optional UI as an MCP Apps HTML resource;
3. use the standard MCP Apps JSON-RPC `postMessage` bridge for UI ↔ tool calls;
4. add OpenAI MCP Extension metadata for ChatGPT-native surfaces such as sidebar/thread entrypoints and fullscreen;
5. test with MCP Inspector, then ChatGPT Developer mode through public HTTPS or Secure MCP Tunnel;
6. package with portable `plugin.json` plus optional `mcp.json` and skills.

Primary references:
- https://developers.openai.com/plugins/build/app-quickstart
- https://developers.openai.com/plugins/build/chatgpt-ui
- https://developers.openai.com/plugins/build/extensions
- https://developers.openai.com/plugins/build/plugins
- https://developers.openai.com/plugins/deploy/connect-chatgpt
- https://developers.openai.com/plugins/plugin-guidelines
