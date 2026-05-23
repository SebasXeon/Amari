import type { AnimationContext, AnimationLayer, BoneName } from '../types';
import { SmoothNoise, damp, clamp, easeInOutSine } from '../math';

interface IdleConfig {
	/** Breaths per minute */
	breathRate: number;
	/** Sway intensity for spine/head */
	swayAmount: number;
	/** How often the head looks to a new direction (seconds) */
	lookInterval: number;
	/** Blink interval min/max in seconds */
	blinkIntervalMin: number;
	blinkIntervalMax: number;
	/** Micro-movement intensity for arms */
	microMovement: number;
}

const DEFAULT_CONFIG: IdleConfig = {
	breathRate: 14,
	swayAmount: 0.03,
	lookInterval: 4,
	blinkIntervalMin: 2.5,
	blinkIntervalMax: 6,
	microMovement: 0.015
};

export function createIdleLayer(config: Partial<IdleConfig> = {}): AnimationLayer {
	const cfg = { ...DEFAULT_CONFIG, ...config };
	const noise = new SmoothNoise(12);

	// Mutable state for this layer
	let nextBlinkTime = 0;
	let blinkState: 'open' | 'closing' | 'closed' | 'opening' = 'open';
	let blinkTimer = 0;
	const blinkDurationOpen = 0.08;
	const blinkDurationClosed = 0.05;

	let lookTargetYaw = 0;
	let lookTargetPitch = 0;
	let currentHeadYaw = 0;
	let currentHeadPitch = 0;
	let nextLookTime = 0;

	let currentChestRot = 0;
	let currentHipsRotY = 0;
	let currentHipsPosY = 0;

	let leftArmRotZ = 0;
	let rightArmRotZ = 0;

	return {
		name: 'idle',
		weight: 1,
		update(ctx: AnimationContext) {
			const { vrm, time, deltaTime } = ctx;
			const humanoid = vrm.humanoid;
			if (!humanoid) return;

			// ---------- BREATHING ----------
			const breathPeriod = 60 / cfg.breathRate;
			const breathT = (time % breathPeriod) / breathPeriod;
			const breathValue = easeInOutSine(Math.sin(breathT * Math.PI * 2) * 0.5 + 0.5);

			const chest = humanoid.getNormalizedBoneNode('chest' as BoneName);
			if (chest) {
				currentChestRot = damp(currentChestRot, breathValue * 0.04, 3, deltaTime);
				chest.rotation.x = currentChestRot;
			}

			const upperChest = humanoid.getNormalizedBoneNode('upperChest' as BoneName);
			if (upperChest) {
				upperChest.rotation.x = breathValue * 0.025;
				upperChest.scale.setScalar(1 + breathValue * 0.005);
			}

			// ---------- POSTURE SWAY ----------
			const hips = humanoid.getNormalizedBoneNode('hips' as BoneName);
			if (hips) {
				const targetHipsY = noise.range(time * 0.5, 0, cfg.swayAmount * 0.3);
				currentHipsRotY = damp(currentHipsRotY, targetHipsY, 2, deltaTime);
				hips.rotation.y = currentHipsRotY;

				const targetHipsPosY = noise.range(time * 0.3, 1, 0.005) - breathValue * 0.003;
				currentHipsPosY = damp(currentHipsPosY, targetHipsPosY, 2, deltaTime);
				hips.position.y = currentHipsPosY;
			}

			const spine = humanoid.getNormalizedBoneNode('spine' as BoneName);
			if (spine) {
				spine.rotation.z = noise.range(time * 0.4, 2, cfg.swayAmount * 0.6);
				spine.rotation.y = noise.range(time * 0.3, 3, cfg.swayAmount * 0.3);
			}

			// ---------- HEAD LOOK-AROUND ----------
			if (time >= nextLookTime) {
				lookTargetYaw = (Math.random() - 0.5) * 0.6;
				lookTargetPitch = (Math.random() - 0.5) * 0.35;
				nextLookTime = time + cfg.lookInterval + (Math.random() - 0.5) * 2;
			}

			currentHeadYaw = damp(currentHeadYaw, lookTargetYaw, 2.5, deltaTime);
			currentHeadPitch = damp(currentHeadPitch, lookTargetPitch, 2.5, deltaTime);

			const head = humanoid.getNormalizedBoneNode('head' as BoneName);
			if (head) {
				head.rotation.y = currentHeadYaw + noise.range(time * 0.6, 4, 0.02);
				head.rotation.x = currentHeadPitch + noise.range(time * 0.5, 5, 0.015);
				head.rotation.z = noise.range(time * 0.35, 6, 0.01);
			}

			const neck = humanoid.getNormalizedBoneNode('neck' as BoneName);
			if (neck) {
				neck.rotation.y = currentHeadYaw * 0.3;
				neck.rotation.x = currentHeadPitch * 0.2;
			}

			// ---------- EYE BLINK ----------
			if (time >= nextBlinkTime && blinkState === 'open') {
				blinkState = 'closing';
				blinkTimer = 0;
				nextBlinkTime = time + cfg.blinkIntervalMin + Math.random() * (cfg.blinkIntervalMax - cfg.blinkIntervalMin);
			}

			let blinkWeight = 0;
			if (blinkState === 'closing') {
				blinkTimer += deltaTime;
				blinkWeight = clamp(blinkTimer / blinkDurationOpen, 0, 1);
				if (blinkTimer >= blinkDurationOpen) {
					blinkState = 'closed';
					blinkTimer = 0;
				}
			} else if (blinkState === 'closed') {
				blinkTimer += deltaTime;
				blinkWeight = 1;
				if (blinkTimer >= blinkDurationClosed) {
					blinkState = 'opening';
					blinkTimer = 0;
				}
			} else if (blinkState === 'opening') {
				blinkTimer += deltaTime;
				blinkWeight = 1 - clamp(blinkTimer / blinkDurationOpen, 0, 1);
				if (blinkTimer >= blinkDurationOpen) {
					blinkState = 'open';
					blinkTimer = 0;
					blinkWeight = 0;
				}
			}

			if (vrm.expressionManager && blinkWeight > 0.001) {
				vrm.expressionManager.setValue('blink', blinkWeight);
				vrm.expressionManager.update();
			} else if (vrm.expressionManager) {
				vrm.expressionManager.setValue('blink', 0);
			}

			// ---------- MICRO ARM MOVEMENTS ----------
			const leftUpper = humanoid.getNormalizedBoneNode('leftUpperArm' as BoneName);
			const rightUpper = humanoid.getNormalizedBoneNode('rightUpperArm' as BoneName);

			if (leftUpper) {
				const target = noise.range(time * 0.7, 7, cfg.microMovement);
				leftArmRotZ = damp(leftArmRotZ, target, 1.5, deltaTime);
				leftUpper.rotation.z = leftArmRotZ;
				leftUpper.rotation.x = noise.range(time * 0.5, 8, cfg.microMovement * 0.5);
			}

			if (rightUpper) {
				const target = noise.range(time * 0.7, 9, cfg.microMovement);
				rightArmRotZ = damp(rightArmRotZ, target, 1.5, deltaTime);
				rightUpper.rotation.z = rightArmRotZ;
				rightUpper.rotation.x = noise.range(time * 0.5, 10, cfg.microMovement * 0.5);
			}
		}
	};
}
