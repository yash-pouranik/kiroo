<div align="center">
  <img src="./kiroo_banner.png" alt="Kiroo Banner" width="100%">

  # 🦏 KIROO
  ### **Version Control for API Interactions**
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-green.svg)](https://nodejs.org/)
  [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

  **Record, Replay, Snapshot, and Diff your APIs just like Git handles code.**

  [Installation](#-installation) • [Quick Start](#-quick-start) • [Key Features](#-core-capabilities) • [Why Kiroo?](#-why-kiroo)

</div>

---

## 📖 What is Kiroo?

Kiroo is **Version Control for API Interactions**. It treats your requests and responses as first-class, versionable artifacts that live right alongside your code in your Git repository.

Stop copy-pasting JSON into Postman. Stop losing your API history. Start versioning it. 🚀

---

## 🕸️ Visual Dependency Graph (`kiroo graph`)

Kiroo doesn't just record requests; it understands the **relationships** between them. 
- **Auto-Tracking**: Kiroo tracks variables created via `--save` and consumed via `{{key}}`.
- **Insight**: Instantly see how data flows from your `/login` to your `/profile` and beyond.

---

## 📊 Insights & Performance Dashboard (`kiroo stats`)

Monitor your API's health directly from your terminal.
- **Success Rates**: Real-time 2xx/4xx/5xx distribution.
- **Performance**: Average response times across all interactions.
- **Bottlenecks**: Automatically identifies your top 5 slowest endpoints.

---

## 🔌 Instant cURL Import (`kiroo import`)

Coming from a browser? Don't type a single header.
- **Copy-Paste Magic**: Just `Copy as cURL` from Chrome/Firefox and run `kiroo import`.
- **Clean Parsing**: Automatically handles multi-line commands, quotes, and complex flags.

---

## ✨ Features that WOW

### 🟢 **Git-Native Testing**
Capture a **Snapshot** of your entire API state and compare versions to detect breaking changes instantly.
```bash
kiroo snapshot save v1-stable
# ... make changes ...
kiroo snapshot compare v1-stable current
```

### 🌍 **Variable Chaining**
Chain requests like a pro. Save a token from one response and inject it into the next.
```bash
kiroo post /login --save jwt=data.token
kiroo get /users -H "Authorization: Bearer {{jwt}}"
```

### ⌨️ **Shorthand JSON Parser**
Forget escaping quotes. Type JSON like a human.
```bash
kiroo post /api/user -d "name=Yash email=yash@kiroo.io role=admin"
```

---

## 🚀 Quick Start

### 1. Installation
```bash
npm install -g kiroo
```

### 2. Initialization
```bash
kiroo init
```

### 3. Record Your First Request
```bash
kiroo get https://api.github.com/users/yash-pouranik
```

---

## 🛠️ Command Reference

| Command | Description | Example |
| :--- | :--- | :--- |
| `kiroo get/post/...` | Execute and record a request | `kiroo get /users` |
| `kiroo list` | View your interaction history | `kiroo list -n 20` |
| `kiroo replay <id>` | Re-run a specific interaction | `kiroo replay 2026-03...` |
| `kiroo graph` | Show visual dependency map | `kiroo graph` |
| `kiroo stats` | Show performance dashboard | `kiroo stats` |
| `kiroo import` | Import from cURL command | `kiroo import` |
| `kiroo snapshot` | Manage API snapshots | `kiroo snapshot save v1` |
| `kiroo env` | Manage environments & vars | `kiroo env use prod` |
| `kiroo clear` | Wipe interaction history | `kiroo clear --force` |

---

## 🤝 Contributing

Kiroo is an open-source project and we love contributions! Check out our [Contribution Guidelines](CONTRIBUTING.md).

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<div align="center">
  Built with ❤️ for Developers by <a href="https://github.com/yash-pouranik">Yash Pouranik</a>
</div>
