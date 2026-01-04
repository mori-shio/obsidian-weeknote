import { App, TFile, moment } from "obsidian";
import { WeeknoteSettings } from "../types";
import { FileUtils } from "../utils/file-utils";

export class MemoService {
  constructor(
    private app: App,
    private settings: WeeknoteSettings,
    private fileUtils: FileUtils
  ) {}

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

    let insertAt = memoSectionStart + 1;

    for (let i = memoSectionStart + 1; i < memoSectionEnd; i++) {
      const line = lines[i].trim();
      if (line.startsWith("- ") && line.length > 2) {
        insertAt = i + 1;
      }
    }

    lines.splice(insertAt, 0, memoLine);

    await this.app.vault.modify(file, lines.join("\n"));
  }

  async updateMemo(originalMemo: string, timestamp: string, newContent: string): Promise<void> {
    const filePath = this.fileUtils.getWeeknotePath();
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

  async deleteMemo(originalMemo: string): Promise<void> {
    const filePath = this.fileUtils.getWeeknotePath();
    const file = this.app.vault.getAbstractFileByPath(filePath);

    if (!(file instanceof TFile)) {
      throw new Error(`週報が見つかりません: ${filePath}`);
    }

    const fileContent = await this.app.vault.read(file);
    const lineToDelete = `- ${originalMemo}`;
    
    const newFileContent = fileContent
      .split("\n")
      .filter(line => line !== lineToDelete)
      .join("\n");
    
    await this.app.vault.modify(file, newFileContent);
  }

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

      if (inMemoSection && trimmed.startsWith("- ") && trimmed.length > 2) {
        memos.push(trimmed.substring(2));
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
