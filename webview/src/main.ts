import { mount } from 'svelte';
import App from './App.svelte';

const target = document.getElementById('app');
if (!target) throw new Error('Webview目标元素#app未找到');
const app = mount(App, { target });

export default app;