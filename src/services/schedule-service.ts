import { App, TFile, moment } from "obsidian";
import { CalendarEvent, WeeklySchedule, WeeknoteSettings } from "../types";
import { FileUtils } from "../utils/file-utils";
import { WeeknoteGenerator } from "../weeknote-generator";

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
    const dayIndex = date.diff(weekStart, "days");
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
        let content = match[2];
        let timePart = "";
        
        const timeMatch = content.match(/^(\d{1,2}:\d{2}(?:-\d{1,2}:\d{2})?|\[終日\])/);
        if (timeMatch) {
            timePart = timeMatch[1];
            content = content.substring(timeMatch[0].length).trim();
        }

        content = content.replace(/\[.*?\]\(.*?\)/g, "").trim();
        content = content.replace(/\s*[＠@].*$/, "");
        
        const eventName = content.trim();

        if (timePart && eventName) {
            const key = `${timePart} ${eventName}`;
            checkedEvents.add(key);
        } else {
            checkedEvents.add(match[2].trim());
        }
      }
    }

    // Format new schedule lines
    const newScheduleLines: string[] = [];
    for (const event of daySchedule.schedule) {
      let isChecked = false;
      const coreEventStr = this.getEventCoreString(event);
      if (checkedEvents.has(coreEventStr)) {
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

  getEventCoreString(event: CalendarEvent): string {
    let timeStr = "";
    if (event.isAllDay) {
      timeStr = "[終日]";
    } else {
      timeStr = `${event.startTime || "??:??"}`;
      if (event.endTime) {
        timeStr += `-${event.endTime}`;
      }
    }
    return `${timeStr} ${event.eventName.trim()}`;
  }

  formatScheduleEvent(event: CalendarEvent, isChecked: boolean = false): string {
    let line = `- [${isChecked ? "x" : " "}] `;
    
    if (event.isAllDay) {
      line += `[終日] ${event.eventName}`;
    } else {
      line += `${event.startTime || "??:??"}`;
      if (event.endTime) {
        line += `-${event.endTime}`;
      }
      line += ` ${event.eventName}`;
    }

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
