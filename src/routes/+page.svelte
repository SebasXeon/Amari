<script lang="ts">
  import VRMCharacter from '$lib/components/VRMCharacter.svelte';
</script>

<VRMCharacter />

<style>
  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  :global(html),
  :global(body) {
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: transparent;
  }
</style>
