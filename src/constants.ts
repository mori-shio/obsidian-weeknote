import { WeeknoteSettings } from "./types";

export const DEFAULT_SETTINGS: WeeknoteSettings = {
  language: "en",
  layoutMode: "two-panel", // Default to current toggle design
  saveLinksToMarkdown: true,
  taskIndentStyle: "tab", // Default to tab indentation
  googleCalendarIcsUrl: "",
  excludeEventPatterns: "", // Regex patterns separated by newline
  weekStartDay: 0, // Sunday
  weeknoteFileFormat: "01.Weeknote/[YYYY]/[MM]/[YYYY]-[MM]-[DD]",
  reportsTitle: "# Reports",
  dayDateFormat: "## MM-DD (ddd)",
  daySections: [
    { id: "schedule", label: "Schedule", heading: "### schedule", isBuiltIn: true, enabled: true },
    { id: "tasks", label: "Tasks", heading: "### tasks", isBuiltIn: true, enabled: true },
    { id: "memo", label: "Memo", heading: "### memo", isBuiltIn: true, enabled: true },
  ],
  summaryTitle: "# Summary",
  summaryContent: "- ",
  memoHeading: "### memo",
  placeholder: "今なにしてる？",
  saveButtonLabel: "投稿",
  timestampFormat: "YYYY-MM-DD HH:mm:ss",
  copyFromButtons: [
    { type: "relative", value: 1, label: "Previous day" },
    { type: "weekday", value: 5, label: "Last Friday" },
  ],
};

export const VIEW_TYPE_WEEKNOTE = "weeknote-view";
