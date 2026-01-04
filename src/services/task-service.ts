import { App, TFile, Notice, moment } from "obsidian";
import { TaskItem, WeeknoteSettings } from "../types";
import { FileUtils } from "../utils/file-utils";
import { WeeknoteGenerator } from "../weeknote-generator";

export class TaskService {
  constructor(
    private app: App,
    private settings: WeeknoteSettings,
    private fileUtils: FileUtils,
    private generator: WeeknoteGenerator,
    private processTaskContent: (text: string) => Promise<string>
  ) {}

  async getDayTasks(date: moment.Moment): Promise<TaskItem[]> {
    const filePath = this.fileUtils.getWeeknotePath(date);
    const file = this.app.vault.getAbstractFileByPath(filePath);

    if (!(file instanceof TFile)) {
      return [];
    }

    const fileContent = await this.app.vault.read(file);
    const lines = fileContent.split("\n");

    const validHeadings = this.fileUtils.getLocaleHeadings(date);
    const tasksHeading = this.settings.daySections.find(s => s.id === "tasks")?.heading || "### tasks";

    let inDaySection = false;
    let inTasksSection = false;
    const taskLines: { line: string; index: number }[] = [];

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();

      if (validHeadings.has(trimmed)) {
        inDaySection = true;
        continue;
      }

      if (inDaySection && trimmed === tasksHeading) {
        inTasksSection = true;
        continue;
      }

      if (inTasksSection && (trimmed.startsWith("##") || trimmed === "---")) {
        break;
      }

      if (inTasksSection && lines[i].match(/^(\s*)- \[[ x]\]/)) {
        taskLines.push({ line: lines[i], index: i });
      }
    }

    return this.parseTaskLines(taskLines);
  }

  parseTaskLines(taskLines: { line: string; index: number }[]): TaskItem[] {
    const rootTasks: TaskItem[] = [];
    const stack: { level: number; task: TaskItem }[] = [];

    for (const { line, index } of taskLines) {
      const match = line.match(/^(\s*)- \[([ x])\] (.+)$/);
      if (!match) continue;

      const indent = match[1].length;
      const level = Math.floor(indent / 2);
      const checked = match[2] === "x";
      const content = match[3];

      const linkMatch = content.match(/^\[(.+?)\]\((.+?)\)(.*)$/);
      let title: string;
      let url: string | null = null;
      let suffix: string | null = null;
      let linkType: "issue" | "pr" | "other" | null = null;

      if (linkMatch) {
        title = linkMatch[1];
        url = linkMatch[2];
        suffix = linkMatch[3] || null;
        if (url.includes("/issues/")) {
          linkType = "issue";
        } else if (url.includes("/pull/")) {
          linkType = "pr";
        } else {
          linkType = "other";
        }
      } else {
        const rawUrlMatch = content.match(/^(https?:\/\/[^\s]+)(\s+.*)?$/);
        if (rawUrlMatch) {
          url = rawUrlMatch[1];
          title = url;
          suffix = rawUrlMatch[2] ? rawUrlMatch[2].trim() : null;
          if (url.includes("/issues/")) {
            linkType = "issue";
          } else if (url.includes("/pull/")) {
            linkType = "pr";
          } else {
            linkType = "other";
          }
        } else {
          title = content;
        }
      }

      const task: TaskItem = {
        level,
        checked,
        title: title.trim(),
        content,
        url,
        suffix: suffix ? suffix.trim() : null,
        linkType,
        children: [],
        lineIndex: index,
      };

      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      if (stack.length === 0) {
        rootTasks.push(task);
      } else {
        stack[stack.length - 1].task.children.push(task);
      }

      stack.push({ level, task });
    }

    return rootTasks;
  }

  async addTask(date: moment.Moment, _taskText: string): Promise<void> {
    const taskText = await this.processTaskContent(_taskText);

    const filePath = this.fileUtils.getWeeknotePath(date);
    const file = this.app.vault.getAbstractFileByPath(filePath);

    if (!(file instanceof TFile)) {
      const weekStart = this.generator.getWeekStartDate(date);
      await this.generator.createReport(weekStart, null);
    }

    const existingFile = this.app.vault.getAbstractFileByPath(filePath);
    if (!(existingFile instanceof TFile)) {
      throw new Error("Failed to create weekly report");
    }

    const fileContent = await this.app.vault.read(existingFile);
    const lines = fileContent.split("\n");
    
    const validHeadings = this.fileUtils.getLocaleHeadings(date);
    const tasksHeading = this.settings.daySections.find(s => s.id === "tasks")?.heading || "### tasks";

    let dayIdx = -1;
    let tasksIdx = -1;
    let insertIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();

      if (validHeadings.has(trimmed)) {
        dayIdx = i;
      }

      if (dayIdx !== -1 && trimmed === tasksHeading) {
        tasksIdx = i;
        insertIdx = i + 1;
        
        for (let j = i + 1; j < lines.length; j++) {
          const line = lines[j].trim();
          if (line.startsWith("##") || line === "---") {
            break;
          }
          if (line.match(/^- \[[ x]\]/)) {
            insertIdx = j + 1;
          }
        }
        break;
      }
    }

    if (tasksIdx === -1) {
      throw new Error("Tasks section not found");
    }

    const taskLine = `- [ ] ${taskText}`;
    lines.splice(insertIdx, 0, taskLine);

    await this.app.vault.modify(existingFile, lines.join("\n"));
  }

  async getPastDaysWithTasks(currentDate: moment.Moment, limit: number = 3): Promise<{date: moment.Moment, count: number}[]> {
    const results: {date: moment.Moment, count: number}[] = [];
    const maxLookBack = 14; 
    
    for (let i = 1; i <= maxLookBack; i++) {
        if (results.length >= limit) break;
        
        const d = currentDate.clone().subtract(i, 'days');
        const tasks = await this.getDayTasks(d);
        if (tasks.length > 0) {
            results.push({ date: d, count: tasks.length });
        }
    }
    return results;
  }

  async copyTasksFromDate(sourceDate: moment.Moment, targetDate: moment.Moment): Promise<void> {
    const tasks = await this.getDayTasks(sourceDate);
    
    if (tasks.length === 0) {
      new Notice("No tasks found in selected day");
      return;
    }

    const linesToAdd: string[] = [];
    const process = (taskList: TaskItem[]) => {
      for (const t of taskList) {
        const indent = "  ".repeat(t.level || 0);
        let line = "";
        if (t.url) {
            line = `${indent}- [ ] [${t.title}](${t.url})`;
        } else {
            line = `${indent}- [ ] ${t.title}`;
        }
        linesToAdd.push(line);
        if (t.children && t.children.length > 0) {
            process(t.children);
        }
      }
    };
    process(tasks);

    const existingFile = await this.fileUtils.ensureWeeknoteExists(targetDate);

    const fileContent = await this.app.vault.read(existingFile);
    const lines = fileContent.split("\n");
    
    const validHeadings = this.fileUtils.getLocaleHeadings(targetDate);
    const tasksHeading = this.settings.daySections.find(s => s.id === "tasks")?.heading || "### tasks";
    
    let insertIdx = -1;
    let foundDay = false;

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (validHeadings.has(trimmed)) {
            foundDay = true;
            continue;
        }
        if (foundDay) {
            if (trimmed.startsWith("## ") && !validHeadings.has(trimmed)) {
                break;
            }
            if (trimmed === tasksHeading) {
                insertIdx = i + 1;
                break;
            }
        }
    }
    
    if (insertIdx !== -1) {
        lines.splice(insertIdx, 0, ...linesToAdd);
        await this.app.vault.modify(existingFile, lines.join("\n"));
        new Notice(`Copied ${linesToAdd.length} tasks from ${sourceDate.format("YYYY-MM-DD")}.`);
    } else {
        new Notice("Tasks section not found.");
    }
  }

  async insertTaskAtLine(date: moment.Moment, _taskText: string, insertBeforeLineIndex: number, useNextLineIndent: boolean = false): Promise<void> {
    const taskText = await this.processTaskContent(_taskText);
    
    const file = await this.fileUtils.ensureWeeknoteExists(date);

    const fileContent = await this.app.vault.read(file);
    const lines = fileContent.split("\n");

    if (insertBeforeLineIndex < 0 || insertBeforeLineIndex > lines.length) {
      return;
    }

    let indentation = "";
    let referenceLineIndex = insertBeforeLineIndex - 1;

    if (useNextLineIndent) {
        referenceLineIndex = insertBeforeLineIndex;
    }

    if (referenceLineIndex >= 0 && referenceLineIndex < lines.length) {
      const refLine = lines[referenceLineIndex];
      const match = refLine.match(/^(\s*)- \[[ x]\]/);
      if (match) {
        indentation = match[1];
      }
    }

    const taskLine = `${indentation}- [ ] ${taskText}`;
    lines.splice(insertBeforeLineIndex, 0, taskLine);

    await this.app.vault.modify(file, lines.join("\n"));
  }

  async updateTaskContent(lineIndex: number, checked: boolean, _newTitle: string, date: moment.Moment): Promise<void> {
    const newTitle = await this.processTaskContent(_newTitle);

    const filePath = this.fileUtils.getWeeknotePath(date);
    const file = this.app.vault.getAbstractFileByPath(filePath);

    if (!(file instanceof TFile)) {
      return;
    }

    const fileContent = await this.app.vault.read(file);
    const lines = fileContent.split("\n");

    if (lineIndex < 0 || lineIndex >= lines.length) {
      return;
    }

    const currentLine = lines[lineIndex];
    const indentMatch = currentLine.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : "";
    
    const checkMark = checked ? "x" : " ";
    const newLine = `${indent}- [${checkMark}] ${newTitle}`;
    lines[lineIndex] = newLine;

    await this.app.vault.modify(file, lines.join("\n"));
  }

  async toggleTaskCheck(lineIndex: number, date: moment.Moment, newState?: boolean): Promise<void> {
    const file = await this.fileUtils.ensureWeeknoteExists(date);
    const fileContent = await this.app.vault.read(file);
    const lines = fileContent.split("\n");

    if (lineIndex < 0 || lineIndex >= lines.length) {
      return;
    }

    const currentLine = lines[lineIndex];
    let newLine = currentLine;

    const uncheckedRegex = /^(\s*)-\s\[ \]\s/;
    const checkedRegex = /^(\s*)-\s\[x\]\s/;

    if (newState === true || (newState === undefined && uncheckedRegex.test(currentLine))) {
      if (uncheckedRegex.test(currentLine)) {
        newLine = currentLine.replace(uncheckedRegex, "$1- [x] ");
      }
    } else if (newState === false || (newState === undefined && checkedRegex.test(currentLine))) {
      if (checkedRegex.test(currentLine)) {
        newLine = currentLine.replace(checkedRegex, "$1- [ ] ");
      }
    }

    if (newLine !== currentLine) {
      lines[lineIndex] = newLine;
      await this.app.vault.modify(file, lines.join("\n"));
    }
  }

  async deleteTask(lineIndex: number, date: moment.Moment): Promise<void> {
    const filePath = this.fileUtils.getWeeknotePath(date);
    const file = this.app.vault.getAbstractFileByPath(filePath);

    if (!(file instanceof TFile)) {
      return;
    }

    const fileContent = await this.app.vault.read(file);
    const lines = fileContent.split("\n");

    if (lineIndex < 0 || lineIndex >= lines.length) {
      return;
    }

    lines.splice(lineIndex, 1);
    await this.app.vault.modify(file, lines.join("\n"));
  }

  async reorderTask(fromLineIndex: number, toLineIndex: number, date: moment.Moment, targetLevel: number = -1): Promise<void> {
    const filePath = this.fileUtils.getWeeknotePath(date);
    const file = this.app.vault.getAbstractFileByPath(filePath);

    if (!(file instanceof TFile)) {
      return;
    }

    const fileContent = await this.app.vault.read(file);
    const lines = fileContent.split("\n");

    if (fromLineIndex < 0 || fromLineIndex >= lines.length || 
        toLineIndex < 0 || toLineIndex >= lines.length) {
      return;
    }

    let lineToMove = lines[fromLineIndex];
    
    if (targetLevel >= 0) {
      const markerIndex = lineToMove.search(/- \[[ x]\]/);
      if (markerIndex >= 0) {
        const content = lineToMove.substring(markerIndex);
        const indent = "  ".repeat(targetLevel);
        lineToMove = `${indent}${content}`;
      } else {
        const bulletIndex = lineToMove.search(/- /);
        if (bulletIndex >= 0) {
           const content = lineToMove.substring(bulletIndex);
           const indent = "  ".repeat(targetLevel);
           lineToMove = `${indent}${content}`;
        }
      }
    }
    
    lines.splice(fromLineIndex, 1);
    
    let adjustedToIndex = toLineIndex;
    if (fromLineIndex < toLineIndex) {
      adjustedToIndex = toLineIndex - 1;
    }
    
    lines.splice(adjustedToIndex, 0, lineToMove);

    await this.app.vault.modify(file, lines.join("\n"));
  }

  // Helper to update settings reference when settings change
  updateSettings(settings: WeeknoteSettings, fileUtils: FileUtils, generator: WeeknoteGenerator): void {
    this.settings = settings;
    this.fileUtils = fileUtils;
    this.generator = generator;
  }

  // Update the processTaskContent callback
  setProcessTaskContent(fn: (text: string) => Promise<string>): void {
    this.processTaskContent = fn;
  }
}
