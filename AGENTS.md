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
registry/dither-fx/    the files themselves
registry/dither-fx/skills/  SKILL.md per skill item, installed to .claude/skills/
r/                     built output, committed
scripts/check-registry.mjs
```

`r` is shadcn's own name for built registry output — `shadcn build` defaults to
`./public/r` and shadcn/ui serves its items at `ui.shadcn.com/r/<item>.json`.
This repo is not a web app and has no `public/`, so it sits at the root.

`registry/dither-fx/*` is not compiled here — no `tsconfig.json`, no
dependencies. The files keep the consumer's alias imports (`@/lib/utils`,
`@/hooks/use-prefers-reduced-motion`), which resolve in the installing project,
not in this one. Do not rewrite them to relative paths.

## Adding an effect

1. Write `registry/dither-fx/effects/<name>.ts`, exporting a factory that
   returns a `DitherEffect` and an `<Name>Options` interface. Copy the shape of
   `fire.ts`: `paint(frame)` per frame, `idle()` when nothing is changing, and a
   settled single frame under reduced motion.
2. Re-export it from `registry/dither-fx/index.ts`.
3. Add an item to `registry.json`: `type: "registry:lib"`, `version`, a
   `registryDependencies` of `["sekeidesign/dither-fx/dither-fx-canvas"]`, and a
   file whose `target` is `@components/dither-fx/effects/<name>.ts`.
4. Add it to the `dither-fx` aggregate item's `registryDependencies`.
5. Rebuild and check, as above.

Registry dependencies stay in `owner/repo/item` shorthand. They resolve from the
moment the repo is public and do not depend on the shadcn registry directory
being reachable. Do not rewrite them to `@sekei/...` or to absolute
`sekei.xyz` URLs.

Leave `"utils"` bare. It resolves against shadcn/ui.

## Skills

`registry/dither-fx/skills/*/SKILL.md` ship as `registry:file` items whose
`target` is `~/.claude/skills/<dir>/SKILL.md`; the CLI reads `~/` as the
consumer's project root. They describe the API a second time, in prose, so an
API change (an option renamed, a default moved, a contract method added) is
not done until both skills say the same thing as the code. Keep them pointing
at the JSDoc for detail rather than restating every table.

## Item names

`dither-fx`, `dither-fx-<effect>`, `use-prefers-reduced-motion`, and the two
`registry:file` skills `dither-fx-skill` and `dither-fx-effect-skill`, whose
`SKILL.md` files sit under `registry/dither-fx/skills/`. They are the
publisher namespace's names (`@sekei/dither-fx-fire`), not the repo's, so the
`dither-fx-` prefix stays even though `sekeidesign/dither-fx/dither-fx-fire`
stutters. Renaming an item breaks every install command already written down.

## Verifying an install

In a scratch Next.js + Tailwind + shadcn project, from the default branch:

```bash
npx shadcn@latest add sekeidesign/dither-fx/dither-fx-fire
npx shadcn@latest add @sekei/dither-fx-fire
```

Both must land identical files. `raw.githubusercontent.com` caches for roughly
five minutes and the sekei.xyz proxy passes that through, so a namespace install
straight after a push can serve the previous build.

## Out of scope here

The docs page, playground and gallery live in `sekeidesign/sekei-xyz` at
`/dither-fx`. That site also vendors a copy of these files under
`components/dither-fx/`; fix bugs here and re-add there.

## Listing `@sekei` in the shadcn registry directory

The directory (<https://ui.shadcn.com/docs/registry/registry-index>) is what
lets `npx shadcn add @sekei/dither-fx` work with no `registries` entry. Its
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
`pnpm validate:registries` there. `logo` is a required inline SVG; swap the
placeholder for the real mark before submitting.

```json
{
	"name": "@sekei",
	"homepage": "https://www.sekei.xyz/dither-fx",
	"url": "https://www.sekei.xyz/registry/{name}.json",
	"description": "Ordered-dither canvas effects for React: fire, lightning, sonar rings, a light beam, a sloshing fluid, rain and snow, copied into your project as source.",
	"author": "Piergiorgio Gonni",
	"logo": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' fill='var(--foreground)'><rect width='32' height='32' rx='8' fill-opacity='.12'/><path d='M8 8h4v4H8zM20 8h4v4h-4zM14 14h4v4h-4zM8 20h4v4H8zM20 20h4v4h-4z'/></svg>"
}
```
