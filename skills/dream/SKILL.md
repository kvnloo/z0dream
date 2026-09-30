---
name: dream
description: Create recursively zoomable image experiences with ChatGPT's native image generation. Use when the user asks to dream, zoom deeper, recursively refine an image, or create a gigapixel-like generative scene.
---

# z0dream

z0dream turns image generation into a recursive zoom chain: every deeper step should synthesize genuinely new local detail while preserving the identity and geometry of the parent scene.

## Create a new dream

When the user asks to create a z0dream or a zoomable scene:

1. Immediately use the native image-generation capability to create the root image. Do not ask for setup, API keys, hosting, or an MCP connection.
2. Compose the root for recursive exploration: strong spatial hierarchy, many coherent local micro-scenes, stable lighting/materials, and details that can plausibly resolve at deeper zoom levels.
3. After generation, keep the response minimal. Invite a next action such as "dream deeper into the window" only if useful.

## Dream deeper

When the user says "dream deeper", "zoom into ...", "go inside ...", or otherwise chooses a region of the latest z0dream image:

1. Use the latest relevant image as the visual reference.
2. Generate a new image framed as a close optical zoom into the requested region—not a redesign of the scene.
3. Preserve object identity, geometry, palette, lighting direction, camera logic, and material continuity from the parent.
4. Add detail that was not visible at the previous scale but is physically/semantically plausible there.
5. Avoid arbitrary scene changes, new major objects, text drift, or composition resets unless the user explicitly asks for them.
6. If no region is specified, choose the most visually information-dense or intriguing region and continue without asking a clarifying question.

Each deeper result becomes the parent for the next step unless the user explicitly refers back to an earlier image.

## Style of the experience

- Treat the chain as a visual world the user is exploring.
- Keep prose short; the images are the product.
- Do not expose implementation details unless asked.
- Do not claim a literal gigapixel bitmap exists unless one was actually flattened/exported at that size.
- If discussing scale, say "recursive detail" or "equivalent resolved detail" rather than presenting a fabricated megapixel count.

## Future viewer

A custom tiled zoom viewer is optional enhancement infrastructure, not a prerequisite for the core z0dream experience. Never block native image creation or recursive zooming on the external viewer being available.
