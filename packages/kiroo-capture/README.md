# @kiroo/sdk

Capture production API traffic with replay IDs, privacy-first sanitization, and Kiroo CLI time-travel debugging.

`@kiroo/sdk` is Express middleware that records request/response interactions, uploads them in batches to Supabase Storage, and attaches an `X-Kiroo-Replay-ID` header on every response.

## Why teams use it

- **Time-travel debugging:** Reproduce production failures locally with `kiroo fetch + kiroo replay`.
- **Low request overhead:** Capture happens on response finish with buffered async uploads.
- **Privacy-first defaults:** Sensitive keys are recursively masked before leaving your server.
- **Operationally friendly:** Batched writes + graceful flush on process shutdown.

## Installation

```bash
npm install @kiroo/sdk
```

## Quick start (Express)

```js
const express = require('express');
const { capture } = require('@kiroo/sdk');

const app = express();
app.use(express.json());

app.use(capture({
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_KEY,
  bucket: process.env.SUPABASE_BUCKET || 'kiroo-captures',
  sampleRate: 0.2,
  scrub: true,
  flushIntervalMs: 30000
}));

app.get('/api/fail', (_req, res) => {
  res.status(500).json({
    error: 'Downstream timeout',
    replayId: res.get('X-Kiroo-Replay-ID')
  });
});
```

## Capture behavior

- Every response gets a unique replay ID header: `X-Kiroo-Replay-ID`.
- **Error responses (`>=400`) are always captured**, even when sampling is low.
- Successful responses are captured according to `sampleRate`.
- Captures are uploaded to Supabase bucket files partitioned by date (`YYYY-MM-DD.json`).

## API reference

### `capture(options)`

Returns Express middleware.

Options:

| Option | Type | Default | Description |
|---|---|---|---|
| `supabaseUrl` | `string` | `process.env.SUPABASE_URL` | Supabase project URL |
| `supabaseKey` | `string` | `process.env.SUPABASE_KEY` | Supabase key used for storage operations |
| `bucket` | `string` | `"kiroo-captures"` | Storage bucket name |
| `sampleRate` | `number` | `1.0` | Fraction of successful responses to capture (`0..1`) |
| `scrub` | `boolean` | `true` | Mask sensitive values before buffering/upload |
| `flushIntervalMs` | `number` | `30000` | Batch upload interval |

## Security model

Before upload, the SDK redacts keys containing:

- `password`, `token`, `authorization`, `secret`
- `apikey`, `api_key`
- `credit_card`, `cvv`
- `cookie`, `set-cookie`

Output placeholder: `<REDACTED>`

## Time-travel workflow with Kiroo CLI

After you get a replay ID from an error response:

```bash
kiroo fetch <replay-id>
kiroo replay <replay-id> --target http://localhost:3000
```

This reproduces the same captured request against your local service for debugging with breakpoints.

## Production notes

- Keep `sampleRate` conservative in high-traffic environments (for example, `0.05` to `0.2`).
- Keep `scrub: true` unless you have strict internal-only handling.
- Ensure the configured bucket has required read/write permissions.
- On process shutdown, SDK flushes buffered captures before exiting.

## Troubleshooting

- **No captures uploaded:** verify `SUPABASE_URL`, `SUPABASE_KEY`, and bucket existence.
- **`kiroo fetch` cannot find replay ID:** check date partition and that app had upload permissions.
- **Too many uploads:** increase `flushIntervalMs` and/or lower `sampleRate`.
- **Missing request body:** ensure body parser middleware runs before routes (`express.json()`).

---
Built with ❤️ by [Kiroo](https://kiroo.bitbros.in)
