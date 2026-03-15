const { createClient } = require('@supabase/supabase-js');

let captureBuffer = [];
let flushInterval = null;
const MAX_BUFFER = 1000;

async function uploadBatchToSupabase(batch, options) {
  const { supabaseUrl, supabaseKey, bucket, retentionDays } = options;
  if (!supabaseUrl || !supabaseKey) return;

  const supabase = createClient(supabaseUrl, supabaseKey);
  const date = new Date().toISOString().split('T')[0];
  const fileName = `${date}.json`;
  
  try {
    const { data: existingData, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(fileName);
    
    let captures = [];
    if (!downloadError && existingData) {
      const text = await existingData.text();
      try { captures = JSON.parse(text); } catch (e) { captures = []; }
    }
    
    captures.push(...batch);
    
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, JSON.stringify(captures, null, 2), {
        upsert: true,
        contentType: 'application/json'
      });

    if (uploadError) throw uploadError;

    // Periodic cleanup
    if (Math.random() < 0.05) {
      await cleanupOldFiles(supabase, bucket, retentionDays);
    }
  } catch (err) {
    console.error(`[kiroo-capture] Batch upload failed: ${err.message}`);
  }
}

async function cleanupOldFiles(supabase, bucket, retentionDays) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - (retentionDays || 60));
  
  const { data: files, error } = await supabase.storage.from(bucket).list();
  if (error || !files) return;
  
  const toDelete = files
    .filter(f => {
      const fileDate = new Date(f.name.replace('.json', ''));
      return !isNaN(fileDate) && fileDate < cutoffDate;
    })
    .map(f => f.name);
  
  if (toDelete.length > 0) {
    await supabase.storage.from(bucket).remove(toDelete);
  }
}

function initFlush(options) {
  if (flushInterval) return;
  
  const intervalMs = options.flushIntervalMs || 30000;
  
  flushInterval = setInterval(async () => {
    await flushNow(options);
  }, intervalMs);
  
  if (flushInterval.unref) flushInterval.unref();

  // Graceful Shutdown
  const shutdownHandler = async () => {
    console.log('[kiroo-capture] App shutting down, flushing final captures...');
    await flushNow(options);
    process.exit(0);
  };

  process.on('SIGTERM', shutdownHandler);
  process.on('SIGINT', shutdownHandler);
}

async function flushNow(options) {
  if (captureBuffer.length === 0) return;
  const batch = [...captureBuffer];
  captureBuffer = [];
  await uploadBatchToSupabase(batch, options);
}

function addToBuffer(capture, options) {
  if (captureBuffer.length >= MAX_BUFFER) {
    captureBuffer.shift(); // Drop oldest
    console.warn('[kiroo-capture] Buffer full, dropping old captures');
  }
  
  captureBuffer.push(capture);
  initFlush(options);
}

module.exports = { addToBuffer };
