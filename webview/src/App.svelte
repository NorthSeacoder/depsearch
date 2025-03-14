<script lang="ts">
  import './app.css';
  import { onMount } from 'svelte';
  import { 
    type ImportSearchResult, 
    type FileGroup, 
    processImportResults, 
    getRelativePath
  } from './importData';
  import { mockFullImportResults } from './mockData';
  import SearchIcon from './icons/SearchIcon.svelte';
  import CaseSensitiveIcon from './icons/CaseSensitiveIcon.svelte';
  import WholeWordIcon from './icons/WholeWordIcon.svelte';
  
  // 类型定义
  interface VSCodeMessage {
    title: string;
    importResults?: ImportSearchResult[];
    msg?: string;
  }

  // 获取 VS Code API
  const vscode = acquireVsCodeApi();
  
  // 状态管理
  let searchQuery = '';
  let importResults: ImportSearchResult[] = [];
  let fileGroups: FileGroup[] = [];
  let isSearching = false;
  let totalMatches = 0;
  let totalFiles = 0;
  let isCaseSensitive = false;
  let isWholeWord = false;
  let includeFiles = '';
  let excludeFiles = '';

  // 文件组展开状态
  let expandedFiles: Record<string, boolean> = {};
  
  // 监听扩展发送的消息
  onMount(() => {
    window.addEventListener('message', (event: MessageEvent) => {
      const message = event.data as VSCodeMessage;
      if (message.title === 'greeting') {
        vscode.postMessage({
          title: 'hello',
          msg: 'Webview 已收到您的问候！'
        });
      } else if (message.title === 'importResults' && message.importResults) {
        importResults = message.importResults;
        processImportResultsData();
        isSearching = false;
      }
    });
    
    // 模拟初始数据
    setTimeout(() => {
      // 模拟导入搜索结果
      importResults = mockFullImportResults;
      processImportResultsData();
    }, 500);
  });
  
  // 处理导入搜索结果
  function processImportResultsData() {
    const result = processImportResults(importResults);
    fileGroups = result.fileGroups;
    totalMatches = result.totalMatches;
    totalFiles = result.totalFiles;
    
    // 初始化所有文件为展开状态
    fileGroups.forEach(group => {
      expandedFiles[group.filePath] = true;
    });
  }
  
  // 发送搜索请求到扩展
  function handleSearch() {
    if (!searchQuery.trim()) return;
    
    isSearching = true;
    vscode.postMessage({
      title: 'search',
      query: searchQuery
    });
    
    // 模拟搜索结果，实际应用中应该由扩展返回
    setTimeout(() => {
      if (isSearching) {
        // 模拟导入搜索结果
        importResults = mockFullImportResults;
        processImportResultsData();
        isSearching = false;
      }
    }, 1000);
  }
  
  // 切换文件组展开状态
  function toggleFileGroup(filePath: string) {
    expandedFiles[filePath] = !expandedFiles[filePath];
    expandedFiles = {...expandedFiles};
  }
  
  // 打开文件
  function openFile(filePath: string, lineNumber: number) {
    vscode.postMessage({
      title: 'openFile',
      filePath,
      lineNumber
    });
  }
  
  // 处理键盘事件
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      handleSearch();
    }
  }
</script>

<div class="container text-vscode-foreground">
  <div class="mb-6">
    <!-- 搜索框 -->
    <div class="w-full mb-2">
      <div class="relative w-full">
        <input 
          type="text" 
          class="vscode-input pr-24"
          placeholder="搜索" 
          bind:value={searchQuery}
          on:keydown={handleKeyDown}
        />
        <div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <button
            class="icon-button"
            aria-label="区分大小写"
            title="区分大小写"
            on:click={() => isCaseSensitive = !isCaseSensitive}
          >
            <CaseSensitiveIcon active={isCaseSensitive} />
          </button>
          <button 
            class="icon-button"
            aria-label="全字匹配"
            title="全字匹配"
            on:click={() => isWholeWord = !isWholeWord}
          >
            <WholeWordIcon active={isWholeWord} />
          </button>
        </div>
      </div>
    </div>

    <!-- 文件过滤 -->
    <div class="mt-2 space-y-2">
      <div class="relative">
        <label for="include-files" class="block text-xs mb-1">包含的文件:</label>
        <input 
          id="include-files"
          type="text" 
          class="vscode-input text-sm"
          placeholder="例如: *.ts,*.js" 
          bind:value={includeFiles}
        />
      </div>
      <div class="relative">
        <label for="exclude-files" class="block text-xs mb-1">排除的文件:</label>
        <input 
          id="exclude-files"
          type="text" 
          class="vscode-input text-sm"
          placeholder="例如: node_modules/**" 
          bind:value={excludeFiles}
        />
      </div>
    </div>
  </div>

  <!-- 导入视图 -->
  <div class="space-y-3">
    {#if isSearching}
      <div class="flex justify-center py-8">
        <div class="w-8 h-8 border-4 border-vscode-button-bg border-t-transparent rounded-full animate-spin"></div>
      </div>
    {:else if fileGroups.length === 0}
      <p class="text-center py-8 text-vscode-description">无搜索结果或尚未搜索</p>
    {:else}
      <div class="text-sm mb-2">
        找到 {totalMatches} 个匹配项，位于 {totalFiles} 个文件中
      </div>
      
      {#each fileGroups as group}
        <div class="border border-vscode-border rounded">
          <!-- 文件头部 -->
          <div 
            class="p-2 flex justify-between items-center cursor-pointer hover:bg-vscode-list-hover"
            on:click={() => toggleFileGroup(group.filePath)}
            role="button"
            tabindex="0"
            on:keydown={(e) => e.key === 'Enter' && toggleFileGroup(group.filePath)}
          >
            <div>
              <span class="font-medium">{group.fileName}</span>
              <span class="text-vscode-description text-sm ml-2">{group.directory}</span>
            </div>
            <div class="text-sm">
              {group.matches.length} 个匹配项
            </div>
          </div>
          
          <!-- 匹配项列表 -->
          {#if expandedFiles[group.filePath]}
            <div class="border-t border-vscode-border">
              {#each group.matches as match}
                <div 
                  class="p-2 hover:bg-vscode-list-hover cursor-pointer border-t border-vscode-border first:border-t-0"
                  on:click={() => openFile(match.filePath, match.lineNumber)}
                  role="button"
                  tabindex="0"
                  on:keydown={(e) => e.key === 'Enter' && openFile(match.filePath, match.lineNumber)}
                >
                  <div class="flex items-start">
                    <div class="text-sm text-vscode-description mr-2">
                      {match.lineNumber}:
                    </div>
                    <div class="text-sm overflow-hidden">
                      <pre class="whitespace-pre-wrap break-all">{match.matchText}</pre>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  :global(:root) {
    /* 使用 VSCode 的 CSS 变量 */
    --vscode-editor-background: var(--vscode-editor-background, #1e1e1e);
    --vscode-foreground: var(--vscode-foreground, #cccccc);
    --vscode-input-background: var(--vscode-input-background, #3c3c3c);
    --vscode-input-foreground: var(--vscode-input-foreground, #cccccc);
    --vscode-input-border: var(--vscode-input-border, #3c3c3c);
    --vscode-button-background: var(--vscode-button-background, #0e639c);
    --vscode-button-foreground: var(--vscode-button-foreground, #ffffff);
    --vscode-button-hoverBackground: var(--vscode-button-hoverBackground, #1177bb);
    --vscode-list-hoverBackground: var(--vscode-list-hoverBackground, #2a2d2e);
    --vscode-list-activeSelectionBackground: var(--vscode-list-activeSelectionBackground, #094771);
    --vscode-list-activeSelectionForeground: var(--vscode-list-activeSelectionForeground, #ffffff);
    --vscode-panel-border: var(--vscode-panel-border, #80808059);
    --vscode-descriptionForeground: var(--vscode-descriptionForeground, #ccccccb3);
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* 添加一些额外的样式，确保 hover 效果正常工作 */
  :global(.hover\:bg-vscode-list-hover:hover) {
    background-color: var(--vscode-list-hoverBackground);
  }
  
  :global(.first\:border-t-0:first-child) {
    border-top-width: 0;
  }
  
  /* 图标按钮样式 */
  .icon-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 3px;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--vscode-foreground);
    padding: 0;
    margin: 0 2px;
  }
  
  .icon-button:hover {
    background-color: var(--vscode-list-hoverBackground);
  }
</style>