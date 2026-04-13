// all these imports
// this is loaded by npm, but is a library on Apps Script side

import "@mcpher/gas-fakes";


import { initTests, getCreds } from "./testinit.js";
import { newScriptDb } from "@mcpher/scriptdb-redux";


// this can run standalone, or as part of combined tests if result of inittests is passed over
export const testAdvanced = (pack) => {
  const { unit, fixes } = pack || initTests();

  // example fix
  const fixOb = {
    type: "employee",
    employee_id: 1,
    name: { first: "Walter", last: "White" },
    address: {
      street: "4076 Washington Avenue",
      city: "Albuquerque",
      state: "NM",
      zip: "87101",
    },
    department_id: 52,
  };

  // in clasp we have testinit as the first file in the pushorder
  const creds = getCreds()

  // in this case we are going to demonstrate how to share the db across multiple scripts
  // by default, the sdb is partitioned by scriptID, so using the same scriptID in gas-fakes
  // allows sharing between live and local apps script.
  // just pick an arbitrary family value, and any script using that family value will share the same db
  const family = 'Breaking bad'

  // this will use the normal scriptid to partition
  const sdb0 = newScriptDb({creds});

  // these 2 databases will actually share a partition
  const sdb1 = newScriptDb({creds, family});
  const sdb2 = newScriptDb({creds, family});

  const db0 = sdb0.getMyDb();
  const db1 = sdb1.getMyDb();
  const db2 = sdb2.getMyDb();

  unit.section("sharing", (t) => {
    // clear all first to be sure
    db0.clear();
    db1.clear(); // this also clears db2 since they share the same family

    const item1 = db1.save(fixOb);
    t.is(db1.count(), 1);

    // db2 should see it immediately
    t.is(db2.count(), 1);
    const item2 = db2.load(item1.getId());
    t.is(item2.employee_id, 1);
    t.is(item2.name.first, "Walter");

    // db0 should NOT see it
    t.is(db0.count(), 0);
    t.is(db0.load(item1.getId()), null);

    // modification in db2 should be seen in db1
    item2.name.first = "Heisenberg";
    db2.save(item2);
    
    const item1Reloaded = db1.load(item1.getId());
    t.is(item1Reloaded.name.first, "Heisenberg");

    // cleanup
    db1.clear();
  });
  
  unit.report();
};

if (ScriptApp.isFake) {
  testAdvanced();
}
