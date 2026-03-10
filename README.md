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

## 📖 Introduction

Kiroo treats your API requests and responses as **first-class versionable artifacts**. 

Ever had a production bug that worked fine on your machine? Ever refactored a backend only to find out you broke a critical field 3 days later? Kiroo solves this by letting you **store API interactions in your repository**.

Every interaction is a structured, reproducibility-focused JSON file that lives in your `.kiroo/` directory.

---

## ✨ Core Capabilities

### 🔴 **Auto-Recording**
Every request made through Kiroo is automatically saved. No more manual exports from Postman.
```bash
kiroo post {{baseUrl}}/users -d "name=Yash email=yash@example.com"
```

### 🔄 **Replay Engine**
Re-run any past interaction instantly and see if the backend behavior has changed.
```bash
kiroo replay <interaction-id>
```

### 🌍 **Smart Environments & Variables**
Stop copy-pasting tokens. Chain requests together dynamically.
```bash
# Save a token from login
kiroo post /login --save token=data.accessToken

# Use it in the next request
kiroo get /profile -H "Authorization: Bearer {{token}}"
```

### 📸 **Snapshot System & Diff Engine**
Capture the "Status Quo" of your API and detect **Breaking Changes** during refactors.
```bash
# Before refactor
kiroo snapshot save v1-stable

# After refactor
kiroo snapshot compare v1-stable current
```

---

## 🚀 Quick Start

### 1. Installation
```bash
# Clone the repo
git clone https://github.com/yash-pouranik/kiroo.git
cd kiroo

# Install and link
npm install
npm link
```

### 2. Initialize
```bash
kiroo init
```

### 3. Basic Request
```bash
kiroo env set baseUrl http://localhost:3000
kiroo get {{baseUrl}}/health
```

---

## 🛠️ Advanced Workflows

### Nested Data Support
Kiroo's shorthand parser understands nested objects and arrays:
```bash
kiroo put /products/1 -d "reviews[0].stars=5 metadata.isFeatured=true"
```

### Managing Environments
```bash
kiroo env use prod
kiroo env list
```

---

## 🎯 Comparison

| Feature | Postman / Insomnia | Bruno | **Kiroo** |
| :--- | :---: | :---: | :---: |
| **CLI-First** | ❌ | ⚠️ | ✅ |
| **Git-Native** | ❌ | ✅ | ✅ |
| **Auto-Recording** | ❌ | ❌ | ✅ |
| **Built-in Replay** | ❌ | ❌ | ✅ |
| **Variable Chaining** | ⚠️ | ⚠️ | ✅ |

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<div align="center">
  Built with ❤️ for Developers by <a href="https://github.com/yash-pouranik">Yash Pouranik</a>
</div>
