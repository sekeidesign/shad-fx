"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";
import { type Fx, FxEngine } from "../engine";
import { AsciiRenderer, SYSTEM_MONO } from "./painter";

export interface AsciiCanvasProps {
	/** From `useFx`. A different effect starts from scratch; the canvas is kept. */
	effect: Fx;
	/** Eases the effect in and out. Defaults to on. */
	active?: boolean;
	/**
	 * Any CSS `font-family`, `var()` included. Defaults to the system monospace.
	 * Load a web font as the page already does; the canvas redraws once it lands.
	 */
	fontFamily?: string;
	/** CSS px. A glyph cell is one advance wide and two tall. */
	fontSize?: number;
	/** Lightest to densest, for evenly lit glyphs. Defaults to `.:-=+*#%@`. */
	ramp?: string;
	seed?: number;
	/** Ceiling on the glyph grid, so a large box can't cost a large frame. */
	maxCols?: number;
	maxRows?: number;
	className?: string;
}

/** Fills its positioned parent with a canvas drawing `effect` as coloured glyphs. */
export function AsciiCanvas({
	effect,
	active = true,
	fontFamily = SYSTEM_MONO,
	fontSize = 10,
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

	// As in DitherCanvas, only what the renderer is built from rebuilds it.
	// The font effect below sizes it.
	// biome-ignore lint/correctness/useExhaustiveDependencies: see above
	useEffect(() => {
		const wrap = wrapRef.current;
		const canvas = canvasRef.current;
		if (!wrap || !canvas) return;
		const renderer = new AsciiRenderer(canvas, { ramp, maxCols, maxRows });
		const engine = new FxEngine(renderer, effect, { seed });
		rendererRef.current = renderer;
		engineRef.current = engine;
		runningRef.current = effect;
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
		return () => {
			ro.disconnect();
			io.disconnect();
			engine.destroy();
			engineRef.current = null;
			rendererRef.current = null;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [seed, maxCols, maxRows]);

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

	// A canvas font can't hold `var()`, so the family is read back computed from
	// the wrapper. Re-runs after a rebuild, since a new renderer needs it too.
	// biome-ignore lint/correctness/useExhaustiveDependencies: see above
	useEffect(() => {
		const wrap = wrapRef.current;
		const renderer = rendererRef.current;
		const engine = engineRef.current;
		if (!wrap || !renderer || !engine) return;
		let live = true;
		const apply = () => {
			renderer.setFont(getComputedStyle(wrap).fontFamily || SYSTEM_MONO, fontSize);
			engine.resize(wrap.clientWidth, wrap.clientHeight);
		};
		apply();
		const fonts = document.fonts;
		if (fonts && !fonts.check(renderer.font)) {
			fonts.load(renderer.font).then(() => live && apply(), () => {});
		}
		return () => {
			live = false;
		};
	}, [fontFamily, fontSize, seed, maxCols, maxRows]);

	return (
		<div
			ref={wrapRef}
			aria-hidden
			className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
			style={{ fontFamily }}
		>
			<canvas ref={canvasRef} className="absolute top-0 left-0" />
		</div>
	);
}
