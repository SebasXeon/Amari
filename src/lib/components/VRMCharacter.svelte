<script lang="ts">
  import { onMount } from 'svelte';
  import * as THREE from 'three';
  import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
  import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

  let canvas: HTMLCanvasElement;
  let error = $state('');

  onMount(() => {
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 20);
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

    let currentVrm: any = null;
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

    return () => {
      renderer.dispose();
      window.removeEventListener('resize', handleResize);
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
