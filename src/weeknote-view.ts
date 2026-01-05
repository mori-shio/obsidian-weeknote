import {
  ItemView,
  WorkspaceLeaf,
  moment,
  Notice,
  setIcon,
  TFile
} from "obsidian";

import { UrlProcessor } from "./url-processor";
import { createTag } from "./github-renderer";
import {
  TaskItem,
  IWeeknotePlugin
} from "./types";
import { i18n, I18nKey } from "./i18n";
import { VIEW_TYPE_WEEKNOTE } from "./constants";

// Helper modules
import { 
  renderMarkdownText as renderMarkdownTextHelper,
  renderRichContent as renderRichContentHelper,
  parseScheduleContent as parseScheduleContentHelper
} from "./views/content-renderer";
import {
  setupVerticalResizer as setupVerticalResizerHelper,
  setupScheduleResizer as setupScheduleResizerHelper,
  setupLeftPanelResizer as setupLeftPanelResizerHelper,
  setupRightPanelResizer as setupRightPanelResizerHelper,
  setupHorizontalResizer as setupHorizontalResizerHelper
} from "./views/layout-helper";

export class WeeknoteView extends ItemView {
  plugin: IWeeknotePlugin;
  textArea: HTMLTextAreaElement;
  saveBtn: HTMLButtonElement;
  selectedDate: moment.Moment;
  memoListContainer: HTMLElement;
  memoListWrapper: HTMLElement;
  scheduleListContainer: HTMLElement;
  scheduleSection: HTMLElement;
  isProgrammaticScrolling = false;
  weekInfoEl: HTMLElement;
  currentMemoView: "memo" | "task" = "task";
  inputArea: HTMLElement;
  taskContainer: HTMLElement;
  viewToggleBtn: HTMLButtonElement;
  memoSectionTitle: HTMLElement;
  taskListContainer: HTMLElement;
  taskListWrapper: HTMLElement;
  reloadBtn: HTMLButtonElement;
  private deselectHandler: ((e: MouseEvent) => void) | null = null;
  private blurHandler: (() => void) | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private activeInputCleanup: (() => void) | null = null;
  private isIgnoringBlur = false;
  private helpRow: HTMLElement;
  private helpPanel: HTMLElement;
  private lastSelectedLineIndex: number | null = null;
  private memoListObserver: MutationObserver | null = null;
  private tabsContainer: HTMLElement;

  constructor(leaf: WorkspaceLeaf, plugin: IWeeknotePlugin) {
    super(leaf);
    this.plugin = plugin;
    this.selectedDate = moment(); // Default to today
  }

  t(key: I18nKey): string {
    const lang = this.plugin.settings.language;
    const val = i18n[lang][key];
    return Array.isArray(val) ? val.join(", ") : val;
  }

  // Convert moment.js timestamp format to regex for parsing
  getTimestampRegex(): RegExp {
    const format = this.plugin.settings.timestampFormat;
    // Escape special regex characters except moment tokens
    const pattern = format
      .replace(/[.*+?^${}|[\]\\]/g, '\\$&') // Escape regex special chars
      .replace(/YYYY/g, '(\\d{4})')
      .replace(/YY/g, '(\\d{2})')
      .replace(/MM/g, '(\\d{2})')
      .replace(/DD/g, '(\\d{2})')
      .replace(/HH/g, '(\\d{2})')
      .replace(/hh/g, '(\\d{2})')
      .replace(/mm/g, '(\\d{2})')
      .replace(/ss/g, '(\\d{2})')
      .replace(/A/g, '(AM|PM)')
      .replace(/a/g, '(am|pm)');
    
    // Wrap in non-capturing group and capture whole timestamp
    // Match timestamp at start of line followed by whitespace and content
    return new RegExp(`^(${pattern})\\s+(.*)$`);
  }

  getViewType(): string {
    return VIEW_TYPE_WEEKNOTE;
  }

  getDisplayText(): string {
    return "Weeknote";
  }

  getIcon(): string {
    return "calendar-clock";
  }

  // Create help panel content using i18n (for Task section)
  createHelpPanel(container: HTMLElement): void {
    const t = this.t.bind(this);
    container.empty();
    
    const createHelpItem = (key: string, text: string) => {
      const item = container.createDiv({ cls: "help-item" });
      item.createSpan({ cls: "help-key", text: key });
      item.appendText(" " + text);
    };
    
    container.createDiv({ cls: "help-title", text: t("helpTitle") });
    
    container.createDiv({ cls: "help-section-title", text: t("helpNoSelection") });
    createHelpItem("↑↓", t("helpArrowSelect"));
    
    container.createDiv({ cls: "help-section-title", text: t("helpWithSelection") });
    createHelpItem("↑↓", t("helpArrowMove"));
    createHelpItem("Shift + ↑↓", t("helpShiftArrow"));
    createHelpItem("Shift + ←→", t("helpShiftIndent"));
    createHelpItem("Shift + Delete", t("helpShiftDelete"));
    createHelpItem("Enter", t("helpEnterEdit"));
    createHelpItem("Esc", t("helpEsc"));
    
    container.createDiv({ cls: "help-section-title", text: t("helpEditing") });
    createHelpItem("Enter", t("helpEnterSave"));
    createHelpItem("Esc", t("helpEscCancel"));
  }

  // Create help panel content for Memo section
  createMemoHelpPanel(container: HTMLElement): void {
    const t = this.t.bind(this);
    container.empty();
    
    const createHelpItem = (key: string, text: string) => {
      const item = container.createDiv({ cls: "help-item" });
      item.createSpan({ cls: "help-key", text: key });
      item.appendText(" " + text);
    };
    
    container.createDiv({ cls: "help-title", text: t("memoHelpTitle") });
    
    container.createDiv({ cls: "help-section-title", text: t("memoHelpUnfocused") });
    createHelpItem("Enter", t("memoHelpEnterFocus"));
    createHelpItem("Tab / Shift+Tab", t("memoHelpEnterFocus"));
    
    container.createDiv({ cls: "help-section-title", text: t("memoHelpInputMode") });
    createHelpItem("Enter", t("memoHelpEnterAdd"));
    createHelpItem("Esc", t("memoHelpEscCancel"));
    createHelpItem("Shift+Tab", t("memoHelpShiftTabToCard"));
    
    container.createDiv({ cls: "help-section-title", text: t("memoHelpCardSelected") });
    createHelpItem("Enter", t("memoHelpEnterEdit"));
    createHelpItem("Delete", t("memoHelpDelete"));
    createHelpItem("Esc", t("memoHelpEscToInput"));
    createHelpItem("Tab / Shift+Tab", t("memoHelpTabMove"));
  }

  // Adjust help panel position using Fixed positioning to escape overflow
  adjustHelpPanelPosition(helpPanel: HTMLElement): void {
    // Get the associated button - either from data attribute or from parent
    let helpBtn: HTMLElement | null = null;
    
    // Check if we have a stored button ID
    const btnId = helpPanel.dataset.helpBtnId;
    if (btnId) {
      helpBtn = document.getElementById(btnId);
    }
    
    // If not found, try to get from parent (first time)
    if (!helpBtn) {
      const parent = helpPanel.parentElement;
      if (!parent) return;
      helpBtn = parent.querySelector(".task-help-btn") as HTMLElement;
      if (!helpBtn) return;
      
      // Store the button with a unique ID for future reference
      if (!helpBtn.id) {
        helpBtn.id = `help-btn-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      }
      helpPanel.dataset.helpBtnId = helpBtn.id;
    }

    // Move panel to document.body to escape any parent transforms/stacking contexts
    if (helpPanel.parentElement !== document.body) {
      document.body.appendChild(helpPanel);
    }

    // Reset to origin for measurement
    helpPanel.setCssStyles({ left: "0", top: "0" });
    
    // Wait for DOM update to get accurate dimensions
    requestAnimationFrame(() => {
      const btnRect = helpBtn!.getBoundingClientRect();
      const panelWidth = helpPanel.offsetWidth;
      const panelHeight = helpPanel.offsetHeight;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Position: right-align panel with button's right edge
      let leftPos = btnRect.right - panelWidth;
      let topPos = btnRect.bottom + 6; // 6px gap below button
      
      // Clamp to viewport edges
      if (leftPos < 10) {
        leftPos = 10;
      }
      if (leftPos + panelWidth > viewportWidth - 10) {
        leftPos = viewportWidth - panelWidth - 10;
      }

      // Vertical: If it goes off bottom, show it above the button
      if (topPos + panelHeight > viewportHeight - 20) {
        topPos = btnRect.top - panelHeight - 6;
      }
      if (topPos < 10) {
        topPos = 10;
      }
      
      // Apply fixed coordinates
      helpPanel.setCssStyles({ top: `${topPos}px`, left: `${leftPos}px` });
    });
  }

  // Shared: Create reload button for schedule section
  createReloadButton(scheduleHeader: HTMLElement): void {
    this.reloadBtn = scheduleHeader.createEl("button", { cls: "weeknote-reload-btn" });
    setIcon(this.reloadBtn, "refresh-cw");
    this.reloadBtn.setAttribute("aria-label", "Reload schedule");
    this.reloadBtn.addEventListener("click", async () => {
      this.reloadBtn.addClass("is-loading");
      await this.reloadSchedule();
      this.reloadBtn.removeClass("is-loading");
    });
  }

  // Shared: Setup help button with panel and click-outside-to-close
  setupHelpButton(header: HTMLElement, type: "task" | "memo" = "task"): { helpRow: HTMLElement, helpPanel: HTMLElement } {
    const helpRow = header.createDiv({ cls: "task-help-row header-help" });
    const helpBtn = helpRow.createDiv({ cls: "task-help-btn" });
    setIcon(helpBtn, "help-circle");
    
    const helpPanel = helpRow.createDiv({ cls: "task-help-panel" });
    // Store the type for later regeneration
    helpPanel.dataset.helpType = type;
    
    const removeAllListeners = () => {
      document.removeEventListener("mousedown", closeHelpPanel, { capture: true });
      window.removeEventListener("resize", closeOnResize);
      window.removeEventListener("blur", closeOnBlur);
    };
    
    const closeHelpPanel = (e: MouseEvent) => {
      if (helpPanel.contains(e.target as Node) || helpBtn.contains(e.target as Node)) return;
      helpPanel.classList.remove("is-visible");
      removeAllListeners();
    };
    
    const closeOnResize = () => {
      helpPanel.classList.remove("is-visible");
      removeAllListeners();
    };
    
    const closeOnBlur = () => {
      helpPanel.classList.remove("is-visible");
      removeAllListeners();
    };

    helpBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isVisible = helpPanel.classList.contains("is-visible");
      
      if (isVisible) {
        helpPanel.classList.remove("is-visible");
        removeAllListeners();
      } else {
        // Regenerate content with current language settings each time
        const helpType = helpPanel.dataset.helpType as "task" | "memo";
        if (helpType === "task") {
          this.createHelpPanel(helpPanel);
        } else {
          this.createMemoHelpPanel(helpPanel);
        }
        helpPanel.classList.add("is-visible");
        this.adjustHelpPanelPosition(helpPanel);
        document.addEventListener("mousedown", closeHelpPanel, { capture: true });
        window.addEventListener("resize", closeOnResize);
        window.addEventListener("blur", closeOnBlur);
      }
    });

    return { helpRow, helpPanel };
  }

  // Shared: Create schedule section with header and reload button
  async createScheduleSection(container: HTMLElement, cls: string = "weeknote-section weeknote-schedule-section"): Promise<void> {
    this.scheduleSection = container.createDiv({ cls });
    const scheduleHeader = this.scheduleSection.createDiv({ cls: "weeknote-schedule-header" });
    scheduleHeader.createEl("h5", { text: this.t("scheduleView") });
    this.createReloadButton(scheduleHeader);
    
    this.scheduleListContainer = this.scheduleSection.createDiv({ cls: "weeknote-schedule-list" });
    await this.loadDaySchedule(this.scheduleListContainer, this.selectedDate);
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("weeknote-container");
    
    // Add layout mode class
    container.removeClass("layout-two-panel", "layout-three-panel");
    container.addClass(`layout-${this.plugin.settings.layoutMode}`);

    const t = this.t.bind(this);
    const days = i18n[this.plugin.settings.language].days as string[];
    const weekStart = this.plugin.generator.getWeekStartDate(this.selectedDate); // Use selectedDate
    // Header
    const header = container.createDiv({ cls: "weeknote-header" });
    
    // Title on the left
    const title = header.createDiv({ cls: "weeknote-title" });
    title.createEl("h4", { text: "Weeknote" });

    // Navigation Center: < Date Range >
    const navCenter = header.createDiv({ cls: "weeknote-nav-center" });
    
    const prevBtn = navCenter.createEl("button", { cls: "weeknote-nav-btn weeknote-nav-prev" });
    setIcon(prevBtn, "chevron-left");
    prevBtn.setAttribute("aria-label", "Previous week");
    prevBtn.addEventListener("click", () => this.navigateWeek(-1));

    // Week Info (Date Range)
    this.weekInfoEl = navCenter.createDiv({ cls: "weeknote-week-info" });
    // Text will be set by updateWeekDisplay()

    const nextBtn = navCenter.createEl("button", { cls: "weeknote-nav-btn weeknote-nav-next" });
    setIcon(nextBtn, "chevron-right");
    nextBtn.setAttribute("aria-label", "Next week");
    nextBtn.addEventListener("click", () => this.navigateWeek(1));

    // Right side controls
    const navRight = header.createDiv({ cls: "weeknote-nav-right" });

    // This Week Button
    const thisWeekBtn = navRight.createEl("button", { cls: "weeknote-nav-btn weeknote-nav-today" });
    thisWeekBtn.setText(t("thisWeek"));
    thisWeekBtn.setAttribute("aria-label", "Go to this week");
    thisWeekBtn.addEventListener("click", () => this.navigateToToday());
    
    this.updateWeekDisplay(); // Set initial text

    // Create Report Button
    const actionSection = container.createDiv({ cls: "weeknote-actions" });
    const createBtn = actionSection.createEl("button", {
      cls: "weeknote-create-btn",
      text: `📝 ${t("createReport")}`,
    });
    createBtn.addEventListener("click", () => void this.createWeeknote());

    // Open Report Button
    const openBtn = actionSection.createEl("button", {
      cls: "weeknote-open-btn",
      text: `📂 ${t("openReport")}`,
    });
    openBtn.addEventListener("click", () => void this.openWeeknote());

    // Day tabs (Chrome-style)
    this.tabsContainer = container.createDiv({ cls: "weeknote-tabs" });
    this.renderTabs(weekStart, days);

    // Main content area - differs based on layout mode
    if (this.plugin.settings.layoutMode === "three-panel") {
      await this.renderThreePanelLayout(container);
    } else if (this.plugin.settings.layoutMode === "three-panel-horizontal") {
      await this.renderThreePanelHorizontalLayout(container);
    } else if (this.plugin.settings.layoutMode === "t-panel") {
      await this.renderTPanelLayout(container);
    } else {
      await this.renderTwoPanelLayout(container);
    }
  }

  // Two-panel layout: Schedule + Task/Memo toggle
  async renderTwoPanelLayout(container: Element): Promise<void> {
    const contentArea = container.createDiv({ cls: "weeknote-content-area" });

    // Section 1: Schedule (top) - using shared method
    await this.createScheduleSection(contentArea);

    // Resizer (between schedule and memo section)
    const resizer = contentArea.createDiv({ cls: "weeknote-resizer" });

    // Section 2: Memo section (combined input + posted memos)
    const memoSection = contentArea.createDiv({ cls: "weeknote-section weeknote-memo-combined" });
    
    // Memo header with title and view toggle button
    const memoHeader = memoSection.createDiv({ cls: "weeknote-memo-header" });
    this.memoSectionTitle = memoHeader.createEl("h5", { text: this.t("taskView") }); // Default to TASK view

    // Help icon with command manual (shared button, content updates on toggle)
    const helpObj = this.setupHelpButton(memoHeader, "task");
    this.helpRow = helpObj.helpRow;
    this.helpPanel = helpObj.helpPanel;

    this.viewToggleBtn = memoHeader.createEl("button", { cls: "weeknote-view-toggle-btn" });
    setIcon(this.viewToggleBtn, "arrow-left-right");
    this.viewToggleBtn.createSpan({ text: this.t("memoViewLabel"), cls: "toggle-label" }); // Show MEMO as toggle target
    this.viewToggleBtn.setAttribute("aria-label", "Switch view");
    this.viewToggleBtn.addEventListener("click", () => this.toggleMemoTaskView());

    // Posted memos list with scroll shadow wrapper (hidden by default - TASK view is default)
    this.memoListWrapper = memoSection.createDiv({ cls: "weeknote-memo-list-wrapper weeknote-hidden" });
    this.memoListContainer = this.memoListWrapper.createDiv({ cls: "weeknote-memo-list" });
    await this.loadDayMemos(this.memoListContainer, this.selectedDate);
    
    // Setup scroll shadow detection
    this.setupScrollShadows();
    
    // Scroll to bottom after DOM is rendered (use longer delay for layout stability)
    setTimeout(() => {
      if (this.memoListContainer) {
        this.isProgrammaticScrolling = true;
        this.memoListContainer.scrollTop = this.memoListContainer.scrollHeight;
        this.updateScrollShadows();
        // Reset flag and start observing after scroll completes
        requestAnimationFrame(() => {
          this.isProgrammaticScrolling = false;
          // Set up observer to maintain position
          this.setupMemoListObserver();
          // Scroll to bottom one more time to ensure stability
          requestAnimationFrame(() => {
            if (this.memoListContainer) {
              this.memoListContainer.scrollTop = this.memoListContainer.scrollHeight;
            }
          });
        });
      }
    }, 150);

    // Input area (hidden by default - TASK view is default)
    this.inputArea = memoSection.createDiv({ cls: "weeknote-input-area weeknote-hidden" });
    
    const editorWrapper = this.inputArea.createDiv({ cls: "weeknote-editor" });
    this.textArea = editorWrapper.createEl("textarea", {
      attr: { placeholder: this.plugin.settings.placeholder },
    });

    const buttonRow = this.inputArea.createDiv({ cls: "weeknote-buttons" });
    this.saveBtn = buttonRow.createEl("button", {
      cls: "weeknote-save-btn",
      attr: { tabindex: "-1" }
    });
    this.saveBtn.setText(this.plugin.settings.saveButtonLabel);
    this.saveBtn.addEventListener("click", () => void this.saveMemo());

    // Task container (visible by default)
    this.taskContainer = memoSection.createDiv({ cls: "weeknote-task-container weeknote-flex" });
    this.taskListWrapper = this.taskContainer.createDiv({ cls: "weeknote-task-list-wrapper" });
    this.taskListContainer = this.taskListWrapper.createDiv({ cls: "weeknote-task-list" });
    await this.loadDayTasks(this.taskListContainer, this.selectedDate);

    // Setup resizer
    this.setupScheduleResizer(resizer, this.scheduleSection, memoSection);

    // Keyboard shortcut
    this.textArea.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void this.saveMemo();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        this.textArea.blur();
      }
      // Shift+Tab: select the last memo card
      if (e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) {
          this.selectLastMemoCard();
          e.stopPropagation();
        }
      }
    });
    
    // Prevent blur when clicking outside Obsidian
    this.textArea.addEventListener("blur", (e) => {
      // If blur happened due to window losing focus (clicking outside Obsidian), refocus
      if (!e.relatedTarget && !document.hasFocus()) {
        setTimeout(() => {
          if (!document.hasFocus()) {
            this.textArea.focus();
          }
        }, 10);
      }
    });
  }

  // Three-panel layout: Schedule + Task + Memo side by side
  async renderThreePanelLayout(container: Element): Promise<void> {
    const t = this.t.bind(this);
    
    const contentArea = container.createDiv({ cls: "weeknote-content-area weeknote-three-panel" });

    // Panel 1: Schedule
    this.scheduleSection = contentArea.createDiv({ cls: "weeknote-panel weeknote-schedule-panel" });
    const scheduleHeader = this.scheduleSection.createDiv({ cls: "weeknote-panel-header" });
    scheduleHeader.createEl("h5", { text: t("scheduleView") });
    this.reloadBtn = scheduleHeader.createEl("button", { cls: "weeknote-reload-btn" });
    setIcon(this.reloadBtn, "refresh-cw");
    this.reloadBtn.setAttribute("aria-label", "Reload schedule");
    this.reloadBtn.addEventListener("click", async () => {
      this.reloadBtn.addClass("is-loading");
      await this.reloadSchedule();
      this.reloadBtn.removeClass("is-loading");
    });
    
    this.scheduleListContainer = this.scheduleSection.createDiv({ cls: "weeknote-schedule-list" });
    await this.loadDaySchedule(this.scheduleListContainer, this.selectedDate);

    // Resizer between Schedule and Task (setup will be done after task panel creation)
    const resizerScheduleTask = contentArea.createDiv({ cls: "weeknote-panel-resizer" });

    // Panel 2: Tasks
    this.taskContainer = contentArea.createDiv({ cls: "weeknote-panel weeknote-task-panel" });
    const taskHeader = this.taskContainer.createDiv({ cls: "weeknote-panel-header" });
    taskHeader.createEl("h5", { text: t("taskView") });
    
    // Help button for tasks - using shared method
    this.setupHelpButton(taskHeader);
    
    this.taskListWrapper = this.taskContainer.createDiv({ cls: "weeknote-task-list-wrapper" });
    this.taskListContainer = this.taskListWrapper.createDiv({ cls: "weeknote-task-list" });
    await this.loadDayTasks(this.taskListContainer, this.selectedDate);

    // Setup left resizer: Schedule/Task resize inversely, Memo stays same
    this.setupLeftPanelResizer(resizerScheduleTask, this.scheduleSection as HTMLElement, this.taskContainer as HTMLElement);

    // Resizer between Task and Memo: Task resizes, Schedule fixed, Memo absorbs
    const resizerTaskMemo = contentArea.createDiv({ cls: "weeknote-panel-resizer" });
    this.setupRightPanelResizer(resizerTaskMemo, this.taskContainer as HTMLElement, this.scheduleSection as HTMLElement);

    // Panel 3: Memos
    const memoPanel = contentArea.createDiv({ cls: "weeknote-panel weeknote-memo-panel" });
    const memoHeader = memoPanel.createDiv({ cls: "weeknote-panel-header" });
    memoHeader.createEl("h5", { text: t("memoView") });
    
    // Help button for memos
    this.setupHelpButton(memoHeader, "memo");
    
    // Memo list
    this.memoListWrapper = memoPanel.createDiv({ cls: "weeknote-memo-list-wrapper" });
    // Always visible in three-panel mode (no weeknote-hidden class)
    this.memoListContainer = this.memoListWrapper.createDiv({ cls: "weeknote-memo-list" });
    await this.loadDayMemos(this.memoListContainer, this.selectedDate);
    
    // Setup scroll shadow detection
    this.setupScrollShadows();
    
    // Scroll to bottom
    setTimeout(() => {
      if (this.memoListContainer) {
        this.isProgrammaticScrolling = true;
        this.memoListContainer.scrollTop = this.memoListContainer.scrollHeight;
        this.updateScrollShadows();
        requestAnimationFrame(() => {
          this.isProgrammaticScrolling = false;
          this.setupMemoListObserver();
          requestAnimationFrame(() => {
            if (this.memoListContainer) {
              this.memoListContainer.scrollTop = this.memoListContainer.scrollHeight;
            }
          });
        });
      }
    }, 150);

    // Memo input area (always visible in three-panel)
    this.inputArea = memoPanel.createDiv({ cls: "weeknote-input-area" });
    // Already visible (no weeknote-hidden class)
    
    const editorWrapper = this.inputArea.createDiv({ cls: "weeknote-editor" });
    this.textArea = editorWrapper.createEl("textarea", {
      attr: { placeholder: this.plugin.settings.placeholder },
    });

    const buttonRow = this.inputArea.createDiv({ cls: "weeknote-buttons" });
    this.saveBtn = buttonRow.createEl("button", { cls: "weeknote-save-btn", attr: { tabindex: "-1" } });
    this.saveBtn.setText(this.plugin.settings.saveButtonLabel);
    this.saveBtn.addEventListener("click", () => void this.saveMemo());

    // Keyboard shortcut
    this.textArea.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void this.saveMemo();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        this.textArea.blur();
      }
      // Shift+Tab: select the last memo card
      if (e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) {
          this.selectLastMemoCard();
          e.stopPropagation();
        }
      }
    });
    
    // Prevent blur when clicking outside Obsidian
    this.textArea.addEventListener("blur", (e) => {
      if (!e.relatedTarget && !document.hasFocus()) {
        setTimeout(() => {
          if (!document.hasFocus()) {
            this.textArea.focus();
          }
        }, 10);
      }
    });
  }

  // Three-panel horizontal layout: Schedule / Task / Memo stacked vertically
  async renderThreePanelHorizontalLayout(container: Element): Promise<void> {
    const t = this.t.bind(this);
    
    const contentArea = container.createDiv({ cls: "weeknote-content-area weeknote-three-panel-horizontal" });

    // Panel 1: Schedule (top) - using shared method
    await this.createScheduleSection(contentArea);

    // Resizer between Schedule and Task
    const resizerScheduleTask = contentArea.createDiv({ cls: "weeknote-resizer" });

    // Panel 2: Tasks (middle)
    this.taskContainer = contentArea.createDiv({ cls: "weeknote-section weeknote-memo-combined" });
    const taskHeader = this.taskContainer.createDiv({ cls: "weeknote-memo-header" });
    taskHeader.createEl("h5", { text: t("taskView") });
    
    // Help button for tasks - using shared method
    this.setupHelpButton(taskHeader);
    
    this.taskListWrapper = this.taskContainer.createDiv({ cls: "weeknote-task-list-wrapper" });
    this.taskListContainer = this.taskListWrapper.createDiv({ cls: "weeknote-task-list" });
    await this.loadDayTasks(this.taskListContainer, this.selectedDate);

    // Resizer between Task and Memo
    const resizerTaskMemo = contentArea.createDiv({ cls: "weeknote-resizer" });

    // Panel 3: Memos (bottom)
    const memoPanel = contentArea.createDiv({ cls: "weeknote-section weeknote-memo-combined weeknote-memo-bottom" });
    const memoHeader = memoPanel.createDiv({ cls: "weeknote-memo-header" });
    memoHeader.createEl("h5", { text: t("memoView") });
    
    // Help button for memos
    this.setupHelpButton(memoHeader, "memo");
    
    // Memo list
    this.memoListWrapper = memoPanel.createDiv({ cls: "weeknote-memo-list-wrapper" });
    // Always visible in horizontal layout (no weeknote-hidden class)
    this.memoListContainer = this.memoListWrapper.createDiv({ cls: "weeknote-memo-list" });
    await this.loadDayMemos(this.memoListContainer, this.selectedDate);
    
    // Setup scroll shadow detection
    this.setupScrollShadows();
    
    // Scroll to bottom
    setTimeout(() => {
      if (this.memoListContainer) {
        this.isProgrammaticScrolling = true;
        this.memoListContainer.scrollTop = this.memoListContainer.scrollHeight;
        this.updateScrollShadows();
        requestAnimationFrame(() => {
          this.isProgrammaticScrolling = false;
          this.setupMemoListObserver();
          requestAnimationFrame(() => {
            if (this.memoListContainer) {
              this.memoListContainer.scrollTop = this.memoListContainer.scrollHeight;
            }
          });
        });
      }
    }, 150);

    // Memo input area
    this.inputArea = memoPanel.createDiv({ cls: "weeknote-input-area" });
    // Already visible (no weeknote-hidden class)
    
    const editorWrapper = this.inputArea.createDiv({ cls: "weeknote-editor" });
    this.textArea = editorWrapper.createEl("textarea", {
      attr: { placeholder: this.plugin.settings.placeholder },
    });

    const buttonRow = this.inputArea.createDiv({ cls: "weeknote-buttons" });
    this.saveBtn = buttonRow.createEl("button", { cls: "weeknote-save-btn", attr: { tabindex: "-1" } });
    this.saveBtn.setText(this.plugin.settings.saveButtonLabel);
    this.saveBtn.addEventListener("click", () => void this.saveMemo());

    // Keyboard shortcut
    this.textArea.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void this.saveMemo();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        this.textArea.blur();
      }
      // Shift+Tab: select the last memo card
      if (e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) {
          this.selectLastMemoCard();
          e.stopPropagation();
        }
      }
    });
    
    // Prevent blur when clicking outside Obsidian
    this.textArea.addEventListener("blur", (e) => {
      if (!e.relatedTarget && !document.hasFocus()) {
        setTimeout(() => {
          if (!document.hasFocus()) {
            this.textArea.focus();
          }
        }, 10);
      }
    });

    // Setup horizontal resizers
    this.setupHorizontalResizer(resizerScheduleTask, this.scheduleSection as HTMLElement, this.taskContainer as HTMLElement);
    this.setupHorizontalResizer(resizerTaskMemo, this.taskContainer as HTMLElement, memoPanel as HTMLElement);
  }

  // T-panel layout: Schedule (top, 100%) + Task/Memo (bottom row, 50% each)
  async renderTPanelLayout(container: Element): Promise<void> {
    const t = this.t.bind(this);
    const contentArea = container.createDiv({ cls: "weeknote-content-area weeknote-t-panel" });

    // Top row: Schedule (100% width) - using shared method
    await this.createScheduleSection(contentArea);

    // Resizer between top and bottom rows
    const resizerTopBottom = contentArea.createDiv({ cls: "weeknote-resizer" });

    // Bottom row container (Task + Memo side by side)
    const bottomRow = contentArea.createDiv({ cls: "weeknote-t-panel-bottom-row" });

    // Left: Task Panel (50%)
    this.taskContainer = bottomRow.createDiv({ cls: "weeknote-section weeknote-memo-combined" });
    const taskHeader = this.taskContainer.createDiv({ cls: "weeknote-memo-header" });
    taskHeader.createEl("h5", { text: t("taskView") });
    
    // Help button for tasks - using shared method
    this.setupHelpButton(taskHeader);
    
    this.taskListWrapper = this.taskContainer.createDiv({ cls: "weeknote-task-list-wrapper" });
    this.taskListContainer = this.taskListWrapper.createDiv({ cls: "weeknote-task-list" });
    await this.loadDayTasks(this.taskListContainer, this.selectedDate);

    // Resizer between Task and Memo
    const resizerTaskMemo = bottomRow.createDiv({ cls: "weeknote-resizer weeknote-resizer-vertical" });

    // Right: Memo Panel (50%)
    const memoPanel = bottomRow.createDiv({ cls: "weeknote-section weeknote-memo-combined weeknote-memo-bottom" });
    const memoHeader = memoPanel.createDiv({ cls: "weeknote-memo-header" });
    memoHeader.createEl("h5", { text: t("memoView") });
    
    // Help button for memos
    this.setupHelpButton(memoHeader, "memo");
    
    this.memoListWrapper = memoPanel.createDiv({ cls: "weeknote-memo-list-wrapper" });
    this.memoListContainer = this.memoListWrapper.createDiv({ cls: "weeknote-memo-list" });
    await this.loadDayMemos(this.memoListContainer, this.selectedDate);
    this.setupScrollShadows();
    
    // Scroll to bottom after render
    setTimeout(() => {
      if (this.memoListContainer) {
        this.isProgrammaticScrolling = true;
        this.memoListContainer.scrollTop = this.memoListContainer.scrollHeight;
        this.updateScrollShadows();
        requestAnimationFrame(() => {
          this.isProgrammaticScrolling = false;
          this.setupMemoListObserver();
          requestAnimationFrame(() => {
            if (this.memoListContainer) {
              this.memoListContainer.scrollTop = this.memoListContainer.scrollHeight;
            }
          });
        });
      }
    }, 150);
    
    // Input area
    this.inputArea = memoPanel.createDiv({ cls: "weeknote-input-area" });
    const editor = this.inputArea.createDiv({ cls: "weeknote-editor" });
    this.textArea = editor.createEl("textarea", {
      attr: { placeholder: this.plugin.settings.placeholder },
    });
    const buttons = this.inputArea.createDiv({ cls: "weeknote-buttons" });
    this.saveBtn = buttons.createEl("button", { cls: "weeknote-save-btn", attr: { tabindex: "-1" } });
    this.saveBtn.setText(this.plugin.settings.saveButtonLabel);
    this.saveBtn.addEventListener("click", () => void this.saveMemo());

    // Keyboard shortcut
    this.textArea.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void this.saveMemo();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        this.textArea.blur();
      }
      // Shift+Tab: select the last memo card
      if (e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) {
          this.selectLastMemoCard();
          e.stopPropagation();
        }
      }
    });
    
    // Prevent blur when clicking outside Obsidian
    this.textArea.addEventListener("blur", (e) => {
      if (!e.relatedTarget && !document.hasFocus()) {
        setTimeout(() => {
          if (!document.hasFocus()) {
            this.textArea.focus();
          }
        }, 10);
      }
    });

    // Setup resizers
    this.setupHorizontalResizer(resizerTopBottom, this.scheduleSection as HTMLElement, bottomRow as HTMLElement);
    this.setupVerticalResizer(resizerTaskMemo, this.taskContainer as HTMLElement, memoPanel as HTMLElement);
  }

  // Vertical resizer for side-by-side panels (horizontal drag)
  setupVerticalResizer(resizer: HTMLElement, leftPanel: HTMLElement, rightPanel: HTMLElement): void {
    setupVerticalResizerHelper(resizer, leftPanel, rightPanel);
  }

  renderTabs(weekStart: moment.Moment, days: string[]): void {
    this.tabsContainer.empty();
    const today = moment();
    
    for (let i = 0; i < 7; i++) {
      const date = weekStart.clone().add(i, "days");
      const isToday = date.isSame(today, "day");
      const isSelected = date.format("YYYY-MM-DD") === this.selectedDate.format("YYYY-MM-DD");
      
      const isSunday = date.day() === 0;
      const isSaturday = date.day() === 6;
      
      const tab = this.tabsContainer.createDiv({ 
        cls: `weeknote-tab ${isSelected ? "is-active" : ""} ${isToday ? "is-today" : ""} ${isSunday ? "is-sunday" : ""} ${isSaturday ? "is-saturday" : ""}` 
      });
      
      const dateLabel = tab.createDiv({ cls: "weeknote-tab-date" });
      dateLabel.setText(date.format("MM/DD"));
      
      const dayLabel = tab.createDiv({ cls: "weeknote-tab-day" });
      dayLabel.setText(days[date.day()]);
      
      tab.addEventListener("click", () => {
        this.selectedDate = date.clone();
        this.lastSelectedLineIndex = null;
        this.renderTabs(weekStart, days);
        void this.refreshContent();
      });
    }
  }

  setupScheduleResizer(resizer: HTMLElement, scheduleSection: HTMLElement, recentSection: HTMLElement): void {
    setupScheduleResizerHelper(resizer, scheduleSection, recentSection);
  }

  // Left resizer: Schedule expands/shrinks, Task shrinks/expands inversely, Memo stays same
  setupLeftPanelResizer(resizer: HTMLElement, schedulePanel: HTMLElement, taskPanel: HTMLElement): void {
    setupLeftPanelResizerHelper(resizer, schedulePanel, taskPanel);
  }

  // Right resizer: Task expands/shrinks, Schedule stays fixed, Memo absorbs
  setupRightPanelResizer(resizer: HTMLElement, taskPanel: HTMLElement, schedulePanel: HTMLElement): void {
    setupRightPanelResizerHelper(resizer, taskPanel, schedulePanel);
  }

  // Horizontal resizer for three-panel-horizontal layout (vertical drag)
  setupHorizontalResizer(resizer: HTMLElement, topPanel: HTMLElement, bottomPanel: HTMLElement): void {
    setupHorizontalResizerHelper(resizer, topPanel, bottomPanel);
  }

  async refreshContent(): Promise<void> {
    const t = this.t.bind(this);
    const container = this.containerEl;
    
    // Update Header Elements
    const thisWeekBtn = container.querySelector(".weeknote-nav-today");
    if (thisWeekBtn) thisWeekBtn.setText(t("thisWeek")); 
    // Actually "today" is "今日", maybe we need "thisWeek" key if not existing.
    // Let's check i18n keys again. 
    
    const weekLabel = container.querySelector(".weeknote-week-info");
    if (weekLabel) this.updateWeekDisplay();

    const createBtn = container.querySelector(".weeknote-create-btn");
    if (createBtn) createBtn.setText(`📝 ${t("createReport")}`);

    const openBtn = container.querySelector(".weeknote-open-btn");
    if (openBtn) openBtn.setText(`📂 ${t("openReport")}`);

    // Update section titles (for three-panel and horizontal layouts)
    const scheduleTitle = container.querySelector(".weeknote-schedule-header h5, .weeknote-panel-header h5");
    if (scheduleTitle) scheduleTitle.setText(t("scheduleView"));
    
    const taskTitle = container.querySelector(".weeknote-task-panel .weeknote-panel-header h5");
    if (taskTitle) taskTitle.setText(t("taskView"));
    
    const memoTitle = container.querySelector(".weeknote-memo-panel .weeknote-panel-header h5");
    if (memoTitle) memoTitle.setText(t("memoView"));

    // Re-render tabs
    if (this.tabsContainer) {
      const weekStart = this.plugin.generator.getWeekStartDate(this.selectedDate);
      const days = i18n[this.plugin.settings.language].days;
      this.renderTabs(weekStart, days);
    }
    
    // Update header texts based on current language
    if (this.memoSectionTitle) {
      if (this.currentMemoView === "task") {
        this.memoSectionTitle.setText(t("taskView"));
      } else {
        this.memoSectionTitle.setText(t("quickMemo"));
      }
    }
    if (this.viewToggleBtn) {
      const label = this.viewToggleBtn.querySelector(".toggle-label");
      if (label instanceof HTMLElement) {
        if (this.currentMemoView === "task") {
          label.setText(t("memoViewLabel"));
        } else {
          label.setText(t("taskViewLabel"));
        }
      }
    }
    
    if (this.memoListContainer) {
      this.memoListContainer.empty();
      await this.loadDayMemos(this.memoListContainer, this.selectedDate);
      // Scroll memo list to bottom after render (only if visible)
      if (this.memoListWrapper && this.memoListWrapper.style.display !== "none") {
        // Use setTimeout for layout stability like in initial render
        setTimeout(() => {
          if (this.memoListContainer) {
            this.isProgrammaticScrolling = true;
            this.memoListContainer.scrollTop = this.memoListContainer.scrollHeight;
            this.updateScrollShadows();
            
            requestAnimationFrame(() => {
              this.isProgrammaticScrolling = false;
              this.setupMemoListObserver();
              requestAnimationFrame(() => {
                if (this.memoListContainer) {
                  this.memoListContainer.scrollTop = this.memoListContainer.scrollHeight;
                }
              });
            });
          }
        }, 50);
      }
    }
    if (this.scheduleListContainer) {
      this.scheduleListContainer.empty();
      await this.loadDaySchedule(this.scheduleListContainer, this.selectedDate);
    }
    // Update task list
    if (this.taskListContainer) {
      this.taskListContainer.empty();
      await this.loadDayTasks(this.taskListContainer, this.selectedDate);
    }
    // Reset schedule section height to auto (in case resizer was used)
    if (this.scheduleSection) {
      this.scheduleSection.setCssStyles({ height: "", flex: "" });
    }
    
    // Reset heights for three-panel-horizontal layout
    if (this.plugin.settings.layoutMode === "three-panel-horizontal") {
      if (this.taskContainer) {
        this.taskContainer.setCssStyles({ height: "", flex: "" });
      }
      // Reset Memo Panel
      const memoPanel = this.containerEl.querySelector(".weeknote-three-panel-horizontal .weeknote-memo-bottom") as HTMLElement;
      if (memoPanel) {
        memoPanel.setCssStyles({ height: "", flex: "" });
      }
    }
    
    // Reset sizes for t-panel layout
    if (this.plugin.settings.layoutMode === "t-panel") {
      // Reset bottom row height
      const bottomRow = this.containerEl.querySelector(".weeknote-t-panel-bottom-row") as HTMLElement;
      if (bottomRow) {
        bottomRow.setCssStyles({ height: "", flex: "" });
      }
      // Reset Task and Memo widths
      if (this.taskContainer) {
        this.taskContainer.setCssStyles({ width: "", flex: "" });
      }
      const memoPanel = this.containerEl.querySelector(".weeknote-t-panel .weeknote-memo-bottom") as HTMLElement;
      if (memoPanel) {
        memoPanel.setCssStyles({ width: "", flex: "" });
      }
    }
    // Update scroll shadows
    this.updateScrollShadows();
    
    // Update memo input elements
    if (this.textArea) {
      this.textArea.placeholder = this.plugin.settings.placeholder;
    }
    if (this.saveBtn) {
      this.saveBtn.setText(this.plugin.settings.saveButtonLabel);
    }
  }

  async reloadSchedule(): Promise<void> {
    const t = this.t.bind(this);
    
    // Check if report file exists
    const filePath = this.plugin.getWeeknotePath(this.selectedDate);
    const file = this.app.vault.getAbstractFileByPath(filePath);

    if (!(file instanceof TFile)) {
       // If file doesn't exist, create it (same behavior as create button)
       await this.createWeeknote();
       return;
    }

    try {
      const weekStart = this.plugin.generator.getWeekStartDate(this.selectedDate);
      const schedule = await this.plugin.calendarService.fetchWeeklySchedule(weekStart);
      
      if (schedule) {
        // Update all days of the week in the report file
        for (let i = 0; i < 7; i++) {
          const dayDate = moment(weekStart).add(i, "days");
          await this.plugin.updateScheduleInReport(dayDate, schedule);
        }
        new Notice(t("scheduleReloaded"));
      }
      
      // Refresh the schedule display for currently selected day
      if (this.scheduleListContainer) {
        this.scheduleListContainer.empty();
        await this.loadDaySchedule(this.scheduleListContainer, this.selectedDate);
      }
    } catch (_error) {
      new Notice(t("scheduleReloadFailed"));
    }
  }

  async createWeeknote(): Promise<void> {
    const t = this.t.bind(this);
    try {
      const weekStart = this.plugin.generator.getWeekStartDate(this.selectedDate);
      const filePath = this.plugin.generator.getReportFilePath(weekStart);
      
      let file = this.app.vault.getAbstractFileByPath(filePath);
      let isNew = false;
      
      // 1. Create file if not exists
      if (!(file instanceof TFile)) {
        await this.plugin.generator.createReport(weekStart, null);
        file = this.app.vault.getAbstractFileByPath(filePath);
        isNew = true;
        new Notice(`${t("reportCreated")}: ${filePath}`);
      } else {
        new Notice(`${filePath} already exists`);
      }
      
      // 2. Open file
      if (file instanceof TFile) {
        await this.app.workspace.getLeaf().openFile(file);
      }
      
      // 3. Update Schedule (only for new files)
      if (isNew) {
        // Show loading indicator on reload button
        if (this.reloadBtn) this.reloadBtn.addClass("is-loading");
        try {
          const schedule = await this.plugin.calendarService.fetchWeeklySchedule(weekStart);
          if (schedule) {
            for (let i = 0; i < 7; i++) {
              const date = weekStart.clone().add(i, "days");
              await this.plugin.updateScheduleInReport(date, schedule);
            }
          }
        } catch (_e) {
          // Schedule fetch failed
          new Notice(t("scheduleSyncFailed") || "Failed to sync schedule");
        } finally {
          if (this.reloadBtn) this.reloadBtn.removeClass("is-loading");
        }
      }
      
      // Refresh sidebar
      setTimeout(async () => {
        await this.refreshContent();
      }, 300);
    } catch (_error) {
      new Notice(`${t("reportCreateFailed")}: ${_error}`);
    }
  }

  async openWeeknote(): Promise<void> {
    const t = this.t.bind(this);
    const weekStart = this.plugin.generator.getWeekStartDate(this.selectedDate);
    const filePath = this.plugin.generator.getReportFilePath(weekStart);
    const file = this.app.vault.getAbstractFileByPath(filePath);
    
    if (file instanceof TFile) {
      await this.app.workspace.getLeaf().openFile(file);
    } else {
      new Notice(t("reportNotFound"));
    }
  }

  /**
   * Select the last memo card (triggered by Shift+Tab from input)
   */
  selectLastMemoCard(): void {
    if (!this.memoListContainer) return;
    
    // Get only visible, non-editing memo cards
    const allCards = Array.from(this.memoListContainer.querySelectorAll(".weeknote-card")) as HTMLElement[];
    const cards = allCards.filter(c => !c.classList.contains("weeknote-card-editing"));
    if (cards.length === 0) return;
    
    const lastCard = cards[cards.length - 1];
    
    // Deselect all cards first
    allCards.forEach(c => c.removeClass("is-selected"));
    
    // Deselect tasks as well
    this.taskListContainer?.querySelectorAll(".is-selected").forEach(el => el.removeClass("is-selected"));
    
    // Blur the text area
    this.textArea?.blur();
    
    // Ensure it's visible
    lastCard.scrollIntoView({ block: "nearest", behavior: "smooth" });
    
    // Switch selection without tooltip
    if (this.activeMemoTooltip) {
      this.activeMemoTooltip.cleanup();
      this.activeMemoTooltip = null;
    }
    lastCard.addClass("is-selected");
  }

  /**
   * Global keydown handler for the view
   */
  private handleGlobalKeydown(e: KeyboardEvent): void {
      // Only handle when this view's container is visible/active
      if (!this.containerEl.isShown()) return;
      
      // Ignore if editing a task or memo
      if (this.taskListContainer?.querySelector(".is-editing") || 
          this.memoListContainer?.querySelector(".weeknote-card-editing")) return;
      
      // Ignore if active element is an input or textarea
      const activeEl = document.activeElement;
      if (activeEl) {
          const tag = activeEl.tagName.toLowerCase();
          if (tag === "input" || tag === "textarea" || (activeEl instanceof HTMLElement && activeEl.isContentEditable)) {
              return;
          }
      }
      
      // Check for selected memo card
      const selectedMemoElement = this.memoListContainer?.querySelector(".weeknote-card.is-selected");
      const selectedMemo = selectedMemoElement instanceof HTMLElement ? selectedMemoElement : null;
      if (selectedMemo) {
          if (e.key === "Escape") {
              e.preventDefault();
              if (this.activeMemoTooltip) {
                  this.activeMemoTooltip.cleanup();
                  this.activeMemoTooltip = null;
              }
              selectedMemo.removeClass("is-selected");
              // Focus textarea so Shift+Tab will work as expected
              if (this.textArea) {
                  this.textArea.focus();
                  this.textArea.setSelectionRange(this.textArea.value.length, this.textArea.value.length);
              }
          } else if (e.key === "Enter") {
              e.preventDefault();
              const memo = selectedMemo.dataset.memo || "";
              const timestamp = selectedMemo.dataset.timestamp || "";
              const content = selectedMemo.dataset.content || "";
              if (this.activeMemoTooltip) {
                  this.activeMemoTooltip.cleanup();
                  this.activeMemoTooltip = null;
              }
              this.editMemo(selectedMemo, memo, timestamp, content);
          } else if (e.key === "Tab") {
              e.preventDefault();
              const cards = Array.from(this.memoListContainer?.querySelectorAll(".weeknote-card") || []);
              if (cards.length > 0) {
                  const currentIndex = cards.indexOf(selectedMemo);
                  if (e.shiftKey) {
                      // Shift + Tab: Move up
                      if (currentIndex > 0) {
                          const prevCard = cards[currentIndex - 1] as HTMLElement;
                          prevCard.scrollIntoView({ block: "nearest", behavior: "smooth" });
                          
                          // Switch selection without tooltip
                          if (this.activeMemoTooltip) {
                              this.activeMemoTooltip.cleanup();
                              this.activeMemoTooltip = null;
                          }
                          selectedMemo.removeClass("is-selected");
                          prevCard.addClass("is-selected");
                      }
                  } else {
                      // Tab: Move down
                      if (currentIndex < cards.length - 1) {
                          const nextCard = cards[currentIndex + 1] as HTMLElement;
                          nextCard.scrollIntoView({ block: "nearest", behavior: "smooth" });
                          
                          // Switch selection without tooltip
                          if (this.activeMemoTooltip) {
                              this.activeMemoTooltip.cleanup();
                              this.activeMemoTooltip = null;
                          }
                          selectedMemo.removeClass("is-selected");
                          nextCard.addClass("is-selected");
                      } else {
                          // Move back to text area
                          if (this.activeMemoTooltip) {
                              this.activeMemoTooltip.cleanup();
                              this.activeMemoTooltip = null;
                          }
                          selectedMemo.removeClass("is-selected");
                          if (this.textArea) {
                              this.textArea.focus();
                              this.textArea.setSelectionRange(this.textArea.value.length, this.textArea.value.length);
                          }
                      }
                  }
              }
          } else if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault(); // Prevent interference with tasks
          } else if (e.key === "Delete" || e.key === "Backspace") {
              // Delete the selected memo card
              e.preventDefault();
              const memo = selectedMemo.dataset.memo || "";
              if (memo) {
                  if (this.activeMemoTooltip) {
                      this.activeMemoTooltip.cleanup();
                      this.activeMemoTooltip = null;
                  }
                  selectedMemo.removeClass("is-selected");
                  void this.plugin.deleteMemo(memo).then(() => {
                      void this.refreshMemos();
                  });
              }
          }
          return; // Handled memo interaction
      }

      // Check if any task is selected
      const selectedTask = this.taskListContainer?.querySelector(".is-selected");
      
      // Prevent Tab key interaction when a task is selected
      if (selectedTask && e.key === "Tab") {
          e.preventDefault();
          return;
      }
      
      // Arrow keys: select task when none is selected
      if ((e.key === "ArrowUp" || e.key === "ArrowDown") && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
          if (!selectedTask && this.taskListContainer) {
              e.preventDefault();
              const rows = Array.from(this.taskListContainer.querySelectorAll(".weeknote-task-row")).filter((el): el is HTMLElement => el instanceof HTMLElement);
              if (rows.length === 0) return;
              
              let targetRow: HTMLElement | undefined;
              
              // Try to restore last selection
              if (this.lastSelectedLineIndex !== null) {
                 targetRow = rows.find(r => r.getAttribute("data-line-index") === String(this.lastSelectedLineIndex));
              }
              
              // Fallback to first row
              if (!targetRow) {
                 targetRow = rows[0];
                 if (targetRow) {
                    const lineIndex = targetRow.getAttribute("data-line-index");
                    if (lineIndex) this.lastSelectedLineIndex = parseInt(lineIndex);
                 }
              }
              
              if (targetRow) {
                  targetRow.addClass("is-selected");
                  targetRow.focus({ preventScroll: true });
                  targetRow.scrollIntoView({ block: "nearest", behavior: "auto" });
              }
          }
      }
      
      // Enter key: focus memo textarea when no task is selected
      if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
          if (!selectedTask && this.textArea) {
              e.preventDefault();
              this.textArea.focus();
          }
      }
      
      // Tab key with nothing selected: focus textarea to prevent browser's native tab navigation
      if (e.key === "Tab" && !selectedTask) {
          e.preventDefault();
          if (this.textArea) {
              this.textArea.focus();
              this.textArea.setSelectionRange(this.textArea.value.length, this.textArea.value.length);
          }
      }
  }

  async saveMemo(): Promise<void> {
    const t = this.t.bind(this);
    const content = this.textArea.value.trim();
    if (!content) {
      return;
    }

    try {
      const processedContent = await this.processTaskContent(content);
      await this.plugin.insertMemoToWeeknote(processedContent, this.selectedDate);
      this.textArea.value = "";

      if (this.memoListContainer) {
        this.memoListContainer.empty();
        await this.loadDayMemos(this.memoListContainer, this.selectedDate);
        // Scroll to bottom
        this.isProgrammaticScrolling = true;
        this.memoListContainer.scrollTop = this.memoListContainer.scrollHeight;
        requestAnimationFrame(() => {
          this.isProgrammaticScrolling = false;
        });
      }
    } catch (_error) {
      new Notice(`${t("saveFailed")}: ${_error}`);
    }
  }

  async loadDayMemos(container: HTMLElement, date: moment.Moment): Promise<void> {
    const t = this.t.bind(this);
    try {
      const memos = await this.plugin.getDayMemos(date);
      
      // Control scrollability based on content
      if (memos.length === 0) {
        container.addClass("no-scroll");
        container.createDiv({ cls: "weeknote-empty", text: t("noMemos") });
        return;
      }
      container.removeClass("no-scroll");

      // Memos in chronological order (oldest at top, newest at bottom)
      const timestampRegex = this.getTimestampRegex();
      
      for (const memo of memos) {
        const card = container.createDiv({ cls: "weeknote-card" });
        
        let timestamp = "";
        let content = memo;
        
        // Try to match using the configured timestamp format
        const formatMatch = memo.match(timestampRegex);
        if (formatMatch) {
          // First capture group is the full timestamp, last is the content
          timestamp = formatMatch[1];
          content = formatMatch[formatMatch.length - 1];
        } else {
          // Fallback: try common patterns for backward compatibility
          const parenMatch = memo.match(/^\(([^)]+)\)\s*(.*)$/);
          if (parenMatch) {
            timestamp = parenMatch[1];
            content = parenMatch[2];
          } else {
            const dateTimeMatch = memo.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?::\d{2})?)\s+(.*)$/);
            if (dateTimeMatch) {
              timestamp = dateTimeMatch[1];
              content = dateTimeMatch[2];
            } else {
              const timeMatch = memo.match(/^(\d{2}:\d{2}(?::\d{2})?)\s+(.*)$/);
              if (timeMatch) {
                timestamp = timeMatch[1];
                content = timeMatch[2];
              }
            }
          }
        }
        
        // Store metadata for global keyboard shortcuts and editing
        card.dataset.memo = memo;
        card.dataset.timestamp = timestamp;
        card.dataset.content = content;
        
        const contentEl = card.createDiv({ cls: "weeknote-card-content" });
        this.renderRichContent(contentEl, content, true); // Disable direct navigation for memo cards
        
        // Override link click handlers to prevent direct navigation (let card handler handle it)
        // Include all clickable elements and their descendants
        const clickableElements = contentEl.querySelectorAll("a, .task-clickable-link, .github-link-inline, .github-link-inline *, [data-link-url], [data-link-url] *");
        clickableElements.forEach(el => {
          el.addEventListener("click", (ev) => {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            
            // Find the closest element with URL info
            const linkEl = el.closest("a, .task-clickable-link, .github-link-inline, [data-link-url]");
            
            // Get the URL from this link
            let linkUrl: string | undefined;
            if (linkEl instanceof HTMLAnchorElement) {
              linkUrl = linkEl.href;
            } else if (linkEl) {
              // Check for data-link-url attribute or nested anchor
              linkUrl = linkEl.getAttribute("data-link-url") || undefined;
              if (!linkUrl) {
                const anchor = linkEl.querySelector("a");
                linkUrl = anchor?.href;
              }
            }
            
            // Store URL in card dataset for the card handler to read
            if (linkUrl) {
              card.dataset.clickedUrl = linkUrl;
            }
            
            // Manually dispatch a click on the card to trigger selection
            card.dispatchEvent(new MouseEvent("click", {
              bubbles: true,
              cancelable: true,
              clientX: (ev as MouseEvent).clientX,
              clientY: (ev as MouseEvent).clientY
            }));
          }, true); // capture phase to intercept before existing handlers
        });
        
        const timeEl = card.createDiv({ cls: "weeknote-card-time" });
        timeEl.setText(timestamp);
        
        // Click to select card and show action tooltip
        // Remove any existing handler first
        const cardWithHandler = card as HTMLElement & { _memoClickHandler?: (e: MouseEvent) => void };
        if (cardWithHandler._memoClickHandler) {
          card.removeEventListener("click", cardWithHandler._memoClickHandler);
        }
        
        const clickHandler = (e: MouseEvent) => {
          e.stopPropagation();
          e.preventDefault();
          
          // Check if URL was stored from link click
          const clickedUrl = card.dataset.clickedUrl;
          delete card.dataset.clickedUrl; // Clear after reading
          
          // Deselect previous card and tasks
          const allCards = container.querySelectorAll(".weeknote-card");
          allCards.forEach(c => c.removeClass("is-selected"));
          this.taskListContainer?.querySelectorAll(".is-selected").forEach(el => el.removeClass("is-selected"));
          
          // Show action tooltip (only pass URL if clicked on link)
          // Note: This may cleanup existing tooltip which deselects the old card
          this.showMemoActionTooltip(e, card, memo, timestamp, content, contentEl, clickedUrl);
          
          // Select this card (after tooltip cleanup to avoid being deselected)
          card.addClass("is-selected");
        };
        
        cardWithHandler._memoClickHandler = clickHandler;
        card.addEventListener("click", clickHandler);
      }
      
      // Note: Scroll to bottom is handled by the caller (layout functions)
    } catch (_error) {
      container.createDiv({ cls: "weeknote-empty", text: t("loadMemoFailed") });
    }
  }

  async loadDaySchedule(container: HTMLElement, date: moment.Moment): Promise<void> {
    const t = this.t.bind(this);
    try {
      const scheduleItems = await this.plugin.getDaySchedule(date);
      if (scheduleItems.length === 0) {
        container.createDiv({ cls: "weeknote-empty", text: t("noSchedule") });
        return;
      }

      for (const item of scheduleItems) {
        // Parse the schedule line (e.g., "- [ ] 10:00-11:00 Meeting [meet](url) ＠Location")
        const isChecked = item.includes("- [x]");
        const content = item.replace(/^- \[[ x]\] /, "");
        
        // Parse schedule content into components
        const parsed = this.parseScheduleContent(content);

        const scheduleCard = container.createDiv({ cls: "weeknote-schedule-card" });
        if (parsed.eventName?.startsWith("~~") && parsed.eventName?.endsWith("~~")) {
          scheduleCard.addClass("is-declined");
        }
        
        const checkbox = scheduleCard.createEl("input", {
          type: "checkbox",
          cls: "weeknote-schedule-checkbox",
        });
        checkbox.checked = isChecked;
        checkbox.addEventListener("change", async () => {
          await this.plugin.toggleScheduleItem(item, checkbox.checked);
        });
        
        const contentEl = scheduleCard.createDiv({ cls: "weeknote-schedule-content" });
        
        // Time
        if (parsed.time) {
          const timeEl = contentEl.createSpan({ cls: "schedule-time" });
          timeEl.setText(parsed.time);
        }
        
        // Event name
        if (parsed.eventName) {
          const nameEl = contentEl.createSpan({ cls: "schedule-event-name" });
          this.renderMarkdownText(nameEl, parsed.eventName);
        }
        
        // Meet URL (video icon)
        if (parsed.meetUrl) {
          const meetLink = contentEl.createEl("a", {
            cls: "schedule-meet-link",
            href: parsed.meetUrl,
          });
          meetLink.setAttribute("target", "_blank");
          setIcon(meetLink, "video");
        }
        
        // Location (badge style with tooltip)
        if (parsed.location) {
          const locationEl = contentEl.createSpan({ cls: "schedule-location" });
          locationEl.setText(parsed.location);
          
          // Dynamic tooltip on hover
          locationEl.addEventListener("mouseenter", (_e) => {
            const tooltip = document.createElement("div");
            tooltip.className = "schedule-location-tooltip";
            tooltip.textContent = parsed.location;
            document.body.appendChild(tooltip);
            
            const rect = locationEl.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();
            tooltip.setCssStyles({
              left: `${rect.left + rect.width / 2 - tooltipRect.width / 2}px`,
              top: `${rect.top - tooltipRect.height - 8}px`
            });
            
            locationEl.addEventListener("mouseleave", () => {
              tooltip.remove();
            }, { once: true });
          });
        }
      }
    } catch (_error) {
      container.createDiv({ cls: "weeknote-empty", text: "スケジュールを読み込めませんでした" });
    }
  }

  async loadDayTasks(container: HTMLElement, date: moment.Moment): Promise<void> {
    const t = this.t.bind(this);
    try {
      const tasks = await this.plugin.getDayTasks(date);

      // Initialize document-level keyboard events once
      if (!this.keydownHandler) {
         this.keydownHandler = this.handleGlobalKeydown.bind(this);
         document.addEventListener("keydown", this.keydownHandler!);
      }

      // Flatten the task tree for grid display
      const flatTasks = this.flattenTasks(tasks);
      
      
      if (flatTasks.length > 0) {
        container.removeClass("is-empty-state");
        this.renderTaskGrid(container, flatTasks);
      } else {
        container.addClass("is-empty-state");
        const emptyState = container.createDiv({ cls: "weeknote-empty is-tasks-empty" });
        // Override absolute positioning so it flows with add button
        emptyState.setCssStyles({
          position: "relative",
          inset: "auto",
          marginBottom: "8px",
          fontSize: "0.95em",
          fontWeight: "500"
        });
        
        emptyState.setText(t("copyFrom"));
        
        void this.showCopyTasksOptions(emptyState, date);
      }

      // Add task button
      const addBtn = container.createDiv({ cls: "weeknote-add-task-btn" });
      addBtn.setAttribute("tabindex", "0");
      setIcon(addBtn, "plus-circle");
      addBtn.createSpan({ text: t("addTask") });
      addBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        // Deselect any selected task cards
        container.querySelectorAll(".is-selected").forEach(el => {
          el.removeClass("is-selected");
        });
        this.showAddTaskInput(container, date);
      });
      
      // Keyboard support for add button
      addBtn.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.showAddTaskInput(container, date);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          // Move focus to last task row
          const rows = Array.from(container.querySelectorAll(".weeknote-task-row")) as HTMLElement[];
          if (rows.length > 0) {
            const lastRow = rows[rows.length - 1];
            addBtn.removeClass("is-selected");
            lastRow.addClass("is-selected");
            lastRow.focus({ preventScroll: true });
            lastRow.scrollIntoView({ block: "nearest", behavior: "auto" });
            this.lastSelectedLineIndex = parseInt(lastRow.getAttribute("data-line-index") || "0");
          }
        } else if (e.key === "Escape") {
          e.preventDefault();
          addBtn.removeClass("is-selected");
          addBtn.blur();
        }
      });
      
    } catch (_error) {
      // Task loading failed
    }
  }

  async processTaskContent(content: string): Promise<string> {
    return await UrlProcessor.process(content, this.plugin.settings.saveLinksToMarkdown);
  }

  /**
   * Render markdown text decorations (bold, italic, strikethrough) into HTML elements.
   * Delegates to helper function.
   */
  renderMarkdownText(container: HTMLElement, text: string): void {
    renderMarkdownTextHelper(container, text);
  }

  /**
   * Render rich content with markdown links, GitHub rich tags, and text decorations.
   * Delegates to helper function.
   */
  renderRichContent(container: HTMLElement, text: string, disableDirectNavigation: boolean = false): void {
    renderRichContentHelper(container, text, disableDirectNavigation);
  }
  showCopyTasksOptions(container: HTMLElement, date: moment.Moment): void {
    const wrapper = container.createDiv({ cls: "weeknote-copy-tasks-wrapper" });
    
    // Get configured buttons from settings
    const buttons = this.plugin.settings.copyFromButtons || [];
    
    for (const buttonConfig of buttons) {
        // Calculate target date based on button type
        let targetDate: moment.Moment;
        
        if (buttonConfig.type === "relative") {
            // N days ago
            targetDate = date.clone().subtract(buttonConfig.value, "days");
        } else {
            // Last specific weekday (0=Sun, 1=Mon, ..., 6=Sat)
            targetDate = date.clone();
            const targetWeekday = buttonConfig.value;
            const currentWeekday = date.day();
            
            // Calculate days to go back
            let daysBack = currentWeekday - targetWeekday;
            if (daysBack <= 0) {
                daysBack += 7; // Go to previous week
            }
            targetDate.subtract(daysBack, "days");
        }
        
        const btn = wrapper.createDiv({ cls: "copy-task-option-btn" });
        btn.setAttr("role", "button");
        btn.setAttr("tabindex", "0");
        
        // Styles are applied via CSS classes (.copy-task-option-btn, :hover, :active)
        
        // Translate button label based on type and value
        const t = this.t.bind(this);
        let relativeLabel: string;
        if (buttonConfig.type === "relative") {
          if (buttonConfig.value === 1) relativeLabel = t("previousDay");
          else if (buttonConfig.value === 2) relativeLabel = t("twoDaysAgo");
          else if (buttonConfig.value === 3) relativeLabel = t("threeDaysAgo");
          else relativeLabel = buttonConfig.label;
        } else {
          // weekday
          const weekdayMap: Record<number, I18nKey> = {
            0: "lastSunday",
            1: "lastMonday",
            2: "lastTuesday",
            3: "lastWednesday",
            4: "lastThursday",
            5: "lastFriday",
            6: "lastSaturday",
          };
          relativeLabel = t(weekdayMap[buttonConfig.value] || "previousDay");
        }
        
        // Use language-appropriate date format with correct locale
        const lang = this.plugin.settings.language;
        targetDate.locale(lang); // Set locale for this date
        const dateLabel = lang === "ja" 
          ? targetDate.format("M/D(ddd)")  // Japanese format
          : targetDate.format("M/D (ddd)"); // English format
        
        const relSpan = btn.createDiv({ cls: "copy-option-relative" });
        relSpan.setText(relativeLabel);
        
        const dateSpan = btn.createDiv({ cls: "copy-option-date" });
        dateSpan.setText(dateLabel);

        // Async check for tasks count
        void this.plugin.getDayTasks(targetDate).then(tasks => {
             if (tasks.length > 0) {
                 btn.setAttribute("title", `${tasks.length} tasks found`);
             } else {
                 btn.setAttribute("title", "No tasks found");
             }
        }).catch(() => {
             btn.setAttribute("title", "File not found");
        });

        const clickHandler = async (e: Event) => {
            e.stopPropagation();
            if (btn.hasClass("is-disabled")) return;

            btn.addClass("is-loading");
            btn.addClass("copy-option-loading");
            
            // Disable all buttons
            wrapper.querySelectorAll(".copy-task-option-btn").forEach(b => {
                b.addClass("is-disabled");
                (b as HTMLElement).setCssStyles({ pointerEvents: "none" });
            });
            
            await this.plugin.copyTasksFromDate(targetDate, date);
            await this.refreshContent();
        };

        btn.addEventListener("click", clickHandler);
        // Keyboard support
        btn.addEventListener("keydown", (e) => {
             if (e.key === "Enter" || e.key === " ") {
                 e.preventDefault();
                 void clickHandler(e);
             }
        });
    }
  }

  flattenTasks(
    tasks: TaskItem[], 
    result: { task: TaskItem; level: number; isLast: boolean }[] = [], 
    level = 0
  ): { task: TaskItem; level: number; isLast: boolean }[] {
    tasks.forEach((task, index) => {
      // Use parsed level to respect Markdown indentation
      const displayLevel = (task.level !== undefined) ? task.level : level;

      // Determine if this is the last sibling in the current list
      const isLast = (index === tasks.length - 1);

      result.push({ task, level: displayLevel, isLast });
      
      this.flattenTasks(task.children, result, displayLevel + 1);
    });
    return result;
  }
  
  async refreshTaskList(selectLineIndex?: number, moveMode?: boolean, skipWait?: boolean, disableHoverOnly?: boolean): Promise<void> {
    // Tooltip cleanup moved to outsideClickHandler to persist across refresh
    // if (this.activeLinkTooltip) { ... }
    
    // Wait for file system cache to sync
    if (!skipWait) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (this.taskListContainer) {
      if (moveMode || disableHoverOnly) {
        // Disable hover effects temporarily during keyboard movement
        this.taskListContainer.addClass("disable-hover");
        
        // Re-enable on next mouse move
        const mouseMoveHandler = () => {
          if (this.taskListContainer) {
            this.taskListContainer.removeClass("disable-hover");
            document.removeEventListener("mousemove", mouseMoveHandler);
          }
        };
        document.addEventListener("mousemove", mouseMoveHandler, { once: true });
      }

      const scrollTop = this.taskListContainer.scrollTop;

      this.taskListContainer.empty();
      await this.loadDayTasks(this.taskListContainer, this.selectedDate);
      
      this.taskListContainer.scrollTop = scrollTop;

      // Restore selection if specified
      if (selectLineIndex !== undefined) {
        const row = this.taskListContainer.querySelector(`[data-line-index="${selectLineIndex}"]`) as HTMLElement;
        if (row) {
          row.addClass("is-selected");
          // Only scroll if needed (nearest), to avoid jumping around
          row.scrollIntoView({ block: "nearest", behavior: "auto" });
          row.focus({ preventScroll: true }); // Prevent focus from forcing scroll if we handled it
        }
      }
      
      // Restore move mode if specified
      if (moveMode && !disableHoverOnly) {
        const row = this.taskListContainer.querySelector(`[data-line-index="${selectLineIndex}"]`) as HTMLElement;
        if (row) {
          row.addClass("is-move-mode");
        }
      }
      
      // Update scroll shadows
      this.updateScrollShadows();
    }
  }

  renderTaskGrid(container: HTMLElement, flatTasks: { task: TaskItem; level: number; isLast: boolean }[]): void {
    const grid = container.createDiv({ cls: "weeknote-task-grid" });
    
    for (let i = 0; i < flatTasks.length; i++) {
      const { task, level } = flatTasks[i];
      
      // Insert button before each row
      const insertBtn = grid.createDiv({ cls: "task-insert-btn" });
      const insertIcon = insertBtn.createDiv({ cls: "task-insert-icon" });
      setIcon(insertIcon, "plus-circle");
      
      let useNextLineIndent = false;
      let isLocked = false;
      
      insertBtn.addEventListener("mouseenter", (e) => {
        if (isLocked) return;
        
        // Always force UP arrow for the very first button
        if (i === 0) {
             useNextLineIndent = true; 
             setIcon(insertIcon, "arrow-up-circle");
             isLocked = true;
             return;
        }

        const rect = insertBtn.getBoundingClientRect();
        const centerY = rect.top + rect.height / 2;
        // Check entry direction roughly by Y position relative to center
        if (e.clientY < centerY) {
             // Entered from above (coming from prev row) -> use prev row indent
             useNextLineIndent = false;
             setIcon(insertIcon, "arrow-down-circle");
        } else {
             // Entered from below (coming from next row) -> use prev row indent too (user expects this)
             useNextLineIndent = true;
             setIcon(insertIcon, "arrow-up-circle");
        }
        isLocked = true;
      });
      
      // Reset state when button becomes hidden (opacity transition ends)
      insertBtn.addEventListener("transitionend", () => {
         const style = window.getComputedStyle(insertBtn);
         if (style.opacity === "0") {
             isLocked = false;
             setIcon(insertIcon, "plus-circle");
         }
      });

      insertBtn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        this.isIgnoringBlur = true;
        // Safety reset
        document.addEventListener("mouseup", () => {
            setTimeout(() => { this.isIgnoringBlur = false; }, 200);
        }, { once: true });
      });

      insertBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        
        // If editing, force refresh to exit edit mode
        if (container.querySelector(".is-editing")) {
             await this.refreshTaskList(undefined, false, true);
        }
        
        // Clear selection when adding new task
        const selectedRow = container.querySelector(".weeknote-task-row.is-selected");
        if (selectedRow) selectedRow.removeClass("is-selected");
        
        // Capture current intent
        const indentToUse = useNextLineIndent;
        
        // Reset state so if button is restored (cancelled), it starts fresh
        isLocked = false;
        useNextLineIndent = false;
        setIcon(insertIcon, "plus-circle");

        this.showInsertTaskInput(container, this.selectedDate, task.lineIndex, indentToUse);
      });
      
      const row = grid.createDiv({ 
        cls: `weeknote-task-row ${task.checked ? "is-checked" : ""}`,
        attr: { 
          "data-line-index": String(task.lineIndex),
          "data-level": String(level)
        }
      });
      
      // Indent guides
      for (let j = 0; j < level; j++) {
        const guide = row.createDiv({ cls: "task-indent-guide" });
        
        // Slot j corresponds to Level (j + 1)
        const targetLevel = j + 1;

        if (j === level - 1) {
          // Connector to the item itself (Level L task, slot L-1)
          // Look ahead to see if another task at exactly this level exists before a shallower level
          let hasMoreSiblings = false;
          for (let k = i + 1; k < flatTasks.length; k++) {
              if (flatTasks[k].level < targetLevel) break;
              if (flatTasks[k].level === targetLevel) {
                  hasMoreSiblings = true;
                  break;
              }
          }
          guide.addClass(hasMoreSiblings ? "is-tee" : "is-corner");
        } else {
          // Vertical line from parent levels (Look-ahead logic)
          let showVertical = false;
          for (let k = i + 1; k < flatTasks.length; k++) {
              const nextTaskLevel = flatTasks[k].level;
              if (nextTaskLevel < targetLevel) {
                  showVertical = false;
                  break;
              }
              if (nextTaskLevel === targetLevel) {
                  showVertical = true;
                  break;
              }
          }
          
          if (showVertical) {
            guide.addClass("is-vertical");
          }
        }
      }

      // Task Card content wrapper
      const card = row.createDiv({ cls: "task-card" });

      // Checkbox cell
      const checkCell = card.createDiv({ cls: "task-cell task-check-cell" });
      const checkbox = checkCell.createEl("input", {
        type: "checkbox",
        cls: "weeknote-task-checkbox",
      });
      checkbox.checked = task.checked;
      checkbox.addEventListener("change", async () => {
        // 1. Cancel concurrent edit/add modes immediately
        if (this.activeInputCleanup) {
          this.activeInputCleanup();
          this.activeInputCleanup = null;
        }

        // 2. Update visible selection immediately (Optimistic UI)
        const allRows = this.taskListContainer.querySelectorAll(".weeknote-task-row");
        allRows.forEach(r => r.removeClass("is-selected"));
        row.addClass("is-selected");
        row.toggleClass("is-checked", checkbox.checked);

        // 3. Perform file update
        await this.plugin.toggleTaskCheck(task.lineIndex, this.selectedDate, checkbox.checked);
        
        // 4. Final refresh to ensure consistency
        await this.refreshTaskList(task.lineIndex, false, true);
      });

      // Title cell
      const titleCell = card.createDiv({ cls: "task-cell task-title-cell" });
      
      const isGitHub = task.url && task.url.includes("github.com");
      
      if (isGitHub && task.url) {
          const tag = createTag(task.url);
          if (tag) {
             // Prevent default link behavior but allow event to bubble
             tag.addEventListener("click", (ev) => {
               ev.preventDefault();
             }, true);
             // Mark as link element with URL for tooltip
             tag.setAttribute("data-link-url", task.url!);
             tag.addClass("task-clickable-link");
             titleCell.appendChild(tag);
          } else {
             const linkEl = titleCell.createEl("span", { cls: "task-link task-clickable-link" });
             linkEl.setText(task.title);
             linkEl.setAttribute("data-link-url", task.url!);
          }
          // Append suffix text after link with spacing
          if (task.suffix) {
             const suffixSpan = titleCell.createEl("span", { cls: "task-suffix" });
             suffixSpan.setText(task.suffix);
          }
      } else if (task.url) {
        const linkEl = titleCell.createEl("span", { cls: "task-link task-clickable-link" });
        linkEl.setText(task.title);
        linkEl.setAttribute("data-link-url", task.url!);
        // Append suffix text after link with spacing
        if (task.suffix) {
           const suffixSpan = titleCell.createEl("span", { cls: "task-suffix" });
           suffixSpan.setText(task.suffix);
        }
      } else {
        // Parse markdown links in title and render with hover tooltips
        const mdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        let lastIndex = 0;
        let match: RegExpExecArray | null;
        let hasLinks = false;
        
        while ((match = mdLinkRegex.exec(task.title)) !== null) {
          hasLinks = true;
          
          // Check if there's text before this link
          const hasTextBefore = match.index > lastIndex;
          // Check if there's text after this link (will be updated after loop for last link)
          const hasTextAfter = (match.index + match[0].length) < task.title.length;
          
          // Add text before the link
          if (hasTextBefore) {
            this.renderMarkdownText(titleCell, task.title.substring(lastIndex, match.index));
          }
          // Add the link as span with tooltip (or rich tag for GitHub)
          const url = match[2];
          const linkText = match[1];
          
          let usedRichTag = false;
          if (url.includes("github.com")) {
             const tag = createTag(url);
             if (tag) {
                 // Prevent default link behavior but allow event to bubble
                 tag.addEventListener("click", (ev) => {
                   ev.preventDefault();
                 }, true);
                 // Mark as link element with URL for tooltip
                 tag.setAttribute("data-link-url", url);
                 tag.addClass("task-clickable-link");
                 // Add conditional margin classes
                 if (hasTextBefore) tag.addClass("has-text-before");
                 if (hasTextAfter) tag.addClass("has-text-after");
                 titleCell.appendChild(tag);
                 usedRichTag = true;
             }
          }
          
          if (!usedRichTag) {
              const linkEl = titleCell.createEl("span", { 
                cls: "task-link task-inline-link task-clickable-link",
                text: linkText
              });
              linkEl.setAttribute("data-link-url", url);
          }
          
          lastIndex = match.index + match[0].length;
        }
        
        // Add remaining text after last link
        if (hasLinks && lastIndex < task.title.length) {
          this.renderMarkdownText(titleCell, task.title.substring(lastIndex));
        } else if (!hasLinks) {
          this.renderMarkdownText(titleCell, task.title);
        }
      }
      
      
      // Edit and delete buttons moved to card action tooltip
      // Click to select card for keyboard navigation and show action tooltip
      row.addEventListener("click", (e) => {
        // Don't select if clicking on checkbox
        if ((e.target as HTMLElement).tagName === "INPUT") return;
        
        // Stop propagation to prevent document click handler from immediately deselecting
        e.stopPropagation();
        
        // Deselect currently selected
        const currentlySelected = container.querySelector(".is-selected");
        if (currentlySelected) currentlySelected.removeClass("is-selected");
        
        // Select this row
        row.addClass("is-selected");
        row.focus();
        
        // Save selection index
        this.lastSelectedLineIndex = task.lineIndex;
        
        // Check if clicked on a link element to get external URL
        let externalUrl: string | undefined;
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;
        const linkEl = target.closest(".task-clickable-link");
        if (linkEl instanceof HTMLElement) {
          externalUrl = linkEl.getAttribute("data-link-url") || undefined;
        }
        
        // Show action tooltip
        this.showCardActionTooltip(e, row, task, titleCell, externalUrl);
      });
      
      // Make row focusable
      row.tabIndex = 0;
      
      // Keyboard navigation when selected
      row.addEventListener("keydown", async (e) => {
        if (!row.hasClass("is-selected")) return;
        
        // Show move mode visual when Shift is held
        if (e.key === "Shift") {
          row.addClass("is-move-mode");
        }
        
        const taskIndex = flatTasks.findIndex(t => t.task.lineIndex === task.lineIndex);
        let newLineIndex = task.lineIndex;
        
        // Only move with Shift+Arrow
        if (e.shiftKey) {
          switch (e.key) {
            case "ArrowUp":
              e.preventDefault();
              if (taskIndex > 0) {
                const prevTask = flatTasks[taskIndex - 1];
                newLineIndex = prevTask.task.lineIndex;
                await this.plugin.reorderTask(task.lineIndex, prevTask.task.lineIndex, this.selectedDate, level);
                await this.refreshTaskList(newLineIndex, true);
              }
              break;
            case "ArrowDown":
              e.preventDefault();
              if (taskIndex < flatTasks.length - 1) {
                const nextTask = flatTasks[taskIndex + 1];
                newLineIndex = nextTask.task.lineIndex;
                await this.plugin.reorderTask(task.lineIndex, nextTask.task.lineIndex + 1, this.selectedDate, level);
                await this.refreshTaskList(newLineIndex, true);
              }
              break;
            case "ArrowLeft":
              e.preventDefault();
              if (level > 0) {
                await this.plugin.reorderTask(task.lineIndex, task.lineIndex, this.selectedDate, level - 1);
                await this.refreshTaskList(task.lineIndex, true);
              }
              break;
            case "ArrowRight":
              e.preventDefault();
              if (level < 5) {
                await this.plugin.reorderTask(task.lineIndex, task.lineIndex, this.selectedDate, level + 1);
                await this.refreshTaskList(task.lineIndex, true);
              }
              break;
            case "Enter":
              // Shift+Enter to toggle checkbox

              e.preventDefault();
              await this.plugin.toggleTaskCheck(task.lineIndex, this.selectedDate);
              await this.refreshTaskList(task.lineIndex);
              break;
            case "Delete":
            case "Backspace":
              // Shift+Delete or Shift+Backspace to delete task
              e.preventDefault();
              await this.plugin.deleteTask(task.lineIndex, this.selectedDate);
              await this.refreshTaskList(undefined, false, false);
              break;
          }
        } else {
          switch (e.key) {
            case "ArrowUp":
              e.preventDefault();
              // Close any open tooltip
              if (this.activeCardTooltip) {
                this.activeCardTooltip.cleanup();
                this.activeCardTooltip = null;
              }
              // Hide insert buttons during keyboard navigation
              container.addClass("disable-hover");
              grid.querySelectorAll(".task-insert-btn").forEach(btn => {
                btn.addClass("weeknote-hidden");
              });
              if (taskIndex > 0) {
                const prevTask = flatTasks[taskIndex - 1];
                const prevRow = grid.querySelector(`[data-line-index="${prevTask.task.lineIndex}"]`) as HTMLElement;
                if (prevRow) {
                  row.removeClass("is-selected");
                  prevRow.addClass("is-selected");
                  prevRow.focus({ preventScroll: true });
                  prevRow.scrollIntoView({ block: "nearest", behavior: "auto" });
                  this.lastSelectedLineIndex = prevTask.task.lineIndex;
                }
              }
              break;
            case "ArrowDown":
              e.preventDefault();
              // Close any open tooltip
              if (this.activeCardTooltip) {
                this.activeCardTooltip.cleanup();
                this.activeCardTooltip = null;
              }
              // Hide insert buttons during keyboard navigation
              container.addClass("disable-hover");
              grid.querySelectorAll(".task-insert-btn").forEach(btn => {
                btn.addClass("weeknote-hidden");
              });
              if (taskIndex < flatTasks.length - 1) {
                const nextTask = flatTasks[taskIndex + 1];
                const nextRow = grid.querySelector(`[data-line-index="${nextTask.task.lineIndex}"]`) as HTMLElement;
                if (nextRow) {
                  row.removeClass("is-selected");
                  nextRow.addClass("is-selected");
                  nextRow.focus({ preventScroll: true });
                  nextRow.scrollIntoView({ block: "nearest", behavior: "auto" });
                  this.lastSelectedLineIndex = nextTask.task.lineIndex;
                }
              } else {
                // Last task - move to add button
                const addBtn = container.querySelector(".weeknote-add-task-btn") as HTMLElement;
                if (addBtn) {
                  row.removeClass("is-selected");
                  addBtn.addClass("is-selected");
                  addBtn.focus({ preventScroll: true });
                  addBtn.scrollIntoView({ block: "nearest", behavior: "auto" });
                }
              }
              break;
            case "Enter":
              e.preventDefault();
              // Close any open tooltip
              if (this.activeCardTooltip) {
                this.activeCardTooltip.cleanup();
                this.activeCardTooltip = null;
              }
              this.enterEditMode(row, task, titleCell);
              break;
            case "Escape":
              e.preventDefault();
              // Close any open tooltip
              if (this.activeCardTooltip) {
                this.activeCardTooltip.cleanup();
                this.activeCardTooltip = null;
              }
              row.removeClass("is-selected");
              row.blur();
              break;
          }
        }
      });
      
      // Remove move mode visual when Shift is released
      row.addEventListener("keyup", (e) => {
        if (e.key === "Shift") {
          row.removeClass("is-move-mode");
        }
      });
      
    }
    
    // Add Last Insert Button (Bottom of the list)
    if (flatTasks.length > 0) {
      const lastTaskItem = flatTasks[flatTasks.length - 1];
      const lastInsertIndex = lastTaskItem.task.lineIndex + 1;
      
      const lastBtn = grid.createDiv({ cls: "task-insert-btn" });
      const lastIcon = lastBtn.createDiv({ cls: "task-insert-icon" });
      setIcon(lastIcon, "arrow-down-circle"); // Always down-only for bottom
      
      const useNextForLast = false; // Always prev line indent (last task)

      lastBtn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        this.isIgnoringBlur = true;
        document.addEventListener("mouseup", () => {
            setTimeout(() => { this.isIgnoringBlur = false; }, 200);
        }, { once: true });
      });

      lastBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        
        // If editing, force refresh to exit edit mode
        if (container.querySelector(".is-editing")) {
             await this.refreshTaskList(undefined, false, true);
        }
        
        // Clear selection
        const selectedRow = container.querySelector(".weeknote-task-row.is-selected");
        if (selectedRow) selectedRow.removeClass("is-selected");

        this.showInsertTaskInput(container, this.selectedDate, lastInsertIndex, useNextForLast);
      });
      
      lastBtn.addEventListener("mouseenter", () => {
         setIcon(lastIcon, "arrow-down-circle");
      });
    }
    
    // Remove old global handlers if exist
    if (this.deselectHandler) {
      document.removeEventListener("click", this.deselectHandler);
    }
    if (this.blurHandler) {
      window.removeEventListener("blur", this.blurHandler);
    }
    
    // Click anywhere outside of card to deselect (document level)
    this.deselectHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // If click target is not inside a task row and not on add button, deselect all
      if (!target.closest(".weeknote-task-row") && !target.closest(".weeknote-add-task-btn")) {
        // If clicked inside task list container (background), focus it to enable keyboard navigation
        if (container.contains(target)) {
            const tag = target.tagName.toLowerCase();
            if (tag !== "input" && tag !== "textarea" && tag !== "select" && 
                !target.closest("button") && !target.closest("a")) {
                container.focus({ preventScroll: true });
            }
        }
          
        grid.querySelectorAll(".is-selected").forEach(el => {
          el.removeClass("is-selected");
        });
        
        // Also deselect memo cards
        this.memoListContainer?.querySelectorAll(".is-selected").forEach(el => {
            el.removeClass("is-selected");
        });
        if (this.activeMemoTooltip) {
            this.activeMemoTooltip.cleanup();
            this.activeMemoTooltip = null;
        }
        
        // Also deselect add button
        const addBtn = container.querySelector(".weeknote-add-task-btn");
        if (addBtn) {
          addBtn.removeClass("is-selected");
        }
      }
    };
    document.addEventListener("click", this.deselectHandler);
    
    // Window blur (clicking outside Obsidian) to deselect - but not if editing
    this.blurHandler = () => {
      // Skip if currently editing
      if (grid.querySelector(".is-editing")) return;
      
      grid.querySelectorAll(".is-selected").forEach(el => {
        el.removeClass("is-selected");
      });
    };
    window.addEventListener("blur", this.blurHandler);
    
    // Re-enable insert button hover when mouse moves (after keyboard navigation)
    container.addEventListener("mousemove", () => {
      if (container.hasClass("disable-hover")) {
        container.removeClass("disable-hover");
        // Clear hidden state
        grid.querySelectorAll(".task-insert-btn").forEach(btn => {
          btn.removeClass("weeknote-hidden");
        });
      }
    });
  }

  showAddTaskInput(container: HTMLElement, date: moment.Moment): void {
    // If there is an active input, cleanup first
    if (this.activeInputCleanup) {
      this.activeInputCleanup();
      this.activeInputCleanup = null;
    }

    // Hide the add button temporarily
    const addBtn = container.querySelector(".weeknote-add-task-btn") as HTMLElement;
    if (addBtn) addBtn.addClass("weeknote-hidden");

    // Create card-style input row
    const inputRow = document.createElement("div");
    inputRow.className = "weeknote-task-row is-adding";
    
    // Task wrapper
    const card = document.createElement("div");
    card.className = "task-card";
    inputRow.appendChild(card);
    
    // Checkbox cell (visual only)
    const checkCell = document.createElement("div");
    checkCell.className = "task-cell task-check-cell";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "weeknote-task-checkbox";
    checkbox.disabled = true;
    checkCell.appendChild(checkbox);
    card.appendChild(checkCell);
    
    // Title cell with edit wrapper
    const titleCell = document.createElement("div");
    titleCell.className = "task-cell task-title-cell";
    card.appendChild(titleCell);
    
    const wrapper = document.createElement("div");
    wrapper.className = "task-edit-wrapper";
    titleCell.appendChild(wrapper);
    
    const input = document.createElement("input");
    input.type = "text";
    input.className = "task-edit-input";
    input.placeholder = "Enter task...";
    wrapper.appendChild(input);
    
    const buttons = document.createElement("div");
    buttons.className = "task-edit-buttons";
    wrapper.appendChild(buttons);
    
    const confirmBtn = document.createElement("button");
    confirmBtn.className = "task-edit-save";
    confirmBtn.textContent = "✓";
    confirmBtn.setAttribute("aria-label", "Add");
    buttons.appendChild(confirmBtn);
    
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "task-edit-cancel";
    cancelBtn.textContent = "✕";
    cancelBtn.setAttribute("aria-label", "Cancel");
    buttons.appendChild(cancelBtn);

    // Insert input row where the button was
    if (addBtn) {
        addBtn.after(inputRow);
    } else {
        container.appendChild(inputRow);
    }

    input.focus();

    let isCleanedUp = false;
    
    const outsideClickHandler = (e: MouseEvent) => {
      // If clicking inside the input row, do nothing
      if (e.target instanceof Node && inputRow.contains(e.target)) return;
      
      // If clicking on another add button or insert button, let that handler take over
      // But we still need to cleanup this one.
      // However, if we cleanup immediately, the other handler might not fire if the DOM changes?
      // No, bubbling happens first on target. But outsideClickHandler is on document.
      // If the other button's handler fires first (because of stopPropagation absence?), 
      // then activeInputCleanup will be called by the new handler.
      
      // If we are here, it means we clicked outside.
      cleanup();
    };

    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      
      if (this.activeInputCleanup === cleanup) {
        this.activeInputCleanup = null;
      }
      
      document.removeEventListener("click", outsideClickHandler, true);
      inputRow.remove();
      
      // Restore add button and focus it
      if (addBtn) {
          addBtn.removeClass("weeknote-hidden");
          addBtn.addClass("is-selected");
          addBtn.focus({ preventScroll: true });
      } else if (!container.querySelector(".weeknote-add-task-btn")) {
          // If button was missing/removed, let's refresh list or ignore
          // but we should just try to restore it if we have it ref
      }
    };
    
    this.activeInputCleanup = cleanup;

    const submit = async () => {
      const value = input.value.trim();
      if (!value) {
        cleanup();
        return;
      }

      document.removeEventListener("click", outsideClickHandler, true);
      inputRow.remove();
      
      await this.plugin.addTaskToReport(date, value);
      
      if (this.activeInputCleanup === cleanup) {
        this.activeInputCleanup = null;
      }
      
      // Restore add button first
      if (addBtn) {
        addBtn.removeClass("weeknote-hidden");
      }
      
      await this.refreshContent();
      
      // Select the last task card (newly added task)
      const rows = Array.from(container.querySelectorAll(".weeknote-task-row")).filter((el): el is HTMLElement => el instanceof HTMLElement);
      if (rows.length > 0) {
        const lastRow = rows[rows.length - 1];
        lastRow.addClass("is-selected");
        lastRow.focus({ preventScroll: true });
        lastRow.scrollIntoView({ block: "nearest", behavior: "auto" });
        this.lastSelectedLineIndex = parseInt(lastRow.getAttribute("data-line-index") || "0");
      }
    };

    confirmBtn.addEventListener("click", (e) => { e.stopPropagation(); void submit(); });
    cancelBtn.addEventListener("click", (e) => { e.stopPropagation(); cleanup(); });
    
    let isComposing = false;
    input.addEventListener("compositionstart", () => { isComposing = true; });
    input.addEventListener("compositionend", () => { isComposing = false; });

    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (isComposing || e.isComposing) return;
      
      if (e.key === "Enter") void submit();
      if (e.key === "Escape") cleanup();
    });
    
    // Click outside to cancel (delay to avoid immediate trigger)
    setTimeout(() => {
      document.addEventListener("click", outsideClickHandler, true);
    }, 10);
  }

  enterEditMode(row: HTMLElement, task: TaskItem, titleCell: HTMLElement): void {
    // Create wrapper
    titleCell.empty();
    const wrapper = titleCell.createDiv({ cls: "task-edit-wrapper" });

    // Create input field
    const input = wrapper.createEl("input", {
      type: "text",
      cls: "task-edit-input",
      value: task.content || task.title
    });
    
    const buttons = wrapper.createDiv({ cls: "task-edit-buttons" });
    const saveBtn = buttons.createEl("button", { text: "✓", cls: "task-edit-save", attr: { "aria-label": "Save" } });
    const cancelBtn = buttons.createEl("button", { text: "✕", cls: "task-edit-cancel", attr: { "aria-label": "Cancel" } });

    input.focus();
    input.selectionStart = input.selectionEnd = input.value.length;
    
    // Add editing class to row
    row.addClass("is-editing");
    
    let isSaving = false;
    let isCleanedUp = false;

    const outsideClickHandler = (e: MouseEvent) => {
       const target = e.target;
       if (target instanceof Node && !wrapper.contains(target)) {
         // Click outside cancels edit
         // Delay cleanup to allow click event to propagate to target first
         setTimeout(() => {
             cleanup();
         }, 0);
       }
    };

    const cleanup = (restoreSelection: boolean = true) => {
      if (isCleanedUp) return;
      isCleanedUp = true; // Prevent double cleanup

      if (this.activeInputCleanup === cleanup) {
         this.activeInputCleanup = null;
      }

      // Remove event listeners
      document.removeEventListener("click", outsideClickHandler, true);

      row.removeClass("is-editing");
      
      // Restore original content (cancel editing)
      titleCell.empty();
      titleCell.setText(task.title); // Temporary fallback
      
      // Force re-render this line to restore full rich text/links logic
      void this.refreshTaskList(task.lineIndex, false, true);

      if (restoreSelection) {
        // Ensure row is selected if needed (usually it stays selected)
        // const allRows = this.taskListContainer.querySelectorAll(".weeknote-task-row");
        // Only select this row if we are restoring selection
        // But if we are cleaning up due to other action (activeInputCleanup called externally),
        // we might not want to touch selection here if the other action handles it.
        // But since restoreSelection defaults to true, checking if row is still in DOM is good.
      }
    };
    
    this.activeInputCleanup = cleanup;

    const save = async () => {
      isSaving = true;
      const newTitle = input.value.trim();
      if (newTitle && newTitle !== task.title) {
        await this.plugin.updateTaskContent(task.lineIndex, task.checked, newTitle, this.selectedDate);
      }
      
      // For save, we DO want to refresh to confirm changes, but after cleanup
      // Actually cleanup restores old title, so if we saved, we MUST refresh or update DOM to new title.
      // Easiest is to refresh.
      
      // Remove editing UI
      // We don't call cleanup() directly for save because cleanup() restores OLD content.
      // Instead we manually clean up references and refresh.
      
      if (this.activeInputCleanup === cleanup) {
         this.activeInputCleanup = null;
      }
      document.removeEventListener("click", outsideClickHandler, true);
      
      // Refresh list to show new title and exit edit mode
      await this.refreshTaskList(task.lineIndex);
    };
    
    const cancel = (restoreSelection: boolean = true, overrideSelectIndex?: number) => {
      cleanup(restoreSelection);
      if (overrideSelectIndex !== undefined) {
         void this.refreshTaskList(overrideSelectIndex);
      }
    };
    
    saveBtn.addEventListener("click", (e) => { e.stopPropagation(); void save(); });
    cancelBtn.addEventListener("click", (e) => { e.stopPropagation(); cancel(); });

    let isComposing = false;
    input.addEventListener("compositionstart", () => { isComposing = true; });
    input.addEventListener("compositionend", () => { isComposing = false; });

    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (isComposing || e.isComposing) return;
      
      if (e.key === "Enter") {
        e.preventDefault();
        void save();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancel(true);
      }
    });
    
    input.addEventListener("blur", (e) => {
      if (isSaving) return;
      if (this.isIgnoringBlur) return;
      
      const related = e.relatedTarget;
      
      // If related is null, focus went outside the app (window blur) - don't cancel
      if (!(related instanceof HTMLElement)) return;
      
      // Do not cancel if clicking buttons inside wrapper
      if (wrapper.contains(related)) return;

      const clickedRow = related.closest(".weeknote-task-row");
      if (clickedRow && clickedRow !== row) {
        // Just cleanup without restoring selection or refreshing target.
        // Let the subsequent click/change event on the target row handle selection/updates.
        cleanup(false);
      } else {
        cancel(!clickedRow || clickedRow === row); 
      }
    });

    // Click outside handler
    setTimeout(() => {
      document.addEventListener("click", outsideClickHandler, true);
    }, 10);
  }

  // Track active card action tooltip for cleanup
  private activeCardTooltip: { element: HTMLElement; cleanup: () => void } | null = null;

  // Show card action tooltip with edit, delete, and optional external link buttons
  private showCardActionTooltip(
    e: MouseEvent,
    row: HTMLElement,
    task: TaskItem,
    titleCell: HTMLElement,
    externalUrl?: string
  ): void {
    // Clean up any existing tooltip first
    if (this.activeCardTooltip) {
      this.activeCardTooltip.cleanup();
      this.activeCardTooltip = null;
    }
    if (this.activeMemoTooltip) {
      this.activeMemoTooltip.cleanup();
      this.activeMemoTooltip = null;
    }
    
    // Deselect memo cards when selecting a task
    this.memoListContainer?.querySelectorAll(".is-selected").forEach(el => el.removeClass("is-selected"));
    
    // Get scroll container and panel for bounds checking
    const scrollContainer = row.closest(".weeknote-task-list") as HTMLElement;
    // Use the section/panel as bounds to allow tooltip to overlap header without being cut
    const panel = row.closest(".weeknote-section") as HTMLElement || row.closest(".weeknote-panel") as HTMLElement || this.taskContainer;
    
    // Create tooltip in document body for simple fixed positioning
    const tooltip = document.body.createDiv({ cls: "task-action-tooltip" });
    
    // Forward wheel events to scroll container so scrolling works while hovering tooltip
    tooltip.addEventListener("wheel", (ev) => {
      if (scrollContainer) {
        scrollContainer.scrollTop += ev.deltaY;
        scrollContainer.scrollLeft += ev.deltaX;
      }
    }, { passive: true });
    
    // External link button (if URL provided)
    if (externalUrl) {
      const linkBtn = tooltip.createEl("button", { cls: "task-action-btn task-action-icon-btn task-action-link-btn" });
      setIcon(linkBtn, "external-link");
      linkBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        window.open(externalUrl, "_blank");
        cleanup();
      });
      
      // Separator
      tooltip.createSpan({ cls: "task-action-separator", text: "|" });
    }
    
    // Edit button (icon)
    const editBtn = tooltip.createEl("button", { cls: "task-action-btn task-action-icon-btn" });
    setIcon(editBtn, "pencil");
    editBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      cleanup();
      this.enterEditMode(row, task, titleCell);
    });
    
    // Delete button (icon)
    const deleteBtn = tooltip.createEl("button", { cls: "task-action-btn task-action-icon-btn" });
    setIcon(deleteBtn, "trash-2");
    deleteBtn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      cleanup();
      await this.plugin.deleteTask(task.lineIndex, this.selectedDate);
      await this.refreshTaskList(undefined, false, false);
    });
    
    // Calculate click X offset for horizontal positioning
    const rowRect = row.getBoundingClientRect();
    const clickOffsetX = e.clientX - rowRect.left;
    
    // Clipping mode: null = not yet determined, 'list' = use list bounds, 'panel' = use panel bounds
    let clipMode: "list" | "panel" | null = null;
    
    const updatePosition = () => {
      const rect = row.getBoundingClientRect();
      const panelRect = panel ? panel.getBoundingClientRect() : null;
      const listRect = scrollContainer ? scrollContainer.getBoundingClientRect() : null;
      
      // Position tooltip above the row, centered on click position
      const left = rect.left + clickOffsetX;
      const top = rect.top - 8; // 8px gap above row
      
      tooltip.setCssStyles({ left: `${left}px`, top: `${top}px` });
      
      // Determine clipping bounds
      const tooltipRect = tooltip.getBoundingClientRect();
      const arrowHeight = 8; // Arrow extends 8px below tooltip box
      
      // On first call, determine clipping mode based on whether tooltip is fully inside list
      if (clipMode === null && listRect) {
        const isFullyInsideList = 
          tooltipRect.top >= listRect.top &&
          (tooltipRect.bottom + arrowHeight) <= listRect.bottom &&
          tooltipRect.left >= listRect.left &&
          tooltipRect.right <= listRect.right;
        
        // If it's already outside the list (e.g. at the top edge), use the panel (wider) as bounds
        clipMode = isFullyInsideList ? "list" : "panel";
      }
      
      // Select clipping bounds based on mode
      const boundsRect = (clipMode === "list" && listRect) ? listRect : panelRect;
      
      if (boundsRect) {
        // Calculate clipping with asymmetric bounds:
        // Top/Left/Right follows clipMode (can expand to panel)
        // Bottom ALWAYS stays within listRect if available
        const clipTop = Math.max(0, boundsRect.top - tooltipRect.top);
        const clipLeft = Math.max(0, boundsRect.left - tooltipRect.left);
        const clipRight = Math.max(0, tooltipRect.right - boundsRect.right);
        
        // For bottom, always use listRect if possible to avoid overlapping input area
        // Also account for horizontal scrollbar if present
        const bottomLimitRect = listRect || boundsRect;
        let bottomOffset = 0;
        if (scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight) {
            // Check for horizontal scrollbar height
            const sbHeight = scrollContainer.offsetHeight - scrollContainer.clientHeight;
            if (sbHeight > 0 && sbHeight < 30) { // Safety check for reasonable scrollbar height
                bottomOffset = sbHeight;
            }
        }
        
        const bottomOverflow = Math.max(0, (tooltipRect.bottom + arrowHeight) - (bottomLimitRect.bottom - bottomOffset));
        const clipBottom = bottomOverflow - arrowHeight;
        
        // Apply clip-path when any overflow occurs
        if (clipTop > 0 || bottomOverflow > 0 || clipLeft > 0 || clipRight > 0) {
          tooltip.setCssStyles({ clipPath: `inset(${clipTop}px ${clipRight}px ${clipBottom}px ${clipLeft}px)` });
        } else {
          tooltip.setCssStyles({ clipPath: "" });
        }
      }
    };
    
    const cleanup = () => {
      tooltip.remove();
      document.removeEventListener("click", outsideClickHandler, true);
      if (scrollContainer) {
        scrollContainer.removeEventListener("scroll", scrollHandler);
      }
      if (this.activeCardTooltip?.element === row) {
        this.activeCardTooltip = null;
      }
    };
    
    const outsideClickHandler = (ev: MouseEvent) => {
      if (!tooltip.contains(ev.target as Node) && !row.contains(ev.target as Node)) {
        cleanup();
      }
    };
    
    const scrollHandler = () => {
      updatePosition();
    };
    
    // Position tooltip with fixed positioning
    tooltip.setCssStyles({
      position: "fixed",
      transform: "translate(-50%, -100%)",
      zIndex: "1000"
    });
    
    // Initial position (also determines clipping mode)
    updatePosition();
    
    this.activeCardTooltip = { element: row, cleanup };
    
    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", scrollHandler, { passive: true });
    }
    
    // Close when clicking outside (delayed to avoid immediate trigger)
    setTimeout(() => {
      document.addEventListener("click", outsideClickHandler, true);
    }, 10);
  }

  // Track active memo action tooltip for cleanup
  private activeMemoTooltip: { element: HTMLElement; cleanup: () => void } | null = null;

  // Show memo action tooltip with edit, delete, and optional external link buttons
  private showMemoActionTooltip(
    e: MouseEvent,
    card: HTMLElement,
    originalMemo: string,
    timestamp: string,
    content: string,
    contentEl: HTMLElement,
    externalUrl?: string
  ): void {
    // Clean up any existing tooltip first
    if (this.activeMemoTooltip) {
      this.activeMemoTooltip.cleanup();
      this.activeMemoTooltip = null;
    }
    if (this.activeCardTooltip) {
      this.activeCardTooltip.cleanup();
      this.activeCardTooltip = null;
    }
    
    // Get scroll container for bounds checking
    const scrollContainer = card.closest(".weeknote-memo-list") as HTMLElement;
    const wrapper = card.closest(".weeknote-section") as HTMLElement || card.closest(".weeknote-panel") as HTMLElement || this.memoListWrapper;
    
    // Create tooltip in document body for simple fixed positioning
    const tooltip = document.body.createDiv({ cls: "memo-action-tooltip" });
    
    // Forward wheel events to scroll container so scrolling works while hovering tooltip
    tooltip.addEventListener("wheel", (ev) => {
      if (scrollContainer) {
        scrollContainer.scrollTop += ev.deltaY;
      }
    }, { passive: true });
    
    // External link button (if URL provided)
    if (externalUrl) {
      const linkBtn = tooltip.createEl("button", { cls: "memo-action-btn memo-action-icon-btn" });
      setIcon(linkBtn, "external-link");
      linkBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        window.open(externalUrl, "_blank");
        cleanup();
      });
      
      // Separator
      tooltip.createSpan({ cls: "memo-action-separator", text: "|" });
    }
    
    // Edit button (icon)
    const editBtn = tooltip.createEl("button", { cls: "memo-action-btn memo-action-icon-btn" });
    setIcon(editBtn, "pencil");
    editBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      cleanup();
      this.editMemo(card, originalMemo, timestamp, content);
    });
    
    // Delete button (icon)
    const deleteBtn = tooltip.createEl("button", { cls: "memo-action-btn memo-action-icon-btn" });
    setIcon(deleteBtn, "trash-2");
    deleteBtn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      cleanup();
      await this.plugin.deleteMemo(originalMemo);
      await this.refreshMemos();
    });
    
    // Calculate click X offset for horizontal positioning
    const cardRect = card.getBoundingClientRect();
    let clickOffsetX = e.clientX - cardRect.left;
    
    // Fallback for keyboard events or programmatic clicks
    if (e.clientX < cardRect.left || e.clientX > cardRect.right) {
        clickOffsetX = cardRect.width / 2;
    }
    
    // Dynamic clipping mode
    let clipMode: "list" | "panel" | null = null;
    
    const updatePosition = () => {
      const rect = card.getBoundingClientRect();
      const listRect = scrollContainer ? scrollContainer.getBoundingClientRect() : null;
      const panelRect = wrapper ? wrapper.getBoundingClientRect() : null;
      
      // Position tooltip above the card, centered on click position
      const left = rect.left + clickOffsetX;
      const top = rect.top - 8; // 8px gap above card
      
      tooltip.setCssStyles({ left: `${left}px`, top: `${top}px` });
      
      // Determine clipping bounds
      const tooltipRect = tooltip.getBoundingClientRect();
      const arrowHeight = 8;
      
      if (clipMode === null && listRect) {
        const isFullyInsideList = 
          tooltipRect.top >= listRect.top &&
          (tooltipRect.bottom + arrowHeight) <= listRect.bottom &&
          tooltipRect.left >= listRect.left &&
          tooltipRect.right <= listRect.right;
        clipMode = isFullyInsideList ? "list" : "panel";
      }

      // Select clipping bounds based on mode
      const boundsRect = (clipMode === "list" && listRect) ? listRect : panelRect;

      // Apply clipping if needed
      if (boundsRect) {
        // Asymmetric clipping: top/left/right follows expanded bounds, bottom is strictly list list
        const clipTop = Math.max(0, boundsRect.top - tooltipRect.top);
        const clipLeft = Math.max(0, boundsRect.left - tooltipRect.left);
        const clipRight = Math.max(0, tooltipRect.right - boundsRect.right);
        
        // Bottom limit is ALWAYS the list zone
        // Also account for horizontal scrollbar if present
        const bottomLimitRect = listRect || boundsRect;
        let bottomOffset = 0;
        if (scrollContainer && scrollContainer.scrollWidth > scrollContainer.clientWidth) {
            const sbHeight = scrollContainer.offsetHeight - scrollContainer.clientHeight;
            if (sbHeight > 0 && sbHeight < 30) {
                bottomOffset = sbHeight;
            }
        }
        
        const bottomOverflow = Math.max(0, (tooltipRect.bottom + arrowHeight) - (bottomLimitRect.bottom - bottomOffset));
        const clipBottom = bottomOverflow - arrowHeight;
        
        if (clipTop > 0 || bottomOverflow > 0 || clipLeft > 0 || clipRight > 0) {
          tooltip.setCssStyles({ clipPath: `inset(${clipTop}px ${clipRight}px ${clipBottom}px ${clipLeft}px)` });
        } else {
          tooltip.setCssStyles({ clipPath: "" });
        }
      }
    };
    
    
    const cleanup = () => {
      tooltip.remove();
      document.removeEventListener("click", outsideClickHandler, true);
      if (scrollContainer) {
        scrollContainer.removeEventListener("scroll", scrollHandler);
      }
      if (this.activeMemoTooltip?.element === card) {
        this.activeMemoTooltip = null;
      }
    };
    
    const outsideClickHandler = (ev: MouseEvent) => {
      if (!tooltip.contains(ev.target as Node) && !card.contains(ev.target as Node)) {
        cleanup();
        card.removeClass("is-selected");
      }
    };
    
    const scrollHandler = () => {
      updatePosition();
    };
    
    // Use setCssStyles for better performance and to avoid element.style usage where possible
    tooltip.setCssStyles({
      position: "fixed",
      transform: "translate(-50%, -100%)",
      zIndex: "1000"
    });
    
    // Initial position
    updatePosition();
    
    this.activeMemoTooltip = { element: card, cleanup };
    
    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", scrollHandler, { passive: true });
    }
    
    // Close when clicking outside (delayed to avoid immediate trigger)
    setTimeout(() => {
      document.addEventListener("click", outsideClickHandler, true);
    }, 10);
  }

  showInsertTaskInput(container: HTMLElement, date: moment.Moment, insertBeforeLineIndex: number, useNextLineIndent: boolean = false): void {
    // If there is an active input, cleanup first
    if (this.activeInputCleanup) {
      this.activeInputCleanup();
      this.activeInputCleanup = null;
    }
    
    // Find the insert button that was clicked and replace it with input
    const insertBtns = Array.from(container.querySelectorAll(".task-insert-btn"));
    for (const btn of insertBtns) {
      // Find the one before the target row
      const nextRow = btn.nextElementSibling as HTMLElement;
      const prevRow = btn.previousElementSibling as HTMLElement;
      
      let isTarget = false;
      if (nextRow && nextRow.getAttribute("data-line-index") === String(insertBeforeLineIndex)) {
        isTarget = true;
      } else if (!nextRow && prevRow) {
        // Last button case
        const prevIndex = Number(prevRow.getAttribute("data-line-index"));
        if (!isNaN(prevIndex) && insertBeforeLineIndex > prevIndex) {
            isTarget = true;
        }
      }

      if (isTarget) {
        const parent = btn.parentElement;
        if (!parent) continue;
        
        // Calculate indent level
        let targetLevel = 0;
        if (useNextLineIndent) {
            if (nextRow) targetLevel = Number(nextRow.getAttribute("data-level")) || 0;
            else if (prevRow) targetLevel = Number(prevRow.getAttribute("data-level")) || 0;
        } else {
            if (prevRow) targetLevel = Number(prevRow.getAttribute("data-level")) || 0;
        }
        
        // Create row with same structure as normal task row
        const inputRow = document.createElement("div");
        inputRow.className = "weeknote-task-row is-adding";
        
        // Add indent guides (same as normal rows)
        for (let j = 0; j < targetLevel; j++) {
          const guide = document.createElement("div");
          guide.className = "task-indent-guide";
          inputRow.appendChild(guide);
        }
        
        // Create task-card wrapper (same as normal rows)
        const card = document.createElement("div");
        card.className = "task-card";
        inputRow.appendChild(card);
        
        // Checkbox cell (visual only)
        const checkCell = document.createElement("div");
        checkCell.className = "task-cell task-check-cell";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "weeknote-task-checkbox";
        checkbox.disabled = true;
        checkCell.appendChild(checkbox);
        card.appendChild(checkCell);
        
        // Title cell with edit wrapper
        const titleCell = document.createElement("div");
        titleCell.className = "task-cell task-title-cell";
        card.appendChild(titleCell);
        
        const wrapper = document.createElement("div");
        wrapper.className = "task-edit-wrapper";
        titleCell.appendChild(wrapper);
        
        const input = document.createElement("input");
        input.type = "text";
        input.className = "task-edit-input";
        input.placeholder = "Enter task...";
        wrapper.appendChild(input);
        
        const buttons = document.createElement("div");
        buttons.className = "task-edit-buttons";
        wrapper.appendChild(buttons);
        
        const confirmBtn = document.createElement("button");
        confirmBtn.className = "task-edit-save";
        confirmBtn.textContent = "✓";
        confirmBtn.setAttribute("aria-label", "Add");
        buttons.appendChild(confirmBtn);
        
        const cancelBtn = document.createElement("button");
        cancelBtn.className = "task-edit-cancel";
        cancelBtn.textContent = "✕";
        cancelBtn.setAttribute("aria-label", "Cancel");
        buttons.appendChild(cancelBtn);
        
        // Store the original button for restoration
        const originalBtn = btn;
        
        // Replace insert button with input row
        btn.replaceWith(inputRow);
        input.focus({ preventScroll: true });
        
        let isCleanedUp = false;
        
        const outsideClickHandler = (e: MouseEvent) => {
          if (!inputRow.contains(e.target as Node)) {
            cleanup();
          }
        };

        const cleanup = () => {
          if (isCleanedUp) return;
          isCleanedUp = true;
          
          if (this.activeInputCleanup === cleanup) {
            this.activeInputCleanup = null;
          }
          
          document.removeEventListener("click", outsideClickHandler, true);
          // Restore the insert button using DOM replacement instead of full refresh
          inputRow.replaceWith(originalBtn);
        };
        
        this.activeInputCleanup = cleanup;
        
        const submit = async () => {
          const value = input.value.trim();
          if (!value) {
            cleanup();
            return;
          }
          
          document.removeEventListener("click", outsideClickHandler, true);
          
          await this.plugin.insertTaskAtLine(date, value, insertBeforeLineIndex, useNextLineIndent);
          
          // Clear active cleanup since we are refreshing the list
          if (this.activeInputCleanup === cleanup) {
            this.activeInputCleanup = null;
          }
          
          await this.refreshTaskList(insertBeforeLineIndex);
        };
        
        confirmBtn.addEventListener("click", (e) => { e.stopPropagation(); void submit(); });
        cancelBtn.addEventListener("click", (e) => { e.stopPropagation(); cleanup(); });
        
        let isComposing = false;
        input.addEventListener("compositionstart", () => { isComposing = true; });
        input.addEventListener("compositionend", () => { isComposing = false; });

        input.addEventListener("keydown", (e) => {
          e.stopPropagation();
          // Ignore if IME is composing
          if (isComposing || e.isComposing || e.keyCode === 229) return;

          if (e.key === "Enter") void submit();
          if (e.key === "Escape") cleanup();
        });
        
        // Click outside to cancel (delay to avoid immediate trigger)
        setTimeout(() => {
          document.addEventListener("click", outsideClickHandler, true);
        }, 10);
        
        // Correctly break loop after processing
        return; 
      }
    }
  }

  parseScheduleContent(content: string): { time: string | null; eventName: string | null; meetUrl: string | null; location: string | null } {
    return parseScheduleContentHelper(content);
  }

  editMemo(card: HTMLElement, originalMemo: string, timestamp: string, content: string): void {
    // Save the original height before emptying
    const originalHeight = card.offsetHeight;
    
    card.empty();
    card.addClass("weeknote-card-editing");
    // Using setCssStyles instead of .style
    card.setCssStyles({ minHeight: `${originalHeight}px` });
    
    const wrapper = card.createDiv({ cls: "weeknote-card-edit-wrapper" });
    
    const inputField = wrapper.createEl("textarea", {
      cls: "weeknote-card-input",
    });
    if (!(inputField instanceof HTMLTextAreaElement)) return;
    const input = inputField;
    input.value = content;
    input.focus();
    input.select();
    
    const buttonCol = wrapper.createDiv({ cls: "weeknote-card-buttons" });
    
    const saveBtn = buttonCol.createEl("button", { text: "✓", cls: "weeknote-card-save" });
    const cancelBtn = buttonCol.createEl("button", { text: "✕", cls: "weeknote-card-cancel" });
    
    const restoreCard = (keepSelection: boolean = false) => {
      cleanup();
      card.empty();
      card.removeClass("weeknote-card-editing");
      card.setCssStyles({ minHeight: "" });
      
      // Store metadata (might have been updated)
      card.dataset.memo = originalMemo;
      card.dataset.timestamp = timestamp;
      card.dataset.content = content;
      
      const contentEl = card.createDiv({ cls: "weeknote-card-content" });
      this.renderRichContent(contentEl, content, true); // Disable direct navigation
      
      // Override link click handlers for memo cards
      const clickableElements = contentEl.querySelectorAll("a, .task-clickable-link, .github-link-inline, .github-link-inline *, [data-link-url], [data-link-url] *");
      clickableElements.forEach(el => {
        el.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          
          // Find the closest element with URL info
          const linkEl = (el as HTMLElement).closest("a, .task-clickable-link, .github-link-inline, [data-link-url]");
          
          // Get the URL from this link
          let linkUrl: string | undefined;
          if (linkEl instanceof HTMLAnchorElement) {
            linkUrl = linkEl.href;
          } else if (linkEl) {
            linkUrl = linkEl.getAttribute("data-link-url") || undefined;
            if (!linkUrl) {
              const anchor = linkEl.querySelector("a");
              linkUrl = anchor?.href;
            }
          }
          
          // Store URL in card dataset for the card handler to read
          if (linkUrl) {
            card.dataset.clickedUrl = linkUrl;
          }
          
          // Manually dispatch a click on the card to trigger selection
          card.dispatchEvent(new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            clientX: (ev as MouseEvent).clientX,
            clientY: (ev as MouseEvent).clientY
          }));
        }, true);
      });
      
      const timeEl = card.createDiv({ cls: "weeknote-card-time" });
      timeEl.setText(timestamp);
      
      if (keepSelection) {
        // Keep selection mode (without tooltip)
        card.addClass("is-selected");
      }
      
      // Re-add click handler for future clicks
      // Remove any existing handler first
      const cardWithHandler = card as HTMLElement & { _memoClickHandler?: (e: MouseEvent) => void };
      if (cardWithHandler._memoClickHandler) {
        card.removeEventListener("click", cardWithHandler._memoClickHandler);
      }
      
      const clickHandler = (e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        
        // Check if URL was stored from link click (via dispatchEvent)
        const clickedUrl = card.dataset.clickedUrl;
        delete card.dataset.clickedUrl; // Clear after reading
        
        const allCards = this.memoListContainer?.querySelectorAll(".weeknote-card");
        allCards?.forEach(c => c.removeClass("is-selected"));
        this.taskListContainer?.querySelectorAll(".is-selected").forEach(el => el.removeClass("is-selected"));
        
        // Show action tooltip (may cleanup existing tooltip)
        this.showMemoActionTooltip(e, card, originalMemo, timestamp, content, contentEl, clickedUrl);
        
        // Select this card (after tooltip cleanup to avoid being deselected)
        card.addClass("is-selected");
      };
      
      cardWithHandler._memoClickHandler = clickHandler;
      card.addEventListener("click", clickHandler);
    };
    
    let isSaving = false;
    let isComposing = false;
    input.addEventListener("compositionstart", () => { isComposing = true; });
    input.addEventListener("compositionend", () => { isComposing = false; });
    
    const save = async () => {
      if (isSaving) return;
      isSaving = true;
      cleanup();
      const newContent = input.value.trim();
      if (!newContent) {
        restoreCard();
        return;
      }
      
      // Always process to convert URLs to markdown links
      const processedContent = await this.processTaskContent(newContent);
      
      // Only update if content actually changed (after processing)
      if (processedContent !== content) {
        await this.plugin.updateMemo(originalMemo, timestamp, processedContent);
        await this.refreshMemos();
        
        // Select the updated card after refresh
        setTimeout(() => {
          const cards = this.memoListContainer?.querySelectorAll(".weeknote-card");
          cards?.forEach(c => {
            const timeEl = c.querySelector(".weeknote-card-time");
            if (timeEl?.textContent === timestamp) {
              c.addClass("is-selected");
            }
          });
        }, 50);
      } else {
        restoreCard(true); // Keep selection
      }
      isSaving = false;
    };
    

    const cancel = (keepSelection: boolean = false) => {
      restoreCard(keepSelection);
    };
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!card.contains(target)) {
        // Click outside cancels edit
        // Delay cleanup to allow click event to propagate to target first
        setTimeout(() => {
          cancel();
        }, 0);
      }
    };
    
    const cleanup = () => {
      document.removeEventListener("click", handleClickOutside, true);
    };
    
    setTimeout(() => {
      document.addEventListener("click", handleClickOutside, true);
    }, 0);
    
    saveBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      void save();
    });
    cancelBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      cancel();
    });

    
    input.addEventListener("click", (e) => e.stopPropagation());
    
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      // Ignore if IME is composing
      if (isComposing || e.isComposing || e.keyCode === 229) return;

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void save();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancel(true); // Keep selection mode when pressing ESC
      }
    });
    
    // Auto-resize textarea based on content (only when there are newlines)
    const autoResize = () => {
      const hasNewlines = input.value.includes("\n");
      if (hasNewlines) {
        input.setCssStyles({ height: "auto" });
        input.setCssStyles({ height: `${Math.min(input.scrollHeight, 150)}px` });
        input.setCssStyles({ overflowY: input.scrollHeight > 150 ? "auto" : "hidden" });
      } else {
        input.setCssStyles({ height: "22px" });
      }
    };
    input.addEventListener("input", autoResize);
  }

  async refreshMemos(): Promise<void> {
    if (this.memoListContainer) {
      this.memoListContainer.empty();
      await this.loadDayMemos(this.memoListContainer, this.selectedDate);
      
      // Scroll to bottom after loading (wait for layout)
      requestAnimationFrame(() => {
        if (this.memoListContainer) {
          this.memoListContainer.scrollTop = this.memoListContainer.scrollHeight;
          this.updateScrollShadows();
        }
      });
    }
  }

  navigateWeek(direction: number): void {
    // direction: 1 for next week, -1 for prev week
    this.selectedDate.add(direction, "weeks");
    this.updateAfterNavigation();
  }

  navigateToToday(): void {
    this.selectedDate = moment();
    this.updateAfterNavigation();
  }

  private updateAfterNavigation(): void {
    this.lastSelectedLineIndex = null;
    const days = i18n[this.plugin.settings.language].days as string[];
    const weekStart = this.plugin.generator.getWeekStartDate(this.selectedDate);

    this.updateWeekDisplay();
    this.renderTabs(weekStart, days); // This updates tabs visually
    void this.refreshContent(); // This loads memos/schedules for the (potentially new) selected day within new week
  }

  updateWeekDisplay(): void {
    if (!this.weekInfoEl) return;
    const weekStart = this.plugin.generator.getWeekStartDate(this.selectedDate);
    const weekEnd = weekStart.clone().add(7 - 1, "days");
    this.weekInfoEl.setText(`${weekStart.format("MM/DD")} - ${weekEnd.format("MM/DD")}`);
  }

  toggleMemoTaskView(): void {
    const t = this.t.bind(this);
    const label = this.viewToggleBtn.querySelector(".toggle-label");
    if (!(label instanceof HTMLElement)) return;
    
    if (this.currentMemoView === "memo") {
      // Switch to TASK view
      this.currentMemoView = "task";
      this.memoSectionTitle.setText(t("taskView"));
      if (label) label.setText(t("memoViewLabel"));
      
      // Update help panel to task content
      if (this.helpPanel) this.createHelpPanel(this.helpPanel);
      
      // Hide memo elements
      this.memoListWrapper.addClass("weeknote-hidden");
      this.inputArea.addClass("weeknote-hidden");
      
      // Show task container and help button
      this.taskContainer.removeClass("weeknote-hidden");
      this.taskContainer.addClass("weeknote-flex");
      if (this.helpRow) this.helpRow.removeClass("weeknote-hidden");
      // Reset toggle button margin (helpRow has margin-left: auto)
      this.viewToggleBtn.setCssStyles({ marginLeft: "" });
    } else {
      // Switch to MEMO view
      this.currentMemoView = "memo";
      this.memoSectionTitle.setText(t("quickMemo"));
      if (label) label.setText(t("taskViewLabel"));
      
      // Update help panel to memo content
      if (this.helpPanel) this.createMemoHelpPanel(this.helpPanel);
      
      // Show memo elements
      this.memoListWrapper.removeClass("weeknote-hidden");
      this.inputArea.removeClass("weeknote-hidden");
      
      // Scroll to bottom after showing (need to wait for layout)
      requestAnimationFrame(() => {
        if (this.memoListContainer) {
          this.memoListContainer.scrollTop = this.memoListContainer.scrollHeight;
          this.updateScrollShadows();
        }
      });
      
      // Hide task container but KEEP help button visible
      this.taskContainer.addClass("weeknote-hidden");
      this.taskContainer.removeClass("weeknote-flex");
      if (this.helpRow) this.helpRow.removeClass("weeknote-hidden");
      // Keep toggle button positioned naturally
      this.viewToggleBtn.setCssStyles({ marginLeft: "" });
    }
  }

  setupScrollShadows(): void {
    // Memo list shadows
    if (this.memoListContainer) {
      this.memoListContainer.addEventListener("scroll", () => {
        this.updateScrollShadows();
      });
      // Note: MutationObserver is set up after initial scroll completes
    }
    
    // Task list shadows
    if (this.taskListContainer) {
      this.taskListContainer.addEventListener("scroll", () => {
        this.updateScrollShadows();
      });
    }
  }
  
  setupMemoListObserver(): void {
    if (!this.memoListContainer) return;
    
    // Disconnect existing observer if any
    if (this.memoListObserver) {
      this.memoListObserver.disconnect();
      this.memoListObserver = null;
    }
    
    // Threshold for "at bottom" detection (account for subpixel rendering)
    const bottomThreshold = 10;
    
    this.memoListObserver = new MutationObserver(() => {
      if (!this.memoListContainer || this.isProgrammaticScrolling) {
        this.updateScrollShadows();
        return;
      }
      
      // Check current scroll position to determine if we're at/near the bottom
      const { scrollTop, scrollHeight, clientHeight } = this.memoListContainer;
      const currentDistanceFromBottom = scrollHeight - scrollTop - clientHeight;
      
      if (currentDistanceFromBottom <= bottomThreshold) {
        // If currently at or near the bottom, scroll to absolute bottom
        this.memoListContainer.scrollTop = this.memoListContainer.scrollHeight;
      }
      // If not at bottom, don't adjust - let content shift naturally (upward)
      
      this.updateScrollShadows();
    });
    
    this.memoListObserver.observe(this.memoListContainer, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  updateScrollShadows(): void {
    const scrollThreshold = 5; // Small threshold to avoid flickering
    
    // Update memo list shadows
    if (this.memoListContainer && this.memoListWrapper) {
      const { scrollTop, scrollHeight, clientHeight } = this.memoListContainer;
      const canScrollUp = scrollTop > scrollThreshold;
      const canScrollDown = scrollTop + clientHeight < scrollHeight - scrollThreshold;
      this.memoListWrapper.toggleClass("can-scroll-up", canScrollUp);
      this.memoListWrapper.toggleClass("can-scroll-down", canScrollDown);
    }
    
    // Update task list shadows - apply to taskListWrapper
    if (this.taskListWrapper && this.taskListContainer) {
      const { scrollTop, scrollHeight, clientHeight } = this.taskListContainer;
      const canScrollUp = scrollTop > scrollThreshold;
      const canScrollDown = scrollTop + clientHeight < scrollHeight - scrollThreshold;
      this.taskListWrapper.toggleClass("can-scroll-up", canScrollUp);
      this.taskListWrapper.toggleClass("can-scroll-down", canScrollDown);
    }
  }

  async onClose(): Promise<void> {
    // Cleanup global event listeners
    if (this.deselectHandler) {
      document.removeEventListener("click", this.deselectHandler);
      this.deselectHandler = null;
    }
    if (this.blurHandler) {
      window.removeEventListener("blur", this.blurHandler);
      this.blurHandler = null;
    }
    if (this.keydownHandler) {
      document.removeEventListener("keydown", this.keydownHandler);
      this.keydownHandler = null;
    }
    // Cleanup MutationObserver
    if (this.memoListObserver) {
      this.memoListObserver.disconnect();
      this.memoListObserver = null;
    }
  }
}
