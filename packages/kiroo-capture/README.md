# @kiroo/sdk

Production API traffic capture for Kiroo. Record real-world interactions and replay them locally for instant debugging.

## 🚀 Features

- **High Performance**: In-memory buffering and batch uploads to Supabase.
- **Zero Overhead**: Minimal impact on production request latency.
- **Privacy First**: Recursive sanitization of sensitive data (tokens, passwords, PII).
- **Time-Travel Ready**: Generates Replay IDs for every interaction.

## 📦 Installation

```bash
npm install @kiroo/sdk
```

## 🛠 Usage

```javascript
const express = require('express');
const { capture } = require('@kiroo/sdk');

const app = express();

app.use(capture({
  supabaseUrl: 'https://your-project.supabase.co',
  supabaseKey: 'your-service-role-key',
  bucket: 'kiroo-captures',
  sampleRate: 0.1 // Capture 10% of traffic
}));

// Return Replay ID in errors for support
app.use((err, req, res, next) => {
  res.status(500).json({
    error: 'Something went wrong',
    replayId: res.get('X-Kiroo-Replay-ID')
  });
});
```

## 🕵️‍♂️ Debugging with CLI

Once a capture is saved to Supabase, you can replay it locally using the [Kiroo CLI](https://www.npmjs.com/package/@kiroo/cli):

```bash
kiroo fetch <replay-id>
kiroo replay <replay-id> --target http://localhost:3000
```

---
Built with ❤️ by [Kiroo](https://kiroo.bitbros.in)
