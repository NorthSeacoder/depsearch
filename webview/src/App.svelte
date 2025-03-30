<script lang="ts">
    import {onMount} from 'svelte';
    import {type ImportSearchResult, type FileGroup, processImportResults} from './importData';
    import CaseSensitiveIcon from './icons/CaseSensitiveIcon.svelte';
    import WholeWordIcon from './icons/WholeWordIcon.svelte';
    import ChevronDownIcon from './icons/ChevronDownIcon.svelte';
    import ChevronRightIcon from './icons/ChevronRightIcon.svelte';

    const vscode = acquireVsCodeApi();

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
    let expandedFiles: Record<string, boolean> = {};

    onMount(() => {
        window.addEventListener('message', (event: MessageEvent) => {
            const message = event.data;
            switch (message.title) {
                case 'importResults':
                    if (message.importResults) {
                        importResults = message.importResults;
                        processImportResultsData();
                        isSearching = false;
                    }
                    break;
                case 'searchError':
                    isSearching = false;
                    break;
                case 'setEntryFile':
                    if (message.entryFile) {
                        entryFile = message.entryFile;
                        if (searchQuery.trim()) {
                            handleSearch();
                        }
                    }
                    break;
                case 'restoreState':
                    if (importResults?.length === 0) return;
                    // 恢复所有状态
                    if (message.importResults) {
                        importResults = message.importResults;
                        processImportResultsData();
                    }
                    searchQuery = message.searchQuery || '';
                    isCaseSensitive = message.isCaseSensitive || false;
                    isWholeWord = message.isWholeWord || false;
                    entryFile = message.entryFile || '';
                    isSearching = false;
                    break;
            }
        });
    });

    function processImportResultsData() {
        const result = processImportResults(importResults);
        fileGroups = result.fileGroups;
        totalMatches = result.totalMatches;
        totalFiles = result.totalFiles;
        fileGroups.forEach((group) => {
            expandedFiles[group.filePath] = true;
        });
    }

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

    function debounceSearch() {
        if (searchTimeout) clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            handleSearch();
            searchTimeout = null;
        }, 500) as unknown as number;
    }

    function toggleFileGroup(filePath: string) {
        expandedFiles[filePath] = !expandedFiles[filePath];
        expandedFiles = {...expandedFiles};
    }

    function openFile(filePath: string, lineNumber: number) {
        vscode.postMessage({title: 'openFile', filePath, lineNumber});
    }

    function handleKeyDown(event: KeyboardEvent) {
        if (event.key === 'Enter') handleSearch();
    }

    function handleSearchInputChange() {
        if (searchQuery.trim() && entryFile) debounceSearch();
    }

    function handleEntryFileChange() {
        if (searchQuery.trim() && entryFile) debounceSearch();
    }

    function splitTextByMatch(text: string, query: string): {text: string; isMatch: boolean}[] {
        if (!query || !text) return [{text, isMatch: false}];
        try {
            const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(${escapedQuery})`, 'gi');
            const parts: {text: string; isMatch: boolean}[] = [];
            let lastIndex = 0;
            let match;
            while ((match = regex.exec(text)) !== null) {
                if (match.index > lastIndex) {
                    parts.push({text: text.substring(lastIndex, match.index), isMatch: false});
                }
                parts.push({text: match[0], isMatch: true});
                lastIndex = regex.lastIndex;
            }
            if (lastIndex < text.length) {
                parts.push({text: text.substring(lastIndex), isMatch: false});
            }
            return parts;
        } catch (error) {
            console.error('分割匹配文本时出错:', error);
            return [{text, isMatch: false}];
        }
    }
</script>

<div class="container text-vscode-foreground">
    <div class="search-header">
        <div class="mb-6">
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
                                if (searchQuery.trim() && entryFile) debounceSearch();
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
                                if (searchQuery.trim() && entryFile) debounceSearch();
                            }}
                        >
                            <WholeWordIcon active={isWholeWord} />
                        </button>
                    </div>
                </div>
            </div>
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
            </div>
        </div>
    </div>

    <div class="results-container">
        <div class="space-y-2 pl-2">
            {#if isSearching}
                <div class="flex justify-center py-8">
                    <div
                        class="w-8 h-8 border-4 border-vscode-button-bg border-t-transparent rounded-full animate-spin"
                    ></div>
                </div>
            {:else if fileGroups.length === 0}
                <p class="text-center py-8 text-vscode-description">无搜索结果或尚未搜索</p>
            {:else}
                <div class="text-xs mb-2 text-vscode-description">
                    找到 {totalMatches} 个匹配项，位于 {totalFiles} 个文件中
                </div>
                {#each fileGroups as group}
                    <div class="mb-2">
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
                                    <span class="text-xs text-vscode-description file-directory">{group.directory}</span
                                    >
                                    <span class="text-xs text-vscode-description file-matches"
                                        >({group.matches.length} 个匹配项)</span
                                    >
                                </div>
                            </div>
                        </div>
                        {#if expandedFiles[group.filePath]}
                            <div class="ml-6">
                                {#each group.matches as match}
                                    <div
                                        class="flex items-start cursor-pointer hover-bg-vscode-list-hover py-2px"
                                        on:click={() => openFile(match.filePath, match.lineNumber)}
                                        role="button"
                                        tabindex="0"
                                        on:keydown={(e) =>
                                            e.key === 'Enter' && openFile(match.filePath, match.lineNumber)}
                                    >
                                        <div class="flex-1 overflow-hidden">
                                            <pre
                                                class="text-xs match-text">{#each splitTextByMatch(match.matchText, searchQuery) as part}{#if part.isMatch}<span
                                                            class="match-highlight">{part.text}</span
                                                        >{:else}{part.text}{/if}{/each}</pre>
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
</div>

<style>
    .container {
        height: 100vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .search-header {
        position: sticky;
        top: 0;
        z-index: 10;
        padding: 0 0.5rem;
        border-bottom: 1px solid var(--vscode-panel-border);
    }

    .results-container {
        flex: 1;
        overflow-y: auto;
        padding: 0.5rem;
    }

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

    .match-highlight {
        background-color: rgba(255, 200, 0, 0.3);
        color: var(--vscode-foreground);
        border-radius: 2px;
        font-weight: bold;
    }
</style>
