# Weeknote Plugin for Obsidian

週次レポートを効率的に管理するためのObsidianプラグインです。  
Google Calendar連携、タスク管理、メモ機能を備えた統合週報管理ツールを提供します。

## ✨ 機能

### 📅 週報ビュー
- **カレンダーナビゲーション**: 週単位でのブラウジング
- **日別タブ**: Chrome風のタブインターフェースで曜日を切り替え
- **レイアウト選択**: 2パネル/3パネル/横並び3パネル/T字パネルから選択可能

### 📋 タスク管理
- **チェックリスト**: タスクの完了状態をトラッキング
- **階層化対応**: インデントでサブタスクを管理
- **キーボード操作**: 矢印キーで選択、Shift+矢印で移動/インデント変更
- **ドラッグ&ドロップ風操作**: Shift+Delete で削除

### 📝 クイックメモ
- **タイムスタンプ付きメモ**: 自動的に時刻を記録
- **リッチリンク対応**: URLを貼り付けると自動でMarkdownリンクに変換
- **GitHub連携**: Issue/PRリンクをリッチなタグ表示

### 📆 Google Calendar連携
- **ICS URL対応**: Googleカレンダーの秘密URLで同期
- **自動スケジュール表示**: 選択日の予定を自動表示
- **イベント除外フィルター**: 正規表現でイベントを除外可能

### 🔗 GitHub連携
- **Personal Access Token認証**: GitHubのIssue/PRを読み込み
- **リッチタグ表示**: Issue/PRを見やすいタグで表示
- **自動リンク変換**: タスクやメモにGitHub URLを貼ると自動でタイトルを取得

## 📥 インストール

### 手動インストール

1. リリースから `main.js`, `manifest.json`, `styles.css` をダウンロード
2. Obsidianのプラグインフォルダに `weeknote` ディレクトリを作成
   - macOS: `~/Library/Application Support/Obsidian/Vault/.obsidian/plugins/weeknote/`
   - Windows: `%APPDATA%\Obsidian\Vault\.obsidian\plugins\weeknote\`
3. ダウンロードしたファイルをコピー
4. Obsidianを再起動し、設定 → コミュニティプラグインからWeeknoteを有効化

## ⚙️ 設定

### 週の設定
- **週の開始日**: 月曜日または日曜日を選択

### パス設定
- **保存フォルダ**: 週報ファイルの保存先パス
- **ファイル名形式**: Moment.js形式でカスタマイズ可能

### カレンダー連携
- **Google Calendar ICS URL**: カレンダーの秘密アドレスを設定
- **除外パターン**: 正規表現でイベントをフィルター

### GitHub連携
- **Personal Access Token**: GitHubのPATを設定
- **APIキャッシュ期間**: APIレスポンスのキャッシュ時間

### メモ設定
- **タイムスタンプ形式**: Moment.js形式でカスタマイズ
- **プレースホルダー**: 入力欄のプレースホルダーテキスト
- **保存ボタンラベル**: ボタンのテキストをカスタマイズ
- **URLの自動リンク化**: URLを自動でMarkdownリンクに変換

## 🖥️ キーボードショートカット

### タスク操作
| キー | 動作 |
|------|------|
| `↑` / `↓` | タスク選択 |
| `Shift + ↑/↓` | タスクの順序変更 |
| `Shift + ←/→` | インデントレベル変更 |
| `Enter` | 編集モード |
| `Shift + Delete` | タスク削除 |
| `Escape` | 選択解除 |

### メモ操作
| キー | 動作 |
|------|------|
| `Enter` | メモを投稿 / 編集確定 |
| `Shift + Tab` | カード選択に移動 |
| `Tab` | 次のカードへ移動 |
| `Delete` | 選択したメモを削除 |
| `Escape` | 選択解除 |

## 🔧 開発

### ビルド

```bash
npm install
npm run build
```

### 開発モード

```bash
npm run dev
```

## 📄 ライセンス

MIT License

## 🤝 コントリビューション

Issue報告やPull Requestは歓迎します。
