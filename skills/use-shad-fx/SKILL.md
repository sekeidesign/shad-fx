---
name: use-shad-fx
description: Set up and use shad-fx, the canvas effects installed under components/shad-fx (DitherCanvas and useFx, plus fire, bolt, rings, fluid, beam, rain, snow). Use this whenever the user wants a pixelated, dithered, retro or 8-bit animated background or accent on a card, hero, button, avatar or section - flames, lightning, sonar or ripple rings, a spotlight or god-ray beam, a liquid or water fill, rain or snow - or mentions DitherCanvas, shad-fx or @sekei, even if they don't name the library. Also use it when an existing DitherCanvas restarts, flickers, does not show, sits on top of the content, or costs too much.
---

# Using shad-fx

shad-fx splits effects from renderers. An effect (in `effects/`) simulates and
paints cells; a renderer draws them. The dither renderer, `DitherCanvas`, paints
each cell as a Bayer-thresholded pixel on a low-resolution canvas scaled up
without smoothing. One canvas runs one effect. The files live in the project,
under `components/shad-fx/`, so read them when in doubt: every option is
documented where it is declared.

## Install, if it is not there yet

Look for `components/shad-fx/dither/dither-canvas.tsx` and
`components/shad-fx/effects/`. If they are missing:

```bash
npx shadcn@latest add @sekei/shad-fx                              # everything
npx shadcn@latest add @sekei/shad-fx-dither @sekei/shad-fx-fire   # renderer + one effect
```

An effect alone has nothing to draw on; always install a renderer with it.
With the full library, import from `@/components/shad-fx`. Otherwise import
`DitherCanvas` from `@/components/shad-fx/dither`, `useFx` from
`@/components/shad-fx/use-fx` and each effect from
`@/components/shad-fx/effects/<name>`.

If `@sekei` does not resolve, the GitHub form needs no config:
`npx shadcn@latest add sekeidesign/shad-fx/shad-fx`. Nothing else to set up:
the hook and `cn` come along, and there is no npm dependency.

## The shape that works

```tsx
"use client";

import { DitherCanvas, fire, useFx } from "@/components/shad-fx";

export function Card() {
  const fx = useFx(fire, { height: 0.6 });

  return (
    <div className="relative overflow-hidden rounded-lg">
      <DitherCanvas effect={fx} />
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
- **The effect comes from `useFx`.** Pass options to it as plain props, state
  and inline arrays included. A change applies in place without restarting the
  simulation, and an option that is removed goes back to its default. Do not
  wrap anything in `useMemo`, and do not call `fire()` and pass its result to
  the canvas: the canvas takes the handle `useFx` returns. Passing a different
  factory (`useFx(on ? fire : rain)`) builds that effect fresh.
- **The component that calls `useFx` is a client component.** An effect is an
  object of functions, which cannot cross the server/client boundary as a
  prop. `DitherCanvas` is already `"use client"`, but whoever calls `useFx`
  needs to be too.

## Driving it

`active` eases the effect in and out. Drive it from hover or visibility for a
reveal; do not mount and unmount the canvas, which throws the simulation away:

```tsx
const [hover, setHover] = useState(false);
<div onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)}>
  <DitherCanvas effect={fx} active={hover} />
```

Any option can change at any time. For one that changes occasionally (a theme
colour, a progress value bound to `level`), pass it through `useFx` like a
prop. For one that changes every frame, such as a position following the
pointer, call `fx.set` from the handler instead, so pointer moves do not
re-render. `origin` and `target` (rings, bolt, beam) take an `Anchor`: an
`[x, y]` pair in 0–1 of the box.

```tsx
const fx = useFx(rings);

function track(e: PointerEvent<HTMLDivElement>) {
  // Measure against the card itself: offsetX/offsetY would be relative to
  // whichever child the pointer is over, and jump between them.
  const box = e.currentTarget.getBoundingClientRect();
  fx.set({
    origin: [
      Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)),
      Math.min(1, Math.max(0, (e.clientY - box.top) / box.height)),
    ],
  });
}
// <div onPointerEnter={(e) => { track(e); setHover(true); }} onPointerMove={track} …>
```

Call it on `pointerenter` as well as `pointermove`. Move events only start
once the pointer is inside, so without it the first ring of every hover spawns
wherever the pointer last left. A value set this way holds until the same
option passed to `useFx` changes, so do not pass `origin` to both.

Colours are `RgbInput`: a hex string or an `[r, g, b]` tuple. CSS variables do
not work here because the renderer writes raw bytes. Pick a hex from the theme,
or read the computed colour once and pass it in.

## Cost and quality

- `cell` (default `2`) is CSS px per dither cell. `1` is fine on a small badge;
  use `3` or `4` on a full-bleed hero, where it also reads more deliberately
  retro. `maxCols` / `maxRows` (default `640` / `400`) cap the grid regardless.
- Each canvas has its own frame loop that runs only while something changes
  and the canvas is on screen. An inactive, settled or scrolled-away effect
  costs nothing, so a long page of canvases is fine without any visibility
  handling of your own; many large ones animating in view at once are not.
  Do not unmount or toggle `active` on scroll to save work: it is already
  paused, and toggling `active` would ease it out and back in.
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
| `fluid` | Liquid pooled along the floor, sloshing | `level` (bind to progress), `slosh` |
| `beam` | A cone of light from the top edge with motes | `origin`, `target` (lean), `spread` |
| `rain` | Slanted streaks splashing on the floor | `slant` (negative blows left), `drops` |
| `snow` | Flakes drifting and settling into a drift | `settle` (`0` for none), `flakes` |

Every option is optional. The full list with defaults and units is the JSDoc on
each `<Name>Options` interface in `components/shad-fx/effects/<name>.ts`.
Read that file before guessing at an option name.

## Extending

To write a new effect, use the `create-shad-fx` skill if it is installed
(`npx skills add sekeidesign/shad-fx --skill create-shad-fx`), or copy the shape of
`effects/fire.ts` and re-export from `components/shad-fx/index.ts` if it exists.
