# SkyStore Drift Lab

SkyStore is a migration playground to test **real API contract drift** between `v1` and `v2`.

It is designed for fast Kiroo demos: capture traffic, save snapshots, compare versions, run blast-radius analysis, and validate risk paths.

## What this example covers

- Structural drift (flat -> nested contracts)
- Behavioral drift (status and flow changes)
- Error-path drift (`403`, `429`)
- Snapshot compare + analyze + AI summary + localization

## Quick setup

```bash
cd examples/sky-store/backend
npm install
node server.js
```

Open frontend: `examples/sky-store/frontend/index.html`

## Recommended end-to-end test flow

### 1) Capture baseline snapshot (`v1`)

```bash
kiroo get http://localhost:3000/api/v1/products
kiroo get http://localhost:3000/api/v1/user
kiroo get http://localhost:3000/api/v1/wishlist
kiroo get http://localhost:3000/api/v1/search?q=watch
kiroo get http://localhost:3000/api/v1/orders/ord-2049
kiroo get http://localhost:3000/api/v1/inventory/sky-1
kiroo get http://localhost:3000/api/v1/shipping/quote?country=IN
kiroo get http://localhost:3000/api/v1/coupons/validate?code=LUX10
kiroo check http://localhost:3000/api/v1/checkout -m POST -d "productId=sky-1" --status 200
kiroo snapshot save v1
```

Expected:
- Flat/simple response shapes.
- Checkout success on `200`.

### 2) Capture target snapshot (`v2`)

```bash
kiroo get http://localhost:3000/api/v2/products
kiroo get http://localhost:3000/api/v2/user
kiroo get http://localhost:3000/api/v2/wishlist
kiroo get http://localhost:3000/api/v2/search?q=watch
kiroo get http://localhost:3000/api/v2/orders/ord-2049
kiroo get http://localhost:3000/api/v2/inventory/sky-1
kiroo get http://localhost:3000/api/v2/shipping/quote?country=IN&fast=true
kiroo get http://localhost:3000/api/v2/coupons/validate?code=LUX20
kiroo get http://localhost:3000/api/v2/notifications
kiroo check http://localhost:3000/api/v2/checkout -m POST -d "productId=sky-1" --status 202
kiroo snapshot save v2
```

Expected:
- Nested response objects for multiple endpoints.
- Checkout success now on `202`.

### 3) Validate high-risk/error paths

```bash
kiroo check http://localhost:3000/api/v2/checkout -m POST -d "productId=sky-3" --status 403
kiroo check "http://localhost:3000/api/v2/shipping/quote?country=BR&fast=true" --status 429
kiroo get "http://localhost:3000/api/v2/coupons/validate?code=BADCODE"
```

Expected:
- Restricted checkout path returns `403`.
- Shipping quote for `BR` returns `429`.
- Invalid coupon returns `constraints.status=invalid`.

### 4) Compare + analyze migration

```bash
kiroo snapshot compare v1 v2
kiroo snapshot compare v1 v2 --analyze --lang de
kiroo snapshot compare v1 v2 --analyze --ai --lang hi
```

Expected from compare/analyze:
- Added/removed endpoint signals.
- Contract drift on products/user/search/orders/inventory/shipping/coupons.
- Severity-prioritized blast radius summary.

### 5) Generate API quality stats

```bash
kiroo stats
kiroo stats --json
```

Expected:
- p50/p95/p99 latency and endpoint risk insights.
- JSON output for automation/reporting pipelines.

## Optional: Proxy + UI capture mode

```bash
kiroo proxy --target http://localhost:3000 --port 8080
```

Then call endpoints on `http://localhost:8080/...` (or switch frontend fetch base to `:8080`) and use the UI buttons/presets to auto-capture traffic.

## v1 -> v2 drift checklist

- `/products`: `price:number` -> `price:{amount,currency,symbol}`
- `/user`: root fields -> `profile` + `preferences`
- `/search`: array -> wrapped object with `results`, `total`, `suggestion`
- `/orders`: flat status/channel -> nested state/channel/eta
- `/inventory`: flat stock -> stock object + warehouse list
- `/shipping/quote`: flat response -> destination/pricing/eta + `429` scenario
- `/checkout`: `200` sync -> `202` accepted; error path `400` -> `403`
- `/coupons/validate`: simple discount fields -> richer `discount` and `constraints`
