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
r/                     built output, committed
scripts/check-registry.mjs
```

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

## Item names

`dither-fx`, `dither-fx-<effect>`, `use-prefers-reduced-motion`. They are the
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
