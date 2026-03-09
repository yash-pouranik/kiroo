# kiroo - Problem Statement & Solution

**Hackathon Submission Document**  
**Category:** Developer Tools / API Infrastructure  
**Date:** March 1-7, 2026

---

## 🎯 Problem Statement

### The Current Reality

Modern backend development involves increasingly complex API interactions:

- **Multi-step workflows** (login → token → profile → checkout → payment)
- **Stateful operations** (JWT tokens, refresh flows, session cookies)
- **Environment dependencies** (local, staging, production configurations)
- **Frequent changes** (API refactors, schema updates, breaking changes)
- **Production incidents** (bugs that only occur in prod, hard to reproduce)

### Pain Points Developers Face Daily

#### 1. **"Works on My Machine" Syndrome**
```
Developer A: "API is broken!"
Developer B: "Works fine for me..."
[30 minutes of debugging to find environment difference]
```

**Root Cause:** No deterministic way to capture and replay exact API interactions across environments.

#### 2. **Silent Breaking Changes**
```
// Before refactor
GET /users → { id, name, email }

// After refactor  
GET /users → { id, name }  // email removed!

Frontend breaks in production. No early warning.
```

**Root Cause:** No systematic way to snapshot API behavior and detect contract changes.

#### 3. **Production Bug Black Hole**
```
User reports: "Payment failed with 500 error"
Logs show: POST /checkout → 500
Developer: "Can't reproduce locally..."
```

**Root Cause:** Production traffic can't be captured and replayed in development.

#### 4. **API Relationship Confusion**
```
"Which endpoints depend on the login token?"
"What breaks if I change /profile response?"
"What's the call sequence for checkout flow?"
```

**Root Cause:** No visibility into API dependency graphs from real usage.

---

## 🚫 Why Existing Tools Fall Short

### Postman / Insomnia / Bruno
**What they do:** Request management, collections, testing  
**What they don't do:**
- ❌ Version interactions like Git commits
- ❌ Deterministic replay of production traffic
- ❌ Snapshot-based contract testing
- ❌ Dependency graph generation

**Philosophy:** Tools for *creating* requests, not *versioning* interactions.

### Newman / Postman CLI
**What they do:** Run pre-defined test collections  
**What they don't do:**
- ❌ Record real API interactions
- ❌ Compare snapshots across time
- ❌ Replay production incidents

**Philosophy:** Test runners, not interaction recorders.

### VCR (Ruby) / Polly.JS
**What they do:** HTTP mocking for tests  
**What they don't do:**
- ❌ CLI-first workflow
- ❌ Git-native storage format
- ❌ Cross-language support
- ❌ Production traffic capture

**Philosophy:** Test fixtures, not operational tools.

### Pact / Spring Cloud Contract
**What they do:** Consumer-driven contract testing  
**What they don't do:**
- ❌ Lightweight enough for solo developers
- ❌ Work without complex DSL/setup
- ❌ Support ad-hoc debugging workflows

**Philosophy:** Enterprise-grade testing frameworks, not developer utilities.

---

## ✅ Our Solution: kiroo

### Core Concept

> **"Git for API Interactions"**

kiroo treats API requests and responses as **first-class, versionable artifacts** — just like Git treats code.

Every interaction becomes a structured, reproducible, diff-able file that lives in your repository.

### The kiroo Workflow

```bash
# 1. Execute requests (stores interaction automatically)
$ kiroo POST https://api.example.com/login \
    email=admin@test.com password=secret

✅ 200 OK (142ms)
💾 Saved: .kiroo/interactions/2026-03-01T12-01-22.json

# 2. Snapshot current API behavior
$ kiroo snapshot save before-refactor

📸 Snapshot saved: before-refactor (15 interactions)

# 3. Make code changes, run again
$ kiroo snapshot save after-refactor

# 4. Detect breaking changes instantly
$ kiroo snapshot compare before-refactor after-refactor

⚠️  Breaking Changes Detected:

  GET /users/{id}
    Status: 200 → 404
    Field removed: "email"
    Field type changed: createdAt (string → number)

  Performance:
    Avg latency: +38ms
```

---

## 🏗️ Architecture

### File Structure

```
my-project/
├── .kiroo/
│   ├── config.yaml
│   ├── interactions/
│   │   ├── 2026-03-01T12-01-22.json
│   │   ├── 2026-03-01T12-05-18.json
│   │   └── ...
│   ├── snapshots/
│   │   ├── before-refactor.json
│   │   └── after-refactor.json
│   └── flows/
│       └── auth-flow.yaml
```

### Interaction File Format

```json
{
  "id": "2026-03-01T12-01-22",
  "request": {
    "method": "POST",
    "url": "https://api.example.com/login",
    "headers": {
      "Content-Type": "application/json"
    },
    "body": {
      "email": "admin@test.com",
      "password": "***REDACTED***"
    }
  },
  "response": {
    "status": 200,
    "headers": {
      "Content-Type": "application/json"
    },
    "body": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "user": {
        "id": "123",
        "email": "admin@test.com"
      }
    }
  },
  "metadata": {
    "duration_ms": 142,
    "timestamp": "2026-03-01T12:01:22Z",
    "environment": "local"
  }
}
```

**Git-Friendly:** Plain JSON, human-readable, diff-able, merge-able.

---

## 🎯 Core Features

### 1. **HTTP Executor with Auto-Recording**

**Command:**
```bash
kiroo POST /api/users name="John Doe" email="john@example.com"
```

**What happens:**
1. Executes HTTP request
2. Pretty-prints response
3. Stores full interaction in `.kiroo/interactions/`
4. Extracts variables (tokens, IDs) for chaining

**Value:** Fast as HTTPie, but with persistence.

---

### 2. **Deterministic Replay Engine**

**Command:**
```bash
kiroo replay 2026-03-01T12-01-22
```

**What happens:**
1. Loads stored interaction
2. Reproduces exact request (URL, headers, body)
3. Compares response with stored version
4. Highlights differences

**Use Cases:**
- Reproduce production bugs locally
- Debug webhook failures
- Investigate race conditions
- Validate API stability

---

### 3. **Snapshot System**

**Commands:**
```bash
# Save current state
kiroo snapshot save v1.0

# Compare snapshots
kiroo snapshot compare v1.0 v2.0
```

**What happens:**
1. Bundles all current interactions
2. Tags with name/version
3. Stores as single artifact
4. Diffs show status/field/performance changes

**Use Cases:**
- Pre-deployment contract validation
- Refactoring safety net
- API versioning workflow
- Team alignment on changes

---

### 4. **Dependency Graph Generator**

**Command:**
```bash
kiroo graph
```

**Output:**
```
POST /login
 └─> extracts: token
     └─> GET /profile
         ├─> GET /orders
         │   └─> GET /orders/{id}
         └─> POST /checkout
```

**Value:** Visualize API relationships from real usage patterns.

---

### 5. **Flow Engine (YAML Workflows)**

**File:** `auth-flow.yaml`
```yaml
name: Authentication Flow
steps:
  - POST /login
    body:
      email: admin@test.com
      password: secret
    extract:
      token: response.body.token

  - GET /profile
    headers:
      Authorization: Bearer {{token}}
```

**Command:**
```bash
kiroo flow auth-flow.yaml
```

**Value:** Reproducible multi-step workflows, version-controlled.

---

## 🆚 Comparison with Existing Tools

| Capability | Postman | Bruno | Newman | VCR | Pact | **kiroo** |
|------------|---------|-------|--------|-----|------|----------|
| **CLI-first** | ❌ | ⚠️ Partial | ✅ | ✅ | ❌ | ✅ |
| **Git-native storage** | ❌ | ✅ | ❌ | ⚠️ Fixtures | ❌ | ✅ |
| **Interaction history** | ❌ | ❌ | ❌ | ⚠️ Mocks | ❌ | ✅ |
| **Deterministic replay** | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| **Snapshot testing** | ⚠️ Enterprise | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Dependency graph** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Zero setup** | ❌ | ⚠️ Desktop | ✅ | ❌ | ❌ | ✅ |

**Category:** kiroo is not an API client. It's an **API interaction versioning system**.

---

## 💡 Real-World Use Cases

### Use Case 1: Production Bug Reproduction

**Scenario:** User reports payment failure. Logs show `POST /checkout → 500`.

**Without kiroo:**
1. Check logs (partial data)
2. Try to guess request payload
3. Manually recreate request
4. Can't reproduce (missing headers/state)
5. Give up or waste hours

**With kiroo:**
1. Production proxy records interaction
2. Download `.kiroo/interactions/prod-500-error.json`
3. `kiroo replay prod-500-error`
4. Bug reproduced locally in 30 seconds

---

### Use Case 2: Safe Refactoring

**Scenario:** Refactoring `/users` endpoint, worried about breaking clients.

**Without kiroo:**
1. Make changes
2. Hope nothing breaks
3. Deploy
4. Frontend breaks in prod
5. Rollback + postmortem

**With kiroo:**
1. `kiroo snapshot save before-refactor`
2. Make code changes
3. `kiroo snapshot save after-refactor`
4. `kiroo snapshot compare before-refactor after-refactor`
5. See: "⚠️ Field 'email' removed" → fix before deploy

---

### Use Case 3: Team Onboarding

**Scenario:** New developer joins, needs to understand API flows.

**Without kiroo:**
1. Read outdated docs
2. Ask senior devs
3. Trial and error with Postman
4. Still confused

**With kiroo:**
1. `git clone project`
2. `.kiroo/` folder already has real interactions
3. `kiroo graph` shows dependency tree
4. `kiroo replay <any-interaction>` to see examples
5. Productive in 1 hour

---

## 🚀 Technical Innovation

### 1. **Git-Native by Design**

Unlike cloud-based tools, kiroo stores everything as plain text files:
- Works offline
- No vendor lock-in
- Full Git integration (branches, PRs, merges)
- Security: no API keys sent to third parties

### 2. **Zero Configuration**

```bash
npm install -g kiroo
kiroo POST /login email=test@test.com
```

No setup files, no accounts, no dashboards. Just works.

### 3. **Lightweight Snapshot Testing**

Traditional contract testing (Pact, Spring Cloud Contract) requires:
- Complex DSL
- Separate test infrastructure
- Consumer/provider coordination

kiroo snapshot testing:
- One command
- Leverages real traffic
- Automatic diff generation

---

## 📊 Success Metrics

### Developer Impact
- **Time saved:** 2-3 hours/week on API debugging
- **Bugs prevented:** Catch breaking changes pre-deploy
- **Onboarding speed:** 50% faster for new team members

### Adoption Potential
- **Target users:** Backend developers, API teams, DevOps engineers
- **Market size:** 27M developers worldwide use REST APIs
- **Competition:** No direct competitor in this category

---

## 🛣️ Roadmap

### MVP (Week 1)
- [x] HTTP executor with storage
- [x] Replay engine
- [x] Snapshot system
- [x] Diff engine
- [x] Dependency graph
- [x] Flow engine

### Post-Hackathon (Month 1-3)
- [ ] Proxy recorder (capture production traffic)
- [ ] CI/CD integrations (GitHub Actions, GitLab CI)
- [ ] Plugin system
- [ ] Web UI for visualization
- [ ] Team collaboration features

### Long-Term (Month 6+)
- [ ] Cloud sync (optional)
- [ ] AI-powered diff explanations
- [ ] Performance regression detection
- [ ] Multi-protocol support (GraphQL, gRPC)

---

## 🎓 Why This Project Matters

### For Individual Developers
Stop wasting hours debugging "works on my machine" issues. Get production-like reproducibility in development.

### For Teams
Version API interactions like code. Catch breaking changes before deployment. Onboard faster.

### For the Ecosystem
First truly Git-native API interaction tool. Sets new standard for how developers should think about API workflows.

---

## 📝 Conclusion

**kiroo transforms ephemeral API requests into versionable, reproducible, diff-able artifacts.**

It's not just another API client.  
It's **Git for APIs**.

---

## 🔗 Links

- **GitHub:** https://github.com/[your-username]/kiroo
- **Documentation:** https://kiroo-cli.com/docs
- **Demo Video:** https://youtube.com/watch?v=[video-id]
- **Landing Page:** https://kiroo-cli.com

---

**Built for:** [Hackathon Name]  
**Team:** [Your Name]  
**Category:** Developer Tools  
**Date:** March 1-7, 2026
