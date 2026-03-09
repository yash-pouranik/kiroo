# Kiroo

> Git for API interactions. Record, replay, snapshot, and diff your APIs.

**Status:** 🚧 Day 1 MVP in progress

## Quick Start

```bash
# Install
npm install -g kiroo

# Initialize
kiroo init

# Make requests (auto-recorded)
kiroo POST https://api.example.com/login email=test@test.com password=secret

# List interactions
kiroo list

# More commands coming soon...
```

## What is Kiroo?

Kiroo treats API requests and responses as **versionable artifacts** — just like Git treats code.

Every interaction becomes a structured, reproducible, diff-able file that lives in your `.kiroo/` directory.

## Core Features (In Progress)

- [x] **HTTP Executor** — Fast request execution with auto-storage
- [x] **Interaction History** — All requests stored as Git-friendly JSON
- [x] **Pretty Output** — Beautiful terminal formatting
- [ ] **Replay Engine** — Coming Day 2
- [ ] **Snapshot System** — Coming Day 3
- [ ] **Dependency Graph** — Coming Day 4

## Why Kiroo?

**Problem:** Production bugs are hard to reproduce. API refactors break things silently.

**Solution:** Version your API interactions like code. Replay production traffic locally. Snapshot API behavior and diff changes.

## Comparison

| Capability | Postman | Bruno | **Kiroo** |
|------------|---------|-------|-----------|
| CLI-first | ❌ | ⚠️ | ✅ |
| Git-native | ❌ | ✅ | ✅ |
| Replay engine | ❌ | ❌ | ✅ (coming) |
| Snapshot testing | ❌ | ❌ | ✅ (coming) |

## Development Progress

**Day 1 (Today):** ✅ Core executor + storage  
**Day 2:** Replay engine  
**Day 3:** Snapshot + diff  
**Day 4:** Graph + flow engine  
**Day 5:** Polish  
**Day 6:** Docs + website  
**Day 7:** Demo video  

## License

MIT

---

Built for [Hackathon Name] by Yash Pouranik
