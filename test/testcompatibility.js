// all these imports
// this is loaded by npm, but is a library on Apps Script side

import "@mcpher/gas-fakes";
import is from "@sindresorhus/is";

import { initTests, getCreds } from "./testinit.js";
import { newScriptDb, SortDirection } from "@mcpher/scriptdb-redux";

// make it global, to emulate how it used to be
// by default it will be partitioned by scriptId as per original

// this can run standalone, or as part of combined tests if result of inittests is passed over
export const testCompatibility = (pack) => {
  const { unit, fixes } = pack || initTests();
  const creds = getCreds();
  globalThis.ScriptDb = newScriptDb({ creds });

  // example fix
  const fixOb = {
    type: "employee",
    employee_id: 1,
    name: { first: "Kim", last: "Wexler" },
    address: {
      street: "4076 Washington Avenue",
      city: "Jackson",
      state: "MS",
      zip: "39201",
    },
    department_id: 52,
  };

  const db = ScriptDb.getMyDb();

  unit.section("save and load", (t) => {
    db.clear();
    const stored = db.save(fixOb);

    t.true(is.nonEmptyString(stored.getId()));
    t.deepEqual(stored, { id: stored.getId(), ...fixOb });

    const loaded = db.load(stored.getId());
    t.is(loaded.getId(), stored.getId());
    t.deepEqual(loaded, { id: stored.getId(), ...fixOb });
  });

  unit.section("modify and save and query", (t) => {
    db.clear();
    // kim
    const kimSave = db.save(fixOb);
    // make a copy by saving again (save now deep clones)
    const saulSave = db.save(fixOb);
    saulSave.name = { first: "Saul", last: "Goodman" };
    saulSave.address.city = "Albuquerque";
    saulSave.employee_id = 2;
    db.save(saulSave); // Actually save the modifications

    const saulLoaded = db.load(saulSave.getId());
    t.is(saulLoaded.getId(), saulSave.getId());
    t.deepEqual(
      { id: saulLoaded.getId(), ...saulLoaded },
      { id: saulSave.getId(), ...saulSave },
    );

    // now we check that both are still present
    const saul = db.query({ name: { first: "Saul", last: "Goodman" } });
    t.is(saul.getSize(), 1);
    t.deepEqual(saul.hasNext() && saul.next(), saulLoaded);

    const saul2Result = db.query({
      name: saulLoaded.name,
      employee_id: saulLoaded.employee_id,
    });
    t.is(saul2Result.getSize(), 1);
    const saul2 = saul2Result.next();
    t.deepEqual(saul2, saulLoaded);

    const kimResult = db.query({
      name: kimSave.name,
      employee_id: kimSave.employee_id,
    });
    t.is(kimResult.getSize(), 1);
    const kim = kimResult.next();
    t.deepEqual(kim, kimSave);

    t.is(db.count({ employee_id: 1 }), 1);
    t.is(db.count({ employee_id: 2 }), 1);
    t.is(db.count(), 2);

    db.remove(kim);
    t.is(db.count(), 1);
    t.is(db.load(kimSave.getId()), null);
    db.removeById(saulSave.getId());
    t.is(db.load(saulSave.getId()), null);
  });

  unit.section("complex queries", (t) => {
    db.clear();
    const walterSave = db.save({
      ...fixOb,
      name: { first: "Walter", last: "White" },
      employee_id: 3,
    });
    const saulSave = db.save({
      ...fixOb,
      name: { first: "Saul", last: "Goodman" },
      employee_id: 2,
    });
    const jessieSave = db.save({
      ...fixOb,
      name: { first: "Jessie", last: "Pinkman" },
      employee_id: 4,
    });
    t.is(db.count(), 3);

    const castById = db.query({ employee_id: db.anyOf([2, 3, 4]) });
    t.is(castById.getSize(), 3);

    const castByName = db.query({
      employee_id: 2,
      name: { first: db.anyOf([walterSave.name.first, saulSave.name.first]) },
    });
    t.is(castByName.getSize(), 1);
    const qSaul = castByName.next();
    t.is(qSaul.employee_id, 2);
    t.deepEqual(qSaul.name, saulSave.name);

    const greaterThanWalter = db.query({
      employee_id: 3,
      name: { first: db.greaterThan("Saul") },
    });
    t.is(greaterThanWalter.getSize(), 1);
    const qWalter = greaterThanWalter.next();
    t.is(qWalter.employee_id, 3);
    t.deepEqual(qWalter.name, walterSave.name);

    const lessThanJessie = db.query({ name: { first: db.lessThan("Saul") } });
    t.is(lessThanJessie.getSize(), 1);
    const qJessie = lessThanJessie.next();
    t.is(qJessie.employee_id, 4);
    t.deepEqual(qJessie.name, jessieSave.name);
  });

  unit.section("pagination and sorting", (t) => {
    db.clear();
    const items = [
      { employee_id: 1, name: { first: "Kim", last: "Wexler" } },
      { employee_id: 2, name: { first: "Saul", last: "Goodman" } },
      { employee_id: 3, name: { first: "Walter", last: "White" } },
      { employee_id: 4, name: { first: "Jessie", last: "Pinkman" } },
      { employee_id: 5, name: { first: "Gus", last: "Fring" } },
    ];
    db.saveBatch(items, false);

    const all = db.query();
    t.is(all.getSize(), 5);

    // Sorting - Ascending
    const sortedAsc = all.sortBy("employee_id");
    t.is(sortedAsc.next().employee_id, 1);
    t.is(sortedAsc.next().employee_id, 2);

    // Sorting - Descending
    const sortedDesc = all.sortBy("employee_id", SortDirection.DESCENDING);
    t.is(sortedDesc.next().employee_id, 5);
    t.is(sortedDesc.next().employee_id, 4);

    // Limit
    const limited = all.sortBy("employee_id").limit(2);
    t.is(limited.getSize(), 2);
    t.is(limited.next().employee_id, 1);
    t.is(limited.next().employee_id, 2);
    t.false(limited.hasNext());

    // StartAt
    const offset = all.sortBy("employee_id").startAt(3);
    t.is(offset.getSize(), 2); // 4 and 5
    t.is(offset.next().employee_id, 4);
    t.is(offset.next().employee_id, 5);

    // Paginate (pageNumber, pageSize)
    // Page 1, size 2 -> items 1, 2
    const page1 = all.sortBy("employee_id").paginate(1, 2);
    t.is(page1.getSize(), 2);
    t.is(page1.next().employee_id, 1);

    // Page 2, size 2 -> items 3, 4
    const page2 = all.sortBy("employee_id").paginate(2, 2);
    t.is(page2.getSize(), 2);
    t.is(page2.next().employee_id, 3);

    // Page 3, size 2 -> item 5
    const page3 = all.sortBy("employee_id").paginate(3, 2);
    t.is(page3.getSize(), 1);
    t.is(page3.next().employee_id, 5);
  });

  unit.section("soak test", (t) => {
    db.clear();
    const count = 100;
    const items = [];

    // Individual saves
    for (let i = 0; i < count; i++) {
      const item = {
        index: i,
        random: Math.random(),
        timestamp: Date.now(),
        nested: {
          val: i * 10,
        },
        tags: ["tag" + i, "common"],
      };
      items.push(db.save(item));
    }
    t.is(db.count(), count);

    // Individual loads
    for (let i = 0; i < count; i++) {
      const loaded = db.load(items[i].getId());
      t.is(loaded.index, i);
      t.is(loaded.nested.val, i * 10);
    }

    // Queries
    const commonQuery = db.query({ tags: "common" });
    t.is(commonQuery.getSize(), count);

    const specificQuery = db.query({ index: 50 });
    t.is(specificQuery.getSize(), 1);
    t.is(specificQuery.next().nested.val, 500);

    const rangeQuery = db.query({ index: db.between(10, 20) });
    t.is(rangeQuery.getSize(), 10);

    // Bulk remove
    db.remove(db.query());
    t.is(db.count(), 0);
  });

  unit.report();
};

if (ScriptApp.isFake) {
  testCompatibility();
}
