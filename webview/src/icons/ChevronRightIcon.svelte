<script lang="ts">
  export let size = 16;
  export let active = false;
</script>

<svg 
  xmlns="http://www.w3.org/2000/svg" 
  width={size} 
  height={size} 
  viewBox="0 0 16 16" 
  fill="none" 
  stroke="currentColor" 
  stroke-width="1.5" 
  stroke-linecap="round" 
  stroke-linejoin="round"
  class={active ? 'active' : ''}
>
  <path d="M6 4l4 4-4 4" />
</svg>

<style>
  svg {
    display: inline-block;
    vertical-align: middle;
  }
  
  .active {
    color: var(--vscode-button-background);
  }
</style> 