# scriptdb-redux

`scriptdb-redux` is a modern resurrection of the original Google Apps Script `ScriptDb` service. It provides a simple, document-oriented database API for permanently storing JavaScript objects. 

It is designed to run seamlessly on both live Google Apps Script environments and local Node.js environments (optionally alongside [@mcpher/gas-fakes](https://github.com/brucemcpherson/gas-fakes)). A key feature is the ability to easily share data across these environments using an Upstash Redis backend.

If you want to review the (now deprecated) original API documentation, you can find it [here on the wayback machine from 2013](https://web.archive.org/web/20131112144543/https://developers.google.com/apps-script/reference/script-db/)


## Features

* **ScriptDb API Compatibility:** Drop-in replacement for the classic `ScriptDb` API (`save`, `load`, `query`, `remove`, etc.).
* **Cross-Environment:** Runs on Google Apps Script and locally in Node.js.
* **Shared Backend:** Uses Upstash Redis (via `@mcpher/gas-flex-cache`) as the persistent store. By setting the `family` configuration, you can share the exact same database partition between a local Node.js process and a live Apps Script project.
* **Robust Pattern Matching:** Implements safe `SCAN` based pattern matching to ensure consistent behavior across different Redis proxy layers and environments.

## Installation

```bash
npm install @mcpher/scriptdb-redux
```

## Setup

You will need an [Upstash](https://upstash.com/) Redis database (which has a nice free tier). Obtain your REST URL and REST Token. For more information on that you can see [this article](https://ramblings.mcpher.com/sharing-cache-and-properties-between-gas-fakes-and-live-apps-script/). `scriptdb-redux` uses [@mcpher/gas-flex-cache](https://github.com/brucemcpherson/gas-flex-cache) under the hood to provide this functionality.

### In Node.js (optionally with `gas-fakes`)

Make sure you have your Upstash credentials available in your environment or property store. Note that if you are using gas-fakes and using Upstash as your property store, this will already have been set in your .env by gas-fakes init.

```javascript
import '@mcpher/gas-fakes';
import { newScriptDb } from '@mcpher/scriptdb-redux';

// Credentials for Upstash
const creds = {
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
  type: "upstash"
};

// Initialize the database. 
// Note: If you don't provide a 'family', it defaults to the Script ID.
globalThis.ScriptDb = newScriptDb({ creds });
const db = ScriptDb.getMyDb();
```

### In Google Apps Script

You'll need the [bmScriptDbRedux library](https://script.google.com/home/projects/1BmL3A3E-BKrU9uxkL9swpaCWbpEzm7s5rc6pWUHhKpo9rTQZOn55KqBM/edit) in your project. 

```javascript
// Assuming you have stored your credentials in Script Properties
const credstr = PropertiesService.getScriptProperties().getProperty("dropin_upstash_credentials");
const creds = JSON.parse(credstr);

const ScriptDb = bmScriptDbRedux.newScriptDb({ creds });
const db = ScriptDb.getMyDb();
```

## Sharing Data Between Local and GAS

To share data between a local Node.js script and a live Google Apps Script project, you must explicitly set the `family` parameter to the same value in both environments (typically the Apps Script Project ID).

```javascript
const creds = { /* ... your upstash creds ... */ };
const family = "YOUR_LIVE_APPS_SCRIPT_ID"; // Use the same ID in both Node.js and GAS

const ScriptDb = newScriptDb({ creds, family });
const db = ScriptDb.getMyDb();

// Now, db.save() in Node.js can be read by db.load() in Apps Script!
```

### gas-fakes and compatible scriptId

If you are using gas-fakes, and you have set the scriptId (or are using clasp) to the same as the co-operating live Apps Script via `gas-fakes init`, there's no need to explicitly set the family parameter as `ScriptApp.getScriptId()` will return the same value in both environments, and `newScriptID()` will use it by default.

## API Overview

### `db.save(item)`
Saves a JavaScript object to the database. Returns a `ScriptDbMap` with an auto-generated `id` (if one wasn't provided).

```javascript
const user = db.save({ name: "Alice", age: 28 });
console.log(user.getId());
```

### `db.load(id)`
Loads an item by its ID. Returns `null` if not found.

### `db.query(queryObject)`
Searches for items matching the properties in `queryObject`. Returns a `ScriptDbResult` iterator.

```javascript
const results = db.query({ type: "car", color: "red" });
while (results.hasNext()) {
  const car = results.next();
  console.log(car.getId());
}
```

### `db.remove(item)` / `db.removeById(id)`
Removes an item from the database.

### `db.count(queryObject)`
Returns the number of items matching the query.

### Query Operators

You can use operators for complex queries:

* `db.anyOf(array)`
* `db.between(min, max)`
* `db.greaterThan(val)` / `db.greaterThanOrEqualTo(val)`
* `db.lessThan(val)` / `db.lessThanOrEqualTo(val)`
* `db.not(val)`

```javascript
// Find cars with price < 10000
const affordableCars = db.query({ 
  type: "car", 
  price: db.lessThan(10000) 
});
```

### Sorting

You can sort the `ScriptDbResult` using `sortBy`.

```javascript
import { SortStrategy, SortDirection } from '@mcpher/scriptdb-redux';

// Sort by price, descending, numerically
const sortedResults = db.query({ type: "car" })
  .sortBy("price", SortDirection.DESCENDING, SortStrategy.NUMERIC);
```

## Batch Operations

For better performance when modifying multiple items, use the batch methods:

* `db.saveBatch(items)`
* `db.removeBatch(items)`
* `db.removeByIdBatch(ids)`
