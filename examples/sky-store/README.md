# SkyStore Drift Lab

SkyStore is a migration playground to demo **real API contract drift** between `v1` and `v2`, with a Neobrutalism UI to generate traffic quickly.

## What this example shows

- Structural drift: flat objects become nested contracts.
- Behavioral drift: status code and flow changes (`200` -> `202`, `400` -> `403`, `429` path).
- Enum/locale drift: currency, shipping, coupon constraints.
- Snapshot-driven diff + blast-radius analysis with localization.

## 1) Start backend

```bash
cd examples/sky-store/backend
npm install
node server.js
```

## 2) Open frontend

Open `examples/sky-store/frontend/index.html` in browser.

Use endpoint buttons or presets to generate realistic traffic.

## 3) Capture baseline (v1)

```bash
kiroo get http://localhost:3000/api/v1/products
kiroo get http://localhost:3000/api/v1/user
kiroo get http://localhost:3000/api/v1/search?q=watch
kiroo get http://localhost:3000/api/v1/inventory/sky-1
kiroo get http://localhost:3000/api/v1/shipping/quote?country=IN
kiroo snapshot save v1
```

## 4) Capture target (v2)

```bash
kiroo get http://localhost:3000/api/v2/products
kiroo get http://localhost:3000/api/v2/user
kiroo get http://localhost:3000/api/v2/search?q=watch
kiroo get http://localhost:3000/api/v2/inventory/sky-1
kiroo get http://localhost:3000/api/v2/shipping/quote?country=IN&fast=true
kiroo get http://localhost:3000/api/v2/notifications
kiroo snapshot save v2
```

## 5) Compare + analyze

```bash
kiroo snapshot compare v1 v2 --analyze --lang de
kiroo snapshot compare v1 v2 --analyze --ai --lang hi
```

## 6) Optional: proxy capture mode

```bash
kiroo proxy --target http://localhost:3000 --port 8080
```

Then call endpoints on `http://localhost:8080/...` to auto-record traffic from the UI flow.

## v1 -> v2 drift highlights

- `/products`: `price:number` -> `price:{amount,currency,symbol}`
- `/user`: root fields -> `profile` + `preferences`
- `/search`: array -> wrapped object with `results`, `total`, `suggestion`
- `/checkout`: synchronous `200` -> async-like `202`, restricted item now `403`
- `/shipping/quote`: added fast mode and a rate-limited region path (`BR` => `429`)
- `/coupons/validate`: simple discount fields -> richer `discount` and `constraints`
