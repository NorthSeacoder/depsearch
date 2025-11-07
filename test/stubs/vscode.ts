export const workspace = {
  getWorkspaceFolder: () => undefined,
  openTextDocument: async () => ({
    lineAt: () => ({ text: '' }),
  }),
}

export const window = {
  showErrorMessage: () => undefined,
  showWarningMessage: () => undefined,
  showTextDocument: async () => ({
    selection: undefined,
    revealRange: () => undefined,
  }),
  setStatusBarMessage: () => ({ dispose: () => undefined }),
  createOutputChannel: () => ({
    appendLine: () => undefined,
    show: () => undefined,
  }),
}

export const commands = {
  executeCommand: async () => undefined,
}

export const Uri = {
  file: (path: string) => ({ fsPath: path }),
  joinPath: (uri: { fsPath: string }, ...paths: string[]) => ({ fsPath: `${uri.fsPath}/${paths.join('/')}` }),
}

export class Selection {
  constructor(public anchorLine: number, public anchorCharacter: number, public activeLine: number, public activeCharacter: number) {}
}

export class Range {
  constructor(public startLine: number, public startCharacter: number, public endLine: number, public endCharacter: number) {}
}

export const TextEditorRevealType = {
  InCenter: 0,
}

export const ColorThemeKind = {
  Dark: 1,
  Light: 2,
  HighContrast: 3,
  HighContrastLight: 4,
}

export const windowActiveColorTheme = {
  kind: ColorThemeKind.Dark,
}

export const env = {
  uriScheme: 'vscode',
}

export const extensions = {
  getExtension: () => undefined,
}
