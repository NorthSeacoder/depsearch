/// <reference types="svelte" />

/**
 * 为Svelte组件声明类型
 */
declare module '*.svelte' {
  import type { ComponentType } from 'svelte';
  
  const component: ComponentType<any>;
  export default component;
}

/**
 * 为@icons路径别名下的Svelte组件声明类型
 */
declare module '@icons/*.svelte' {
  import type { ComponentType } from 'svelte';
  
  const component: ComponentType<any>;
  export default component;
} 