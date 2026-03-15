# SDK + CLI Walkthrough in 5 Minutes

This example is built for developers to test Kiroo core value quickly:
- `@kiroo/sdk` captures request/response traffic and emits `X-Kiroo-Replay-ID`.
- `kiroo` CLI records, snapshots, compares, analyzes, and exports API contracts.
- `kiroo fetch + replay` demonstrates production-to-local time travel.
- `kiroo analyze --lang` adds localized blast radius and field-intent signals.

## 1) Configure Supabase (required for replay-ID flow)

At repo root:

```bash
kiroo init
kiroo env set SUPABASE_URL <your_supabase_url>
kiroo env set SUPABASE_KEY <your_supabase_service_role_key>
kiroo env set SUPABASE_BUCKET kiroo-captures
```

Inside this folder, create `.env`:

```bash
SUPABASE_URL=<your_supabase_url>
SUPABASE_KEY=<your_supabase_service_role_key>
SUPABASE_BUCKET=kiroo-captures
```

## 2) Start the demo API

```bash
cd examples/sdk-cli-walkthrough
npm install
npm start
```

Server runs on `http://localhost:3311`.

## 3) Killer feature: production replay ID -> local replay

Trigger a controlled server failure:

```bash
kiroo get http://localhost:3311/api/fail
```

Copy `X-Kiroo-Replay-ID` from CLI response headers, then:

```bash
kiroo fetch <replay-id>
kiroo replay <replay-id> --target http://localhost:3311
```

## 4) Record baseline (`v1`) with CLI

Open a second terminal at repo root:

```bash
kiroo get http://localhost:3311/api/v1/products
kiroo get http://localhost:3311/api/v1/user
kiroo post http://localhost:3311/api/v1/checkout -d "productId=p-101"
kiroo snapshot save v1-stable
```

## 5) Record updated contract (`v2`)

```bash
kiroo get http://localhost:3311/api/v2/products
kiroo get http://localhost:3311/api/v2/user
kiroo post http://localhost:3311/api/v2/checkout -d "productId=p-101"
kiroo snapshot save v2-evolved
```

## 6) Show core value (contract drift + impact)

```bash
kiroo snapshot compare v1-stable v2-evolved
kiroo analyze v1-stable v2-evolved --fail-on high
kiroo analyze v1-stable v2-evolved --lang hi
```

Expected highlights:
- `price` changes from number to object.
- `user` response moves to nested profile.
- checkout status changes from `200` to `202`.

## 7) Export for team handoff

```bash
kiroo export --format openapi --out demo-openapi.json
```

If `kiroo fetch` fails, verify Supabase keys and storage bucket permissions.
