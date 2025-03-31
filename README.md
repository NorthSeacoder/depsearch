# DepSearch

![icon](res/icon.png)  
A Visual Studio Code extension for searching within your project's dependency tree.  
一款用于在项目依赖树中进行搜索的 Visual Studio Code 扩展。

---

### Overview  
DepSearch is a VS Code extension designed to help developers efficiently search for terms within the dependency tree of their JavaScript and TypeScript projects.
DepSearch 是一款 Visual Studio Code 扩展，旨在帮助开发者在 JavaScript 和 TypeScript 项目的依赖树中高效搜索特定术语。

### Features  
- **Dependency Tree Search**: Search for terms across all files in a dependency chain, starting from an entry file.  
  **依赖树搜索**：从入口文件开始，在整个依赖链的所有文件中搜索术语。  
- **Interactive Webview**: A modern UI built with Svelte, featuring case-sensitive and whole-word search options.  
  **交互式 Webview**：基于 Svelte 构建的现代化界面，支持区分大小写和全字匹配搜索选项。  
- **Fast Search**: Powered by `ripgrep` for high-performance searches, with a Node.js fallback for robustness.  
  **快速搜索**：使用 `ripgrep` 提供高性能搜索，并配备 Node.js 后备机制以确保健壮性。  
- **VS Code Integration**: Accessible via the activity bar and explorer context menu.  
  **VS Code 集成**：通过活动栏和资源管理器上下文菜单轻松访问。

### Installation  
1. Open Visual Studio Code.  
   打开 Visual Studio Code。  
2. Go to the Extensions view (`Ctrl+Shift+X` or `Cmd+Shift+X` on macOS).  
   进入扩展视图（`Ctrl+Shift+X` 或 macOS 上的 `Cmd+Shift+X`）。  
3. Search for `DepSearch` by `Northseacoder`.  
   搜索 `Northseacoder` 发布的 `DepSearch`。  
4. Click **Install**.  
   点击 **安装**。  

Alternatively, install via the Marketplace: [DepSearch on VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Northseacoder.depsearch).  
或者，通过 Marketplace 安装：[VS Code Marketplace 上的 DepSearch](https://marketplace.visualstudio.com/items?itemName=Northseacoder.depsearch)。

### Usage  
1. **Open the DepSearch Panel**:  
   - Click the DepSearch icon in the activity bar, or  
   - Right-click a file or folder in the Explorer and select **DepSearch: Analyze Dependencies**.  
   **打开 DepSearch 面板**：  
   - 点击活动栏中的 DepSearch 图标，或者  
   - 在资源管理器中右键单击文件或文件夹，选择 **DepSearch: 分析依赖**。   
2. **Search**:  
   - Type your search query in the input box.  
   - Toggle **Case Sensitive** or **Whole Word** options as needed.  
   - Press `Enter` to execute.  
   **搜索**：  
   - 在输入框中键入搜索查询。  
   - 根据需要切换 **区分大小写** 或 **全字匹配** 选项。  
   - 按 `Enter` 执行搜索。  
4. **View Results**:  
   - Results are grouped by file, with expandable sections showing matching lines.  
   - Click a result to open the file at the corresponding line.  
   **查看结果**：  
   - 结果按文件分组，带有可展开的部分显示匹配行。  
   - 点击结果以在对应行打开文件。

### Development  

#### Prerequisites  
- Node.js (>= 18.x)  
- pnpm (>= 10.x)  
- VS Code (>= 1.90.0)  

#### Setup  
1. Clone the repository:  
   克隆仓库：  
   ```bash
   git clone https://github.com/Northseacoder/depsearch.git
   cd depsearch
   ```  
2. Install dependencies:  
   安装依赖：  
   ```bash
   pnpm install
   ```  
3. Build the extension:  
   构建扩展：  
   ```bash
   pnpm build
   ```  
4. Open in VS Code and press `F5` to debug.  
   在 VS Code 中打开并按 `F5` 进行调试。

#### Contributing  
Contributions are welcome! Please:  
欢迎贡献！请按照以下步骤：  
1. Fork the repository.  
   Fork 本仓库。  
2. Create a feature branch (`git checkout -b feature/your-feature`).  
   创建特性分支（`git checkout -b feature/your-feature`）。  
3. Commit changes (`git commit -m "Add your feature"`).  
   提交更改（`git commit -m "添加您的功能"`）。  
4. Push to the branch (`git push origin feature/your-feature`).  
   推送分支（`git push origin feature/your-feature`）。  
5. Open a Pull Request.  
   提交 Pull Request。

### License  
This extension is licensed under the [WTFPL](LICENSE.md) – do what you want with it!  
本扩展采用 [WTFPL](LICENSE.md) 许可证 – 您可以随意使用！

### Issues  
Found a bug? Have a feature request? Please open an issue on [GitHub](https://github.com/Northseacoder/depsearch/issues).  
发现问题？有功能建议？请在 [GitHub](https://github.com/Northseacoder/depsearch/issues) 上提交 issue。
