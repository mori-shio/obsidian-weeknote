import { App, PluginSettingTab, Setting, setIcon } from "obsidian";
import { IWeeknotePlugin } from "../types";
import { i18n, I18nKey, setLanguage } from "../i18n";
import { DEFAULT_SETTINGS, VIEW_TYPE_WEEKNOTE } from "../constants";
import { GithubSettingsUI } from "./github-settings";

export class WeeknoteSettingTab extends PluginSettingTab {
  plugin: IWeeknotePlugin;
  memoHeadingInput: HTMLInputElement | null = null;
  private githubSettingsUI: GithubSettingsUI;

  constructor(app: App, plugin: IWeeknotePlugin) {
    super(app, (plugin as unknown) as import("obsidian").Plugin);
    this.plugin = plugin;
    this.githubSettingsUI = new GithubSettingsUI(
      this.app, 
      this.plugin.saveSettings.bind(this.plugin), 
      this.display.bind(this)
    );
  }

  t(key: I18nKey): string {
    const lang = this.plugin.settings.language;
    return i18n[lang][key] as string;
  }

  tFrag(key: I18nKey): string | DocumentFragment {
    const text = this.t(key);
    if (text.includes("<br>")) {
      const frag = document.createDocumentFragment();
      const parts = text.split("<br>");
      parts.forEach((part, index) => {
        frag.appendText(part);
        if (index < parts.length - 1) {
          frag.createEl("br");
        }
      });
      return frag;
    }
    return text;
  }

  // Refresh all sidebar views after settings change
  refreshSidebarViews(): void {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WEEKNOTE);
    leaves.forEach(leaf => {
      const view = (leaf.view as unknown) as { refreshContent?: () => Promise<void> };
      if (view && typeof view.refreshContent === "function") {
        void view.refreshContent();
      }
    });
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const lang = this.plugin.settings.language;
    const t = this.t.bind(this);
    const tFrag = this.tFrag.bind(this);

    // General Settings (first heading, no need for plugin name)
    new Setting(containerEl).setName(t("generalSettings")).setHeading();

    new Setting(containerEl)
      .setName(t("language"))
      .setDesc(t("languageDesc"))
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            "en": "English",
            "ja": "日本語",
          })
          .setValue(this.plugin.settings.language)
          .onChange(async (value) => {
            this.plugin.settings.language = value as "ja" | "en";
            setLanguage(this.plugin.settings.language);
            await this.plugin.saveSettings();
            this.display(); // Re-render settings with new language
            // Refresh sidebar view if open
            this.refreshSidebarViews();
          })
      );

    new Setting(containerEl)
      .setName(t("layoutMode"))
      .setDesc(t("layoutModeDesc"))
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            "two-panel": t("layoutTwoPanel"),
            "three-panel": t("layoutThreePanel"),
            "three-panel-horizontal": t("layoutThreePanelHorizontal"),
            "t-panel": t("layoutTPanel"),
          })
          .setValue(this.plugin.settings.layoutMode)
          .onChange(async (value) => {
            this.plugin.settings.layoutMode = value as "two-panel" | "three-panel" | "three-panel-horizontal" | "t-panel";
            await this.plugin.saveSettings();
            // Refresh sidebar view to apply new layout
            const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WEEKNOTE);
            leaves.forEach(leaf => {
              const view = (leaf.view as unknown) as { onOpen?: () => Promise<void> };
              if (view && typeof view.onOpen === "function") {
                // Need to re-render the entire view for layout change
                void view.onOpen();
              }
            });
          })
      );

    new Setting(containerEl)
      .setName(t("saveLinksToMarkdown"))
      .setDesc(t("saveLinksToMarkdownDesc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.saveLinksToMarkdown ?? false)
          .onChange(async (value) => {
            this.plugin.settings.saveLinksToMarkdown = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t("markdownIndentStyle"))
      .setDesc(t("markdownIndentStyleDesc"))
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            "tab": t("markdownIndentTab"),
            "2-spaces": t("markdownIndent2Spaces"),
            "4-spaces": t("markdownIndent4Spaces"),
          })
          .setValue(this.plugin.settings.markdownIndentStyle || "tab")
          .onChange(async (value) => {
            this.plugin.settings.markdownIndentStyle = value as "2-spaces" | "4-spaces" | "tab";
            await this.plugin.saveSettings();
          })
      );

    // Week Settings (Moved to General Settings)
    const dayOptions = lang === "ja" 
      ? { "0": "日曜日", "1": "月曜日", "2": "火曜日", "3": "水曜日", "4": "木曜日", "5": "金曜日", "6": "土曜日" }
      : { "0": "Sunday", "1": "Monday", "2": "Tuesday", "3": "Wednesday", "4": "Thursday", "5": "Friday", "6": "Saturday" };

    new Setting(containerEl)
      .setName(t("weekStartDay"))
      .setDesc(t("weekStartDayDesc"))
      .addDropdown((dropdown) =>
        dropdown
          .addOptions(dayOptions)
          .setValue(String(this.plugin.settings.weekStartDay))
          .onChange(async (value) => {
            this.plugin.settings.weekStartDay = parseInt(value);
            await this.plugin.saveSettings();
            this.display(); // Refresh to update preview
            
            // Refresh sidebar view to update tabs order
            this.refreshSidebarViews();
          })
      );

    // Path Settings (Nested under General Settings)


    const fileFormatSetting = new Setting(containerEl)
      .setName(t("weeknoteFileFormat"))
      .setDesc(tFrag("weeknoteFileFormatDesc"))
      .addText((text) =>
        text
          .setPlaceholder("01.Weeknote/[YYYY]/[MM]/[YYYY]-[MM]-[DD]")
          .setValue(this.plugin.settings.weeknoteFileFormat)
          .onChange(async (value) => {
            this.plugin.settings.weeknoteFileFormat = value;
            await this.plugin.saveSettings();
            updatePreview(value);
          })
      );

    // Add preview element below the input
    // Force controlEl to display column to place preview under the textbox
    fileFormatSetting.controlEl.addClass("weeknote-settings-control-column");
    
    const previewEl = fileFormatSetting.controlEl.createDiv({ cls: "weeknote-settings-preview" });

    const updatePreview = (value: string) => {
      try {
        const momentFormat = this.plugin.generator.convertUserPathFormatToMomentFormat(value);
        const weekStart = this.plugin.generator.getWeekStartDate();
        const preview = weekStart.format(momentFormat);
        previewEl.setText(`${preview}.md`);
      } catch {
        previewEl.setText("Invalid format");
      }
    };
    
    updatePreview(this.plugin.settings.weeknoteFileFormat);



    // Calendar Settings
    new Setting(containerEl).setName(t("integrationSettings")).setHeading();

    new Setting(containerEl).setName("Calendar").setHeading();

    new Setting(containerEl)
      .setName(t("calendarIcsUrl"))
      .setDesc(t("calendarIcsUrlDesc"))
      .addText((text) =>
        text
          .setPlaceholder("https://calendar.google.com/calendar/ical/... or webcal://...")
          .setValue(this.plugin.settings.googleCalendarIcsUrl)
          .onChange(async (value) => {
            this.plugin.settings.googleCalendarIcsUrl = value;
            await this.plugin.saveSettings();
          })
      );

    const excludeSetting = new Setting(containerEl)
      .setName(t("excludeEventPatterns"))
      .setDesc(tFrag("excludeEventPatternsDesc"))
      .setClass("vertical-resize-textarea")
      .addTextArea((text) =>
        text
          .setPlaceholder("^昼休憩$\n.*飲み会$")
          .setValue(this.plugin.settings.excludeEventPatterns || "")
          .onChange(async (value) => {
            this.plugin.settings.excludeEventPatterns = value;
            await this.plugin.saveSettings();
          })
      );
    // Adjust textarea style
    const textarea = excludeSetting.controlEl.querySelector("textarea") as HTMLTextAreaElement;
    if (textarea) {
      textarea.addClass("weeknote-template-preview");
    }

    // GitHub Settings (within Integration)
    this.githubSettingsUI.display(containerEl);




    // Template Settings
    new Setting(containerEl).setName(t("templateSettings")).setHeading();

    new Setting(containerEl)
      .setDesc(t("resetToDefaultDesc"))
      .addButton((button) =>
        button
          .setButtonText(t("resetToDefault"))
          .onClick(async () => {
            // Reset template-related settings to defaults
            this.plugin.settings.reportsTitle = DEFAULT_SETTINGS.reportsTitle;
            this.plugin.settings.dayDateFormat = DEFAULT_SETTINGS.dayDateFormat;
            this.plugin.settings.daySections = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.daySections));
            this.plugin.settings.summaryTitle = DEFAULT_SETTINGS.summaryTitle;
            this.plugin.settings.summaryContent = DEFAULT_SETTINGS.summaryContent;
            await this.plugin.saveSettings();
            // Re-render the settings tab
            this.display();
          })
      );

    // Reports Section
    new Setting(containerEl).setName(t("reportsSection")).setHeading();

    new Setting(containerEl)
      .setName(t("title"))
      .setDesc(t("reportsTitleDesc"))
      .addText((text) =>
        text
          .setPlaceholder("# Reports")
          .setValue(this.plugin.settings.reportsTitle)
          .onChange(async (value) => {
            this.plugin.settings.reportsTitle = value;
            await this.plugin.saveSettings();
            updateTemplatePreview();
          })
      );



    new Setting(containerEl)
      .setName(t("dayDateFormat"))
      .setDesc(tFrag("dayDateFormatDesc"))
      .addText((text) =>
        text
          .setPlaceholder("## MM-DD (ddd)")
          .setValue(this.plugin.settings.dayDateFormat)
          .onChange(async (value) => {
            this.plugin.settings.dayDateFormat = value;
            await this.plugin.saveSettings();
            updateTemplatePreview();
          })
      );

    // Day Section Items (indented)
    const daySectionItemsSetting = new Setting(containerEl)
      .setName(t("daySectionItems"));
    daySectionItemsSetting.settingEl.addClass("day-section-items-label");
    
    const sectionsWrapper = containerEl.createDiv({ cls: "day-sections-wrapper" });
    const sectionsContainer = sectionsWrapper.createDiv({ cls: "sections-container" });
    
    const updateTemplatePreview = () => {
      this.renderSections(sectionsContainer);
      this.renderTemplatePreview(templatePreviewContent);
    };
    
    this.renderSections(sectionsContainer);

    // Add Section Button (inside wrapper)
    new Setting(sectionsWrapper)
      .addButton((button) =>
        button
          .setButtonText(t("addSection"))
          .onClick(async () => {
            this.plugin.settings.daySections.push({
              id: `section_${Date.now()}`,
              label: "",
              heading: "### new-section",
            });
            await this.plugin.saveSettings();
            updateTemplatePreview();
          })
      );

    // Summary Section
    new Setting(containerEl).setName(t("summarySection")).setHeading();

    new Setting(containerEl)
      .setName(t("title"))
      .setDesc(t("summaryTitleDesc"))
      .addText((text) =>
        text
          .setPlaceholder("# Summary")
          .setValue(this.plugin.settings.summaryTitle)
          .onChange(async (value) => {
            this.plugin.settings.summaryTitle = value;
            await this.plugin.saveSettings();
            updateTemplatePreview();
          })
      );

    // Template Preview (collapsible)
    const previewContainer = containerEl.createDiv({ cls: "template-preview-container" });
    const previewHeader = previewContainer.createDiv({ cls: "template-preview-header" });
    previewHeader.createEl("span", { text: t("templatePreview") });
    
    const buttonGroup = previewHeader.createDiv({ cls: "template-preview-buttons" });
    const refreshBtn = buttonGroup.createEl("button", { cls: "template-preview-refresh clickable-icon weeknote-hidden" });
    setIcon(refreshBtn, "refresh-cw");
    const toggleBtn = buttonGroup.createEl("button", { text: t("show"), cls: "template-preview-toggle" });
    
    const templatePreviewContent = previewContainer.createDiv({ cls: "template-preview-content weeknote-hidden" });
    
    refreshBtn.addEventListener("click", () => {
      refreshBtn.addClass("spinning");
      this.renderTemplatePreview(templatePreviewContent);
      setTimeout(() => {
        refreshBtn.removeClass("spinning");
      }, 500);
    });
    
    toggleBtn.addEventListener("click", () => {
      if (templatePreviewContent.hasClass("weeknote-hidden")) {
        templatePreviewContent.removeClass("weeknote-hidden");
        toggleBtn.setText(t("hide"));
        refreshBtn.removeClass("weeknote-hidden");
        this.renderTemplatePreview(templatePreviewContent);
      } else {
        templatePreviewContent.addClass("weeknote-hidden");
        toggleBtn.setText(t("show"));
        refreshBtn.addClass("weeknote-hidden");
      }
    });

    // Task Settings
    new Setting(containerEl).setName(lang === "ja" ? "☑️ タスク設定" : "☑️ Task settings").setHeading();
    new Setting(containerEl).setName(lang === "ja" ? "タスクコピー" : "Task copy").setHeading();

    // Button presets for copy from
    const buttonPresets: { type: "relative" | "weekday"; value: number; label: string }[] = [
      { type: "relative", value: 1, label: lang === "ja" ? "前日" : "Previous day" },
      { type: "relative", value: 2, label: lang === "ja" ? "2日前" : "2 days ago" },
      { type: "relative", value: 3, label: lang === "ja" ? "3日前" : "3 days ago" },
      { type: "weekday", value: 1, label: lang === "ja" ? "先週の月曜" : "Last Monday" },
      { type: "weekday", value: 2, label: lang === "ja" ? "先週の火曜" : "Last Tuesday" },
      { type: "weekday", value: 3, label: lang === "ja" ? "先週の水曜" : "Last Wednesday" },
      { type: "weekday", value: 4, label: lang === "ja" ? "先週の木曜" : "Last Thursday" },
      { type: "weekday", value: 5, label: lang === "ja" ? "先週の金曜" : "Last Friday" },
      { type: "weekday", value: 6, label: lang === "ja" ? "先週の土曜" : "Last Saturday" },
      { type: "weekday", value: 0, label: lang === "ja" ? "先週の日曜" : "Last Sunday" },
    ];

    // Create dropdown options
    const presetOptions: Record<string, string> = {};
    buttonPresets.forEach(p => {
      presetOptions[`${p.type}:${p.value}`] = p.label;
    });

    // Ensure copyFromButtons array exists
    if (!this.plugin.settings.copyFromButtons) {
      this.plugin.settings.copyFromButtons = [];
    }

    // Helper to create button setting with toggle + dropdown
    const createButtonSetting = (index: number, name: string, desc: string) => {
      const btn = this.plugin.settings.copyFromButtons[index];
      const isEnabled = !!btn;
      let dropdownEl: HTMLSelectElement | null = null;

      new Setting(containerEl)
        .setName(name)
        .setDesc(desc)
        .addToggle(toggle => {
          toggle.setValue(isEnabled);
          toggle.onChange(async enabled => {
            if (enabled) {
              // Enable: add default button if not exists
              if (!this.plugin.settings.copyFromButtons[index]) {
                // Fill in gaps if needed
                for (let i = 0; i <= index; i++) {
                  if (!this.plugin.settings.copyFromButtons[i]) {
                    this.plugin.settings.copyFromButtons[i] = { ...buttonPresets[i] || buttonPresets[0] };
                  }
                }
              }
              if (dropdownEl) dropdownEl.disabled = false;
            } else {
              // Disable: remove this button and all after it
              this.plugin.settings.copyFromButtons = this.plugin.settings.copyFromButtons.slice(0, index);
              if (dropdownEl) dropdownEl.disabled = true;
            }
            await this.plugin.saveSettings();
            this.display(); // Refresh to update UI state
            this.refreshSidebarViews();
          });
        })
        .addDropdown(dropdown => {
          dropdown.addOptions(presetOptions);
          if (btn) {
            dropdown.setValue(`${btn.type}:${btn.value}`);
          } else {
            dropdown.setValue(`${buttonPresets[0].type}:${buttonPresets[0].value}`);
          }
          dropdown.setDisabled(!isEnabled);
          dropdownEl = dropdown.selectEl;
          dropdown.onChange(async value => {
            const [type, val] = value.split(":");
            const preset = buttonPresets.find(p => p.type === type && p.value === parseInt(val));
            if (preset) {
              this.plugin.settings.copyFromButtons[index] = { ...preset };
              await this.plugin.saveSettings();
              this.refreshSidebarViews();
            }
          });
        });
    };

    // Button 1 (always enabled, no toggle needed)
    new Setting(containerEl)
      .setName(lang === "ja" ? "コピーボタン 1" : "Copy button 1")
      .setDesc(lang === "ja" ? "タスクが空の時に表示される最初のボタン" : "First button shown when tasks are empty")
      .addDropdown(dropdown => {
        dropdown.addOptions(presetOptions);
        const btn = this.plugin.settings.copyFromButtons[0];
        if (btn) {
          dropdown.setValue(`${btn.type}:${btn.value}`);
        } else {
          // Initialize with default
          this.plugin.settings.copyFromButtons[0] = { ...buttonPresets[0] };
          dropdown.setValue(`${buttonPresets[0].type}:${buttonPresets[0].value}`);
        }
        dropdown.onChange(async value => {
          const [type, val] = value.split(":");
          const preset = buttonPresets.find(p => p.type === type && p.value === parseInt(val));
          if (preset) {
            this.plugin.settings.copyFromButtons[0] = { ...preset };
            await this.plugin.saveSettings();
            this.refreshSidebarViews();
          }
        });
      });

    // Button 2 with toggle
    createButtonSetting(1, 
      lang === "ja" ? "コピーボタン 2" : "Copy button 2",
      lang === "ja" ? "2番目のボタン" : "Second button"
    );

    // Button 3 with toggle
    createButtonSetting(2,
      lang === "ja" ? "コピーボタン 3" : "Copy button 3", 
      lang === "ja" ? "3番目のボタン" : "Third button"
    );

    // Memo Settings
    new Setting(containerEl).setName(t("memoSettings")).setHeading();

    // Find memo section heading from daySections
    const memoSection = this.plugin.settings.daySections.find(s => s.id === "memo");
    const memoHeadingValue = memoSection?.heading || this.plugin.settings.memoHeading;
    
    // Sync memoHeading with memo section
    if (memoSection && this.plugin.settings.memoHeading !== memoSection.heading) {
      this.plugin.settings.memoHeading = memoSection.heading;
      void this.plugin.saveSettings();
    }

    // Store reference to the readonly input for live sync
    let memoHeadingInput: HTMLInputElement | null = null;

    new Setting(containerEl)
      .setName(t("insertSection"))
      .setDesc(t("insertSectionDesc"))
      .addText((text) => {
        text
          .setPlaceholder("### memo")
          .setValue(memoHeadingValue)
          .setDisabled(true);
        text.inputEl.addClass("memo-heading-readonly");
        memoHeadingInput = text.inputEl;
      });
    
    // Store the input reference for use in renderSections
    this.memoHeadingInput = memoHeadingInput;

    new Setting(containerEl)
      .setName(t("placeholder"))
      .setDesc(t("placeholderDesc"))
      .addText((text) =>
        text
          .setPlaceholder(lang === "ja" ? "今なにしてる？" : "What's on your mind?")
          .setValue(this.plugin.settings.placeholder)
          .onChange(async (value) => {
            this.plugin.settings.placeholder = value;
            await this.plugin.saveSettings();
            this.refreshSidebarViews();
          })
      );

    new Setting(containerEl)
      .setName(t("saveButtonLabel"))
      .setDesc(t("saveButtonLabelDesc"))
      .addText((text) =>
        text
          .setPlaceholder(lang === "ja" ? "投稿" : "Post")
          .setValue(this.plugin.settings.saveButtonLabel)
          .onChange(async (value) => {
            this.plugin.settings.saveButtonLabel = value;
            await this.plugin.saveSettings();
            this.refreshSidebarViews();
          })
      );

    new Setting(containerEl)
      .setName(t("timestampFormat"))
      .setDesc(t("timestampFormatDesc"))
      .addText((text) =>
        text
          .setPlaceholder("YYYY-MM-DD HH:mm:ss")
          .setValue(this.plugin.settings.timestampFormat)
          .onChange(async (value) => {
            this.plugin.settings.timestampFormat = value;
            await this.plugin.saveSettings();
          })
      );

    // Ko-fi support section at bottom
    const kofiSection = containerEl.createDiv({ cls: "weeknote-kofi-section" });
    const kofiText = kofiSection.createSpan({ cls: "weeknote-kofi-text" });
    kofiText.setText(t("supportMessage"));
    const kofiLink = kofiSection.createEl("a", { href: "https://ko-fi.com/X8X21RHGB3" });
    kofiLink.setAttr("target", "_blank");
    const kofiImg = kofiLink.createEl("img", { cls: "weeknote-kofi-img" });
    kofiImg.setAttr("src", "https://storage.ko-fi.com/cdn/kofi5.png?v=6");
    kofiImg.setAttr("alt", "Buy Me a Coffee at ko-fi.com");

  }

  renderSections(container: HTMLElement): void {
    container.empty();

    const t = this.t.bind(this);
    const memoHeading = this.plugin.settings.memoHeading;

    for (let i = 0; i < this.plugin.settings.daySections.length; i++) {
      const section = this.plugin.settings.daySections[i];
      const isScheduleSection = section.id === "schedule";
      const isTasksSection = section.id === "tasks";
      const isMemoSection = section.heading === memoHeading || section.id === "memo";
      const isBuiltIn = section.isBuiltIn === true;
      const isEnabled = section.enabled !== false; // default to true
      
      // Determine display name and description
      let displayName = section.heading;
      let description = "";
      if (isScheduleSection) {
        displayName = t("calendarSchedule");
        description = t("calendarScheduleDesc");
      } else if (isTasksSection) {
        displayName = t("tasks");
      } else if (isMemoSection) {
        displayName = t("memo");
        description = t("memoDesc");
      } else if (section.heading === "### new-section") {
        displayName = t("newItem");
      }
      
      const sectionEl = container.createDiv({ cls: "section-item" });
      if (!isEnabled) {
        sectionEl.addClass("section-item-disabled");
      }
      
      const setting = new Setting(sectionEl)
        .setName(displayName)
        .setDesc(description)
        .addText((text) =>
          text
            .setPlaceholder(t("headingPlaceholder"))
            .setValue(section.heading)
            .onChange(async (value) => {
              this.plugin.settings.daySections[i].heading = value;
              // Auto-generate ID from heading (remove ### and spaces)
              const autoId = value.replace(/^#+\s*/, "").toLowerCase().replace(/\s+/g, "-");
              this.plugin.settings.daySections[i].id = autoId || section.id;
              // Sync memoHeading if this is the memo section
              if (isMemoSection) {
                this.plugin.settings.memoHeading = value;
                // Live sync to the readonly input
                if (this.memoHeadingInput) {
                  this.memoHeadingInput.value = value;
                }
              }
              await this.plugin.saveSettings();
            })
        )
        .addExtraButton((button) =>
          button
            .setIcon("arrow-up")
            .setTooltip(t("moveUp"))
            .onClick(async () => {
              if (i > 0) {
                const temp = this.plugin.settings.daySections[i];
                this.plugin.settings.daySections[i] = this.plugin.settings.daySections[i - 1];
                this.plugin.settings.daySections[i - 1] = temp;
                await this.plugin.saveSettings();
                this.renderSections(container);
              }
            })
        )
        .addExtraButton((button) =>
          button
            .setIcon("arrow-down")
            .setTooltip(t("moveDown"))
            .onClick(async () => {
              if (i < this.plugin.settings.daySections.length - 1) {
                const temp = this.plugin.settings.daySections[i];
                this.plugin.settings.daySections[i] = this.plugin.settings.daySections[i + 1];
                this.plugin.settings.daySections[i + 1] = temp;
                await this.plugin.saveSettings();
                this.renderSections(container);
              }
            })
        );
      
      // Built-in sections: toggle visibility, custom sections: delete
      if (isBuiltIn) {
        setting.addExtraButton((button) =>
          button
            .setIcon(isEnabled ? "eye" : "eye-off")
            .setTooltip(isEnabled ? t("hideSection") : t("showSection"))
            .onClick(async () => {
              this.plugin.settings.daySections[i].enabled = !isEnabled;
              await this.plugin.saveSettings();
              this.renderSections(container);
            })
        );
      } else {
        setting.addExtraButton((button) =>
          button
            .setIcon("trash")
            .setTooltip(t("deleteSection"))
            .onClick(async () => {
              this.plugin.settings.daySections.splice(i, 1);
              await this.plugin.saveSettings();
              this.renderSections(container);
            })
        );
      }
    }
  }

  renderTemplatePreview(container: HTMLElement): void {
    container.empty();
    
    const t = this.t.bind(this);
    const weekStart = this.plugin.generator.getWeekStartDate();
    
    let preview = this.plugin.settings.reportsTitle + "\n\n";
    
    // Show first day as example
    const date = weekStart.clone();
    // Set locale based on settings
    date.locale(this.plugin.settings.language === "ja" ? "ja" : "en");
    const dateHeading = date.format(this.plugin.settings.dayDateFormat);
    
    preview += `${dateHeading}\n\n`;
    
    for (const section of this.plugin.settings.daySections) {
      if (section.enabled === false) continue;
      
      preview += `${section.heading}\n`;
      if (section.id === "schedule") {
        preview += t("scheduleExample") + "\n";
      }
      preview += "\n";
    }
    
    preview += "---\n\n";
    preview += t("otherDaysSame") + "\n\n";
    preview += this.plugin.settings.summaryTitle + "\n" + this.plugin.settings.summaryContent;
    
    const preEl = container.createEl("pre", { cls: "template-preview-code" });
    preEl.createEl("code", { text: preview });
  }
}
