# Changelog

All notable changes to the "DepSearch" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive test suite with vitest
  - Unit tests for search utilities
  - Unit tests for dependency parser
  - Unit tests for webview provider
- Test coverage configuration with thresholds
- Prettier configuration for consistent code formatting
- JSDoc comments for better code documentation
- Type safety improvements throughout the codebase
- State restoration bug fix in webview panel
- Enhanced error handling and validation
- Cache mechanism for dependency parsing (5-minute TTL)
- Better workspace folder detection

### Changed
- Refactored panel.ts with cleaner separation of concerns
- Improved search.ts with better error handling
- Enhanced dependency-parser.ts with async/await patterns
- Updated npm scripts for better workflow
  - `pnpm clean` - Clean build artifacts
  - `pnpm lint:fix` - Auto-fix linting issues
  - `pnpm format` - Check code formatting
  - `pnpm format:fix` - Auto-format code
  - `pnpm test:watch` - Run tests in watch mode
  - `pnpm test:coverage` - Generate coverage reports
- Migrated from type interfaces to stronger type definitions
- Improved code organization and module structure

### Fixed
- State restoration bug where webview wouldn't restore results
- Better handling of missing tsconfig.json files
- Improved error messages for better user experience
- Fixed workspace folder detection for better project support
- Fixed build script to correctly bundle extension code with tsup

### Dependencies
- Updated vitest from ^1.4.0 to ^2.1.8
- Added @vitest/coverage-v8 for test coverage
- Added prettier ^3.4.2 for code formatting
- All other dependencies updated to latest stable versions

## [0.0.4] - 2024-11-07

### Added
- Initial release with basic functionality
- Dependency tree search from entry file
- Interactive Svelte-based webview
- Case-sensitive and whole-word search options
- Integration with VS Code activity bar
- Ripgrep-powered search with Node.js fallback

[Unreleased]: https://github.com/Northseacoder/depsearch/compare/v0.0.4...HEAD
[0.0.4]: https://github.com/Northseacoder/depsearch/releases/tag/v0.0.4
