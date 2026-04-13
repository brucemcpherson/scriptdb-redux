// we want to be able to get a dropin cache usable on both live and fake
// family by default witll partition according to the scriptId, but we can have broader sharing by providing some other string
import { newCacheDropin } from '@mcpher/gas-flex-cache'

// handle if it comes from a gaslibrary (as in live apps script)
let dropin = null
if (typeof bmGasFlexCache !== 'undefined' && bmGasFlexCache.newCacheDropin) {
  dropin = bmGasFlexCache.newCacheDropin
} else {
  dropin = newCacheDropin
}

export const getUpstashBackend = ({kind='property', family = ScriptApp.getScriptId(), creds = null} = {}) => {
  creds = {
    ...creds,
    type:"upstash",
    family,
    kind
  }
  // this will be the store that we use  as the backend for the database
  const store = dropin({ creds });

  // Patch getProperties to handle potential pattern matching issues on some environments
  // We'll use SCAN instead of KEYS as it is more robust and preferred by Upstash
  if (store && store.getProperties) {
    store.getProperties = function () {
      if (this.client) {
        try {
          const prefix = this.client.redisSet + "-";
          let cursor = '0';
          let allMyKeys = [];
          
          // Use SCAN instead of KEYS for better reliability and performance
          // This avoids issues with long pattern strings in some environments
          do {
            const result = this.client.request(['SCAN', cursor, 'MATCH', prefix + '*', 'COUNT', '1000']);
            if (result && result[0] && result[0].result) {
              cursor = result[0].result[0];
              const foundKeys = result[0].result[1];
              if (foundKeys && foundKeys.length > 0) {
                allMyKeys = allMyKeys.concat(foundKeys);
              }
            } else {
              cursor = '0';
            }
          } while (cursor !== '0' && cursor !== 0);

          if (allMyKeys.length > 0) {
            // Strip the prefix to get the original item IDs
            const ids = allMyKeys.map(k => k.substring(prefix.length));
            return this.getAll(ids);
          }
        } catch (e) {
          console.error('...getProperties SCAN failed', e.message);
        }
      }
      return {};
    };
  }

  return store
}