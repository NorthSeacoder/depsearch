export interface Payload {
    title: string;
    msg?: string;
    entryFile?: string;
    query?: string;
    isCaseSensitive?: boolean;
    isWholeWord?: boolean;
    filePath?: string;
    lineNumber?: number;
    importResults?: any[];
  }