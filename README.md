# Kiroo 🚀

> **Version Control for API Interactions.** Record, Replay, Snapshot, and Diff your APIs just like Git handles code.

Kiroo treats your API requests and responses as versionable artifacts. Every interaction becomes a structured, reproducible file that stays right in your repository, making debugging and API testing seamless.

---

## 🏗️ Core Features

- **🔴 Auto-Recording**: Every request made through Kiroo is automatically saved with its response, status, and timing.
- **🔄 Replay Engine**: Instantly reproduce any past interaction. Compare the new response with the stored record to detect regressions.
- **📸 Snapshot System**: Bundle your API's current state into tagged snapshots.
- **🔍 Semantic Diffs**: Compare two snapshots to detect breaking changes (removed fields, status changes, or performance drops).
- **📟 Smart CLI**: Case-insensitive commands, smart type detection (Boolean/Numbers) for bodies, and paginated history.
- **🔗 Git-Native**: All data lives in `.kiroo/`—commit your API interactions alongside your source code.

---

## 🚀 Quick Start

### Installation

```bash
# Clone and link (while in development)
npm install
npm link
```

### Initialize Project

```bash
kiroo init
```

### Record Interactions

```bash
# Kiroo automatically detects types (Number/Boolean)
kiroo post https://api.your-app.com/v1/users -d "name=Yash age=25 isVerified=true"
```

### View History

```bash
kiroo list
```

---

## 🛠️ Advanced Usage

### Replay a Specific Request
```bash
kiroo replay <interaction-id>
```

### Snapshot & Diff Engine
```bash
# Save current state
kiroo snapshot save v1-beta

# ... after refactoring your backend ...

# Save new state
kiroo snapshot save v1-rc

# Detect breaking changes
kiroo snapshot compare v1-beta v1-rc
```

### Pagination
```bash
kiroo list --limit 5 --offset 10
```

---

## 🎯 Comparison

| Feature | Postman / Insomnia | Bruno | **Kiroo** |
| :--- | :---: | :---: | :---: |
| **CLI-First** | ❌ | ⚠️ | ✅ |
| **Git-Native** | ❌ | ✅ | ✅ |
| **Auto-Recording** | ❌ | ❌ | ✅ |
| **Built-in Replay** | ❌ | ❌ | ✅ |
| **Snapshot Testing** | ❌ | ❌ | ✅ |

---

## 📜 License

MIT © [Yash Pouranik](https://github.com/yash-pouranik)
