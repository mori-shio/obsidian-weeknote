import {
  Plugin,
  moment,
  TFile,
  Notice,
} from "obsidian";

import { 
    PluginSettings as GithubPluginSettings, 
    PluginData as GithubPluginData,
    updatePluginSettings,
} from "./globals";
import { DATA_VERSION as GITHUB_DATA_VERSION } from "./settings/types";
import { CalendarService } from "./calendar-service";
import { WeeknoteGenerator } from "./weeknote-generator";
import { WeeknoteSettingTab } from "./settings/weeknote-settings-tab";
import { WeeknoteView } from "./weeknote-view";
import {
  CalendarEvent,
  WeeklySchedule,
  TaskItem,
  WeeknoteSettings,
} from "./types";
import { setLanguage } from "./i18n";
import { DEFAULT_SETTINGS, VIEW_TYPE_WEEKNOTE } from "./constants";

// Services
import { FileUtils } from "./utils/file-utils";
import { MemoService } from "./services/memo-service";
import { TaskService } from "./services/task-service";
import { ScheduleService } from "./services/schedule-service";

// ============================================
// Plugin
// ============================================

export default class WeeknotePlugin extends Plugin {
  settings: WeeknoteSettings;
  generator: WeeknoteGenerator;
  calendarService: CalendarService;

  // Services
  private fileUtils: FileUtils;
  private memoService: MemoService;
  private taskService: TaskService;
  private scheduleService: ScheduleService;

  async onload(): Promise<void> {
    await this.loadSettings();
    setLanguage(this.settings.language);
    
    // Migration: weeknotePath/weeknoteFilename -> weeknoteFileFormat
    const settingsAny = (this.settings as unknown) as Record<string, unknown>;
    if (settingsAny.weeknotePath !== undefined || settingsAny.weeknoteFilename !== undefined) {
      const path = (settingsAny.weeknotePath as string) || "01.Weeknote/[YYYY]/[MM]";
      const filename = (settingsAny.weeknoteFilename as string) || "[YYYY]-[MM]-[DD]";
      
      if (this.settings.weeknoteFileFormat === "01.Weeknote/[YYYY]/[MM]/[YYYY]-[MM]-[DD]") {
        this.settings.weeknoteFileFormat = `${path}/${filename}`;
      }
      
      delete settingsAny.weeknotePath;
      delete settingsAny.weeknoteFilename;
      delete settingsAny.weeknoteBasePath;
      delete settingsAny.weeknoteSubPath;
      delete settingsAny.weeklyReportBasePath;
      await this.saveSettings();
    }

    // Initialize services
    this.initializeServices();

    this.registerView(VIEW_TYPE_WEEKNOTE, (leaf) => new WeeknoteView(leaf, this));

    this.addRibbonIcon("calendar-clock", "Open weeknote", () => {
      void this.activateView();
    });

    this.addCommand({
      id: "open-manager",
      name: "Open weekly report view",
      callback: () => void this.activateView(),
    });

    this.addCommand({
      id: "create-report",
      name: "Create weekly report",
      callback: () => void this.createWeeknote(),
    });

    this.addSettingTab(new WeeknoteSettingTab(this.app, this));
  }

  private initializeServices(): void {
    this.generator = new WeeknoteGenerator(this.app, this.settings);
    this.calendarService = new CalendarService(this.settings);
    this.fileUtils = new FileUtils(this.app, this.settings, this.generator);
    this.memoService = new MemoService(this.app, this.settings, this.fileUtils);
    this.scheduleService = new ScheduleService(this.app, this.settings, this.fileUtils, this.generator);
    this.taskService = new TaskService(
      this.app, 
      this.settings, 
      this.fileUtils, 
      this.generator,
      this.getProcessTaskContentFn()
    );
  }

  private getProcessTaskContentFn(): (text: string) => Promise<string> {
    return async (text: string): Promise<string> => {
      const view = this.app.workspace.getLeavesOfType(VIEW_TYPE_WEEKNOTE)[0]?.view as WeeknoteView;
      return view ? await view.processTaskContent(text) : text;
    };
  }

  async createWeeknote(): Promise<void> {
    try {
      const weekStart = this.generator.getWeekStartDate();
      const filePath = this.generator.getReportFilePath(weekStart);
      
      let file = this.app.vault.getAbstractFileByPath(filePath);
      let isNew = false;
      
      if (!(file instanceof TFile)) {
        new Notice("週報を作成中...");
        await this.generator.createReport(weekStart, null);
        file = this.app.vault.getAbstractFileByPath(filePath);
        isNew = true;
        new Notice(`週報を作成しました: ${filePath}`);
      } else {
        new Notice(`${filePath} already exists`);
      }
      
      if (file instanceof TFile) {
        await this.app.workspace.getLeaf().openFile(file);
      }
      
      if (isNew) {
        new Notice("スケジュールを同期しています...");
        try {
          const schedule = await this.calendarService.fetchWeeklySchedule(weekStart);
          if (schedule) {
            for (let i = 0; i < 7; i++) {
              const date = weekStart.clone().add(i, "days");
              await this.updateScheduleInReport(date, schedule);
            }
            new Notice("スケジュールの同期が完了しました");
            
            const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WEEKNOTE);
            leaves.forEach(leaf => {
              const view = (leaf.view as unknown) as { onOpen?: () => Promise<void> };
              if (view && typeof view.onOpen === "function") {
                // Need to re-render the entire view for layout change
                void view.onOpen();
              }
            });
          }
        } catch (e) {
          new Notice("スケジュールの取得に失敗しました");
        }
      }
    } catch (error) {
      new Notice(`週報の作成に失敗しました: ${error}`);
    }
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;

    let leaf = workspace.getLeavesOfType(VIEW_TYPE_WEEKNOTE)[0];

    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        leaf = rightLeaf;
        await leaf.setViewState({ type: VIEW_TYPE_WEEKNOTE, active: true });
      }
    }

    if (leaf) {
      void workspace.revealLeaf(leaf);
    }
  }

  onunload(): void {
    void this.saveSettings();
  }

  async loadSettings(): Promise<void> {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);

    if (data) {
        updatePluginSettings({
            settings: data.githubSettings,
            cache: data.githubCache,
            dataVersion: data.githubDataVersion
        });
    }
  }

  async saveSettings(): Promise<void> {
    const data = {
        ...this.settings,
        githubSettings: GithubPluginSettings,
        githubCache: GithubPluginData.cache,
        githubDataVersion: GITHUB_DATA_VERSION
    };
    await this.saveData(data);
    
    // Update services with new settings
    this.initializeServices();
  }

  // ============================================
  // Delegation methods for IWeeknotePlugin interface
  // (Preserves backwards compatibility with WeeknoteView)
  // ============================================

  // FileUtils delegation
  getWeeknotePath(date: moment.Moment = moment()): string {
    return this.fileUtils.getWeeknotePath(date);
  }

  async ensureWeeknoteExists(date: moment.Moment): Promise<TFile> {
    return this.fileUtils.ensureWeeknoteExists(date);
  }

  getDaySectionHeading(date: moment.Moment): string {
    return this.fileUtils.getDaySectionHeading(date);
  }

  getTodaySectionHeading(): string {
    return this.fileUtils.getTodaySectionHeading();
  }

  getLocaleHeadings(date: moment.Moment): Set<string> {
    return this.fileUtils.getLocaleHeadings(date);
  }

  // MemoService delegation
  async insertMemoToWeeknote(content: string, date?: moment.Moment): Promise<void> {
    return this.memoService.insertMemo(content, date);
  }

  async updateMemo(originalMemo: string, timestamp: string, newContent: string): Promise<void> {
    return this.memoService.updateMemo(originalMemo, timestamp, newContent);
  }

  async deleteMemo(originalMemo: string): Promise<void> {
    return this.memoService.deleteMemo(originalMemo);
  }

  async getDayMemos(date: moment.Moment): Promise<string[]> {
    return this.memoService.getDayMemos(date);
  }

  async getTodaysMemos(): Promise<string[]> {
    return this.memoService.getTodaysMemos();
  }

  // TaskService delegation
  async getDayTasks(date: moment.Moment): Promise<TaskItem[]> {
    return this.taskService.getDayTasks(date);
  }

  async addTaskToReport(date: moment.Moment, taskText: string): Promise<void> {
    return this.taskService.addTask(date, taskText);
  }

  async getPastDaysWithTasks(currentDate: moment.Moment, limit: number = 3): Promise<{date: moment.Moment, count: number}[]> {
    return this.taskService.getPastDaysWithTasks(currentDate, limit);
  }

  async copyTasksFromDate(sourceDate: moment.Moment, targetDate: moment.Moment): Promise<void> {
    return this.taskService.copyTasksFromDate(sourceDate, targetDate);
  }

  async insertTaskAtLine(date: moment.Moment, taskText: string, insertBeforeLineIndex: number, useNextLineIndent: boolean = false): Promise<void> {
    return this.taskService.insertTaskAtLine(date, taskText, insertBeforeLineIndex, useNextLineIndent);
  }

  async updateTaskContent(lineIndex: number, checked: boolean, newTitle: string, date: moment.Moment): Promise<void> {
    return this.taskService.updateTaskContent(lineIndex, checked, newTitle, date);
  }

  async toggleTaskCheck(lineIndex: number, date: moment.Moment, newState?: boolean): Promise<void> {
    return this.taskService.toggleTaskCheck(lineIndex, date, newState);
  }

  async deleteTask(lineIndex: number, date: moment.Moment): Promise<void> {
    return this.taskService.deleteTask(lineIndex, date);
  }

  async reorderTask(fromLineIndex: number, toLineIndex: number, date: moment.Moment, targetLevel: number = -1): Promise<void> {
    return this.taskService.reorderTask(fromLineIndex, toLineIndex, date, targetLevel);
  }

  // ScheduleService delegation
  async getDaySchedule(date: moment.Moment): Promise<string[]> {
    return this.scheduleService.getDaySchedule(date);
  }

  async getTodaysSchedule(): Promise<string[]> {
    return this.scheduleService.getTodaysSchedule();
  }

  async updateScheduleInReport(date: moment.Moment, schedule: WeeklySchedule): Promise<void> {
    return this.scheduleService.updateScheduleInReport(date, schedule);
  }

  async toggleScheduleItem(originalLine: string, checked: boolean): Promise<void> {
    return this.scheduleService.toggleScheduleItem(originalLine, checked);
  }
}
