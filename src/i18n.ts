export const i18n = {
  ja: {
    // Settings sections
    generalSettings: "⚙️ 一般設定",
    integrationSettings: "🔗 外部連携設定",
    weekSettings: "📆 週の設定",
    pathSettings: "📁 パス設定",
    templateSettings: "📄 テンプレート設定",
    memoSettings: "✏️ メモ設定",
    
    // General settings
    language: "表示言語",
    languageDesc: "設定画面の表示言語",
    layoutMode: "レイアウトモード",
    layoutModeDesc: "サイドバーのレイアウトを選択",
    layoutTwoPanel: "2パネル（Schedule + Task/Memo）",
    layoutThreePanel: "3パネル縦分割",
    layoutThreePanelHorizontal: "3パネル横分割",
    layoutTPanel: "T字レイアウト（Schedule上 + Task/Memo下）",
    
    // Integration settings
    calendarIcsUrl: "カレンダー ICS URL",
    calendarIcsUrlDesc: "カレンダーの ICS URL（秘密のアドレス）。Google カレンダー、Outlook 等に対応。",
    excludeEventPatterns: "除外するイベント名（正規表現）",
    excludeEventPatternsDesc: "除外したいイベントの正規表現を改行区切りで入力してください。<br>（例: ^昼休憩$, .*飲み会$）",
    
    // General settings - URL conversion
    saveLinksToMarkdown: "URLをMarkdownリンクに変換",
    saveLinksToMarkdownDesc: "貼り付けたURLのタイトルを自動取得し [タイトル](URL) 形式に変換",
    
    // Week settings
    weekStartDay: "週の開始曜日",
    weekStartDayDesc: "週報の開始曜日を選択",
    
    // Path settings
    weeknoteFileFormat: "週報ファイルパス",
    weeknoteFileFormatDesc: "フォルダパスとファイル名を指定。<br>※YYやMMなどの日付フォーマットを使用する場合は[]で囲んでください。<br>例: 01.Weeknote/[YYYY]/[MM]/[YYYY]-[MM]-[DD]",
    
    // Template settings
    resetToDefault: "デフォルトに戻す",
    resetToDefaultDesc: "テンプレート設定をデフォルト値に戻します",
    reportsSection: "レポートセクション",
    title: "タイトル",
    reportsTitleDesc: "週報の先頭に表示する見出し",
    daySection: "日毎セクション",
    dayDateFormat: "日付表示のフォーマット",
    dayDateFormatDesc: "各日の見出しフォーマット（moment.js形式）。<br>例: ## MM-DD (ddd)",
    daySectionItems: "日毎セクション内の項目",
    addSection: "+ セクションを追加",
    summarySection: "サマリーセクション",
    summaryTitle: "サマリー見出し",
    summaryTitleDesc: "週報の末尾に表示するサマリーの見出し",
    
    // Preview
    previewDate: "日付",
    previewSchedule: "スケジュール",
    previewTasks: "タスク",
    previewMemo: "メモ",
    previewSummary: "サマリー",
    scheduleExample: "- [ ] 10:00 ミーティングA",
    otherDaysSame: "... (他の日も同様)",
    templatePreview: "テンプレートプレビュー",
    show: "表示",
    hide: "隠す",
    
    // Day section items
    calendarSchedule: "カレンダースケジュール",
    calendarScheduleDesc: "カレンダーのイベントが自動挿入されます",
    tasks: "タスク",
    memo: "メモ",
    memoDesc: "ひとことメモの保存先",
    newItem: "新しいアイテム",
    headingPlaceholder: "### 見出し",
    moveUp: "上に移動",
    moveDown: "下に移動",
    toggleVisibility: "表示/非表示",
    showSection: "表示する",
    hideSection: "非表示にする",
    deleteSection: "削除",
    
    // Memo settings
    insertSection: "挿入先セクション",
    insertSectionDesc: "日毎セクション内の「メモ」の見出しと連動しています",
    placeholder: "プレースホルダー",
    placeholderDesc: "入力欄に表示するヒントテキスト",
    saveButtonLabel: "投稿ボタンのラベル",
    saveButtonLabelDesc: "投稿ボタンに表示するテキスト",
    timestampFormat: "タイムスタンプ形式",
    timestampFormatDesc: "moment.js形式（例: YYYY-MM-DD HH:mm:ss, HH:mm）",
    
    // Sidebar view
    weeknoteManager: "週報マネージャー",
    weekOf: "週",
    createReport: "週報作成",
    openReport: "週報を開く",
    today: "今日",
    thisWeek: "今週",
    quickMemo: "✏️ ひとことメモ",
    todayMemos: "📝 今日のメモ",
    noMemos: "今日のメモはありません",
    noSchedule: "今日のスケジュールはありません",
    
    // Notices
    creatingReport: "週報を作成中...",
    reportCreated: "週報を作成しました",
    reportCreateFailed: "週報の作成に失敗しました",
    reportNotFound: "今週の週報が見つかりません。「週報を作成」ボタンで作成してください。",
    enterText: "テキストを入力してください",
    saveFailed: "保存に失敗しました",
    loadMemoFailed: "メモを読み込めませんでした",
    scheduleReloaded: "スケジュールを更新しました",
    scheduleReloadFailed: "スケジュールの更新に失敗しました",
    

    
    // Sidebar UI
    scheduleView: "📅 スケジュール",
    taskView: "☑️ タスク",
    taskViewLabel: "タスク",
    memoView: "✏️ メモ",
    memoViewLabel: "メモ",
    copyFrom: "コピー元:",
    previousDay: "前日",
    twoDaysAgo: "2日前",
    threeDaysAgo: "3日前",
    lastMonday: "先週の月曜",
    lastTuesday: "先週の火曜",
    lastWednesday: "先週の水曜",
    lastThursday: "先週の木曜",
    lastFriday: "先週の金曜",
    lastSaturday: "先週の土曜",
    lastSunday: "先週の日曜",
    addTask: "タスク追加",
    edit: "編集",
    delete: "削除",
    openLink: "外部リンク",
    
    // Help panel (Task)
    helpTitle: "キーボード操作",
    // No selection
    helpNoSelection: "カード未選択時",
    helpArrowSelect: "カードを選択",
    // With selection
    helpWithSelection: "カード選択時",
    helpArrowMove: "選択対象移動",
    helpShiftArrow: "カード順序入替",
    helpShiftIndent: "インデント変更",
    helpShiftDelete: "カード削除",
    helpEnterEdit: "編集モードへ",
    helpEsc: "選択解除",
    // Editing
    helpEditing: "編集中",
    helpEnterSave: "保存",
    helpEscCancel: "キャンセル",
    
    // Help panel (Memo)
    memoHelpTitle: "キーボード操作",
    // Unfocused
    memoHelpUnfocused: "未フォーカス時",
    memoHelpEnterFocus: "メモ入力モードへ",
    memoHelpEscUnfocus: "フォーカス解除",
    // Memo input mode
    memoHelpInputMode: "メモ入力モード時",
    memoHelpEnterAdd: "メモの追加",
    memoHelpEscCancel: "キャンセル",
    memoHelpShiftTabToCard: "メモカードへ移動",
    // Card selected
    memoHelpCardSelected: "メモカード選択時",
    memoHelpEnterEdit: "編集モードへ",
    memoHelpDelete: "メモ削除",
    memoHelpEscToInput: "メモ入力モードへ",
    memoHelpTabMove: "メモカードの移動",
    
    // Support message
    supportMessage: "このプラグインを気に入っていただけたら、チップで応援お願いします！",
    
    // Days of week
    days: ["日", "月", "火", "水", "木", "金", "土"],
    
    // GitHub Link settings
    githubLinkSettings: "GitHub Link",
    githubAuthDesc: "認証トークンによりプライベートリポジトリへのアクセスとレート制限の緩和が可能になります。",
    githubAccounts: "GitHub アカウント",
    addGithubAccount: "GitHub アカウントを追加",
    add: "追加",
    defaultAccount: "デフォルトアカウント",
    defaultAccountDesc: "組織が一致しない場合に使用されます。",
    clearCache: "キャッシュをクリア",
    accountName: "アカウント名",
    required: "必須",
    orgsAndUsers: "組織とユーザー",
    orgsAndUsersDesc: "このアカウントを使用するGitHub組織とユーザーをカンマ区切りで入力（任意）",
    useCustomOAuth: "カスタムOAuthアプリを使用",
    useCustomOAuthDesc: "カスタムOAuthアプリでより細かい制御と大きなレート制限が可能です。",
    token: "トークン",
    tokenDesc: "GitHubトークン。自動生成（推奨）または個人アクセストークンを手動入力。",
    generateToken: "トークン生成",
    tokenPlaceholder: "Personal Access Token / OAuth Token",
    saveAccount: "アカウントを保存",
    deleteAccount: "アカウントを削除",
    cancel: "キャンセル",
    clientIdPlaceholder: "Client ID",
    cacheCleared: "GitHubリンクキャッシュから{count}件のアイテムを削除しました。",
  },
  en: {
    // Settings sections
    generalSettings: "⚙️ General Settings",
    integrationSettings: "🔗 Integration Settings",
    weekSettings: "📆 Week Settings",
    pathSettings: "📁 Path Settings",
    templateSettings: "📄 Template Settings",
    memoSettings: "✏️ Memo Settings",
    
    // General settings
    language: "Language",
    languageDesc: "Display language for settings",
    layoutMode: "Layout mode",
    layoutModeDesc: "Choose sidebar layout style",
    layoutTwoPanel: "2-panel (Schedule + Task/Memo)",
    layoutThreePanel: "3-panel vertical",
    layoutThreePanelHorizontal: "3-panel horizontal",
    layoutTPanel: "T-layout (Schedule top + Task/Memo bottom)",
    
    // Integration settings
    calendarIcsUrl: "Calendar ICS URL",
    calendarIcsUrlDesc: "Calendar ICS URL (secret address). Supports Google Calendar, Outlook, etc.",
    excludeEventPatterns: "Exclude event patterns (regex)",
    excludeEventPatternsDesc: "Enter regular expressions of events to exclude, one per line.<br>(e.g., ^Lunch Break$, .*Party$)",
    
    // General settings - URL conversion
    saveLinksToMarkdown: "Convert URLs to markdown links",
    saveLinksToMarkdownDesc: "Automatically fetch title for pasted URLs and convert to [Title](URL)",
    
    // Week settings
    weekStartDay: "Week start day",
    weekStartDayDesc: "Select the starting day of the week",

    
    // Path settings
    weeknoteFileFormat: "Weeknote file path",
    weeknoteFileFormatDesc: "Folder path and filename.<br>Note: Wrap date formats (YY, MM, etc.) in [].<br>Ex: 01.Weeknote/[YYYY]/[MM]/[YYYY]-[MM]-[DD]",
    
    // Template settings
    resetToDefault: "Reset to default",
    resetToDefaultDesc: "Reset template settings to default values",
    reportsSection: "Reports section",
    title: "Title",
    reportsTitleDesc: "Heading displayed at the top of the report",
    daySection: "Daily section",
    dayDateFormat: "Date format",
    dayDateFormatDesc: "Date heading format (moment.js format).<br>Ex: ## MM-DD (ddd)",
    daySectionItems: "Daily section items",
    addSection: "+ Add section",
    summarySection: "Summary section",
    summaryTitle: "Summary title",
    summaryTitleDesc: "Heading for the summary section at the bottom",

    // Preview
    previewDate: "Date",
    previewSchedule: "Schedule",
    previewTasks: "Tasks",
    previewMemo: "Memo",
    previewSummary: "Summary",
    scheduleExample: "- [ ] 10:00 Event A",
    otherDaysSame: "... (Other days follow same format)",
    templatePreview: "Template preview",
    show: "Show",
    hide: "Hide",
    
    // Day section items
    calendarSchedule: "Calendar schedule",
    calendarScheduleDesc: "Calendar events are auto-inserted here",
    tasks: "Tasks",
    memo: "Memo",
    memoDesc: "Memo save location",
    newItem: "New item",
    headingPlaceholder: "### heading",
    moveUp: "Move up",
    moveDown: "Move down",
    toggleVisibility: "Toggle visibility",
    showSection: "Show",
    hideSection: "Hide",
    deleteSection: "Delete",
    
    // Memo settings
    insertSection: "Insert section",
    insertSectionDesc: "Linked to the 'Memo' heading in daily section items",
    placeholder: "Placeholder",
    placeholderDesc: "Hint text displayed in input field",
    saveButtonLabel: "Post button label",
    saveButtonLabelDesc: "Text displayed on post button",
    timestampFormat: "Timestamp format",
    timestampFormatDesc: "moment.js format (e.g., YYYY-MM-DD HH:mm:ss, HH:mm)",
    
    // Sidebar view
    weeknoteManager: "Weeknote",
    weekOf: "Week of",
    createReport: "Create report",
    openReport: "Open report",
    today: "Today",
    thisWeek: "This week",
    quickMemo: "✏️ Memo",
    todayMemos: "📝 Today's memos",
    noMemos: "No memos for today",
    noSchedule: "No schedule for today",
    
    // Notices
    creatingReport: "Creating report...",
    reportCreated: "Report created",
    reportCreateFailed: "Failed to create report",
    reportNotFound: "This week's report not found. Click 'Create report' to create one.",
    enterText: "Please enter text",
    saveFailed: "Failed to save",
    loadMemoFailed: "Failed to load memos",
    scheduleReloaded: "Schedule reloaded",
    scheduleReloadFailed: "Failed to reload schedule",
    
    // Sidebar UI
    scheduleView: "📅 Schedule",
    taskView: "☑️ Task",
    taskViewLabel: "Task",
    memoView: "✏️ Memo",
    memoViewLabel: "Memo",
    copyFrom: "Copy from:",
    previousDay: "Previous day",
    twoDaysAgo: "2 days ago",
    threeDaysAgo: "3 days ago",
    lastMonday: "Last Monday",
    lastTuesday: "Last Tuesday",
    lastWednesday: "Last Wednesday",
    lastThursday: "Last Thursday",
    lastFriday: "Last Friday",
    lastSaturday: "Last Saturday",
    lastSunday: "Last Sunday",
    addTask: "Add task",
    edit: "Edit",
    delete: "Delete",
    openLink: "Open link",
    
    // Help panel (Task)
    helpTitle: "Keyboard shortcuts",
    // No selection
    helpNoSelection: "No card selected",
    helpArrowSelect: "Select card",
    // With selection
    helpWithSelection: "Card selected",
    helpArrowMove: "Move selection",
    helpShiftArrow: "Reorder card",
    helpShiftIndent: "Change indent",
    helpShiftDelete: "Delete card",
    helpEnterEdit: "Enter edit mode",
    helpEsc: "Deselect",
    // Editing
    helpEditing: "Editing",
    helpEnterSave: "Save",
    helpEscCancel: "Cancel",
    
    // Help panel (Memo)
    memoHelpTitle: "Keyboard shortcuts",
    // Unfocused
    memoHelpUnfocused: "Unfocused",
    memoHelpEnterFocus: "Enter memo input mode",
    memoHelpEscUnfocus: "Remove focus",
    // Memo input mode
    memoHelpInputMode: "Memo input mode",
    memoHelpEnterAdd: "Add memo",
    memoHelpEscCancel: "Cancel",
    memoHelpShiftTabToCard: "Move to memo card",
    // Card selected
    memoHelpCardSelected: "Memo card selected",
    memoHelpEnterEdit: "Enter edit mode",
    memoHelpDelete: "Delete memo",
    memoHelpEscToInput: "Back to input mode",
    memoHelpTabMove: "Navigate memo cards",
    
    // Support message
    supportMessage: "If you enjoy this plugin, please consider supporting with a tip!",
    
    // Days of week
    days: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    
    // GitHub Link settings
    githubLinkSettings: "GitHub Link",
    githubAuthDesc: "Authentication token allows referencing private repos and increases rate limits.",
    githubAccounts: "GitHub accounts",
    addGithubAccount: "Add GitHub account",
    add: "Add",
    defaultAccount: "Default account",
    defaultAccountDesc: "Used when no organization matches.",
    clearCache: "Clear cache",
    accountName: "Account name",
    required: "Required.",
    orgsAndUsers: "Orgs and users",
    orgsAndUsersDesc: "A comma separated list of the GitHub organizations and users this account should be used for. Optional.",
    useCustomOAuth: "Use custom OAuth app",
    useCustomOAuthDesc: "You can optionally provide your own OAuth app for more control and a larger request rate limit.",
    token: "Token",
    tokenDesc: "A GitHub token, which can be generated automatically (recommended) or by creating a personal access token.",
    generateToken: "Generate token",
    tokenPlaceholder: "Personal Access Token / OAuth Token",
    saveAccount: "Save account",
    deleteAccount: "Delete account",
    cancel: "Cancel",
    clientIdPlaceholder: "Client ID",
    cacheCleared: "Removed {count} stored items from GitHub Link cache.",
  },
};

export type I18nKey = keyof typeof i18n.ja;

let currentLanguage: "ja" | "en" = "ja";

export function setLanguage(lang: "ja" | "en") {
  currentLanguage = lang;
}

export function t(key: I18nKey): string {
  // @ts-ignore
  return i18n[currentLanguage][key] || i18n["en"][key] || key;
}
