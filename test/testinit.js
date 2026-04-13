
// all these imports 
// this is loaded by npm, but is a library on Apps Script side
import '@mcpher/gas-fakes';
import { Exports as unitExports } from '@mcpher/unit'
import { newScriptDb } from '@mcpher/scriptdb-redux'

// at this point we dont have any fixtures
const testFixes = []



// we have the upstash credentials in the real property store
// we'll use the apps script library to get them
// these are the creds we need to use apps script from the real properties service
// we can use kind as cache if we want just an ephemeral database
export const getCreds = () => {
    const credstr = PropertiesService.getScriptProperties().getProperty("dropin_upstash_credentials")
    if (!credstr) {
      throw new Error('dropin_upstash_credentials not found in script properties')
    }
    const creds = JSON.parse(credstr)
    return creds
}

export const initTests = () => {

  // on node this will have come from the imports that get stripped when mocing to gas
  // on apps script, you'll have a gas only imports file that aliases 
  // the exports from any gas libraries required
  const unit = unitExports.newUnit({
    showErrorsOnly: true
  })



  // apps script can't get from parent without access to the getresource of the parent
  if (unitExports.CodeLocator.isGas) {
    // because a GAS library cant get its caller's code
    unitExports.CodeLocator.setGetResource(ScriptApp.getResource)
    // optional - generally not needed - only necessary if you are using multiple libraries and some file sahre the same ID
    unitExports.CodeLocator.setScriptId(ScriptApp.getScriptId())
  }

  // these are fixtures to test imported from separate file
  const fixes = testFixes

  // if we in fake mode, we'll operate in sandbox mode by default
  if (ScriptApp.isFake) {
    const behavior = ScriptApp.__behavior;
    const proxies = ScriptApp.__proxies;
    behavior.sandboxMode = true;
    console.log('...operating in sandbox mode - only files created in this instance of gas-fakes are accessible')
    behavior.strictSandbox = true;
    behavior.cleanup = fixes.CLEAN;

    // Proactively initialize sandbox behaviors for all registered services.
    // This prevents crashes in services that check for their sandbox config
    // before a test has had a chance to set it up.
    console.log('...proactively initializing sandbox service behaviors');
    proxies.getRegisteredServices().forEach(serviceName => {
      // Just accessing the property is enough to trigger the lazy-creation
      // of the default sandbox behavior object for that service.
      // This ensures `ScriptApp.__behavior.sandboxService[serviceName]` is never undefined.
      const _ = behavior.sandboxService[serviceName];
    });

    // The root folder should always be accessible for read operations.
    // We'll add its ID to the whitelist to ensure tests that traverse
    // up to the root folder don't fail in sandbox mode.
    const rootFolderId = DriveApp.getRootFolder().getId();
    const platform = ScriptApp.__platform || 'google';
    console.log(`...whitelisting test file ROOT_FOLDER_ID: ${rootFolderId} on ${platform}`);
    behavior.addIdWhitelist(behavior.newIdWhitelistItem(rootFolderId));
  }
  return {
    unit,
    fixes,
    // because we want to automatically run any functions in this list if in Node
    runnables: ScriptApp.isFake ? process.argv.slice(2) : []
  }

}



