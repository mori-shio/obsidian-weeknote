import { App, TFile, moment } from "obsidian";
import { CalendarEvent, WeeklySchedule, WeeknoteSettings } from "../types";
import { FileUtils } from "../utils/file-utils";
import { WeeknoteGenerator } from "../weeknote-generator";
import { i18n } from "../i18n";

export class ScheduleService {
  constructor(
    private app: App,
    private settings: WeeknoteSettings,
    private fileUtils: FileUtils,
    private generator: WeeknoteGenerator
  ) {}

  async getDaySchedule(date: moment.Moment): Promise<string[]> {
    const filePath = this.fileUtils.getWeeknotePath(date);
    const file = this.app.vault.getAbstractFileByPath(filePath);

    if (!(file instanceof TFile)) {
      return [];
    }

    const fileContent = await this.app.vault.read(file);
    const lines = fileContent.split("\n");

    const validHeadings = this.fileUtils.getLocaleHeadings(date);
    const scheduleHeading = this.settings.daySections.find(s => s.id === "schedule")?.heading || "### schedule";

    let inDaySection = false;
    let inScheduleSection = false;
    const scheduleItems: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (validHeadings.has(trimmed)) {
        inDaySection = true;
        continue;
      }

      if (inDaySection && trimmed === scheduleHeading) {
        inScheduleSection = true;
        continue;
      }

      if (inScheduleSection && (trimmed.startsWith("##") || trimmed === "---")) {
        break;
      }

      if (inScheduleSection && trimmed.startsWith("- [")) {
        scheduleItems.push(trimmed);
      }
    }

    return scheduleItems;
  }

  async getTodaysSchedule(): Promise<string[]> {
    return this.getDaySchedule(moment());
  }

  async updateScheduleInReport(date: moment.Moment, schedule: WeeklySchedule): Promise<void> {
    const filePath = this.fileUtils.getWeeknotePath(date);
    const file = this.app.vault.getAbstractFileByPath(filePath);

    if (!(file instanceof TFile)) {
      return;
    }

    const fileContent = await this.app.vault.read(file);
    const lines = fileContent.split("\n");
    const validHeadings = this.fileUtils.getLocaleHeadings(date);
    const scheduleHeading = this.settings.daySections.find(s => s.id === "schedule")?.heading || "### schedule";

    // Find the day's schedule section
    let inDaySection = false;
    let scheduleStartIdx = -1;
    let scheduleEndIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();

      if (validHeadings.has(trimmed)) {
        inDaySection = true;
        continue;
      }

      if (inDaySection && trimmed === scheduleHeading) {
        scheduleStartIdx = i + 1;
        continue;
      }

      if (scheduleStartIdx !== -1 && (trimmed.startsWith("##") || trimmed === "---")) {
        scheduleEndIdx = i;
        break;
      }
    }

    if (scheduleStartIdx === -1) {
      return; // Schedule section not found
    }

    if (scheduleEndIdx === -1) {
      scheduleEndIdx = lines.length;
    }

    // Get events for this specific date
    const dayKeys = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
    const weekStart = this.generator.getWeekStartDate(date);
    const dayIndex = Math.round(date.diff(weekStart, "days"));
    const dayKey = dayKeys[date.day()] + "_" + dayIndex;
    const daySchedule = schedule[dayKey];

    if (!daySchedule) {
      return;
    }

    // Parse existing schedule to preserve checkbox state
    const existingScheduleLines = lines.slice(scheduleStartIdx, scheduleEndIdx);
    const checkedEvents = new Set<string>();

    for (const line of existingScheduleLines) {
      const match = line.match(/^- \[(x| )\] (.*?)$/);
      if (match && match[1] === "x") {
        const eventName = this.normalizeForMatching(match[2]);
        if (eventName) {
            checkedEvents.add(eventName);
        }
      }
    }

    // Format new schedule lines
    const newScheduleLines: string[] = [];
    for (const event of daySchedule.schedule) {
      let isChecked = false;
      const coreName = this.normalizeForMatching(event.eventName);
      if (checkedEvents.has(coreName)) {
        isChecked = true;
      }
      
      // Force check for declined events
      if (event.status === "declined") {
        isChecked = true;
      }
      
      newScheduleLines.push(this.formatScheduleEvent(event, isChecked));
    }
    if (newScheduleLines.length > 0) {
      newScheduleLines.push(""); // Add empty line after schedule
    }

    // Replace the old schedule with new one
    const newLines = [
      ...lines.slice(0, scheduleStartIdx),
      ...newScheduleLines,
      ...lines.slice(scheduleEndIdx)
    ];

    await this.app.vault.modify(file, newLines.join("\n"));
  }

  /**
   * Normalize an event string for comparison (strips time, labels, locations, links, and markdown)
   */
  private normalizeForMatching(text: string): string {
    if (!text) return "";
    
    let normalized = text.trim();
    
    // 1. Remove non-breaking spaces and other invisible chars
    normalized = normalized.replace(/[\u00a0\u1680\u180e\u2000-\u200b\u202f\u205f\u3000\ufeff]/g, " ");
    
    // 2. Strip outer strikethrough if any
    normalized = normalized.replace(/^~~(.*)~~$/, "$1");
    
    // 3. Strip various all-day labels
    normalized = normalized.replace(/^(\[終日\]|\[All day\])\s*/i, "");
    
    // 4. Strip time formats (HH:mm, HH:mm:ss, HH:mm-HH:mm)
    normalized = normalized.replace(/^(\d{1,2}:\d{2}(?::\d{2})?(?:-\d{1,2}:\d{2}(?::\d{2})?)?)\s*/, "");
    
    // 5. Strip [meet] links specifically
    normalized = normalized.replace(/\[meet\]\(.*?\)/g, "");
    // Also strip generic markdown links but keep text [text](url) -> text
    normalized = normalized.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    
    // 6. Strip location (must be preceded by space and at the very end to avoid matching middle-of-title @)
    normalized = normalized.replace(/\s+[＠@][^＠@]+$/, "");
    
    // 7. Remove all markdown decorations (*, _, ~)
    normalized = normalized.replace(/[*_~]/g, "");
    
    // 8. Final trim and lowercase
    return normalized.trim().toLowerCase();
  }

  getEventCoreString(event: CalendarEvent): string {
    return this.normalizeForMatching(event.eventName);
  }

  formatScheduleEvent(event: CalendarEvent, isChecked: boolean = false): string {
    const lang = this.settings.language;
    const allDayLabel = i18n[lang].allDay as string;
    
    let line = `- [${isChecked ? "x" : " "}] `;
    
    if (event.isAllDay) {
      line += `${allDayLabel} `;
    } else {
      line += `${event.startTime || "??:??"}`;
      if (event.endTime) {
        line += `-${event.endTime}`;
      }
      line += " ";
    }

    let eventName = event.eventName;
    if (event.status === "declined") {
      eventName = `~~${eventName}~~`;
    }
    line += eventName;

    if (event.meetUrl) {
      line += ` [meet](${event.meetUrl})`;
    }

    if (event.location) {
      line += ` ＠${event.location}`;
    }

    return line;
  }

  async toggleScheduleItem(originalLine: string, checked: boolean): Promise<void> {
    const filePath = this.fileUtils.getWeeknotePath();
    const file = this.app.vault.getAbstractFileByPath(filePath);

    if (!(file instanceof TFile)) {
      return;
    }

    const contentPart = originalLine.replace(/^- \[[ x]\] /, "");
    
    const fileContent = await this.app.vault.read(file);
    
    const checkedPattern = `- [x] ${contentPart}`;
    const uncheckedPattern = `- [ ] ${contentPart}`;
    
    let newFileContent: string;
    if (checked) {
      newFileContent = fileContent.replace(uncheckedPattern, checkedPattern);
    } else {
      newFileContent = fileContent.replace(checkedPattern, uncheckedPattern);
    }
    
    await this.app.vault.modify(file, newFileContent);
  }

  // Helper to update settings reference when settings change
  updateSettings(settings: WeeknoteSettings, fileUtils: FileUtils, generator: WeeknoteGenerator): void {
    this.settings = settings;
    this.fileUtils = fileUtils;
    this.generator = generator;
  }
}
