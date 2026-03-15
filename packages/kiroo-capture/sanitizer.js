function scrubSensitive(obj) {
  if (!obj) return obj;
  
  const sensitiveKeys = [
    'password', 'token', 'authorization', 'secret', 
    'apikey', 'api_key', 'credit_card', 'cvv', 'cookie', 'set-cookie'
  ];
  
  // Clone to avoid mutating original objects in the app
  const scrubbed = JSON.parse(JSON.stringify(obj));
  
  function scrubRecursive(curr) {
    if (typeof curr !== 'object' || curr === null) return;
    
    for (let key in curr) {
      const lowerKey = key.toLowerCase();
      
      if (sensitiveKeys.some(s => lowerKey.includes(s))) {
        curr[key] = '<REDACTED>';
      } else if (typeof curr[key] === 'object') {
        scrubRecursive(curr[key]);
      }
    }
  }
  
  scrubRecursive(scrubbed);
  return scrubbed;
}

module.exports = { scrubSensitive };
