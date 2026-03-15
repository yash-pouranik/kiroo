const express = require('express');
const { capture } = require('@kiroo/sdk');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 1. INTEGRATE KIROO SDK
// This should be one of the first middlewares in your stack
app.use(capture({
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_KEY,
  bucket: process.env.SUPABASE_BUCKET || 'kiroo-captures',
  sampleRate: 1.0 
}));

app.use(express.json());

// --- ROUTES ---

// A successful route to test sampling
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Kiroo Time-Travel Demo! 🚀' });
});

// A buggy route to test error capture
app.get('/api/checkout', (req, res) => {
  // Simulating a random production bug
  const isBuggy = true;
  
  if (isBuggy) {
    return res.status(500).json({
      error: 'Payment Gateway Timeout',
      // The SDK automatically adds this header. 
      // It's best practice to return it to the user/client.
      replayId: res.get('X-Kiroo-Replay-ID')
    });
  }
  
  res.json({ status: 'Success' });
});

// --- ERROR HANDLER ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    replayId: res.get('X-Kiroo-Replay-ID')
  });
});

app.listen(PORT, () => {
  console.log(`\n💎 Kiroo Demo Server running at http://localhost:${PORT}`);
  console.log(`☝️  Try visiting http://localhost:${PORT}/api/checkout to trigger a bug!`);
});
