import type { VRM } from '@pixiv/three-vrm';
import type { AnimationContext, AnimationLayer, AnimationState } from './types';

export class VrmAnimator {
	private states: Map<string, AnimationState> = new Map();
	private currentStateName: string | null = null;
	private globalTime = 0;
	private _isRunning = false;
	private _vrm: VRM | null = null;

	/** Called each frame with the current VRM context */
	private onUpdate?: (ctx: AnimationContext) => void;

	addState(state: AnimationState): this {
		this.states.set(state.name, state);
		return this;
	}

	setVrm(vrm: VRM): this {
		this._vrm = vrm;
		return this;
	}

	transitionTo(name: string): this {
		if (!this.states.has(name)) {
			console.warn(`Animation state '${name}' not found.`);
			return this;
		}
		const prev = this.currentStateName ? this.states.get(this.currentStateName) : undefined;
		const next = this.states.get(name)!;

		if (prev && this._vrm) {
			const ctx = this.makeContext();
			for (const layer of prev.layers) {
				layer.exit?.(ctx);
			}
		}

		this.currentStateName = name;

		if (this._vrm) {
			const ctx = this.makeContext();
			for (const layer of next.layers) {
				layer.enter?.(ctx);
			}
		}
		return this;
	}

	start(stateName?: string): this {
		this._isRunning = true;
		if (stateName) {
			this.transitionTo(stateName);
		} else if (!this.currentStateName && this.states.size > 0) {
			const first = this.states.keys().next().value;
			if (first) this.transitionTo(first);
		}
		return this;
	}

	stop(): this {
		this._isRunning = false;
		return this;
	}

	update(deltaTime: number): void {
		if (!this._isRunning || !this._vrm || !this.currentStateName) return;

		this.globalTime += deltaTime;
		const ctx = this.makeContext(deltaTime);

		const state = this.states.get(this.currentStateName);
		if (!state) return;

		for (const layer of state.layers) {
			if (layer.weight > 0) {
				layer.update(ctx);
			}
		}

		this.onUpdate?.(ctx);
	}

	get isRunning(): boolean {
		return this._isRunning;
	}

	get currentState(): string | null {
		return this.currentStateName;
	}

	get time(): number {
		return this.globalTime;
	}

	private makeContext(deltaTime = 0): AnimationContext {
		return {
			vrm: this._vrm!,
			time: this.globalTime,
			deltaTime
		};
	}
}
