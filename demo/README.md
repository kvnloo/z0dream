# Quackles 1GP deep-zoom proof

This is the first real z0dream rendering proof. It ports the Quackles gigapixel primitives from `kvnloo/quackles@preview/gigapixel-single`:

- 25,820 × 38,730 (~1GP) DZI pyramid
- 512px tile addressing
- 1.6K → 3.2K → 6.4K → 12.9K → 25.8K resolution tiers
- centre-first visible-tile priority
- 96 MiB decoded LRU cache
- max 3 concurrent fetch/decode jobs
- fetch while moving, decode after camera rest
- lower-tier underlay while sharp tiles arrive

This deliberately uses the known Quackles pyramid first. Dynamic generated pyramids come after the renderer passes sharpness tests.
