// all these imports
// this is loaded by npm, but is a library on Apps Script side
// when running with local , run local test first to populate, then run this one fist in live apps script to avoid db being cleared

import "@mcpher/gas-fakes";
import {
  newScriptDb
} from "@mcpher/scriptdb-redux";
import { initTests, getCreds } from "./testinit.js";

// make it global, to emulate how it used to be
// by default it will be partitioned by scriptId as per original

// this can run standalone, or as part of combined tests if result of inittests is passed over
export const testSharing = (pack) => {
  // in clasp we have testinit as the first file in the pushorder
  const creds = getCreds();
  globalThis.ScriptDb = newScriptDb({ creds });

  const { unit, fixes } = pack || initTests();

  const db = ScriptDb.getMyDb();

  unit.section("sharing between local and gas", (t) => {
    const isLocal = ScriptApp.isFake;
    const sharingKey = "sharing-test-record";

    if (isLocal) {
      // Local writes, GAS will read
      db.save({
        id: sharingKey,
        type: "sharing",
        message: "Hello from Local Node.js",
        timestamp: Date.now(),
      });

      // Also check if GAS has left a message
      const gasMessage = db.load("gas-to-local-record");
      if (gasMessage) {
        console.log("...Found message from GAS:", gasMessage.message);
        t.is(gasMessage.type, "sharing-response");
      }
    } else {
      // GAS reads what local wrote
      const localMessage = db.load(sharingKey);
      t.is(!!localMessage, true, "GAS should find the record created locally");
      if (localMessage) {
        console.log("...GAS found local message:", localMessage.message);

        // GAS writes a response for local to find next time
        db.save({
          id: "gas-to-local-record",
          type: "sharing-response",
          message: "Hello from live Apps Script!",
          timestamp: Date.now(),
          respondingTo: localMessage.timestamp,
        });
      }
    }
  });

  unit.report();
};

if (ScriptApp.isFake) {
  testSharing();
}
