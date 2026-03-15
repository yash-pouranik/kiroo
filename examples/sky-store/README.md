# 🌌 SkyStore API: A Senior Architect's Playground

Welcome to the **SkyStore Migration Demo**. This scenario is designed to show how Kiroo handles **Structural Difts**, **Behavioral Risk**, and **Localized Errors** in real migration workflows.

## 🏗️ Scenario: "The Modernization Sprint"

Your company is moving from a flat, monolithic API (v1) to a modern, nested, and feature-rich architecture (v2). This migration introduces several subtle breaking changes that Kiroo is designed to catch.

### What is changing?
| Component | v1 (Stable) | v2 (Evolution) | Drift Type |
|-----------|-------------|----------------|------------|
| **Products** | `price: 4500` | `price: { amount: 4500, ... }` | **Structural (Breaking)** |
| **User** | `{ name: 'Yash', country: 'IN' }` | `{ profile: { name: 'Yash' }, preferences: { ... } }` | **Structural (Nesting)** |
| **Reviews** | `["Great!"]` | `[{ user: 'Alice', comment: 'Great!' }]` | **Type (Array Primitive to Object)** |
| **Search** | `[ { product1 }, { product2 } ]` | `{ results: [...], total: 2, ... }` | **Root Type Change** |
| **Checkout**| `200 OK` (Sync) | `202 Accepted` (Async) | **Behavioral Risk** |

---

## 🚀 Step 1: Initialize the Lab

1. **Start Backend**:
   ```bash
   cd examples/sky-store/backend
   npm install && node server.js
   ```

2. **Open Dashboard**:
   Open `examples/sky-store/frontend/index.html` in your browser.

---

## 🧪 Step 2: Record Stable State (v1)

Capture the baseline traffic. You can use the buttons in the dashboard or run:

```bash
kiroo get http://localhost:3000/api/v1/products
kiroo get http://localhost:3000/api/v1/user
kiroo get http://localhost:3000/api/v1/wishlist
kiroo get http://localhost:3000/api/v1/search?q=watch
kiroo snapshot save v1-stable
```

---

## 🧪 Step 3: Record Next-Gen State (v2)

Capture the updated API surface:

```bash
kiroo get http://localhost:3000/api/v2/products
kiroo get http://localhost:3000/api/v2/user
kiroo get http://localhost:3000/api/v2/search?q=watch
kiroo get http://localhost:3000/api/v2/notifications
kiroo snapshot save v2-staging
```

---

## 🧪 Step 4: The Comparison Magic

### 1. Structural Analysis (Lingo.dev)
Reveal exactly where the data moved:
```bash
kiroo snapshot compare v1-stable v2-staging --lang hi
```
*Observe: Kiroo flags the Price change, User nesting, and Search result wrapping.*

### 2. AI Blast Radius Analysis
Get an architectural review of the migration risks:
```bash
kiroo analyze v1-stable v2-staging --ai --lang hi
```
*Note: AI will warn about the 202 status on checkout and the impact of price object change on UI components.*

### 3. Localized Semantic Test
```bash
kiroo check http://localhost:3000/api/v2/checkout -m POST -d "productId=sky-3" --status 403 --lang es
```
*Observe how the logistics error is translated for global debugging.*

---

## 🔌 Pro Tip: Use the Proxy
Instead of typing commands, run the proxy and click the buttons on the dashboard!
```bash
kiroo proxy --target http://localhost:3000 --port 8080
```
*(Remember to update the fetch URL in index.html script to port 8080)*
