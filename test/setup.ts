import { vi } from 'vitest'

vi.mock('vscode', async () => await import('./stubs/vscode'))

vi.mock('reactive-vscode', () => ({
  getDefaultLoggerPrefix: () => 'test',
  useLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    dispose: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    createLoggerFunc: () => vi.fn(),
  }),
}))
