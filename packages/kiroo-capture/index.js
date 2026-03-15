const { addToBuffer } = require('./storage');
const { scrubSensitive } = require('./sanitizer');
const crypto = require('crypto');

function capture(options = {}) {
  const {
    supabaseUrl = process.env.SUPABASE_URL,
    supabaseKey = process.env.SUPABASE_KEY,
    bucket = 'kiroo-captures',
    sampleRate = 1.0,
    scrub = true,
    flushIntervalMs = 30000
  } = options;

  return (req, res, next) => {
    const shouldSample = Math.random() <= sampleRate;
    const replayId = `kiroo-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    
    // Inject header early
    res.setHeader('X-Kiroo-Replay-ID', replayId);

    const capturedRequest = {
      method: req.method,
      url: req.originalUrl || req.url,
      headers: { ...req.headers },
      body: req.body
    };

    const originalSend = res.send;
    const originalJson = res.json;
    let capturedResponseData = null;

    res.send = function(data) {
      capturedResponseData = data;
      return originalSend.apply(res, arguments);
    };

    res.json = function(data) {
      capturedResponseData = data;
      return originalJson.apply(res, arguments);
    };

    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const isError = res.statusCode >= 400;
      if (!isError && !shouldSample) return;

      let responseBody = capturedResponseData;
      if (Buffer.isBuffer(responseBody)) responseBody = responseBody.toString('utf8');
      try {
        if (typeof responseBody === 'string') responseBody = JSON.parse(responseBody);
      } catch (e) {}

      const captureRecord = {
        id: replayId,
        timestamp: new Date().toISOString(),
        request: scrub ? scrubSensitive(capturedRequest) : capturedRequest,
        response: {
          status: res.statusCode,
          headers: res.getHeaders(),
          body: scrub ? scrubSensitive(responseBody) : responseBody
        },
        metadata: { 
          sampled: !isError, 
          isError: isError,
          duration_ms: duration
        }
      };

      addToBuffer(captureRecord, { 
        supabaseUrl, 
        supabaseKey, 
        bucket, 
        flushIntervalMs 
      });
    });

    next();
  };
}

module.exports = { capture };
