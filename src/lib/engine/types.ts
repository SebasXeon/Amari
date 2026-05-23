import type { VRM } from '@pixiv/three-vrm';

export interface AnimationContext {
	vrm: VRM;
	time: number;
	deltaTime: number;
}

export interface AnimationLayer {
	name: string;
	/** 0-1 blend weight. Layers are applied in order (additive). */
	weight: number;
	update(ctx: AnimationContext): void;
	enter?(ctx: AnimationContext): void;
	exit?(ctx: AnimationContext): void;
}

export interface AnimationState {
	name: string;
	layers: AnimationLayer[];
}

export type BoneName =
	| 'hips'
	| 'spine'
	| 'chest'
	| 'upperChest'
	| 'neck'
	| 'head'
	| 'leftEye'
	| 'rightEye'
	| 'leftShoulder'
	| 'rightShoulder'
	| 'leftUpperArm'
	| 'rightUpperArm'
	| 'leftLowerArm'
	| 'rightLowerArm'
	| 'leftHand'
	| 'rightHand'
	| 'leftUpperLeg'
	| 'rightUpperLeg'
	| 'leftLowerLeg'
	| 'rightLowerLeg'
	| 'leftFoot'
	| 'rightFoot';

export type ExpressionName =
	| 'happy'
	| 'angry'
	| 'sad'
	| 'relaxed'
	| 'surprised'
	| 'blink'
	| 'blinkLeft'
	| 'blinkRight'
	| 'neutral';
