// all these imports
// this is loaded by npm, but is a library on Apps Script side

import "@mcpher/gas-fakes";
import {
  newScriptDb,
  SortStrategy,
  SortDirection,
} from "@mcpher/scriptdb-redux";
import { initTests, getCreds } from "./testinit.js";

// make it global, to emulate how it used to be
// by default it will be partitioned by scriptId as per original

// this can run standalone, or as part of combined tests if result of inittests is passed over
export const testBasic = (pack) => {
  // in clasp we have testinit as the first file in the pushorder
  const creds = getCreds();
  globalThis.ScriptDb = newScriptDb({ creds });

  const { unit, fixes } = pack || initTests();

  const db = ScriptDb.getMyDb();


  unit.section("save and load", (t) => {
    const item = { name: "John Doe", age: 30 };
    const saved = db.save(item);

    t.is(typeof saved.getId() === "string" && saved.getId().length > 0, true);
    t.is(saved.name, "John Doe");
    t.is(saved.age, 30);

    const loaded = db.load(saved.getId());
    t.is(loaded.getId(), saved.getId());
    t.is(loaded.name, "John Doe");
    t.is(loaded.age, 30);
  });

  unit.section("remove and removeById", (t) => {
    const item1 = db.save({ test: "item1" });
    const item2 = db.save({ test: "item2" });

    // Test removing using the item object
    db.remove(item1);
    t.is(db.load(item1.getId()), null);

    // Test removing using the string ID
    db.removeById(item2.getId());
    t.is(db.load(item2.getId()), null);
  });

  unit.section("batch operations", (t) => {
    const items = [{ batch: 1 }, { batch: 2 }, { batch: 3 }];

    // Test saveBatch
    const saveResults = db.saveBatch(items, false);
    t.is(db.allOk(saveResults), true);
    t.is(saveResults.length, 3);

    const ids = saveResults.map((r) => r.getId());

    // Test multiple load
    const loaded = db.load(ids);
    t.is(loaded.length, 3);
    t.is(loaded[0].batch, 1);

    // Test removeBatch (using the loaded items)
    const itemsToRemove = [loaded[0], loaded[1]];
    const removeResults = db.removeBatch(itemsToRemove, false);
    t.is(db.allOk(removeResults), true);
    t.is(db.load(loaded[0].getId()), null);

    // Test removeByIdBatch
    const removeByIdResults = db.removeByIdBatch([ids[2]], false);
    t.is(db.allOk(removeByIdResults), true);
    t.is(db.load(ids[2]), null);
  });

  unit.section("count", (t) => {
    const initialCount = db.count();

    const item1 = db.save({ counted: 1 });
    const item2 = db.save({ counted: 2 });

    t.is(db.count(), initialCount + 2);

    db.removeBatch([item1, item2], false);

    t.is(db.count(), initialCount);
  });

  unit.section("queries and operators", (t) => {
    db.clear();
    db.saveBatch(
      [
        { type: "car", color: "red", price: 10000 },
        { type: "car", color: "blue", price: 20000 },
        { type: "bike", color: "red", price: 500 },
        { type: "bike", color: "green", price: 600 },
      ],
      false,
    );

    // Equality query
    t.is(db.query({ type: "car" }).getSize(), 2);
    t.is(db.query({ color: "red" }).getSize(), 2);
    t.is(db.query({ type: "car", color: "red" }).getSize(), 1);

    // anyOf operator
    t.is(db.query({ color: db.anyOf(["blue", "green"]) }).getSize(), 2);

    // comparison operators
    t.is(db.query({ price: db.greaterThan(10000) }).getSize(), 1);
    t.is(db.query({ price: db.greaterThanOrEqualTo(10000) }).getSize(), 2);
    t.is(db.query({ price: db.lessThan(600) }).getSize(), 1);

    // between operator (inclusive lower, exclusive upper)
    t.is(db.query({ price: db.between(500, 10000) }).getSize(), 2); // 500 and 600

    // not operator
    t.is(db.query({ type: db.not("car") }).getSize(), 2);
  });

  unit.section("sorting overloads", (t) => {
    db.clear();

    // Diagnostic: check if clear actually cleared anything or if it's even finding keys
    const countAfterClear = db.count();
    if (countAfterClear !== 0) {
      console.warn(
        `db.clear() did not clear all items. Remaining: ${countAfterClear}`,
      );
    }

    db.saveBatch(
      [
        { name: "z", val: 10 },
        { name: "a", val: 100 },
        { name: "m", val: 50 },
      ],
      false,
    );

    const result = db.query();

    // Diagnostic: check why query might be empty
    if (result.getSize() === 0) {
      console.warn(
        "db.query() returned 0 results in sorting overloads section",
      );
      // Try to see if direct load works
      const all = db.count();
      console.log(`Total items in DB according to count(): ${all}`);
    }

    // sortBy(field) - default ascending lexical
    const r1 = result.sortBy("name");
    const n1 = r1.next();
    t.is(n1 && n1.name, "a");

    // sortBy(field, direction) - descending lexical
    const r2 = result.sortBy("name", SortDirection.DESCENDING);
    const n2 = r2.next();
    t.is(n2 && n2.name, "z");

    // sortBy(field, strategy) - ascending numeric
    const r3 = result.sortBy("val", SortStrategy.NUMERIC);
    const n3 = r3.next();
    t.is(n3 && n3.val, 10);

    // sortBy(field, direction, strategy) - descending numeric
    const r4 = result.sortBy(
      "val",
      SortDirection.DESCENDING,
      SortStrategy.NUMERIC,
    );
    const n4 = r4.next();
    t.is(n4 && n4.val, 100);

    // reverse order check for strategy/direction swap
    const r5 = result.sortBy(
      "val",
      SortStrategy.NUMERIC,
      SortDirection.DESCENDING,
    );
    const n5 = r5.next();
    t.is(n5 && n5.val, 100);
  });

  unit.report();
};

if (ScriptApp.isFake) {
  testBasic();
}
