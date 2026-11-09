# PickerTile

A square choice for character options (hair, outfit). Unselected is white with `shadow-sm`; selected fills blue and sits 4px down and right with no shadow, as if pressed.

- Use a `<button>` with `aria-pressed` and an `aria-label` naming the option ("Spiky hair").
- The consumer provides the pixel icon (`<img>`, pixelated, whole-number scale).
- Rows of 3 or 4, gap 8–14px.
