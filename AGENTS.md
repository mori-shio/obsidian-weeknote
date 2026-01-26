# Agent Instructions

This document contains instructions for AI agents working on this project.

## Release Notes Workflow

After completing a task, update the release notes based on the current branch name.

### Steps

1. **Check the current branch name**
   ```bash
   git branch --show-current
   ```

2. **Extract version from branch name**
   - Branch format: `release/X.Y.Z` or `feature/X.Y.Z-description`
   - Extract the version number (e.g., `1.1.3` from `release/1.1.3`)

3. **Update the corresponding release notes file**
   - File location: `docs/releases/vX.Y.Z.md`
   - If the file doesn't exist, create it using the template below

4. **Update CHANGELOG.md**
   - Add a brief summary entry to `/CHANGELOG.md` if not already present

### Release Notes Template

```markdown
# vX.Y.Z

📅 Released: YYYY-MM-DD

## ✨ New Features

- **Feature name** - Description of the feature

## 🔧 Improvements

- Improvement description

## 🐛 Bug Fixes

- Fix description

## 📝 Notes

- Breaking changes, migration notes, etc.
```

### Categories

| Emoji | Category | Description |
|-------|----------|-------------|
| ✨ | New Features | New functionality added |
| 🔧 | Improvements | Enhancements to existing functionality |
| 🐛 | Bug Fixes | Bug fixes |
| 📝 | Notes | Breaking changes, deprecations, migration notes |

### Example

For branch `release/1.1.3`:
1. Open/create `docs/releases/v1.1.3.md`
2. Add the completed feature/fix under the appropriate category
3. Update `CHANGELOG.md` with a summary line

## Other Instructions

- Build and deploy using the skill in `.agent/skills/build-deploy/SKILL.md`
- Respond to user in Japanese
- Think in English
