/**
 * Simple 1D value noise for natural-looking random motion.
 */
export class SmoothNoise {
	private seeds: number[] = [];
	private seedCount: number;

	constructor(seedCount = 8) {
		this.seedCount = seedCount;
		for (let i = 0; i < seedCount; i++) {
			this.seeds.push(Math.random() * 1000);
		}
	}

	noise(time: number, index = 0): number {
		const s = this.seeds[index % this.seedCount];
		const t = time + s;
		const i = Math.floor(t);
		const f = t - i;
		const f2 = f * f * (3 - 2 * f); // smoothstep
		const a = this.fracSin(i);
		const b = this.fracSin(i + 1);
		return a + (b - a) * f2;
	}

	/** Noise mapped to [-amplitude, amplitude] */
	range(time: number, index: number, amplitude: number): number {
		return (this.noise(time, index) - 0.5) * 2 * amplitude;
	}

	private fracSin(n: number): number {
		return Math.sin(n * 12.9898 + 78.233) * 0.5 + 0.5;
	}
}

export function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

export function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

export function damp(current: number, target: number, speed: number, dt: number): number {
	return lerp(current, target, 1 - Math.exp(-speed * dt));
}

export function pingPong(t: number): number {
	return Math.abs((t % 2) - 1);
}

export function easeInOutSine(t: number): number {
	return -(Math.cos(Math.PI * t) - 1) / 2;
}
