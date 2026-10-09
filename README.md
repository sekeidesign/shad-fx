# shad-fx

Canvas effects for React, distributed through a [shadcn](https://ui.shadcn.com)
registry — the files are copied into your project, not added as a dependency.

Effects and renderers are separate. An effect (fire, lightning, sonar rings, a
light beam, a sloshing fluid, rain and snow) simulates and paints into a grid of
cells; a renderer decides what a cell looks like. The first renderer is ordered
dither, which draws each cell as a Bayer-thresholded pixel on a pixelated
canvas. Others, such as ASCII, will run the same effects unchanged.

> [!NOTE]
> shad-fx is an independent project. It is not made, maintained or endorsed by
> shadcn or the shadcn/ui project. It only uses the shadcn CLI and registry
> format to install.

<!-- TODO: drop demo.gif (or demo.png) in the repo root and uncomment:
![shad-fx](demo.gif)
-->

```bash
npx shadcn@latest add @sekei/shad-fx
```

Docs, playground and gallery: [sekei.design/shad-fx](https://www.sekei.design/shad-fx)

## Install

Take the whole library, or a renderer and the effects you want:

```bash
npx shadcn@latest add @sekei/shad-fx                              # everything
npx shadcn@latest add @sekei/shad-fx-dither @sekei/shad-fx-fire   # dither renderer + fire only
```

An effect on its own has nothing to draw on, so always take a renderer with it.

Nothing to configure. `@sekei` is in the shadcn registry directory, so the CLI
resolves it and writes the `registries` entry into your `components.json`
itself. To pin it yourself instead:

```bash
npx shadcn registry add @sekei=https://www.sekei.design/registry/{name}.json
```

Or by hand, in `components.json` or `package.json` — the CLI reads both:

```json
{
	"registries": {
		"@sekei": "https://www.sekei.design/registry/{name}.json"
	}
}
```

This repo is also a registry on its own terms, so the `owner/repo/item` form
works without touching any config:

```bash
npx shadcn@latest add sekeidesign/shad-fx/shad-fx
```

Files land under `components/shad-fx/` and `hooks/`, following your
`components.json` aliases: renderers in `dither/`, effects in `effects/`. With
the full library, import everything from `@/components/shad-fx`. With a
renderer and a few effects, import from `@/components/shad-fx/dither`,
`@/components/shad-fx/effects/<name>` and `@/components/shad-fx/use-fx`.

## Items

| Item | Pulls in |
| --- | --- |
| `shad-fx` | Every renderer and effect below, plus an `index.ts` barrel |
| `shad-fx-dither` | The dither renderer: `DitherCanvas`. Pulls in the engine, the reduced-motion hook, `utils` |
| `shad-fx-fire` | Engine |
| `shad-fx-rings` | Engine |
| `shad-fx-beam` | Engine |
| `shad-fx-bolt` | Engine |
| `shad-fx-fluid` | Engine |
| `shad-fx-rain` | Engine |
| `shad-fx-snow` | Engine |
| `shad-fx-engine` | Nothing — the frame loop, the effect contract, `useFx`, seeded RNG, colour helpers |
| `use-prefers-reduced-motion` | Nothing |

## Usage

The canvas fills its nearest positioned ancestor, so give the parent
`relative`:

```tsx
"use client";

import { DitherCanvas, fire, useFx } from "@/components/shad-fx";

export function Card({ height }: { height: number }) {
  const fx = useFx(fire, { colors: ["#e5343a", "#f05100", "#fcbb00"], height });

  return (
    <div className="relative overflow-hidden rounded-lg">
      <DitherCanvas effect={fx} />
      <p className="relative">Burning</p>
    </div>
  );
}
```

`useFx` builds the effect once and keeps it in step with its options. Pass them
like any props, inline arrays included: a change applies in place, without
restarting the simulation, and a removed option goes back to its default.
Passing a different effect (`useFx(on ? fire : rain)`) starts that one fresh.

For a value that changes every frame, such as a pointer position, skip the
re-render and call `fx.set` from the handler:

```tsx
const fx = useFx(rings);
<div onPointerMove={(e) => fx.set({ origin: [x, y] })}>
```

Outside React, `createFx(fire, options)` returns the same handle.

### `DitherCanvas`

| Prop | Default | Notes |
| --- | --- | --- |
| `effect` | — | The effect to run, from `useFx`. |
| `active` | `true` | Eases in and out. Drive it from hover for a reveal. |
| `cell` | `2` | CSS px per dither cell. Lower is finer and costlier. |
| `seed` | `1` | Seeds the RNG, so a given seed replays identically. |
| `maxCols` / `maxRows` | `640` / `400` | Ceiling on the backing grid. |
| `className` | — | Merged onto the wrapper. |

The element is `aria-hidden` and `pointer-events-none`: it is decoration, and
never the only carrier of meaning.

### Effects

Every effect is a factory returning an `FxEffect`, passed to `useFx`, and every
option is optional and can change at any time. `RgbInput` is a hex string or an `[r, g, b]` tuple. Where a count is
given at full intensity, it scales down as the effect eases out.

#### `fire`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `colors` | `[RgbInput, RgbInput, RgbInput]` | `["#e5343a", "#f05100", "#fcbb00"]` | Cold to hot: the tips, the body, the base. |
| `height` | `number` | `0.5` | Fraction of the height the flames reach at full intensity. |
| `rate` | `number` | `36` | Simulation steps per second. Lower reads chunkier. |
| `embers` | `number` | `8` | Embers aloft at once, at full intensity. |

#### `bolt`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `color` | `RgbInput` | `"#fcbb00"` | Colour of the strike and its afterglow. |
| `interval` | `[number, number]` | `[0.6, 1.4]` | Seconds between strikes at full intensity, as a `[min, max]` range. |
| `target` | `Anchor` | `[0.5, 0.43]` | What the strikes aim for. They land just short of it or on it. |
| `rate` | `number` | `30` | Simulation steps per second. Lower reads chunkier. |

#### `rings`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `color` | `RgbInput` | `"#ac4bff"` | Colour of the rings. |
| `origin` | `Anchor` | `[0.5, 0.42]` | The point every ring expands from. |
| `interval` | `number` | `1.15` | Seconds between rings. |
| `speed` | `number` | `0.45` | Expansion speed as a fraction of the height per second. |
| `width` | `number` | `2.6` | Ring thickness in cells. |

#### `fluid`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `color` | `RgbInput` | `"#3080ff"` | Colour of the liquid and its bubbles. |
| `level` | `number` | `0.2` | Resting depth as a fraction of the height, at full intensity. |
| `slosh` | `number` | `0.09` | How far the surface tilts at either edge, as a fraction of the height. |
| `tempo` | `number` | `0.15` | Slosh cycles per second. |
| `bubbles` | `number` | `12` | Bubbles rising at once, at full intensity. |

#### `beam`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `color` | `RgbInput` | `"#3080ff"` | Colour of the light and its motes. |
| `origin` | `Anchor` | `[0.5, 0.5]` | Only the `x` is used: where the light enters at the top edge. |
| `target` | `Anchor` | — | Only the `x` is used: where the axis meets the bottom edge. Unset, the beam falls straight down from `origin`; set, it leans toward this point. |
| `spread` | `number` | `0.5` | Half-width of the cone at the bottom edge, as a fraction of the width. |
| `motes` | `number` | `16` | Dust motes drifting in the light. |

#### `rain`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `color` | `RgbInput` | `"#bedbff"` | Colour of the drops and splashes. |
| `drops` | `number` | `64` | Drops in flight at once, at full intensity. |
| `speed` | `number` | `1.4` | Fall speed of the nearest drops as a fraction of the height per second. |
| `slant` | `number` | `0.25` | Cells drifted sideways per cell fallen. Negative blows left. |
| `length` | `number` | `6` | Streak length of the nearest drops, in cells. |

#### `snow`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `color` | `RgbInput` | `"#d1d5dc"` | Colour of the flakes and the drift. |
| `flakes` | `number` | `40` | Flakes aloft at once. |
| `speed` | `number` | `0.12` | Fall speed of the nearest flakes as a fraction of the height per second. |
| `sway` | `number` | `0.6` | Sideways wander as a fraction of the fall speed. |
| `settle` | `number` | `0.12` | Depth the snow settles to along the floor, as a fraction of the height. `0` for none. |

`origin` and `target` take an `Anchor`: an `[x, y]` pair in 0–1 of the box. To
follow something that moves, call `fx.set({ origin })` as it moves.

## Agent skills

Two [agent skills](https://agentskills.io) teach your coding agent the library
the way this README does, from inside your project:

```bash
npx skills add sekeidesign/shad-fx
```

`use-shad-fx` covers placement, `useFx`, driving options and cost.
`create-shad-fx` covers the `FxEffect` contract, the two shapes an effect
takes, the `Surface` it paints into, live options, reduced motion and parking. The CLI installs them wherever
each agent you use looks for skills.

## Reduced motion

`DitherCanvas` reads `prefers-reduced-motion` through `useSyncExternalStore`, so
it is correct on the server and updates when the setting changes. Under reduce,
each effect paints one settled frame and stops: fire is pre-warmed and still,
rings sit at three fixed radii, rain and snow hang mid-fall, particles are
dropped. Nothing animates and the frame loop parks.

## Cost

The engine runs `requestAnimationFrame` only while something is changing, and
stops once the eased intensity has settled and the effect reports `idle()`. An
inactive effect costs nothing. A canvas scrolled off screen pauses too, through
an `IntersectionObserver`, and resumes where it left off as it comes back, so a
page of them only pays for the ones in view. Each frame is one `putImageData` over a grid
capped at 640×400 cells, not a `fillRect` per cell.

## Contributing

See [AGENTS.md](AGENTS.md). The short version: `registry.json` and
`registry/shad-fx/` are the source, `r/` is generated and committed, and
`pnpm registry:build && pnpm registry:check` runs before every commit that
touches either.

## Credit

The ordered-dither rendering — a low-resolution backing canvas scaled up
pixelated, the Bayer threshold matrix, and filling every cell at one of two
alpha tiers rather than leaving holes — derives from
[dither-kit](https://github.com/Boring-Software-Inc/dither-kit) (MIT). The
effects, the `Painter`'s single-blit design, the frame loop and the
reduced-motion handling are not.
See [NOTICE.md](NOTICE.md) for the full attribution.

MIT © Piergiorgio Gonni
