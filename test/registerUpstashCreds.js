import '@mcpher/gas-fakes'

const creds = {
  type: "upstash",
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
}
if (!creds.url || !creds.token) {
  throw new Error('Upstash credentials not found')
}
PropertiesService.getScriptProperties().setProperty('dropin_upstash_credentials', JSON.stringify(creds))

console.log('dropin_upstash_credentials - registered for scriptID ' + ScriptApp.getScriptId())
