---
name: use-shad-fx
description: Set up and use shad-fx, whose ordered-dither canvas effects are installed under components/shad-fx/dither (DitherCanvas plus fire, bolt, rings, fluid, beam, rain, snow). Use this whenever the user wants a pixelated, dithered, retro or 8-bit animated background or accent on a card, hero, button, avatar or section - flames, lightning, sonar or ripple rings, a spotlight or god-ray beam, a liquid or water fill, rain or snow - or mentions DitherCanvas, shad-fx or @sekei, even if they don't name the library. Also use it when an existing DitherCanvas restarts, flickers, does not show, sits on top of the content, or costs too much.
---

# Using shad-fx

shad-fx's dither renderer paints an effect as Bayer-thresholded cells into a
low-resolution canvas that is scaled up without smoothing. One `DitherCanvas`
runs one effect. The files live in the project, under
`components/shad-fx/dither/`, so read them when in doubt: every option is
documented where it is declared.

## Install, if it is not there yet

Look for `components/shad-fx/dither/dither-canvas.tsx`. If it is missing:

```bash
npx shadcn@latest add @sekei/shad-fx                # everything
npx shadcn@latest add @sekei/shad-fx-dither-fire    # dither canvas + one effect
```

If `@sekei` does not resolve, the GitHub form needs no config:
`npx shadcn@latest add sekeidesign/shad-fx/shad-fx`. Nothing else to set up:
the hook and `cn` come along, and there is no npm dependency.

## The shape that works

```tsx
"use client";

import { DitherCanvas, fire } from "@/components/shad-fx";
import { useMemo } from "react";

export function Card() {
  const effect = useMemo(() => fire({ height: 0.6 }), []);

  return (
    <div className="relative overflow-hidden rounded-lg">
      <DitherCanvas effect={effect} />
      <p className="relative">Burning</p>
    </div>
  );
}
```

Four things in there matter, and each is the cause of a common bug:

- **The parent is `relative` (or otherwise positioned) and clips.** The canvas
  is `absolute inset-0` and fills its nearest positioned ancestor. Without a
  positioned parent it fills the page section instead. Without
  `overflow-hidden` rounded corners leak.
- **Content sits above it.** The canvas is painted first, so siblings after it
  are already on top in DOM order, but a sibling that is `static` loses to a
  positioned canvas. Give text and controls `relative` (or a `z-index`). The
  canvas is transparent wherever nothing is painted, so the parent's
  background shows through; when copy has to stay readable over a busy
  effect, put a gradient scrim between the two rather than dimming the effect.
- **The effect is built once.** A new `effect` reference restarts the
  simulation: the canvas survives, but flames, drops and rings reset. Use
  `useMemo` with the reactive options in its dependency array, or module scope
  when the options are constant. A getter that reads a ref is not reactive,
  so `[]` is right for it. Never call `fire()` inline in JSX.
- **The component that builds the effect is a client component.** An effect is
  an object of functions, which cannot cross the server/client boundary as a
  prop. `DitherCanvas` is already `"use client"`, but whoever calls `fire()`
  needs to be too.

## Driving it

`active` eases the effect in and out. Drive it from hover or visibility for a
reveal; do not mount and unmount the canvas, which throws the simulation away:

```tsx
const [hover, setHover] = useState(false);
<div onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)}>
  <DitherCanvas effect={effect} active={hover} />
```

`origin` and `target` (rings, bolt, beam) take an `Anchor`: an `[x, y]` pair in
0–1 of the box, or a getter. `height`, `level` and `slant` (fire, fluid, rain)
likewise take a number or a getter. A getter is re-read every frame, so the
effect follows something that moves without being rebuilt. Feed it a ref, not
state, so pointer moves do not re-render:

```tsx
const at = useRef<readonly [number, number]>([0.5, 0.5]);
const effect = useMemo(() => rings({ origin: () => at.current }), []);

function track(e: PointerEvent<HTMLDivElement>) {
  // Measure against the card itself: offsetX/offsetY would be relative to
  // whichever child the pointer is over, and jump between them.
  const box = e.currentTarget.getBoundingClientRect();
  at.current = [
    Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)),
    Math.min(1, Math.max(0, (e.clientY - box.top) / box.height)),
  ];
}
// <div onPointerEnter={(e) => { track(e); setHover(true); }} onPointerMove={track} …>
```

Set the ref on `pointerenter` as well as `pointermove`. Move events only
start once the pointer is inside, so without it the first ring of every hover
spawns wherever the pointer last left.

Colours are `RgbInput`: a hex string or an `[r, g, b]` tuple. CSS variables do
not work here because the painter writes raw bytes. Pick a hex from the theme,
or read the computed colour once and pass it in.

## Cost and quality

- `cell` (default `2`) is CSS px per dither cell. `1` is fine on a small badge;
  use `3` or `4` on a full-bleed hero, where it also reads more deliberately
  retro. `maxCols` / `maxRows` (default `640` / `400`) cap the grid regardless.
- Each canvas has its own frame loop that runs only while something changes.
  An inactive or settled effect costs nothing, so many small canvases are fine;
  many large ones all animating at once are not.
- Reduced motion is handled. Under `prefers-reduced-motion: reduce` each effect
  paints one settled frame and parks. Do not gate the canvas on it yourself.
- The canvas is `aria-hidden` and `pointer-events-none`. It is decoration;
  whatever it emphasises must also be said in text.

## Which effect

| Effect | Reads as | Reach for first |
| --- | --- | --- |
| `fire` | Flames rising from the bottom edge with embers | `colors` (cold, body, base), `height` |
| `bolt` | Lightning strikes toward a point, with afterglow | `target`, `interval` |
| `rings` | Sonar rings expanding from a point | `origin`, `interval`, `width` (thinner reads quieter over text) |
| `fluid` | Liquid pooled along the floor, sloshing | `level` (bind a getter to progress), `slosh` |
| `beam` | A cone of light from the top edge with motes | `origin`, `target` (lean), `spread` |
| `rain` | Slanted streaks splashing on the floor | `slant` (negative blows left), `drops` |
| `snow` | Flakes drifting and settling into a drift | `settle` (`0` for none), `flakes` |

Every option is optional. The full list with defaults and units is the JSDoc on
each `<Name>Options` interface in `components/shad-fx/dither/effects/<name>.ts`.
Read that file before guessing at an option name.

## Extending

To write a new effect, use the `create-shad-fx` skill if it is installed
(`npx skills add sekeidesign/shad-fx --skill create-shad-fx`), or copy the shape of
`effects/fire.ts` and re-export from `components/shad-fx/dither/index.ts`.
