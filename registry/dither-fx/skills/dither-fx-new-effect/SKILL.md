---
name: dither-fx-new-effect
description: Write a new effect for dither-fx, the ordered-dither canvas library under components/dither-fx, or change how an existing one simulates. Use this whenever the user wants a dithered or pixelated animation that the shipped set (fire, bolt, rings, fluid, beam, rain, snow) does not cover - stars, smoke, sparks, static, embers, matrix rain, aurora, waves, confetti, a scanline sweep - or asks to add, create, build or extend a DitherCanvas effect, even if they call it a shader, a particle system or a background animation. Also use it when an effect restarts or flickers on the ease-out, never parks when inactive, ignores reduced motion, or looks different at different sizes or seeds.
---

# Writing a dither-fx effect

An effect is a factory returning a `DitherEffect`: three methods the engine
calls, and nothing else. Everything visible is painted through a `Painter`
into a grid of cells. Read these before writing, in this order; they are short:

1. `components/dither-fx/engine.ts` — the contract, the painter, the loop.
2. `components/dither-fx/effects/fire.ts` — a simulation with its own state.
3. `components/dither-fx/effects/beam.ts` — a scene driven purely by intensity.
4. `components/dither-fx/effects/particles.ts` — the shared particle helpers.

## The contract

```ts
interface DitherEffect {
  resize(cols: number, rows: number, rand: () => number): void;
  step(frame: DitherFrame): boolean;   // true when the painter holds a new frame
  idle(): boolean;                     // true once nothing is left to animate
}
```

`DitherFrame` carries `px` (the painter), `cols`, `rows`, `t` (seconds since
start), `dt` (seconds since last frame, capped at 0.1 so a background tab does
not jump), `intensity` (eased 0–1 from `active`), `reduced` and `rand`.

The engine eases `intensity` toward 1 or 0, calls `step` on every animation
frame, blits the painter when `step` returns true, and **parks the loop when
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
out or never parking.

## Painting

The painter writes into a `Uint32Array` and the engine blits once per frame,
so per-cell work is cheap and per-cell allocation is not. Start every paint
with `px.clear()`. Then:

- `px.dither(x, y, density, color, gain = 1)` — the signature look. Every cell
  in range is painted at one of two alpha tiers; the Bayer threshold decides
  which. Use it for fields and gradients: heat, glow, a fading band. Density
  is 0–1; shape it with a power (`h ** 0.85`) rather than a threshold.
- `px.blend(x, y, color, alpha)` — a solid source-over pixel. Use it for
  strokes, points and surfaces that must read as continuous. A streak dithered
  end to end breaks into dots below the threshold; rain blends the near part
  of each streak and dithers only the tail.
- `px.glint(x, y, color, alpha, arms)` — a sparkle: centre plus four arms that
  flare in with `arms` (0–1). Pair with `twinkle` and `arms` from
  `particles.ts` for a wink that flashes rather than pulses.
- `px.inside(x, y)` is checked for you in every write; drawing off-grid is a
  no-op, so let particles fly past the edges and cull them later.

The `gain` argument on `dither` exists for reduced motion: pass `intensity`
there so the still frame can still fade in and out.

## Units, time and randomness

- Sizes are cells. Express speeds as fractions of `rows` per second and
  positions as fractions of the box, so the effect looks the same in a badge
  and a hero. The grid is capped at 640×400, so a per-cell pass per frame is
  affordable; a per-cell pass per particle is not.
- Use `dt` for motion and `t` for oscillation. Never read the clock.
- Use only the `rand` handed to `resize` and `step`. It is seeded from the
  canvas `seed`, which is what makes a given seed replay identically; a
  `Math.random()` anywhere breaks that promise silently.
- `resize` is called on mount, on every box change and when the effect is
  swapped in. Rebuild your fields there (`new Float32Array(cols * rows)`),
  reset accumulators and clear particles. Do not keep state that assumes the
  old grid.

## Anchors and steerable options

A position option is an `Anchor`: `readonly [x, y]` in 0–1 or a getter. Call
`resolveAnchor(anchor)` every `step`, never only in `resize`, so a getter can
follow a pointer. If a position feeds an expensive per-cell table (rings caches
every cell's distance from its origin), rebuild the table only when the
resolved value changes. Numeric options that a user might want to bind to live
state (`height`, `level`, `slant`) take `number | (() => number)` and are read
the same way, every frame.

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
  color?: RgbInput;                       // hex or [r, g, b]; convert once with toRgb
  /** Embers aloft at once, at full intensity. */
  count?: number;
  /** Rise speed as a fraction of the height per second. */
  speed?: number;
}

export function embers({
  color: colorInput = [252, 187, 0],
  count = 24,
  speed = 0.2,
}: EmberOptions = {}): DitherEffect { … }
```

Every option optional with a default, `RgbInput` for any colour, a one-line
JSDoc on each stating the unit and whether it scales with intensity. That
JSDoc is the consumer's documentation; there is no other.

## Wiring it in

In a project that installed dither-fx: write
`components/dither-fx/effects/<name>.ts`, importing from `../engine` and
`./particles`, and add `export { <name>, type <Name>Options } from "./effects/<name>";`
to `components/dither-fx/index.ts`. Then use it like any other:
`<DitherCanvas effect={useMemo(() => embers(), [])} />`.

To contribute it upstream, the repo's AGENTS.md at
https://github.com/sekeidesign/dither-fx covers the registry item and the
rebuild; the effect file itself is identical.

## Before calling it done

- Ease in from `active={false}` to `true` and back. It should grow and drain,
  not snap, and the canvas should end empty.
- Confirm it parks: with `active={false}` and the fade finished, no frame work
  should show in the performance panel.
- Toggle reduced motion in devtools: one still frame, nothing moving.
- Resize the box: no crash, no ghost of the old grid.
- Two canvases with the same `seed` show the same thing.
- Search the file for `Math.random`, `Date.now` and `performance.now`. None.
