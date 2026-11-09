# Character art v1

Generated with the built-in imagegen tool on 2026-11-09 from the user's supplied Conquest signup image. Reference applies to character detail only; the Conquest frame still follows `brand-assets/design-system`.

Assets are copied into `public/characters/`: `knight-v1.png`, `wizard-v1.png`, `rogue-v1.png`, `bard-v1.png`. Each is a 1254×1254 PNG with alpha transparency. Full-body art is used for the selected character and CSS portrait framing for small avatars and class pickers. The source PNGs are unmodified. Next Image serves appropriately sized, high-quality optimized variants to the browser; `sizes` accounts for the 2.4× portrait framing. Profile photos still take precedence. Curated class art replaces the old seed-colored SVG placeholders; `avatar_seed` stays in the contract for future appearance variants. The neutral fallback uses the knight art with a generic adventurer text alternative.

## Final prompt: knight

Use the provided image ONLY as a style reference for the central pixel-art adventurer, not as a UI to reproduce. Create ONE production game character sprite: the KNIGHT class for a contemporary conference-adventure game. Full body, front three-quarter view facing slightly right, neutral standing pose. Match the reference's expressive anime-inspired pixel face, spiky dark hair, crisp dark stepped outlines, detailed layered dark charcoal jacket, backpack, conference badge on a gold lanyard, segmented hiking boots, pockets, stitching and subtle 3-tone material shading. Knight identity through a structured protective utility jacket and small shield-shaped badge, no medieval helmet or weapons. Compact silhouette, head about one quarter of body height; clear hands and feet; enough chunky pixel detail to read at 128–192 CSS pixels. True 16-bit pixel-art look with consistent square pixel clusters, no smoothing, no photorealism, no soft painterly detail. Entire sprite centered within a square transparent canvas, with generous 10% transparent padding on all sides, feet near bottom 90%, hair top about 10%. No words, text, UI, frame, scenery, labels, ground ring, or cast shadow. Background must have real alpha transparency. Keep the reference's warm cream, charcoal and muted slate tones with restrained gold highlights.

## Shared prefix for wizard, rogue and bard

Input image 1 was the user's reference. Image 2 was the generated knight above. For each asset, the final prompt was this prefix followed by its class-specific text below. Transparency was enabled in every tool call.

Use image 1 only as the pixel-art character style reference and image 2 as the exact companion asset to match in proportions, pixel density, outline thickness, pose, scale, and lighting. Generate ONE new contemporary conference-adventure character sprite. Detailed 16-bit anime-inspired pixel art: crisp stepped outlines, square pixel clusters, expressive face, layered clothing, backpack, conference badge and lanyard, pockets, seams, three-tone material shading, detailed segmented boots. Same front three-quarter standing pose facing slightly right as image 2, no scene. Full body centered on a square true-transparent canvas; consistent 8% top/bottom padding, no cropping, no frame, no words or labels, no UI, no platform/ring or shadow. Character should occupy same height as image 2, with head roughly 1/4 body height. Preserve the muted charcoal/cream/slate palette and small tasteful accent areas. Avoid soft painterly rendering, blurred edges, photorealism or medieval costumes.

### Wizard

This is the WIZARD class: a young adult woman with warm brown wavy tied-back hair and a clear expressive face, a long cream-and-slate technical coat over a charcoal hoodie, blue-indigo stitching and lanyard, a compact backpack with a rolled notebook, and a small tablet tucked at her side. One tiny star-shaped enamel pin conveys the wizard role. Hair and coat must be distinct from the knight while retaining the same art style.

### Rogue

This is the ROGUE class: a young adult with short tousled sandy-blond hair, charcoal hooded lightweight jacket (hood resting behind the head so hair and face remain clear), dark fitted utility trousers, compact cross-body sling bag and small backpack, rust-orange zipper pulls, and conference badge on a muted rust lanyard. Subtle compass pin. Clean recognizable face and distinctive asymmetrical hair silhouette; no weapons.

### Bard

This is the BARD class: a young adult woman with a straight dark bob and bangs, a friendly clear expressive face, a cropped slate jacket over an ivory hoodie, a soft olive scarf, a gold conference lanyard and badge, a rounded canvas backpack and small messenger pouch, and practical charcoal trousers and boots. Small music-note enamel pin conveys the bard role; no instrument covering the face or body. Distinct head silhouette while matching the other character's proportions and detailed pixel craft.

Delivery check: the four 576px, quality-100 WebP responses totaled 226,564 bytes versus 2,312,860 bytes for the source PNGs (90.2% smaller). Measured on the local standalone production server with an `Accept: image/webp` request; actual browser width/format varies.
