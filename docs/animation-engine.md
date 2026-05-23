# Amari Animation Engine

## Overview

The animation engine is a **layered, state-machine based procedural animation system** built for VRM characters. It runs entirely in JavaScript/TypeScript using Three.js and `@pixiv/three-vrm`, with no pre-recorded animation clips or BVH files. Every motion is generated mathematically in real-time.

The engine follows an architecture inspired by professional game animation systems (Unity Mecanim, Unreal AnimGraph) with three separation-of-concerns layers:

1. **UI / Render Loop** (`VRMCharacter.svelte`) — WebGL lifecycle, input handling, camera
2. **State Machine** (`VrmAnimator.ts`) — Manages animation states, blends layers, provides context
3. **Animation Layers** (e.g., `idle.ts`) — Individual procedural animation behaviors

---

## Architecture

```
┌─────────────────────────────────────────┐
│         VRMCharacter.svelte             │
│  Creates renderer, loads VRM, drives      │
│  the animator every frame, handles        │
│  mouse/scroll/wheel input                 │
└─────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│           VrmAnimator                   │
│  Manages states, blends layers,          │
│  provides AnimationContext each frame    │
└─────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│      AnimationLayer (e.g., idle)        │
│  Reads VRM bones, applies transforms,    │
│  drives expression blend shapes          │
└─────────────────────────────────────────┘
```

---

## Core Types (`src/lib/engine/types.ts`)

| Type | Purpose |
|------|---------|
| `AnimationContext` | Passed to every layer each frame. Contains `{ vrm: VRM, time: number, deltaTime: number }`. |
| `AnimationLayer` | A single animation behavior with `{ name, weight, update(ctx), enter?(ctx), exit?(ctx) }`. Weight is 0-1. Layers are applied additively in order. |
| `AnimationState` | A named collection of layers: `{ name, layers: AnimationLayer[] }`. |
| `BoneName` | Strongly-typed union of VRM humanoid bone names (`'hips'`, `'chest'`, `'head'`, `'leftUpperArm'`, etc.). |
| `ExpressionName` | Strongly-typed union of VRM expression names (`'happy'`, `'angry'`, `'blink'`, `'neutral'`, etc.). |

---

## Math Utilities (`src/lib/engine/math.ts`)

Procedural animation needs smooth, organic motion without keyframes:

| Function | Purpose |
|----------|---------|
| `SmoothNoise` | 1D value noise using multiple seeded sine waves. Creates non-repetitive organic randomness for idle sway and micro-movements. |
| `lerp(a, b, t)` | Linear interpolation. Basic blending between two values. |
| `damp(current, target, speed, dt)` | **Exponential smoothing**: `lerp(current, target, 1 - exp(-speed * dt))`. This is the workhorse of the engine. It makes transitions feel physical and springy rather than robotic. Used for camera zoom, head rotation, arm sway, posture drift. |
| `clamp(val, min, max)` | Bounds a value to a range. |
| `easeInOutSine(t)` | S-curve easing for the breathing cycle so inhale/exhale feel natural. |

### Why `damp` instead of `lerp`?

`lerp` with a fixed factor feels robotic because the transition speed depends on the delta between current and target. `damp` uses an exponential decay curve that feels like physical inertia — fast when far from target, smooth as it approaches.

---

## State Machine (`src/lib/engine/VrmAnimator.ts`)

```ts
const animator = new VrmAnimator();
animator
  .setVrm(vrm)                          // Bind the loaded VRM instance
  .addState({ name: 'idle', layers: [createIdleLayer()] })
  .start('idle');                       // Enter the idle state

// In the render loop:
animator.update(delta);                  // Advance time, run current state's layers
```

### Methods

| Method | Description |
|--------|-------------|
| `setVrm(vrm)` | Binds the VRM instance. Must be called before `start()`. |
| `addState(state)` | Registers a state. States are keyed by `name`. |
| `transitionTo(name)` | Switches to another state. Calls `exit()` on all layers of the previous state, then `enter()` on all layers of the new state. |
| `start(stateName?)` | Starts the engine. Optionally transitions to a named state immediately, or defaults to the first registered state. |
| `stop()` | Halts updates. The engine can be restarted with `start()`. |
| `update(deltaTime)` | **Call every frame.** Advances global time, builds `AnimationContext`, and calls `layer.update(ctx)` for every layer in the current state whose `weight > 0`. |

### State transitions

When `transitionTo('talking')` is called:
1. `prevState.layers.forEach(l => l.exit?.(ctx))`
2. `currentStateName = 'talking'`
3. `nextState.layers.forEach(l => l.enter?.(ctx))`

This allows layers to reset internal timers, clear blend shapes, or set up initial conditions.

---

## The Idle Animation (`src/lib/engine/animations/idle.ts`)

The idle state is the only animation currently implemented, but it is composed of **five simultaneous subsystems** running inside a single `AnimationLayer`:

### A. Breathing

- **Rate**: 14 breaths per minute
- **Drive**: `easeInOutSine(Math.sin(breathT * 2π))`
- **Effects**:
  - `chest` bone rotates forward/back `±0.04 rad`
  - `upperChest` bone scales `±0.5%` to simulate ribcage expansion
  - `hips` position drops slightly on inhale to ground the motion
- **Why it works**: The chest expansion and hip counter-motion create a believable diaphragm-driven breath rather than a rigid chest heave.

### B. Posture Sway

- **Drive**: `SmoothNoise` at multiple frequencies (`0.3–0.5 Hz`)
- **Effects**:
  - `hips.rotation.y` drifts `±0.03 rad`
  - `spine.rotation.z` drifts `±0.018 rad`
  - `spine.rotation.y` drifts `±0.009 rad`
- **Why it works**: Humans never stand perfectly still. The noise is seeded so it's deterministic but non-repetitive, creating the subtle "alive" feeling of someone shifting their weight.

### C. Head Look-Around

- **Interval**: Every ~4 seconds a new random target is chosen
- **Target range**: Yaw `±0.6 rad` (≈ ±34°), Pitch `±0.35 rad` (≈ ±20°)
- **Approach**: `damp()` smooths the head toward the target over ~0.4 seconds
- **Jitter**: A tiny `SmoothNoise` overlay (`±0.02 rad`) prevents robotic precision
- **Neck chaining**: The `neck` bone receives 30% of the head rotation so the spine participates naturally
- **Why it works**: The randomized targets and smooth damping create the impression of curiosity — glancing around the environment.

### D. Eye Blinking

- **Interval**: Random between 2.5–6 seconds
- **State machine**: `open → closing → closed → opening → open`
- **Timing**:
  - Closing: 80ms
  - Closed hold: 50ms
  - Opening: 80ms
- **Drive**: VRM `blink` expression blend shape (value 0 → 1 → 0)
- **Why it works**: Blinking is one of the strongest cues of life. The variable interval and fast transition feel human.

### E. Micro Arm Movements

- **Drive**: `SmoothNoise` at `0.5–0.7 Hz`
- **Effects**:
  - `leftUpperArm.rotation.z` drifts `±0.015 rad`
  - `rightUpperArm.rotation.z` drifts `±0.015 rad`
  - `leftUpperArm.rotation.x` drifts `±0.0075 rad`
- **Why it works**: Prevents the arms from looking locked in a T-pose. The drift is imperceptible as "motion" but perceptible as "not frozen."

---

## WebGL / Tauri Integration (`VRMCharacter.svelte`)

### Render Loop

```ts
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  // 1. Smooth camera zoom (damped, fixed viewing angle)
  camera.position.copy(LOOK_AT_TARGET)
    .add(CAMERA_OFFSET_DIR.clone().multiplyScalar(currentDistance));

  // 2. Run custom animation engine
  animator?.update(delta);

  // 3. Run VRM built-in updates (expressions, lookAt if configured)
  currentVrm.update(delta);

  // 4. Draw
  renderer.render(scene, camera);
}
```

### Camera System

The camera uses a **fixed direction vector** for zoom. This means zooming in/out only changes distance, never the viewing angle:

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `LOOK_AT_TARGET` | `(0, 0.25, 0)` | Camera always looks at the character's shins |
| `CAMERA_OFFSET_DIR` | `(0, 1.2, 4.2)` normalized | The camera sits high and back along this vector |
| `DEFAULT_DISTANCE` | ~4.37 | The "known good" distance where the full body is framed |
| `MIN_DISTANCE` | 3.2 | Close-up zoom limit |
| `MAX_DISTANCE` | 6.5 | Full-body zoom limit |

### Interaction State Machine

The borderless transparent window requires a custom input handling system:

| Event | Condition | Action |
|-------|-----------|--------|
| `mousemove` + hit mesh | `!isOverCharacter` | `setClickThrough(false)` — window becomes interactive |
| `mousemove` + no hit | `isOverCharacter` | `setClickThrough(true)` — clicks pass through |
| `mousedown` + hit | — | `isMouseDown = true`, disable click-through polling |
| `mousemove` + `isMouseDown` + dx/dy > 5px | `!hasDragged` | `startDragging()` — move window |
| `mouseup` + `!hasDragged` + hit | — | `show_main_window()` — open chat |
| `mouseup` + `hasDragged` + no hit | — | `setClickThrough(true)` — restore pass-through |
| `blur` | `isMouseDown` | Reset all state, restore pass-through |

### Critical Design: Polling Lockout

The polling loop that checks global cursor position runs every 100ms. It is **completely disabled while `isMouseDown === true`**. This prevents a race condition where the loop sets `clickThrough=true` between `mousedown` and `mouseup`, which would prevent `handleMouseUp` from ever firing and leave `isMouseDown` stuck as `true` forever, permanently breaking interaction.

---

## Extending the Engine

The modular design makes adding new behaviors straightforward:

### Adding a Talking State

```ts
// Create a new layer
function createTalkLayer(): AnimationLayer {
  return {
    name: 'talk',
    weight: 1,
    update(ctx) {
      // Read audio volume from some external source
      const mouthOpen = getCurrentAudioVolume(); // 0-1
      ctx.vrm.expressionManager?.setValue('aa', mouthOpen);
    }
  };
}

// Register it as a state
animator.addState({
  name: 'talking',
  layers: [createIdleLayer(), createTalkLayer()]
});

// Transition to it when the agent speaks
animator.transitionTo('talking');
```

### Adding a Gesture (Wave)

```ts
function createWaveLayer(): AnimationLayer {
  let t = 0;
  return {
    name: 'wave',
    weight: 1,
    enter() { t = 0; },
    update(ctx) {
      t += ctx.deltaTime;
      const arm = ctx.vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
      if (arm) {
        arm.rotation.z = Math.sin(t * 8) * 0.5 + 0.5; // Wave
      }
      // Auto-return to idle after 1.5s
      if (t > 1.5) animator.transitionTo('idle');
    }
  };
}
```

### Mouse-Tracking LookAt

In `VRMCharacter.svelte`, track the mouse position in normalized screen space and pass it to the animator. The idle layer can blend between "random look" and "look at cursor" based on a weight parameter.

### Emotion Expressions

Any layer can drive VRM blend shapes:

```ts
ctx.vrm.expressionManager?.setValue('happy', 0.8);
ctx.vrm.expressionManager?.setValue('surprised', 0.3);
ctx.vrm.expressionManager?.update();
```

### Loading Pre-Recorded Clips (BVH / Mixamo)

Instead of procedural math, a layer could sample from a pre-recorded animation clip each frame and apply the sampled rotations to the normalized bones. This is useful for complex gestures, dancing, or sitting animations that are hard to procedurally generate.

---

## File Reference

| File | Role |
|------|------|
| `src/lib/engine/types.ts` | Type definitions and contracts |
| `src/lib/engine/math.ts` | Noise, lerp, damp, easing functions |
| `src/lib/engine/VrmAnimator.ts` | State machine and layer runner |
| `src/lib/engine/animations/idle.ts` | Idle animation layer implementation |
| `src/lib/engine/index.ts` | Public API barrel export |
| `src/lib/components/VRMCharacter.svelte` | WebGL scene, camera, input handling, animator wiring |
