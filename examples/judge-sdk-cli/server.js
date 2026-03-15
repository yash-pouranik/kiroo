const express = require('express');
const { capture } = require('@kiroo/sdk');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3311;

app.use(express.json());

app.use(
  capture({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_KEY,
    bucket: process.env.SUPABASE_BUCKET || 'kiroo-captures',
    sampleRate: 1.0
  })
);

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'judge-sdk-cli-demo' });
});

app.get('/api/v1/products', (_req, res) => {
  res.json([
    { id: 'p-101', name: 'Nebula Watch', price: 4500, inStock: true },
    { id: 'p-102', name: 'Orbit Ring', price: 1200, inStock: false }
  ]);
});

app.get('/api/v2/products', (_req, res) => {
  res.json([
    {
      id: 'p-101',
      name: 'Nebula Watch',
      price: { amount: 4500, currency: 'INR' },
      inventory: { inStock: true, warehouses: ['blr-1'] }
    },
    {
      id: 'p-102',
      name: 'Orbit Ring',
      price: { amount: 1200, currency: 'INR' },
      inventory: { inStock: false, warehouses: [] }
    }
  ]);
});

app.get('/api/v1/user', (_req, res) => {
  res.json({ id: 'u-11', name: 'Aarav', country: 'IN' });
});

app.get('/api/v2/user', (_req, res) => {
  res.json({
    id: 'u-11',
    profile: { fullName: 'Aarav', countryCode: 'IN' },
    preferences: { currency: 'INR', locale: 'en-IN' }
  });
});

app.post('/api/v1/checkout', (_req, res) => {
  res.status(200).json({ status: 'paid' });
});

app.post('/api/v2/checkout', (_req, res) => {
  res.status(202).json({ status: 'queued', etaSeconds: 18 });
});

app.get('/api/fail', (_req, res) => {
  res.status(500).json({
    error: 'Downstream payment timeout',
    replayId: res.get('X-Kiroo-Replay-ID')
  });
});

app.listen(PORT, () => {
  console.log(`\nJudge demo running: http://localhost:${PORT}`);
  console.log('Try: /api/v1/products, /api/v2/products, /api/fail');
});
