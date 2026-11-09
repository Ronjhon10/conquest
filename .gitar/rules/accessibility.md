---
title: "Accessible screens and themes"
description: "Every image and icon control needs a text alternative, and themes must keep readable contrast (Merge Forward)."
when: "A PR changes UI under apps/web or theme generation/palette code in services/game-api"
actions: "Flag missing alt text, aria-labels, labels, color-only meaning, or contrast below WCAG AA, with the fix"
---

Conquest enters the Merge Forward accessibility track. Spec: `specs/040-web.md` Behavior 2-5 and WEB-9 to WEB-11, `specs/030-game.md` GM-2.

Check the diff for:

1. `<img>`, `<svg>` with meaning, `next/image`, and icon-only buttons or links without `alt` / `aria-label`.
2. Form inputs without a visible or programmatic label.
3. Meaning carried by color alone (for example step-free status only shown as a color).
4. Click handlers on non-interactive elements without keyboard support.
5. Animations that ignore `prefers-reduced-motion`.
6. Theme palettes where `fg` on `bg` is under 4.5:1, or code that skips the contrast check.

Comment with the exact line and the fix. Request changes for items 1-3.
