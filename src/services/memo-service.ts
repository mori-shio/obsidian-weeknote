import { App, TFile, moment } from "obsidian";
import { MemoItem, WeeknoteSettings } from "../types";
import { FileUtils } from "../utils/file-utils";

export class MemoService {
  constructor(
    private app: App,
    private settings: WeeknoteSettings,
    private fileUtils: FileUtils
  ) {}

  // Get the indent string based on settings
  private getIndentString(): string {
    switch (this.settings.markdownIndentStyle) {
      case "2-spaces":
        return "  ";
      case "4-spaces":
        return "    ";
      case "tab":
      default:
        return "\t";
    }
  }

  // Calculate level from indentation, supporting mixed styles
  private calculateLevelFromIndent(indentStr: string): number {
    // Count tabs first
    const tabCount = (indentStr.match(/\t/g) || []).length;
    // Count remaining spaces (after removing tabs)
    const spacesOnly = indentStr.replace(/\t/g, "");
    const spaceCount = spacesOnly.length;
    
    // Determine indent width for spaces
    let indentWidth: number;
    switch (this.settings.markdownIndentStyle) {
      case "2-spaces":
        indentWidth = 2;
        break;
      case "4-spaces":
        indentWidth = 4;
        break;
      case "tab":
      default:
        indentWidth = 2; // For tab mode, treat 2 spaces as 1 level
    }
    
    return tabCount + Math.floor(spaceCount / indentWidth);
  }

  async insertMemo(content: string, date?: moment.Moment): Promise<void> {
    const targetDate = date || moment();
    const file = await this.fileUtils.ensureWeeknoteExists(targetDate);

    if (!(file instanceof TFile)) {
      throw new Error("Failed to create or find weeknote file");
    }

    const fileContent = await this.app.vault.read(file);
    const lines = fileContent.split("\n");

    const validHeadings = this.fileUtils.getLocaleHeadings(targetDate);
    const memoHeading = this.settings.memoHeading;

    let daySectionStart = -1;
    let memoSectionStart = -1;
    let memoSectionEnd = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (validHeadings.has(line)) {
        daySectionStart = i;
      }

      if (daySectionStart !== -1 && memoSectionStart === -1 && line === memoHeading) {
        memoSectionStart = i;
      }

      if (memoSectionStart !== -1 && memoSectionEnd === -1 && i > memoSectionStart) {
        if (line.startsWith("##") || line === "---") {
          memoSectionEnd = i;
          break;
        }
      }
    }

    if (memoSectionStart === -1) {
      throw new Error(`"${memoHeading}" が指定日のセクションに見つかりません`);
    }

    if (memoSectionEnd === -1) {
      memoSectionEnd = lines.length;
    }

    const timestamp = moment().format(this.settings.timestampFormat);
    const memoLine = `- ${timestamp} ${content.replace(/\n/g, " ")}`;

    // Find the last top-level memo (not indented) to insert after
    let insertAt = memoSectionStart + 1;

    for (let i = memoSectionStart + 1; i < memoSectionEnd; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      // Check if it's a top-level memo (starts with "- " without indentation)
      if (trimmed.startsWith("- ") && trimmed.length > 2) {
        const indent = line.length - line.trimStart().length;
        if (indent === 0) {
          // Find the last reply of this memo
          let lastLineOfMemo = i;
          for (let j = i + 1; j < memoSectionEnd; j++) {
            const nextLine = lines[j];
            const nextTrimmed = nextLine.trim();
            if (nextTrimmed.startsWith("- ")) {
              const nextIndent = nextLine.length - nextLine.trimStart().length;
              if (nextIndent > 0) {
                lastLineOfMemo = j; // This is a reply
              } else {
                break; // Next top-level memo
              }
            } else if (nextTrimmed === "" || nextTrimmed.startsWith("##") || nextTrimmed === "---") {
              break;
            }
          }
          insertAt = lastLineOfMemo + 1;
        }
      }
    }

    lines.splice(insertAt, 0, memoLine);

    await this.app.vault.modify(file, lines.join("\n"));
  }

  /**
   * Insert a reply to a parent memo
   */
  async insertReply(parentMemo: MemoItem, content: string, date?: moment.Moment): Promise<void> {
    const targetDate = date || moment();
    const filePath = this.fileUtils.getWeeknotePath(targetDate);
    const file = this.app.vault.getAbstractFileByPath(filePath);

    if (!(file instanceof TFile)) {
      throw new Error("Failed to find weeknote file");
    }

    const fileContent = await this.app.vault.read(file);
    const lines = fileContent.split("\n");

    const timestamp = moment().format(this.settings.timestampFormat);
    const indentStr = this.getIndentString();
    const replyLine = `${indentStr}- ${timestamp} ${content.replace(/\n/g, " ")}`;

    // Find the insertion point: after parent memo and all its existing replies
    let insertAt = parentMemo.lineIndex + 1;
    
    // Skip over any existing replies
    for (let i = parentMemo.lineIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      if (trimmed === "" || trimmed.startsWith("##") || trimmed === "---") {
        break;
      }
      
      if (trimmed.startsWith("- ")) {
        const indent = line.length - line.trimStart().length;
        if (indent > 0) {
          insertAt = i + 1; // This is a reply, insert after it
        } else {
          break; // Next top-level memo
        }
      }
    }

    lines.splice(insertAt, 0, replyLine);

    await this.app.vault.modify(file, lines.join("\n"));
  }

  async updateMemo(originalMemo: string, timestamp: string, newContent: string, date?: moment.Moment): Promise<void> {
    const targetDate = date || moment();
    const filePath = this.fileUtils.getWeeknotePath(targetDate);
    const file = this.app.vault.getAbstractFileByPath(filePath);

    if (!(file instanceof TFile)) {
      throw new Error(`週報が見つかりません: ${filePath}`);
    }

    const fileContent = await this.app.vault.read(file);
    const oldLine = `- ${originalMemo}`;
    const newLine = `- ${timestamp} ${newContent.replace(/\n/g, " ")}`;
    
    const newFileContent = fileContent.replace(oldLine, newLine);
    await this.app.vault.modify(file, newFileContent);
  }

  /**
   * Delete a memo and optionally its replies
   */
  async deleteMemo(memo: MemoItem, deleteReplies: boolean = true): Promise<void> {
    const filePath = this.fileUtils.getWeeknotePath();
    const file = this.app.vault.getAbstractFileByPath(filePath);

    if (!(file instanceof TFile)) {
      throw new Error(`週報が見つかりません: ${filePath}`);
    }

    const fileContent = await this.app.vault.read(file);
    const lines = fileContent.split("\n");
    
    // Collect line indices to delete
    const linesToDelete = new Set<number>();
    linesToDelete.add(memo.lineIndex);
    
    // If deleting replies and this is a parent memo
    if (deleteReplies && memo.level === 0 && memo.replies) {
      for (const reply of memo.replies) {
        linesToDelete.add(reply.lineIndex);
      }
    }
    
    const newLines = lines.filter((_, index) => !linesToDelete.has(index));
    await this.app.vault.modify(file, newLines.join("\n"));
  }

  /**
   * Delete a memo by its raw line content (legacy support)
   */
  async deleteMemoByLine(originalMemo: string): Promise<void> {
    const filePath = this.fileUtils.getWeeknotePath();
    const file = this.app.vault.getAbstractFileByPath(filePath);

    if (!(file instanceof TFile)) {
      throw new Error(`週報が見つかりません: ${filePath}`);
    }

    const fileContent = await this.app.vault.read(file);
    const lineToDelete = `- ${originalMemo}`;
    
    const newFileContent = fileContent
      .split("\n")
      .filter(line => line.trim() !== lineToDelete.trim())
      .join("\n");
    
    await this.app.vault.modify(file, newFileContent);
  }

  /**
   * Get memos with hierarchical structure (parent memos with replies)
   */
  async getDayMemosStructured(date: moment.Moment): Promise<MemoItem[]> {
    const filePath = this.fileUtils.getWeeknotePath(date);
    const file = this.app.vault.getAbstractFileByPath(filePath);

    if (!(file instanceof TFile)) {
      return [];
    }

    const fileContent = await this.app.vault.read(file);
    const lines = fileContent.split("\n");

    const validHeadings = this.fileUtils.getLocaleHeadings(date);
    const memoHeading = this.settings.memoHeading;

    let inDaySection = false;
    let inMemoSection = false;
    let memoSectionStart = -1;
    const memos: MemoItem[] = [];
    let currentParent: MemoItem | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (validHeadings.has(trimmed)) {
        inDaySection = true;
        continue;
      }

      if (inDaySection && trimmed === memoHeading) {
        inMemoSection = true;
        memoSectionStart = i;
        continue;
      }

      if (inMemoSection && (trimmed.startsWith("##") || trimmed === "---")) {
        break;
      }

      if (inMemoSection && trimmed.startsWith("- ") && trimmed.length > 2) {
        const level = this.calculateLevelFromIndent(line.substring(0, line.length - line.trimStart().length));
        const content = trimmed.substring(2); // Remove "- "
        
        const memoItem: MemoItem = {
          timestamp: "",
          content: content,
          rawLine: content,
          lineIndex: i,
          level: level > 0 ? 1 : 0, // Collapse all levels > 0 to 1 (reply)
          replies: []
        };
        
        // Parse timestamp from content
        this.parseTimestampAndContent(memoItem);
        
        if (memoItem.level === 0) {
          // Parent memo
          currentParent = memoItem;
          memos.push(memoItem);
        } else if (currentParent) {
          // Reply to current parent
          currentParent.replies.push(memoItem);
        }
      }
    }

    return memos;
  }

  /**
   * Parse timestamp and content from a memo item
   */
  private parseTimestampAndContent(memo: MemoItem): void {
    const text = memo.rawLine;
    
    // Try common timestamp patterns
    // Pattern 1: YYYY-MM-DD HH:mm:ss content
    const dateTimeMatch = text.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?::\d{2})?)\s+(.*)$/);
    if (dateTimeMatch) {
      memo.timestamp = dateTimeMatch[1];
      memo.content = dateTimeMatch[2];
      return;
    }
    
    // Pattern 2: HH:mm:ss content or HH:mm content
    const timeMatch = text.match(/^(\d{2}:\d{2}(?::\d{2})?)\s+(.*)$/);
    if (timeMatch) {
      memo.timestamp = timeMatch[1];
      memo.content = timeMatch[2];
      return;
    }
    
    // Pattern 3: (timestamp) content
    const parenMatch = text.match(/^\(([^)]+)\)\s*(.*)$/);
    if (parenMatch) {
      memo.timestamp = parenMatch[1];
      memo.content = parenMatch[2];
      return;
    }
    
    // No timestamp found, use content as-is
    memo.content = text;
  }

  /**
   * Get memos as flat string array (legacy support)
   */
  async getDayMemos(date: moment.Moment): Promise<string[]> {
    const filePath = this.fileUtils.getWeeknotePath(date);
    const file = this.app.vault.getAbstractFileByPath(filePath);

    if (!(file instanceof TFile)) {
      return [];
    }

    const fileContent = await this.app.vault.read(file);
    const lines = fileContent.split("\n");

    const validHeadings = this.fileUtils.getLocaleHeadings(date);
    const memoHeading = this.settings.memoHeading;

    let inDaySection = false;
    let inMemoSection = false;
    const memos: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (validHeadings.has(trimmed)) {
        inDaySection = true;
        continue;
      }

      if (inDaySection && trimmed === memoHeading) {
        inMemoSection = true;
        continue;
      }

      if (inMemoSection && (trimmed.startsWith("##") || trimmed === "---")) {
        break;
      }

      // Only return top-level memos (no indentation)
      if (inMemoSection && trimmed.startsWith("- ") && trimmed.length > 2) {
        const indent = line.length - line.trimStart().length;
        if (indent === 0) {
          memos.push(trimmed.substring(2));
        }
      }
    }

    return memos;
  }

  async getTodaysMemos(): Promise<string[]> {
    return this.getDayMemos(moment());
  }

  // Helper to update settings reference when settings change
  updateSettings(settings: WeeknoteSettings, fileUtils: FileUtils): void {
    this.settings = settings;
    this.fileUtils = fileUtils;
  }
}
