# GitHub Actions CI 修复说明

## 🔧 修复的问题

### 1. **CI 配置过时**
原有的 CI 配置使用了旧版本的 GitHub Actions 和 pnpm action，导致构建失败。

### 2. **@antfu/ni 依赖问题**
CI 中使用了 `@antfu/ni` 工具（nr、nci 命令），但这增加了不必要的复杂性和潜在的失败点。

### 3. **跨平台环境变量问题**
在 Windows 环境下，直接使用 `NODE_ENV=production` 会失败，需要跨平台的解决方案。

---

## ✅ 修复内容

### 1. 更新 GitHub Actions 版本

```yaml
# 之前
- uses: actions/checkout@v3
- uses: pnpm/action-setup@v2
- uses: actions/setup-node@v3

# 之后
- uses: actions/checkout@v4
- uses: pnpm/action-setup@v4
- uses: actions/setup-node@v4
```

### 2. 简化 CI 命令

移除对 `@antfu/ni` 的依赖，直接使用 pnpm 命令：

```yaml
# 之前
- name: Setup
  run: npm i -g @antfu/ni
- name: Install
  run: nci
- name: Lint
  run: nr lint

# 之后
- name: Install
  run: pnpm install --frozen-lockfile
- name: Lint
  run: pnpm lint
```

### 3. 添加 cross-env 支持跨平台

在 `package.json` 中：

```json
{
  "devDependencies": {
    "cross-env": "^7.0.3"
  },
  "scripts": {
    "bundle": "cross-env NODE_ENV=production tsup",
    "bundle:watch": "cross-env NODE_ENV=development tsup --watch"
  }
}
```

### 4. 修复测试命令

```yaml
# 之前
- name: Test
  run: nr test

# 之后
- name: Test
  run: pnpm exec vitest run
```

---

## 📝 完整的 CI 流程

现在 CI 包含 3 个 job：

### 1. **lint** - 代码检查
```bash
pnpm install --frozen-lockfile
pnpm lint
```

### 2. **typecheck** - 类型检查
```bash
pnpm install --frozen-lockfile
pnpm typecheck
```

### 3. **test** - 构建和测试
在 3 个平台上运行（Ubuntu, Windows, macOS）：
```bash
pnpm install --frozen-lockfile
pnpm build
pnpm exec vitest run
```

---

## ✅ 验证结果

所有命令在本地测试通过：

```bash
✅ pnpm lint           # ESLint 检查通过
✅ pnpm typecheck      # TypeScript 类型检查通过
✅ pnpm build          # 构建成功
✅ pnpm exec vitest run # 7/7 测试通过
```

---

## 🎯 优势

1. **更简单** - 直接使用 pnpm 命令，减少依赖
2. **更可靠** - 使用最新的 GitHub Actions
3. **跨平台** - cross-env 确保在 Windows/Linux/macOS 上都能工作
4. **更快** - 使用 `--frozen-lockfile` 确保依赖一致性

---

## 📌 注意事项

- 所有 CI 使用 `pnpm install --frozen-lockfile` 确保依赖锁定
- 测试命令使用 `pnpm exec vitest run` 而不是 `pnpm test`（避免 watch 模式）
- 构建脚本使用 `cross-env` 设置环境变量，确保跨平台兼容
