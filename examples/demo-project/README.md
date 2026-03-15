# 🦏 Kiroo Demo Project

This is a professional **Deployment Tracker & Project Manager** API used to demonstrate the power of Kiroo.

## 🚀 Setup

1. **Install Dependencies**:
   ```bash
   cd examples/demo-project/backend
   npm install express cors
   ```

2. **Start the Server**:
   ```bash
   node server.js
   ```

3. **Open the Dashboard**:
   Open `examples/demo-project/frontend/index.html` in your browser.

---

## 🧪 Testing with Kiroo

### 1. The Proxy Demo (Capture Traffic)
Run Kiroo Proxy to capture traffic from the dashboard:
```bash
kiroo proxy --target http://localhost:3000 --port 8080
```
*Now, open the dashboard and change the fetch URL in code to port 8080, or just use the CLI commands below.*

### 2. Snapshot Comparison (The Breaking Change)
Observe how Kiroo detects contract drift between v1 and v2.

**Step A: Capture v1**
```bash
kiroo get http://localhost:3000/api/v1/projects
kiroo get http://localhost:3000/api/v1/deployments
kiroo snapshot save state-v1
```

**Step B: Capture v2**
```bash
kiroo get http://localhost:3000/api/v2/projects
kiroo get http://localhost:3000/api/v2/deployments
kiroo snapshot save state-v2
```

**Step C: Compare & Transate**
```bash
kiroo snapshot compare state-v1 state-v2 --lang hi
```

### 3. AI Blast Radius Analysis
Get a senior architect's summary of the changes:
```bash
kiroo analyze state-v1 state-v2 --ai --lang hi
```

### 4. Smart Suggestions
Make a intentional typo to see Kiroo's self-correction:
```bash
kiroo statz
```

---

## 📦 What's inside?
- **v1**: Uses `author` field for projects.
- **v2**: Renames `author` to `owner` (Breaking Change).
- **v2**: Flattens the `status` object into a string (Structural Change).
- **v2**: Adds `/api/v2/logs` (New Feature).
