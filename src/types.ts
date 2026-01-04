export interface DaySection {
  id: string;
  label: string;
  heading: string;
  isBuiltIn?: boolean; // true for schedule, tasks, memo
  enabled?: boolean; // false to hide built-in sections
}

export interface CalendarEvent {
  eventName: string;
  isAllDay: boolean;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  meetUrl: string | null;
  date: string | null; // YYYY-MM-DD format
}

export interface DaySchedule {
  dateLabel: string;
  schedule: CalendarEvent[];
}

export type WeeklySchedule = Record<string, DaySchedule>;

// Task item for hierarchical task display
export interface TaskItem {
  level: number;        // Indentation level (0, 1, 2, ...)
  checked: boolean;     // Whether the task is checked
  title: string;        // Task title text (link stripped)
  content: string;      // Raw markdown content (excluding checkbox)
  url: string | null;   // GitHub/external URL if present
  suffix: string | null; // Text after the link (e.g., "いいね")
  linkType: "issue" | "pr" | "other" | null; // Link type for icon
  children: TaskItem[]; // Nested child tasks
  lineIndex: number;    // Original line index in file for editing
}

export interface WeeknoteSettings {
  // General settings
  language: "ja" | "en";
  layoutMode: "two-panel" | "three-panel" | "three-panel-horizontal" | "t-panel"; // View layout mode
  saveLinksToMarkdown: boolean; // Convert pasted URLs to [Title](URL) format
  
  // Calendar settings
  googleCalendarIcsUrl: string;
  excludeEventPatterns: string; // Regex patterns separated by newline (e.g., "^Lunch$\n.*Party$")
  
  // Week settings
  weekStartDay: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  
  // Path settings
  weeknoteFileFormat: string; // Full path format including folder and filename (e.g., "01.Weeknote/YYYY/MM/YYYY-MM-DD")
  
  // Template settings - Reports section
  reportsTitle: string; // H1 heading at the top (e.g., "# Reports")
  dayDateFormat: string; // Date format for each day (e.g., "## MM-DD (ddd)")
  daySections: DaySection[];
  
  // Template settings - Summary section
  summaryTitle: string; // Summary heading (e.g., "# Summary")
  summaryContent: string; // Initial content under summary (e.g., "- ")
  
  // Memo settings
  memoHeading: string;
  placeholder: string;
  saveButtonLabel: string;
  timestampFormat: string;
  
  // Copy From buttons settings
  copyFromButtons: CopyFromButton[];
}

// Copy From button configuration
export interface CopyFromButton {
  type: "relative" | "weekday"; // "relative" = N days ago, "weekday" = last specific weekday
  value: number; // For relative: days ago (1, 2, 3...), For weekday: 0=Sun, 1=Mon, ..., 6=Sat
  label: string; // Display label (e.g., "Previous day", "Last Friday")
}

// Worker Types
export interface WorkerRequest {
  icsUrl?: string;          // URL to fetch ICS from
  icsData?: string;         // Raw ICS data as string
  icsBuffer?: ArrayBuffer;  // Raw ICS data as ArrayBuffer (for transferable)
  startDate: string;        // YYYY-MM-DD
  endDate: string;          // YYYY-MM-DD
  excludePatterns: string[];
}

export interface WorkerResponse {
  events: Record<string, CalendarEvent[]>;
  error?: string;
}

import type { App, TFile, moment } from "obsidian";
import type { WeeknoteGenerator } from "./weeknote-generator";
import type { CalendarService } from "./calendar-service";

// Interface for WeeknotePlugin to avoid circular dependencies
export interface IWeeknotePlugin {
  app: App;
  settings: WeeknoteSettings;
  generator: WeeknoteGenerator;
  calendarService: CalendarService;
  saveSettings(): Promise<void>;
  
  // File operations
  getWeeknotePath(date?: moment.Moment): string;
  ensureWeeknoteExists(date: moment.Moment): Promise<TFile>;
  
  // Schedule operations
  getDaySchedule(date: moment.Moment): Promise<string[]>;
  toggleScheduleItem(originalLine: string, checked: boolean): Promise<void>;
  updateScheduleInReport(date: moment.Moment, schedule: WeeklySchedule): Promise<void>;
  
  // Memo operations
  getDayMemos(date: moment.Moment): Promise<string[]>;
  insertMemoToWeeknote(content: string, date?: moment.Moment): Promise<void>;
  updateMemo(originalMemo: string, timestamp: string, newContent: string): Promise<void>;
  deleteMemo(originalMemo: string): Promise<void>;
  
  // Task operations
  getDayTasks(date: moment.Moment): Promise<TaskItem[]>;
  addTaskToReport(date: moment.Moment, taskText: string): Promise<void>;
  updateTaskContent(lineIndex: number, checked: boolean, newTitle: string, date: moment.Moment): Promise<void>;
  toggleTaskCheck(lineIndex: number, date: moment.Moment, newState?: boolean): Promise<void>;
  deleteTask(lineIndex: number, date: moment.Moment): Promise<void>;
  reorderTask(fromLineIndex: number, toLineIndex: number, date: moment.Moment, targetLevel?: number): Promise<void>;
  insertTaskAtLine(date: moment.Moment, taskText: string, insertBeforeLineIndex: number, useNextLineIndent?: boolean): Promise<void>;
  copyTasksFromDate(sourceDate: moment.Moment, targetDate: moment.Moment): Promise<void>;
  getPastDaysWithTasks(currentDate: moment.Moment, limit?: number): Promise<{date: moment.Moment, count: number}[]>;
}
