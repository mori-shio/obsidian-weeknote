import { App, TFile, Notice, moment } from "obsidian";
import { WeeknoteSettings } from "../types";
import { WeeknoteGenerator } from "../weeknote-generator";

export class FileUtils {
  constructor(
    private app: App,
    private settings: WeeknoteSettings,
    private generator: WeeknoteGenerator
  ) {}

  getWeeknotePath(date: moment.Moment = moment()): string {
    return this.generator.getReportFilePath(this.generator.getWeekStartDate(date));
  }

  async ensureWeeknoteExists(date: moment.Moment): Promise<TFile> {
    const filePath = this.getWeeknotePath(date);
    let file = this.app.vault.getAbstractFileByPath(filePath);

    if (!(file instanceof TFile)) {
      new Notice("週報を作成中...");
      const weekStart = this.generator.getWeekStartDate(date);
      await this.generator.createReport(weekStart, null);

      file = this.app.vault.getAbstractFileByPath(filePath);
      if (!(file instanceof TFile)) {
        throw new Error(`週報の作成に失敗しました: ${filePath}`);
      }
      new Notice("週報ファイルを自動作成しました");
      
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    return file;
  }

  getDaySectionHeading(date: moment.Moment): string {
    const lang = this.settings.language === "ja" ? "ja" : "en";
    return date.clone().locale(lang).format(this.settings.dayDateFormat);
  }

  getTodaySectionHeading(): string {
    return this.getDaySectionHeading(moment());
  }

  getLocaleHeadings(date: moment.Moment): Set<string> {
    const headingEn = date.clone().locale("en").format(this.settings.dayDateFormat);
    const headingJa = date.clone().locale("ja").format(this.settings.dayDateFormat);
    const headingSetting = this.getDaySectionHeading(date);
    return new Set([headingEn, headingJa, headingSetting]);
  }

  // Helper to update settings reference when settings change
  updateSettings(settings: WeeknoteSettings, generator: WeeknoteGenerator): void {
    this.settings = settings;
    this.generator = generator;
  }
}
