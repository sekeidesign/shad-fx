# Working on this repo

## Rebuild `r/` in the same commit as any source change

`r/` is generated and committed. `registry.json` and `registry/` are what the
GitHub shorthand install reads; `r/` is what `@sekei` serves through
`www.sekei.xyz/registry/*`. A stale `r/` means a namespace install gets old code
while a shorthand install gets new code — the two paths disagree, which is worse
than either being wrong on its own.

So after touching anything under `registry/` or `registry.json`:

```bash
pnpm registry:build   # writes r/, including r/registry.json as the index
pnpm registry:check   # offline; fails when r/ has drifted. Run before committing.
```

`registry:check` reads no network and takes no dependencies, so there is no
reason to skip it.

## Layout

```
registry.json          source of truth, the build's input
registry/shad-fx/      the files themselves
  index.ts             top-level barrel: every renderer and effect
  engine.ts            frame loop, Surface/Renderer/FxEffect contracts, RNG, colour
  effects/             one file per effect, renderer-agnostic, plus particles.ts
  dither/              the ordered-dither renderer: Painter, DitherRenderer, DitherCanvas
  use-prefers-reduced-motion.ts   shared across renderers
r/                     built output, committed
scripts/check-registry.mjs
skills/                agent skills, installed with `npx skills add`, not shadcn
```

`r` is shadcn's own name for built registry output — `shadcn build` defaults to
`./public/r` and shadcn/ui serves its items at `ui.shadcn.com/r/<item>.json`.
This repo is not a web app and has no `public/`, so it sits at the root.

`registry/shad-fx/*` is not compiled here — no `tsconfig.json`, no
dependencies. The files keep the consumer's alias imports (`@/lib/utils`,
`@/hooks/use-prefers-reduced-motion`), which resolve in the installing project,
not in this one. Do not rewrite them to relative paths.

## Adding an effect

1. Write `registry/shad-fx/effects/<name>.ts`, exporting a factory that
   returns an `FxEffect` and an `<Name>Options` interface. Copy the shape of
   `fire.ts`: `paint(frame)` per frame, `idle()` when nothing is changing, and a
   settled single frame under reduced motion. Paint only through the four
   `Surface` calls on `frame.px`, and import only from `../engine` and
   `./particles`, never from a renderer. That is what keeps it runnable on
   every renderer.
2. Re-export it from `registry/shad-fx/index.ts`.
3. Add an item `shad-fx-<name>` to `registry.json`: `type: "registry:lib"`,
   `version`, a `registryDependencies` of `["sekeidesign/shad-fx/shad-fx-engine"]`,
   and a file whose `target` is `@components/shad-fx/effects/<name>.ts`.
4. Add it to the `shad-fx` aggregate item's `registryDependencies`.
5. Rebuild and check, as above.

Registry dependencies stay in `owner/repo/item` shorthand. They resolve from the
moment the repo is public and do not depend on the shadcn registry directory
being reachable. Do not rewrite them to `@sekei/...` or to absolute
`sekei.xyz` URLs.

Leave `"utils"` bare. It resolves against shadcn/ui.

## Skills

`skills/*/SKILL.md` are not registry items. They install with
`npx skills add sekeidesign/shad-fx`, which finds them by folder, so keep the
folder name and the frontmatter `name` equal. They describe the API a second time, in prose, so an
API change (an option renamed, a default moved, a contract method added) is
not done until both skills say the same thing as the code. Keep them pointing
at the JSDoc for detail rather than restating every table.

## Adding a renderer

A new technique (ASCII, say) gets its own folder, `registry/shad-fx/<renderer>/`,
mirroring `dither/`: a class implementing `Surface` (what the four paint calls
mean in this medium), a class implementing `Renderer` (size the backing store,
put a frame on screen), a React canvas that hands both to `FxEngine`, and an
`index.ts`. It reuses every effect as is. It is one item, `shad-fx-<renderer>`,
depending on `shad-fx-engine`; add it to `shad-fx`'s `registryDependencies` and
re-export the folder from `registry/shad-fx/index.ts`. When two renderers
export the same symbol name, re-export them under namespaces there instead of
`export *`. Extend both skills to cover it.

Cells need not be square. A renderer whose cells are not (glyphs are roughly
twice as tall as wide) will squash anything an effect measures in cells, such
as rings' radii. When that matters, add the cell aspect to `FxFrame` and have
the affected effects correct for it; adding a field does not break existing
effects.

## Item names

`shad-fx`, `shad-fx-engine`, `shad-fx-<renderer>`, `shad-fx-<effect>`, and
`use-prefers-reduced-motion`. A renderer's name and an effect's name share one
space, so neither may take a name the other could want. They are the publisher
namespace's names (`@sekei/shad-fx-fire`), not the repo's, so the `shad-fx-`
prefix stays even though `sekeidesign/shad-fx/shad-fx-fire` stutters. Renaming an item
breaks every install command already written down.

shad-fx is not affiliated with shadcn or shadcn/ui. Keep the disclaimer in the
README, and do not use shadcn's logo or imply endorsement anywhere.

## Verifying an install

In a scratch Next.js + Tailwind + shadcn project, from the default branch:

```bash
npx shadcn@latest add sekeidesign/shad-fx/shad-fx-dither sekeidesign/shad-fx/shad-fx-fire
npx shadcn@latest add @sekei/shad-fx-dither @sekei/shad-fx-fire
```

Both must land identical files. `raw.githubusercontent.com` caches for roughly
five minutes and the sekei.xyz proxy passes that through, so a namespace install
straight after a push can serve the previous build.

## Out of scope here

The docs page, playground and gallery live in `sekeidesign/sekei-xyz` at
`/shad-fx`. That site also vendors a copy of these files under
`components/shad-fx/`; fix bugs here and re-add there.

## Listing `@sekei` in the shadcn registry directory

The directory (<https://ui.shadcn.com/docs/registry/registry-index>) is what
lets `npx shadcn add @sekei/shad-fx` work with no `registries` entry. Its
requirements, and where this repo stands on each:

1. Open source and publicly accessible — the repo must be public, since every
   `registryDependencies` entry resolves through `raw.githubusercontent.com`.
2. `registry.json` must conform to the registry schema — `registry:build`
   validates it, and CI runs `registry:check`.
3. Flat: `/registry.json` and `/<item>.json` at the registry root — `r/` is
   flat and served at `www.sekei.xyz/registry/*`.
4. `files` in the index must carry no `content` — `r/registry.json` does not.
   The per-item files do, which is what an install needs.

The health monitor also scores "a matching registry name": `name` in
`registry.json` (`sekei`) must match the namespace (`@sekei`) once the `@` is
stripped. Keep them in step.

To submit, open a pull request against <https://github.com/shadcn-ui/ui> that
appends this to `apps/v4/registry/directory.json`, then run
`pnpm validate:registries` there. `logo` is a required inline SVG. Keep
`fill='var(--foreground)'` so it follows light and dark mode.

```json
{
	"name": "@sekei",
	"homepage": "https://www.sekei.xyz/shad-fx",
	"url": "https://www.sekei.xyz/registry/{name}.json",
	"description": "Canvas effects for React, copied into your project as source. Starts with ordered dither: fire, lightning, sonar rings, a light beam, a sloshing fluid, rain and snow.",
	"author": "Piergiorgio Gonni",
	"logo": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' fill='var(--foreground)'><path d='M18 12H26V14H28V16H26V18H24V20H22V22H20V24H18V26H16V28H14V20H6V18H4V16H6V14H8V12H10V10H12V8H14V6H16V4H18V12Z'/></svg>"
}
```
