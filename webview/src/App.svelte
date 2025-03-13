<script lang="ts">
    import { onMount } from 'svelte';
  
    let messageFromExtension = 'Waiting for message...';
  
    // 获取 VS Code API
    const vscode = acquireVsCodeApi();
  
    // 监听扩展发送的消息
    onMount(() => {
      window.addEventListener('message', (event) => {
        const message = event.data; // Payload 类型为 { title: string; msg: string }
        if (message.title === 'greeting') {
          messageFromExtension = message.msg;
          // 可选：响应扩展
          vscode.postMessage({
            title: 'hello',
            msg: 'Webview 已收到您的问候！'
          });
        }
      });
    });
  
    // 发送消息到扩展
    function sendMessage() {
      vscode.postMessage({
        title: 'hello',
        msg: 'Hello from Webview!'
      });
    }
  </script>
  
  <div>
    <p class="title">Hello, World!</p>
    <p>Message from extension: {messageFromExtension}</p>
    <button on:click={sendMessage}>Send Message to Extension</button>
  </div>
  
  <style>
    .title {
      color: red;
    }
  </style>