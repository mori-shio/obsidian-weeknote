[日本語版はこちら](./README.ja.md)

# Weeknote Plugin for Obsidian

Efficiently manage your weekly reports with this Obsidian plugin.  
It provides an integrated tool for managing tasks, notes, and Google Calendar events in a weekly format.

## ✨ Features

### 📅 Weeknote View
- **Calendar Navigation**: Browse through weeks easily.
- **Daily Tabs**: Switch between days with a Chrome-like tab interface.
- **Layout Selection**: Choose from 2-panel, 3-panel, 3-panel horizontal, or T-panel layouts.

### 📋 Task Management
- **Checklists**: Track the completion status of your tasks.
- **Hierarchical Support**: Manage subtasks with indentation.
- **Keyboard Navigation**: Select with arrow keys, reorder or change indentation with Shift + arrow keys.
- **Quick Deletion**: Delete tasks with Shift + Delete.

### 📝 Quick Memo
- **Timstamped Memos**: Automatically record the time for each entry.
- **Rich Links**: Automatically converts URLs into Markdown links with titles.
- **GitHub Integration**: Displays GitHub Issue/PR links as rich tags.

### 📆 Google Calendar Integration
- **ICS URL Support**: Sync with your Google Calendar via secret ICS URL.
- **Auto Schedule**: Automatically display events for the selected day.
- **Event Filters**: Exclude specific events using regular expressions.

### 🔗 GitHub Integration
- **Personal Access Token Auth**: Load your private/public GitHub Issues and PRs.
- **Rich Tag Display**: Visual tags for Issues and PRs for better readability.
- **Auto Link Conversion**: Paste a GitHub URL to automatically fetch its title.

## 📥 Installation

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release.
2. Create a `weeknote` folder in your Obsidian plugins directory:
   - macOS: `~/Library/Application Support/Obsidian/Vault/.obsidian/plugins/weeknote/`
   - Windows: `%APPDATA%\Obsidian\Vault\.obsidian\plugins\weeknote\`
3. Copy the downloaded files into that folder.
4. Restart Obsidian and enable "Weeknote" under Settings → Community plugins.

## ⚙️ Settings

### Week Settings
- **Week Start Day**: Choose Monday or Sunday as the start of your week.

### Path Settings
- **Save Folder**: Specify the path where weeknote files will be saved.
- **Filename Format**: Customize the filename using Moment.js tokens.

### Calendar Integration
- **Google Calendar ICS URL**: Set your calendar's secret address.
- **Exclude Patterns**: Filter out specific events using regex.

### GitHub Integration
- **Personal Access Token**: Set your GitHub PAT.
- **API Cache Duration**: Set how long to cache API responses.

### Memo Settings
- **Timestamp Format**: Customize using Moment.js tokens.
- **Placeholder**: Hint text for the memo input field.
- **Post Button Label**: Customize the text on the post button.
- **Auto-link URLs**: Automatically convert pasted URLs to Markdown links.

## 🖥️ Keyboard Shortcuts

### Task Operations
| Key | Action |
|------|------|
| `↑` / `↓` | Select task |
| `Shift + ↑/↓` | Reorder task |
| `Shift + ←/→` | Change indentation level |
| `Enter` | Enter edit mode |
| `Shift + Delete` | Delete task |
| `Escape` | Deselect |

### Memo Operations
| Key | Action |
|------|------|
| `Enter` | Post memo / Save edit |
| `Shift + Tab` | Move to card selection |
| `Tab` | Navigate between cards |
| `Delete` | Delete selected memo |
| `Escape` | Deselect |

## 🔧 Development

### Build

```bash
npm install
npm run build
```

### Dev Mode

```bash
npm run dev
```

## 📄 License

MIT License

## 🤝 Contributions

Issues and Pull Requests are welcome!
