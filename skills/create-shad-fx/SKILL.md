---
name: create-shad-fx
description: Write a new effect for shad-fx, the canvas effects library under components/shad-fx, or change how an existing one simulates. Use this whenever the user wants a dithered or pixelated animation that the shipped set (fire, bolt, rings, fluid, beam, rain, snow) does not cover - stars, smoke, sparks, static, embers, matrix rain, aurora, waves, confetti, a scanline sweep - or asks to add, create, build or extend a DitherCanvas effect, even if they call it a shader, a particle system or a background animation. Also use it when an effect restarts or flickers on the ease-out, restarts or ignores an option change, never parks when inactive, ignores reduced motion, or looks different at different sizes or seeds.
---

# Writing a shad-fx effect

An effect is a factory returning an `FxEffect`: four methods, three the
engine calls every frame and one that applies new options, and nothing else. Everything visible is painted through a `Surface`
into a grid of cells. The effect never knows which renderer draws those cells:
the same effect runs on `DitherCanvas` today and on any renderer added later.
Read these before writing, in this order; they are short:

1. `components/shad-fx/engine.ts` — the contract, the `Surface`, the loop.
2. `components/shad-fx/effects/fire.ts` — a simulation with its own state.
3. `components/shad-fx/effects/snow.ts` — a scene driven by intensity, with a
   built still frame for reduced motion. `beam.ts` is the same shape at its
   simplest.
4. `components/shad-fx/effects/particles.ts` — the shared particle helpers.

## The contract

```ts
interface FxEffect<O> {
  resize(cols: number, rows: number, rand: () => number): void;
  step(frame: FxFrame): boolean;       // true when the surface holds a new frame
  idle(): boolean;                     // true once nothing is left to animate
  set(options: O): void;               // only the keys that changed
}
```

`FxFrame` carries `px` (the surface), `cols`, `rows`, `t` (seconds since
start), `dt` (seconds since last frame, capped at 0.1 so a background tab does
not jump), `intensity` (eased 0–1 from `active`), `reduced` and `rand`.

The engine eases `intensity` toward 1 or 0, calls `step` on every animation
frame, has the renderer present the surface when `step` returns true, and **parks the loop when
intensity has settled AND `idle()` is true AND (the target is 0 OR motion is
reduced)**. Two consequences shape every effect:

- While active and not reduced, the loop always runs. `idle()` can be anything.
- After `active` goes false, the loop keeps running until `idle()` is true. An
  effect that never reports idle burns a frame loop forever on an invisible
  canvas. An effect that reports idle too early gets cut off mid-fade.

## Two shapes

**Simulation** (fire, bolt, rings, rain): state that evolves and needs time to
drain. Intensity drives what is *spawned*, not what is drawn, so easing out
lets what is aloft finish. Keep `alive` (did the last paint draw anything?) and
`lastReduced`, and report `idle: () => lastReduced || !alive`. Run the
simulation at a fixed `rate` through an accumulator so it reads chunky and
identical at any refresh rate:

```ts
acc += dt;
let stepped = false;
while (acc >= 1 / rate) { acc -= 1 / rate; simulate(intensity); stepped = true; }
if (!stepped && particles.length === 0) return false; // nothing new to blit
paint(frame);
return true;
```

**Intensity-driven** (beam, fluid, snow): the whole picture is a function of
`t` and `intensity`, with nothing to drain. Scale every alpha by `intensity`,
report `idle: () => true`, and keep a `dark` flag so the canvas is cleared
exactly once when intensity reaches zero:

```ts
if (intensity <= 0.002) { if (dark) return false; px.clear(); dark = true; return true; }
dark = false;
```

Pick the shape first. Mixing them is how effects end up flickering on the way
out or never parking. The test is what happens to a transient on the way out:
a shooting star inside a starfield, a splash inside a puddle. If it may simply
fade with the scene, the effect is intensity-driven and the transient is just
more pixels scaled by `intensity`. If it has to finish (rain's drops land,
rings reach the edge), the whole effect is a simulation, field included.

In an intensity-driven effect the order of the first two branches in `step`
matters: check `intensity <= 0.002` and clear *before* the `reduced` branch,
or the still frame never clears on ease-out. snow.ts has it right.

## Painting

`px` is a `Surface`, and these four calls are the whole of it. Paint through
nothing else, and import nothing from a renderer folder, or the effect only
works on that renderer. Each renderer writes cells into a buffer and presents
once per frame, so per-cell work is cheap and per-cell allocation is not.
Start every paint with `px.clear()`. Then:

- `px.dither(x, y, density, color, gain = 1)` — a field sample. The dither
  renderer paints every cell in range at one of two alpha tiers and lets the
  Bayer threshold decide which; another renderer maps density its own way. Use
  it for fields and gradients: heat, glow, a fading band. Density
  is 0–1; shape it with a power (`h ** 0.85`) rather than a threshold.
- `px.blend(x, y, color, alpha)` — a solid source-over cell. Use it for
  strokes, points and surfaces that must read as continuous. A streak dithered
  end to end breaks into dots below the threshold; rain blends the near part
  of each streak and dithers only the tail.
- `px.glint(x, y, color, alpha, arms)` — a sparkle: centre plus four arms that
  flare in with `arms` (0–1). Pair with `twinkle(t, phase, hz)` and `arms(tw)`
  from `particles.ts` for a wink that flashes rather than pulses; `hz` is the
  per-particle wink speed.
- Drawing off-grid is a no-op in every call, so let particles fly past the
  edges and cull them later.

The `gain` argument on `dither` exists for reduced motion: pass `intensity`
there so the still frame can still fade in and out.

## Units, time and randomness

- Sizes are cells. Express speeds as fractions of `rows` per second and
  positions as fractions of the box, so the effect looks the same in a badge
  and a hero. The grid is capped at 640×400, so a per-cell pass per frame is
  affordable; a per-cell pass per particle is not.
- Use `dt` for motion and `t` for oscillation. Never read the clock.
- Use only the `rand` handed to `resize` and `step`. They are the same seeded
  stream; the shipped effects keep the one from `resize` in a closure
  variable. It is seeded from the canvas `seed`, which is what makes a given
  seed replay identically; a `Math.random()` call anywhere breaks that promise
  silently. The shipped effects initialise that variable to `Math.random` as
  a placeholder, which is never called because `resize` always runs before
  `step`; `() => 0.5` does the same job without tripping a grep.
- `resize` is called on mount, on every box change and when the effect is
  swapped in. Anything in cells (a `Float32Array` field, particle positions)
  is wrong for the new grid, so rebuild it there and reset accumulators. State
  kept as fractions of the box can survive a resize if a reshuffle would be
  visible: a starfield that re-rolls on every responsive step looks broken,
  while snow reseeding its flakes does not. Choose per effect, and say which
  in a comment.

## Live options: `set`

Every option can change while the effect runs, through `useFx` props or
`fx.set`, and neither restarts the effect. Both arrive at `set` with only the
keys that changed. A key present but `undefined` means the prop was removed
and goes back to its default; `assign` from the engine handles that. Read
options from the merged object, `o.speed`, at the point of use rather than
destructuring them once, and most options are live for free.

`set` only has to deal with what a value was turned into or built from:

- **Derived values.** A colour converted once with `toRgb`: convert it again.
  A per-cell table built from a position (rings caches every cell's distance
  from `origin`): rebuild it, and only when that key is in the patch.
- **Counts that size an array.** Top up or trim it (beam's motes, snow's
  flakes) so what is on screen stays put. Never reset the whole simulation for
  a count change.
- **The reduced-motion still frame.** If it was built from the option (fire is
  warmed to `height`, rain hangs `drops` drops), clear the `still` flag so the
  next step builds it again. The engine wakes after every `set`, so a parked
  still frame repaints once and parks again.
- `set` can be called before the first `resize`. Anything sized in cells
  waits for `resize` while `cols` is 0.

A position is an `Anchor`, `readonly [x, y]` in 0–1. There are no getter
options: something that moves calls `fx.set` as it moves.

## Reduced motion

Under `reduced`, paint one settled frame that says what the effect is: fire is
pre-warmed and still, rings sit at three fixed radii, rain hangs mid-fall,
snow has its drift already built. Build it once behind a `still` flag, return
true so it blits, and let `idle` be true so the loop parks. When `reduced`
flips back, drop the still state so the simulation restarts clean. Nothing
should oscillate under reduce: pass `time = 0` into anything that uses `t`.

## Options and defaults

```ts
export interface EmberOptions {
  color?: RgbInput;                       // hex or [r, g, b]; convert with toRgb
  /** Embers aloft at once, at full intensity. */
  count?: number;
  /** Rise speed as a fraction of the height per second. */
  speed?: number;
}

const DEFAULTS: Required<EmberOptions> = {
  color: [252, 187, 0],
  count: 24,
  speed: 0.2,
};

export function embers(options: EmberOptions = {}): FxEffect<EmberOptions> {
  let o = assign(DEFAULTS, DEFAULTS, options);
  let color = toRgb(o.color);
  // … state, and o.count / o.speed read where they are used …
  return {
    resize(c, r, random) { … },
    step(frame) { … },
    idle: () => lastReduced || !alive,
    set(patch) {
      o = assign(DEFAULTS, o, patch);
      if ("color" in patch) color = toRgb(o.color);
    },
  };
}
```

Every option optional with a default in `DEFAULTS`, `RgbInput` for any
colour, a one-line JSDoc on each stating the unit and whether it scales with
intensity. That JSDoc is the consumer's documentation; there is no other. An
option with no default (beam's `target`) is typed out of `Required` and kept
`undefined` in `DEFAULTS`.

## Wiring it in

In a project that installed shad-fx: write
`components/shad-fx/effects/<name>.ts`, importing only from `../engine` and
`./particles`; never from React or `use-fx`. If `components/shad-fx/index.ts` exists (the full library was
installed), add `export { <name>, type <Name>Options } from "./effects/<name>";`
there; otherwise import the effect from its file. Then use it like any other:
`const fx = useFx(embers, { count: 12 })` and `<DitherCanvas effect={fx} />`.

To contribute it upstream, the repo's AGENTS.md at
https://github.com/sekeidesign/shad-fx covers the registry item and the
rebuild; the effect file itself is identical.

## Before calling it done

Most of this can be checked without a browser. The dither renderer's `Painter`
needs only a global `ImageData`, so an effect runs in Node under `npx tsx`:

```ts
// scratch/smoke.mts — npx tsx scratch/smoke.mts
import { seededRandom } from "../components/shad-fx/engine";
import { Painter } from "../components/shad-fx/dither/painter";
import { stars as effect } from "../components/shad-fx/effects/stars";

class ImageData {
  data: Uint8ClampedArray;
  constructor(public width: number, public height: number) {
    this.data = new Uint8ClampedArray(width * height * 4);
  }
}
(globalThis as { ImageData?: unknown }).ImageData = ImageData;

const cols = 160, rows = 100;
const fx = effect();
const rand = seededRandom(1);
const px = new Painter(cols, rows);
fx.resize(cols, rows, rand);
const lit = () => { let n = 0; for (let i = 3; i < px.image.data.length; i += 4) if (px.image.data[i]) n++; return n; };
const step = (t: number, intensity: number, reduced = false) =>
  fx.step({ px, cols, rows, t, dt: 1 / 60, intensity, reduced, rand });

for (let i = 0; i < 180; i++) step(i / 60, 1);
console.log("active: lit cells", lit());                       // > 0
for (let i = 0; i < 180; i++) step(3 + i / 60, 0);
console.log("eased out: lit", lit(), "idle", fx.idle(), "painting", step(7, 0)); // 0 true false
step(8, 1, true); const a = px.image.data.slice(); step(9, 1, true);
console.log("reduced: frames identical", a.every((v, i) => v === px.image.data[i])); // true

fx.set({ color: "#00ff00" }); step(10, 1);                    // every option, in turn
console.log("set applies:", px.image.data.some((v, i) => i % 4 === 1 && v === 255)); // true
fx.set({ color: undefined }); step(11, 1);
console.log("unset restores the default:", !px.image.data.some((v, i) => i % 4 === 1 && v === 255)); // true
```

Then in the browser:

- Ease in from `active={false}` to `true` and back. It should grow and drain,
  not snap, and the canvas should end empty.
- Confirm it parks: with `active={false}` and the fade finished, no frame work
  should show in the performance panel.
- Toggle reduced motion in devtools: one still frame, nothing moving.
- Resize the box: no crash, no ghost of the old grid.
- Change every option while it runs, and again under reduced motion: each
  shows on the next frame, and none resets what is on screen except where a
  comment in `set` says why.
- Two canvases with the same `seed` show the same thing.
- Search the file for `Math.random`, `Date.now` and `performance.now`. The
  only hit allowed is the pre-resize placeholder described above.
