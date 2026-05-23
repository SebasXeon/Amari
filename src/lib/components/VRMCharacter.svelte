<script lang="ts">
  import { onMount } from 'svelte';
  import * as THREE from 'three';
  import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
  import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
  import { invoke } from '@tauri-apps/api/core';
  import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
  import { VrmAnimator, createIdleLayer, damp } from '$lib/engine';

  let canvas: HTMLCanvasElement;
  let error = $state('');

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let camera: THREE.PerspectiveCamera;
  let currentVrm: any = null;
  let characterGroup: THREE.Group | null = null;
  let isOverCharacter = false;
  let isPolling = false;
  let animator: VrmAnimator | null = null;

  // Camera zoom state — moves along the "known good" viewing line so the angle never changes.
  // The known good camera position was (0, 1.45, 4.2) looking at (0, 0.25, 0).
  // We keep the lookAt fixed and slide the camera along that same direction vector.
  const LOOK_AT_TARGET = new THREE.Vector3(0, 0.25, 0);
  const CAMERA_OFFSET_DIR = new THREE.Vector3(0, 1.2, 4.2).normalize();
  const DEFAULT_DISTANCE = Math.sqrt(1.2 * 1.2 + 4.2 * 4.2); // ≈ 4.369
  const MIN_DISTANCE = 3.2;
  const MAX_DISTANCE = 6.5;
  let targetDistance = DEFAULT_DISTANCE;
  let currentDistance = DEFAULT_DISTANCE;

  // Drag state
  let isMouseDown = false;
  let hasDragged = false;
  let dragStartX = 0;
  let dragStartY = 0;
  const DRAG_THRESHOLD = 5;

  // Rotation state
  let isMiddleDown = false;
  let rotateStartX = 0;
  let rotationStartAngle = 0;
  let currentRotation = 0;
  let targetRotation = 0;
  const ROTATION_SENSITIVITY = 0.008;
  const SNAP_ANGLE = Math.PI / 4; // 45 degrees, 8 directions

  function setClickThrough(clickThrough: boolean) {
    invoke('set_secondary_click_through', { clickThrough });
  }

  async function pollCursorPosition() {
    if (isPolling) return;
    isPolling = true;

    // CRITICAL: never toggle click-through while any mouse button is held.
    // Otherwise the polling loop can set click-through=true between
    // mousedown and mouseup, which prevents handleMouseUp from ever firing
    // and leaves isMouseDown stuck true forever.
    if (isMouseDown || isMiddleDown) {
      isPolling = false;
      return;
    }

    try {
      const info = await invoke<{
        cursor_x: number;
        cursor_y: number;
        win_x: number;
        win_y: number;
        scale: number;
      }>('get_cursor_info');

      const clientX = (info.cursor_x - info.win_x) / info.scale;
      const clientY = (info.cursor_y - info.win_y) / info.scale;

      const hit = updateRaycast(clientX, clientY);

      if (hit && !isOverCharacter) {
        isOverCharacter = true;
        setClickThrough(false);
      } else if (!hit && isOverCharacter) {
        isOverCharacter = false;
        setClickThrough(true);
      }
    } catch {
      // window may be minimized or position unavailable
    }
    isPolling = false;
  }

  function updateRaycast(clientX: number, clientY: number) {
    if (!camera || !canvas) return false;

    const rect = canvas.getBoundingClientRect();
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    if (currentVrm?.scene) {
      const intersects = raycaster.intersectObject(currentVrm.scene, true);
      return intersects.length > 0;
    }
    return false;
  }

  function handleMouseMove(event: MouseEvent) {
    const hit = updateRaycast(event.clientX, event.clientY);

    if (hit) {
      if (!isOverCharacter) {
        isOverCharacter = true;
        setClickThrough(false);
      }
    } else {
      if (isOverCharacter) {
        isOverCharacter = false;
        setClickThrough(true);
      }
    }

    // Middle-click drag → rotate character around Y axis
    if (isMiddleDown && characterGroup) {
      const dx = event.clientX - rotateStartX;
      targetRotation = rotationStartAngle + dx * ROTATION_SENSITIVITY;
      characterGroup.rotation.y = targetRotation;
      currentRotation = targetRotation;
      return;
    }

    // Drag detection: if left mouse is down and moved past threshold, start window drag
    if (!isMouseDown) return;
    const dx = event.clientX - dragStartX;
    const dy = event.clientY - dragStartY;
    if (!hasDragged && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
      hasDragged = true;
      getCurrentWebviewWindow().startDragging();
    }
  }

  function handleMouseDown(event: MouseEvent) {
    // Middle click (wheel press) → rotate character
    if (event.button === 1) {
      event.preventDefault();
      const hit = updateRaycast(event.clientX, event.clientY);
      if (!hit) return;
      isMiddleDown = true;
      rotateStartX = event.clientX;
      rotationStartAngle = currentRotation;
      setClickThrough(false);
      return;
    }

    // Left click → drag window / click to open chat
    const hit = updateRaycast(event.clientX, event.clientY);
    if (!hit) return;
    isMouseDown = true;
    hasDragged = false;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    setClickThrough(false);
  }

  function handleMouseUp(event: MouseEvent) {
    // Middle click release → snap to nearest 8-direction
    if (isMiddleDown) {
      isMiddleDown = false;
      const snapped = Math.round(currentRotation / SNAP_ANGLE) * SNAP_ANGLE;
      targetRotation = snapped;
      // Only restore click-through if cursor is outside the mesh
      const hit = updateRaycast(event.clientX, event.clientY);
      if (!hit) setClickThrough(true);
      return;
    }

    if (!isMouseDown) return;
    isMouseDown = false;

    // After any mouse interaction, immediately re-evaluate whether the cursor
    // is still over the character so we don't leave the window in a stale state.
    const hit = updateRaycast(event.clientX, event.clientY);
    isOverCharacter = hit;

    if (!hasDragged && isOverCharacter) {
      // Click on character → open chat, then restore click-through
      setClickThrough(true);
      invoke('show_main_window');
    } else if (hasDragged && !isOverCharacter) {
      // Drag ended with cursor outside the mesh → make window click-through again
      setClickThrough(true);
    }
  }

  function handleMouseLeave() {
    isOverCharacter = false;
    isMouseDown = false;
    isMiddleDown = false;
    setClickThrough(true);
  }

  function base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  function handleWheel(event: WheelEvent) {
    if (!isOverCharacter) return;
    event.preventDefault();

    const zoomSpeed = 0.005;
    targetDistance += event.deltaY * zoomSpeed;
    targetDistance = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, targetDistance));
  }

  onMount(() => {
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 20);
    camera.position.copy(LOOK_AT_TARGET).add(CAMERA_OFFSET_DIR.clone().multiplyScalar(currentDistance));
    camera.lookAt(LOOK_AT_TARGET);

    const scene = new THREE.Scene();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, Math.PI);
    mainLight.position.set(1, 1.5, 1).normalize();
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0xffccaa, 0.6);
    fillLight.position.set(-0.8, 0.4, 0.6).normalize();
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x88ccff, 0.5);
    rimLight.position.set(0, 1, -1).normalize();
    scene.add(rimLight);

    const loader = new GLTFLoader();
    loader.crossOrigin = 'anonymous';
    loader.register((parser: any) => new VRMLoaderPlugin(parser));

    // Resolve character: user data takes precedence, fallback to bundled asset
    (async () => {
      const base64Data: string | null = await invoke('load_character');
      const vrmUrl = base64Data
        ? URL.createObjectURL(new Blob([base64ToUint8Array(base64Data)], { type: 'application/octet-stream' }))
        : '/character.vrm';

      loader.load(
        vrmUrl,
        (gltf: any) => {
          const vrm = gltf.userData.vrm;
          VRMUtils.removeUnnecessaryVertices(gltf.scene);
          VRMUtils.combineSkeletons(gltf.scene);
          VRMUtils.combineMorphs(vrm);

          vrm.scene.traverse((obj: any) => {
            obj.frustumCulled = false;
          });

          currentVrm = vrm;

          // Wrap the VRM scene in a group so we can rotate the whole character
          characterGroup = new THREE.Group();
          characterGroup.add(vrm.scene);
          scene.add(characterGroup);

          // Initialize animation engine
          animator = new VrmAnimator();
          animator
            .setVrm(vrm)
            .addState({
              name: 'idle',
              layers: [createIdleLayer()]
            })
            .start('idle');
        },
        undefined,
        (err: any) => {
          error = 'Failed to load character: ' + (err instanceof Error ? err.message : 'Unknown error');
        }
      );
    })();

    const clock = new THREE.Clock();
    clock.start();

    function animate() {
      requestAnimationFrame(animate);
      const delta = clock.getDelta();

      // Smooth camera zoom along the fixed direction — angle never changes
      if (Math.abs(currentDistance - targetDistance) > 0.001) {
        currentDistance = damp(currentDistance, targetDistance, 6, delta);
        camera.position.copy(LOOK_AT_TARGET).add(CAMERA_OFFSET_DIR.clone().multiplyScalar(currentDistance));
      }

      // Snap rotation to nearest 45° direction after middle-click release
      if (characterGroup && Math.abs(currentRotation - targetRotation) > 0.001) {
        currentRotation = damp(currentRotation, targetRotation, 8, delta);
        characterGroup.rotation.y = currentRotation;
      }

      if (currentVrm) {
        // Run custom animation engine
        animator?.update(delta);
        // Still call VRM update for expressions / lookAt if configured
        currentVrm.update(delta);
      }
      renderer.render(scene, camera);
    }
    animate();

    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    const pollInterval = setInterval(pollCursorPosition, 100);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('mouseleave', handleMouseLeave);

    // Safety: if the window loses focus while the mouse is held down
    // (e.g. Alt-Tab), reset the interaction state so polling resumes.
    const handleBlur = () => {
      if (isMouseDown || isMiddleDown) {
        isMouseDown = false;
        isMiddleDown = false;
        setClickThrough(true);
      }
    };
    window.addEventListener('blur', handleBlur);

    setClickThrough(true);

    return () => {
      renderer.dispose();
      clearInterval(pollInterval);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('wheel', handleWheel);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('blur', handleBlur);
      animator?.stop();
      animator = null;
      if (characterGroup) {
        scene.remove(characterGroup);
        characterGroup = null;
      }
    };
  });
</script>

<div class="container">
  <canvas bind:this={canvas}></canvas>
  {#if error}
    <div class="error">{error}</div>
  {/if}
</div>

<style>
  .container {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    position: relative;
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
  .error {
    position: absolute;
    bottom: 8px;
    left: 8px;
    right: 8px;
    color: #ff6b6b;
    font-size: 11px;
    font-family: sans-serif;
    text-align: center;
    pointer-events: none;
  }
</style>
