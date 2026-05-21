<script lang="ts">
  import { onMount } from 'svelte';
  import * as THREE from 'three';
  import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
  import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
  import { invoke } from '@tauri-apps/api/core';

  let canvas: HTMLCanvasElement;
  let error = $state('');

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let camera: THREE.PerspectiveCamera;
  let currentVrm: any = null;
  let isOverCharacter = false;
  let isPolling = false;

  function setClickThrough(clickThrough: boolean) {
    invoke('set_secondary_click_through', { clickThrough });
  }

  async function pollCursorPosition() {
    if (isPolling) return;
    isPolling = true;
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
  }

  function handleClick(event: MouseEvent) {
    const hit = updateRaycast(event.clientX, event.clientY);
    if (hit) {
      isOverCharacter = false;
      setClickThrough(true);
      invoke('show_main_window');
    }
  }

  function handleMouseLeave() {
    isOverCharacter = false;
    setClickThrough(true);
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

    camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 20);
    camera.position.set(0, 0.9, 3.5);
    camera.lookAt(0, 0.9, 0);

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
    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.load(
      '/character.vrm',
      (gltf) => {
        const vrm = gltf.userData.vrm;
        VRMUtils.removeUnnecessaryVertices(gltf.scene);
        VRMUtils.combineSkeletons(gltf.scene);
        VRMUtils.combineMorphs(vrm);

        vrm.scene.traverse((obj: any) => {
          obj.frustumCulled = false;
        });

        currentVrm = vrm;
        scene.add(vrm.scene);
      },
      undefined,
      (err) => {
        error = 'Failed to load character: ' + (err instanceof Error ? err.message : 'Unknown error');
      }
    );

    const clock = new THREE.Clock();
    clock.start();

    function animate() {
      requestAnimationFrame(animate);
      if (currentVrm) {
        currentVrm.update(clock.getDelta());
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
    canvas.addEventListener('click', handleClick);
    window.addEventListener('mouseleave', handleMouseLeave);

    setClickThrough(true);

    return () => {
      renderer.dispose();
      clearInterval(pollInterval);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
      window.removeEventListener('mouseleave', handleMouseLeave);
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