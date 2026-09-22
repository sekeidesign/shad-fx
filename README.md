# dither-fx

Ordered-dither canvas effects for React: fire, lightning, sonar rings, a light
beam, a sloshing fluid, rain and snow, each painted as Bayer-thresholded cells
over a pixelated canvas. Distributed through a [shadcn](https://ui.shadcn.com)
registry — the files are copied into your project, not added as a dependency.

<!-- TODO: drop demo.gif (or demo.png) in the repo root and uncomment:
![dither-fx](demo.gif)
-->

```bash
npx shadcn@latest add @sekei/dither-fx
```

Docs, playground and gallery: [sekei.xyz/dither-fx](https://www.sekei.xyz/dither-fx)

## Install

Take the whole library, or one effect:

```bash
npx shadcn@latest add @sekei/dither-fx        # canvas + every effect + barrel
npx shadcn@latest add @sekei/dither-fx-fire   # canvas + fire only
```

Nothing to configure. `@sekei` is in the shadcn registry directory, so the CLI
resolves it and writes the `registries` entry into your `components.json`
itself. To pin it yourself instead:

```bash
npx shadcn registry add @sekei=https://www.sekei.xyz/registry/{name}.json
```

Or by hand, in `components.json` or `package.json` — the CLI reads both:

```json
{
	"registries": {
		"@sekei": "https://www.sekei.xyz/registry/{name}.json"
	}
}
```

This repo is also a registry on its own terms, so the `owner/repo/item` form
works without touching any config:

```bash
npx shadcn@latest add sekeidesign/dither-fx/dither-fx
```

Files land under `components/dither-fx/` and `hooks/`, following your
`components.json` aliases.

## Items

| Item | Pulls in |
| --- | --- |
| `dither-fx` | Everything below, plus an `index.ts` barrel |
| `dither-fx-canvas` | Engine, the reduced-motion hook, `utils` |
| `dither-fx-fire` | Canvas |
| `dither-fx-rings` | Canvas |
| `dither-fx-beam` | Canvas |
| `dither-fx-bolt` | Canvas |
| `dither-fx-fluid` | Canvas |
| `dither-fx-rain` | Canvas |
| `dither-fx-snow` | Canvas |
| `dither-fx-engine` | Nothing — painter, seeded RNG, colour helpers |
| `use-prefers-reduced-motion` | Nothing |
| `dither-fx-skill` | Nothing — a Claude Code skill, see below |
| `dither-fx-effect-skill` | Nothing — a Claude Code skill, see below |

## Usage

The canvas fills its nearest positioned ancestor, so give the parent
`relative`:

```tsx
import { DitherCanvas, fire } from "@/components/dither-fx";
import { useMemo } from "react";

export function Card() {
  const effect = useMemo(() => fire({ colors: ["#e5343a", "#f05100", "#fcbb00"] }), []);

  return (
    <div className="relative overflow-hidden rounded-lg">
      <DitherCanvas effect={effect} />
      <p className="relative">Burning</p>
    </div>
  );
}
```

Build the effect once. A new `effect` reference restarts the simulation — the
canvas and its observer survive, but particles and heat fields reset. `useMemo`
with the options in the dependency array, or module scope when the options are
constant.

### `DitherCanvas`

| Prop | Default | Notes |
| --- | --- | --- |
| `effect` | — | The effect to run. Keep the reference stable. |
| `active` | `true` | Eases in and out. Drive it from hover for a reveal. |
| `cell` | `2` | CSS px per dither cell. Lower is finer and costlier. |
| `seed` | `1` | Seeds the RNG, so a given seed replays identically. |
| `maxCols` / `maxRows` | `640` / `400` | Ceiling on the backing grid. |
| `className` | — | Merged onto the wrapper. |

The element is `aria-hidden` and `pointer-events-none`: it is decoration, and
never the only carrier of meaning.

### Effects

Every effect is a factory returning a `DitherEffect`, and every option is
optional. `RgbInput` is a hex string or an `[r, g, b]` tuple. Where a count is
given at full intensity, it scales down as the effect eases out.

#### `fire`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `colors` | `[RgbInput, RgbInput, RgbInput]` | `["#e5343a", "#f05100", "#fcbb00"]` | Cold to hot: the tips, the body, the base. |
| `height` | `number \| () => number` | `0.5` | Fraction of the height the flames reach at full intensity. A getter is re-read every frame. |
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
| `level` | `number \| () => number` | `0.2` | Resting depth as a fraction of the height, at full intensity. A getter is re-read every frame. |
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
| `slant` | `number \| () => number` | `0.25` | Cells drifted sideways per cell fallen. Negative blows left. A getter is re-read every frame. |
| `length` | `number` | `6` | Streak length of the nearest drops, in cells. |

#### `snow`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `color` | `RgbInput` | `"#d1d5dc"` | Colour of the flakes and the drift. |
| `flakes` | `number` | `40` | Flakes aloft at once. |
| `speed` | `number` | `0.12` | Fall speed of the nearest flakes as a fraction of the height per second. |
| `sway` | `number` | `0.6` | Sideways wander as a fraction of the fall speed. |
| `settle` | `number` | `0.12` | Depth the snow settles to along the floor, as a fraction of the height. `0` for none. |

`origin` and `target` take an `Anchor`: an `[x, y]` pair in 0–1 of the box, or a
getter, which is re-read every frame, so an effect can follow something that
moves without being rebuilt and losing what it has already simulated.

## Agent skills

Two opt-in items install [skills](https://code.claude.com/docs/en/skills)
into `.claude/skills/` so Claude Code knows the library the way this README
does, from inside your project:

```bash
npx shadcn@latest add @sekei/dither-fx-skill          # set up and drive the effects
npx shadcn@latest add @sekei/dither-fx-effect-skill   # write a new effect
```

The first covers placement, the stable-reference rule, anchors and cost. The
second covers the `DitherEffect` contract, the two shapes an effect takes, the
`Painter`, reduced motion and parking. Neither is pulled in by `dither-fx`.

## Reduced motion

`DitherCanvas` reads `prefers-reduced-motion` through `useSyncExternalStore`, so
it is correct on the server and updates when the setting changes. Under reduce,
each effect paints one settled frame and stops: fire is pre-warmed and still,
rings sit at three fixed radii, rain and snow hang mid-fall, particles are
dropped. Nothing animates and the frame loop parks.

## Cost

The engine runs `requestAnimationFrame` only while something is changing, and
stops once the eased intensity has settled and the effect reports `idle()`. An
inactive effect costs nothing. Each frame is one `putImageData` over a grid
capped at 640×400 cells, not a `fillRect` per cell.

## Contributing

See [AGENTS.md](AGENTS.md). The short version: `registry.json` and
`registry/dither-fx/` are the source, `r/` is generated and committed, and
`pnpm registry:build && pnpm registry:check` runs before every commit that
touches either.

## Credit

The ordered-dither rendering — a low-resolution backing canvas scaled up
pixelated, the Bayer threshold matrix, and filling every cell at one of two
alpha tiers rather than leaving holes — derives from
[dither-kit](https://github.com/Boring-Software-Inc/dither-kit) (MIT). The
effects, the `Painter`, the frame loop and the reduced-motion handling are not.
See [NOTICE.md](NOTICE.md) for the full attribution.

MIT © Piergiorgio Gonni
