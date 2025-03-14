<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    type ImportSearchResult, 
    type FileGroup, 
    processImportResults, 
  } from './importData';
  import CaseSensitiveIcon from './icons/CaseSensitiveIcon.svelte';
  import WholeWordIcon from './icons/WholeWordIcon.svelte';
  import ChevronDownIcon from './icons/ChevronDownIcon.svelte';
  import ChevronRightIcon from './icons/ChevronRightIcon.svelte';
  
  // 类型定义
  interface VSCodeMessage {
    title: string;
    importResults?: ImportSearchResult[];
    msg?: string;
    entryFile?: string;
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
  let entryFile = '';
  let searchTimeout: number | null = null;

  // 文件组展开状态
  let expandedFiles: Record<string, boolean> = {};
  
  // 监听扩展发送的消息
  onMount(() => {
    window.addEventListener('message', (event: MessageEvent) => {
      const message = event.data as VSCodeMessage;
      
      switch (message.title) {
        case 'greeting':
          vscode.postMessage({
            title: 'hello',
            msg: 'Webview 已收到您的问候！'
          });
          break;
          
        case 'importResults':
          if (message.importResults) {
            importResults = message.importResults;
            processImportResultsData();
            isSearching = false;
          }
          break;
          
        case 'searchError':
          isSearching = false;
          // 可以在界面上显示错误消息
          break;
          
        case 'setEntryFile':
          if (message.entryFile) {
            entryFile = message.entryFile;
            // 如果已有搜索关键词，则自动触发搜索
            if (searchQuery.trim()) {
              handleSearch();
            }
          }
          break;
      }
    });
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
    if (!searchQuery.trim() || !entryFile) return;
    
    isSearching = true;
    vscode.postMessage({
      title: 'search',
      query: searchQuery,
      entryFile: entryFile,
      isCaseSensitive,
      isWholeWord
    });
  }
  
  // 防抖处理搜索
  function debounceSearch() {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    searchTimeout = setTimeout(() => {
      handleSearch();
      searchTimeout = null;
    }, 500) as unknown as number;
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
  
  // 处理搜索输入变化
  function handleSearchInputChange() {
    if (searchQuery.trim() && entryFile) {
      debounceSearch();
    }
  }
  
  // 处理入口文件变化
  function handleEntryFileChange() {
    if (searchQuery.trim() && entryFile) {
      debounceSearch();
    }
  }
  
  // 将文本分割为匹配和非匹配部分
  function splitTextByMatch(text: string, query: string): { text: string; isMatch: boolean }[] {
    if (!query || !text) return [{ text, isMatch: false }];
    
    try {
      // 转义正则表达式特殊字符
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escapedQuery})`, 'gi');
      
      const parts: { text: string; isMatch: boolean }[] = [];
      let lastIndex = 0;
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        // 添加匹配前的文本
        if (match.index > lastIndex) {
          parts.push({
            text: text.substring(lastIndex, match.index),
            isMatch: false
          });
        }
        
        // 添加匹配的文本
        parts.push({
          text: match[0],
          isMatch: true
        });
        
        lastIndex = regex.lastIndex;
      }
      
      // 添加最后一部分
      if (lastIndex < text.length) {
        parts.push({
          text: text.substring(lastIndex),
          isMatch: false
        });
      }
      
      return parts;
    } catch (error) {
      console.error('分割匹配文本时出错:', error);
      return [{ text, isMatch: false }];
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
          on:input={handleSearchInputChange}
        />
        <div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <button
            class="icon-button"
            aria-label="区分大小写"
            title="区分大小写"
            on:click={() => {
              isCaseSensitive = !isCaseSensitive;
              if (searchQuery.trim() && entryFile) {
                debounceSearch();
              }
            }}
          >
            <CaseSensitiveIcon active={isCaseSensitive} />
          </button>
          <button 
            class="icon-button"
            aria-label="全字匹配"
            title="全字匹配"
            on:click={() => {
              isWholeWord = !isWholeWord;
              if (searchQuery.trim() && entryFile) {
                debounceSearch();
              }
            }}
          >
            <WholeWordIcon active={isWholeWord} />
          </button>
        </div>
      </div>
    </div>

    <!-- 文件过滤 -->
    <div class="mt-2 space-y-2">
      <div class="relative">
        <label for="include-files" class="block text-xs mb-1">起始文件:</label>
        <input 
          id="include-files"
          type="text" 
          class="vscode-input text-sm"
          placeholder="例如: /path/to/file.ts" 
          bind:value={entryFile}
          on:input={handleEntryFileChange}
        />
      </div>
      <!-- <div class="relative">
        <label for="exclude-files" class="block text-xs mb-1">排除的文件:</label>
        <input 
          id="exclude-files"
          type="text" 
          class="vscode-input text-sm"
          placeholder="例如: node_modules/**" 
          bind:value={excludeFiles}
        />
      </div> -->
    </div>
  </div>

  <!-- 导入视图 -->
  <div class="space-y-2 pl-2">
    {#if isSearching}
      <div class="flex justify-center py-8">
        <div class="w-8 h-8 border-4 border-vscode-button-bg border-t-transparent rounded-full animate-spin"></div>
      </div>
    {:else if fileGroups.length === 0}
      <p class="text-center py-8 text-vscode-description">无搜索结果或尚未搜索</p>
    {:else}
      <div class="text-xs mb-2 text-vscode-description">
        找到 {totalMatches} 个匹配项，位于 {totalFiles} 个文件中
      </div>
      
      {#each fileGroups as group}
        <div class="mb-2">
          <!-- 文件头部 -->
          <div 
            class="flex items-center cursor-pointer hover-bg-vscode-list-hover py-2px"
            on:click={() => toggleFileGroup(group.filePath)}
            role="button"
            tabindex="0"
            on:keydown={(e) => e.key === 'Enter' && toggleFileGroup(group.filePath)}
          >
            <div class="w-4 text-center flex-shrink-0 mr-2">
              {#if expandedFiles[group.filePath]}
                <ChevronDownIcon size={14} />
              {:else}
                <ChevronRightIcon size={14} />
              {/if}
            </div>
            <div class="flex-1 overflow-hidden">
              <div class="file-header">
                <span class="text-xs file-name">{group.fileName}</span>
                <span class="text-xs text-vscode-description file-directory">{group.directory}</span>
                <span class="text-xs text-vscode-description file-matches">({group.matches.length} 个匹配项)</span>
              </div>
            </div>
          </div>
          
          <!-- 匹配项列表 -->
          {#if expandedFiles[group.filePath]}
            <div class="ml-6">
              {#each group.matches as match}
                <div 
                  class="flex items-start cursor-pointer hover-bg-vscode-list-hover py-2px"
                  on:click={() => openFile(match.filePath, match.lineNumber)}
                  role="button"
                  tabindex="0"
                  on:keydown={(e) => e.key === 'Enter' && openFile(match.filePath, match.lineNumber)}
                >
                  <div class="flex-1 overflow-hidden">
                    <pre class="text-xs match-text">{#each splitTextByMatch(match.matchText, searchQuery) as part}{#if part.isMatch}<span class="match-highlight">{part.text}</span>{:else}{part.text}{/if}{/each}</pre>
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
  
  /* 匹配高亮样式 */
  .match-highlight {
    background-color: rgba(255, 200, 0, 0.3);
    color: var(--vscode-foreground);
    border-radius: 2px;
    font-weight: bold;
  }
</style>