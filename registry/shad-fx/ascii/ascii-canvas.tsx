"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";
import { type Fx, FxEngine } from "../engine";
import { AsciiRenderer } from "./painter";

export interface AsciiCanvasProps {
	/** From `useFx`. A different effect starts from scratch; the canvas is kept. */
	effect: Fx;
	/** Eases the effect in and out. Defaults to on. */
	active?: boolean;
	/** CSS px. A glyph cell is one advance wide and two tall. */
	fontSize?: number;
	/** Lightest to densest, for evenly lit glyphs. Defaults to `.:-=+*#%@`. */
	ramp?: string;
	seed?: number;
	/** Ceiling on the glyph grid, so a large box can't cost a large frame. */
	maxCols?: number;
	maxRows?: number;
	/** The font comes from here: `font-mono` unless a class overrides it. */
	className?: string;
}

/**
 * Fills its positioned parent with a canvas that draws `effect` as coloured
 * glyphs. The font is the wrapper's computed one, so it follows the project's
 * `font-mono` and any font class passed in `className`.
 */
export function AsciiCanvas({
	effect,
	active = true,
	fontSize = 12,
	ramp,
	seed = 1,
	maxCols,
	maxRows,
	className,
}: AsciiCanvasProps) {
	const wrapRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const engineRef = useRef<FxEngine | null>(null);
	const rendererRef = useRef<AsciiRenderer | null>(null);
	const runningRef = useRef(effect);
	const reduced = usePrefersReducedMotion();

	// As in DitherCanvas: only what the renderer is built from rebuilds the
	// engine. `effect`, `active`, `reduced` and `ramp` are seeded into a fresh
	// one here and applied on their own below.
	// biome-ignore lint/correctness/useExhaustiveDependencies: see above
	useEffect(() => {
		const wrap = wrapRef.current;
		const canvas = canvasRef.current;
		if (!wrap || !canvas) return;
		const family = getComputedStyle(wrap).fontFamily || undefined;
		const renderer = new AsciiRenderer(canvas, { fontSize, fontFamily: family, ramp, maxCols, maxRows });
		const engine = new FxEngine(renderer, effect, { seed });
		rendererRef.current = renderer;
		engineRef.current = engine;
		runningRef.current = effect;
		engine.resize(wrap.clientWidth, wrap.clientHeight);
		engine.setReduced(reduced);
		engine.setActive(active);
		const ro = new ResizeObserver(([entry]) => {
			const { width, height } = entry.contentRect;
			engine.resize(width, height);
		});
		ro.observe(wrap);
		const io = new IntersectionObserver(
			([entry]) => engine.setVisible(entry.isIntersecting),
			{ rootMargin: "100px" },
		);
		io.observe(wrap);
		// A web font that has not loaded yet measured and drew as its fallback.
		// Once it lands, re-measure: the cell may change size, and the effect
		// only restarts if that changes the grid.
		let live = true;
		document.fonts?.load(renderer.font).then(() => {
			if (!live) return;
			renderer.setFont(getComputedStyle(wrap).fontFamily || family || "monospace");
			engine.resize(wrap.clientWidth, wrap.clientHeight);
		}, () => {});
		return () => {
			live = false;
			ro.disconnect();
			io.disconnect();
			engine.destroy();
			engineRef.current = null;
			rendererRef.current = null;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fontSize, seed, maxCols, maxRows]);

	useEffect(() => {
		if (runningRef.current === effect) return;
		runningRef.current = effect;
		engineRef.current?.setFx(effect);
	}, [effect]);

	useEffect(() => {
		engineRef.current?.setReduced(reduced);
	}, [reduced]);

	useEffect(() => {
		engineRef.current?.setActive(active);
	}, [active]);

	useEffect(() => {
		rendererRef.current?.setRamp(ramp ?? "");
	}, [ramp]);

	// A class can change the font. Re-read it in place rather than rebuilding,
	// so a class toggled on hover does not restart the effect.
	// biome-ignore lint/correctness/useExhaustiveDependencies: className is the trigger
	useEffect(() => {
		const wrap = wrapRef.current;
		const renderer = rendererRef.current;
		if (!wrap || !renderer) return;
		const family = getComputedStyle(wrap).fontFamily;
		if (!family || family === renderer.family) return;
		renderer.setFont(family);
		engineRef.current?.resize(wrap.clientWidth, wrap.clientHeight);
	}, [className]);

	return (
		<div
			ref={wrapRef}
			aria-hidden
			className={cn(
				"pointer-events-none absolute inset-0 overflow-hidden font-mono",
				className,
			)}
		>
			<canvas ref={canvasRef} className="absolute top-0 left-0" />
		</div>
	);
}
