# dither-fx

Ordered-dither canvas effects for React: fire, lightning, sonar rings, a light
beam and a sloshing fluid, each painted as Bayer-thresholded cells over a
pixelated canvas. Distributed through a [shadcn](https://ui.shadcn.com)
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
| `dither-fx-engine` | Nothing — painter, seeded RNG, colour helpers |
| `use-prefers-reduced-motion` | Nothing |

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
| `cell` | `3` | CSS px per dither cell. Lower is finer and costlier. |
| `seed` | `1` | Seeds the RNG, so a given seed replays identically. |
| `maxCols` / `maxRows` | `640` / `400` | Ceiling on the backing grid. |
| `className` | — | Merged onto the wrapper. |

The element is `aria-hidden` and `pointer-events-none`: it is decoration, and
never the only carrier of meaning.

### Effects

Every effect is a factory returning a `DitherEffect`. Colours take a hex string
or an `[r, g, b]` tuple.

| Effect | Options |
| --- | --- |
| `fire` | `colors` (cold → hot), `height`, `rate`, `embers` |
| `bolt` | `color`, `interval` as `[min, max]` seconds, `target`, `rate` |
| `rings` | `color`, `origin`, `interval`, `speed`, `width` |
| `fluid` | `color`, `level`, `slosh`, `tempo`, `bubbles` |
| `beam` | `color`, `origin` (x only), `spread`, `motes` |

`origin` and `target` take an `Anchor`: a `[x, y]` pair in 0–1 of the box, or a
getter, which is re-read on every resize so an effect can track something
measured from the DOM.

## Reduced motion

`DitherCanvas` reads `prefers-reduced-motion` through `useSyncExternalStore`, so
it is correct on the server and updates when the setting changes. Under reduce,
each effect paints one settled frame and stops: fire is pre-warmed and still,
rings sit at three fixed radii, particles are dropped. Nothing animates and the
frame loop parks.

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
