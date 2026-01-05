import { App, TFile, moment } from "obsidian";
import {
  CalendarEvent,
  WeeklySchedule,
  WeeknoteSettings
} from "./types";

export class WeeknoteGenerator {
  constructor(
    private app: App,
    private settings: WeeknoteSettings
  ) {}

  getWeekStartDate(date?: moment.Moment): moment.Moment {
    const target = date || moment();
    const currentDay = target.day();
    const startDay = this.settings.weekStartDay;
    
    let diff = currentDay - startDay;
    if (diff < 0) diff += 7;
    
    return target.clone().subtract(diff, "days").startOf("day");
  }

  getReportFilePath(weekStartDate: moment.Moment): string {
    // Convert user format (e.g. "01.Weeknote/[YYYY]-[MM]-[DD]") to moment format
    const momentFormat = this.convertUserPathFormatToMomentFormat(this.settings.weeknoteFileFormat);
    const formattedPath = weekStartDate.format(momentFormat);
    return `${formattedPath}.md`;
  }

  // Helper: Convert user friendly format (YYYY in brackets) to moment.js format
  // Example: "01.Weeknote/[YYYY]/[MM]" -> "[01.Weeknote/]YYYY[/]MM"
  convertUserPathFormatToMomentFormat(format: string): string {
    // Split by [format] blocks
    // Capture the delimiters (brackets included)
    const parts = format.split(/(\[[^\]]+\])/);
    
    return parts.map(part => {
      if (part.match(/^\[[^\]]+\]$/)) {
        // This is a date format block (e.g. [YYYY]), remove brackets to make it active moment token
        return part.slice(1, -1);
      } else if (part) {
        // This is a literal string, escape it with [] for moment.js
        return `[${part}]`;
      }
      return "";
    }).join("");
  }

  generateReport(weekStartDate: moment.Moment, schedule: WeeklySchedule | null): string {
    const dayKeys = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
    
    let content = this.settings.reportsTitle + "\n\n";

    for (let i = 0; i < 7; i++) {
      const date = weekStartDate.clone().add(i, "days");
      const dayKey = dayKeys[date.day()] + "_" + i;
      
      // Format date heading using dayDateFormat
      // Ensure locale matches plugin setting
      date.locale(this.settings.language === "ja" ? "ja" : "en");
      const dateHeading = date.format(this.settings.dayDateFormat);
      content += `${dateHeading}\n\n`;

      // Add each section (only enabled ones)
      for (const section of this.settings.daySections) {
        if (section.enabled === false) continue;
        
        content += `${section.heading}\n`;

        // If this is the schedule section and we have calendar data
        if (section.id === "schedule" && schedule && schedule[dayKey]) {
          const daySchedule = schedule[dayKey];
          for (const event of daySchedule.schedule) {
            content += this.formatEvent(event) + "\n";
          }
        }

        content += "\n";
      }

      content += "---\n\n";
    }

    content += this.settings.summaryTitle + "\n" + this.settings.summaryContent + "\n";

    return content;
  }

  private formatEvent(event: CalendarEvent): string {
    let line = "- [ ] ";
    
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

  async createReport(weekStartDate: moment.Moment, schedule: WeeklySchedule | null): Promise<string> {
    const filePath = this.getReportFilePath(weekStartDate);
    const content = await this.generateReport(weekStartDate, schedule);

    // Ensure directory exists
    const dirPath = filePath.substring(0, filePath.lastIndexOf("/"));
    await this.ensureDirectory(dirPath);

    // Create file if not exists
    const existingFile = this.app.vault.getAbstractFileByPath(filePath);
    if (existingFile instanceof TFile) {
        // Do nothing if file already exists
        return filePath; 
    } else {
      await this.app.vault.create(filePath, content);
    }

    return filePath;
  }

  private async ensureDirectory(path: string): Promise<void> {
    const parts = path.split("/");
    let currentPath = "";

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const folder = this.app.vault.getAbstractFileByPath(currentPath);
      if (!folder) {
        await this.app.vault.createFolder(currentPath);
      }
    }
  }
}
