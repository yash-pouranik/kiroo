# Kiroo Demo Guide (Judge Playbook)

Use this as your exact demo script for judges.

## Quick setup

At repo root:

```bash
kiroo init
kiroo env set SUPABASE_URL <your_supabase_url>
kiroo env set SUPABASE_KEY <your_supabase_service_role_key>
kiroo env set SUPABASE_BUCKET kiroo-captures
```

Inside `examples/judge-sdk-cli`, create `.env`:

```bash
SUPABASE_URL=<your_supabase_url>
SUPABASE_KEY=<your_supabase_service_role_key>
SUPABASE_BUCKET=kiroo-captures
```

Start demo API:

```bash
cd examples/judge-sdk-cli
npm install
npm start
```

API: `http://localhost:3311`

---

## 1) Production Time-Travel Debugging (USP #1)

**What:** Production-like 500 error capture with replay ID.

**Killer part:** `kiroo replay <id>` recreates the exact scenario locally.

```bash
kiroo get http://localhost:3311/api/fail
kiroo fetch <replay-id-from-X-Kiroo-Replay-ID>
kiroo replay <replay-id-from-X-Kiroo-Replay-ID> --target http://localhost:3311
```

---

## 2) AI-Powered Blast Radius Analysis (USP #2)

**What:** Compare snapshots and get impact severity.

**Killer part:** AI summary explains practical break risk, not just raw diffs.

First record snapshots:

```bash
kiroo get http://localhost:3311/api/v1/products
kiroo get http://localhost:3311/api/v1/user
kiroo post http://localhost:3311/api/v1/checkout -d "productId=p-101"
kiroo snapshot save v1-stable

kiroo get http://localhost:3311/api/v2/products
kiroo get http://localhost:3311/api/v2/user
kiroo post http://localhost:3311/api/v2/checkout -d "productId=p-101"
kiroo snapshot save v2-evolved
```

**One-command AI demo:**

```bash
kiroo snapshot compare v1-stable v2-evolved --analyze --ai --fail-on high --lang hi
```

---

## 3) Git-Native API Versioning (Snapshots) (USP #3)

**What:** API states stored as versioned snapshots in `.kiroo/`.

**Killer part:** You can inspect historical behavior exactly like code versions.

```bash
kiroo snapshot list
kiroo snapshot compare v1-stable v2-evolved
kiroo snapshot run v1-stable --fail-fast
```

---

## 4) Zero-Code Testing Engine (USP #4)

**What:** CI-friendly assertions without writing test files.

**Killer part:** Single command gives automation-ready API checks.

```bash
kiroo check http://localhost:3311/api/v2/products --status 200 --has id,name,price
```

---

## 5) Privacy-First Local Scrubbing (USP #5)

**What:** Sensitive values are masked before sharing artifacts.

**Killer part:** Security teams can approve because secrets are redacted locally.

```bash
kiroo scrub --dry-run
kiroo scrub
```

---

## 6) Time-Travel Proxy Auto Capture (USP #6)

**What:** Proxy captures frontend traffic automatically.

**Killer part:** No manual typing for each request while exploring UI.

```bash
kiroo proxy --target http://localhost:3311 --port 8080
```

Then hit proxied endpoints from app/browser via `http://localhost:8080/...`.

---

## 7) Real-Traffic OpenAPI Export (USP #7)

**What:** Generate OpenAPI from observed traffic.

**Killer part:** Docs reflect real behavior, not stale hand-written specs.

```bash
kiroo export --format openapi --out judge-openapi.json
```

---

## checklist

- Replay ID captured and replayed locally
- AI analyze command runs with severity output
- Snapshot compare shows contract drift (`price`, `user`, `checkout`)
- `kiroo check` assertion passes
- OpenAPI file generated
