import { QueryOperator } from "./queryoperator.js";
import { ScriptDbResult } from "./scriptdbresult.js";
import { MutationResult } from "./mutationresult.js";
import { ScriptDbMap } from "./scriptdbmap.js";

/**
 * A JavaScript object database for permanently storing data.
 */
export class ScriptDbInstance {
  constructor(how) {
    this._how = how;
  }

  /**
   * Clears all items from the database.
   * @returns {void}
   */
  clear() {
    const all = this._how.getProperties();
    if (all) {
      const keys = Object.keys(all);
      if (keys.length > 0) {
        this._how.removeAll(keys);
      }
    }
  }

  /**
   * Returns true if all of the items in the result set were successful.
   * @param {MutationResult[]} mutateResults
   * @returns {Boolean}
   */
  allOk(mutateResults) {
    return mutateResults.every(r => r.isOk());
  }

  /**
   * Returns a query operator that evaluates to true if the field's value matches any of the passed in values.
   * @param {Array} values
   * @returns {QueryOperator}
   */
  anyOf(values) {
    return new QueryOperator("anyOf", values);
  }

  /**
   * Returns a query operator that evaluates to true if the field has any value.
   * @returns {QueryOperator}
   */
  anyValue() {
    return new QueryOperator("anyValue");
  }

  /**
   * Returns a query operator that evaluates to true if the field has a value in-between the two passed in values.
   * @param {*} value1
   * @param {*} value2
   * @returns {QueryOperator}
   */
  between(value1, value2) {
    return new QueryOperator("between", [value1, value2]);
  }

  /**
   * Returns the number of items that match the query.
   * @param {Object} query
   * @returns {Integer}
   */
  count(query) {
    return this.query(query).getSize();
  }

  /**
   * Returns a query operator that evaluates to true if the field's value is greater than the passed in value.
   * @param {*} value
   * @returns {QueryOperator}
   */
  greaterThan(value) {
    return new QueryOperator("greaterThan", [value]);
  }

  /**
   * Returns a query operator that evaluates to true if the field's value is greater than or equal to the passed in value.
   * @param {*} value
   * @returns {QueryOperator}
   */
  greaterThanOrEqualTo(value) {
    return new QueryOperator("greaterThanOrEqualTo", [value]);
  }

  /**
   * Returns a query operator that evaluates to true if the field's value is less than the passed in value.
   * @param {*} value
   * @returns {QueryOperator}
   */
  lessThan(value) {
    return new QueryOperator("lessThan", [value]);
  }

  /**
   * Returns a query operator that evaluates to true if the field's value is less than or equal to the passed in value.
   * @param {*} value
   * @returns {QueryOperator}
   */
  lessThanOrEqualTo(value) {
    return new QueryOperator("lessThanOrEqualTo", [value]);
  }

  /**
   * Loads an item or items from the database by id.
   * @param {String|String[]} idOrIds
   * @returns {ScriptDbMap|ScriptDbMap[]}
   */
  load(idOrIds) {
    if (Array.isArray(idOrIds)) {
      return idOrIds.map(id => this.load(id)).filter(item => item !== null);
    }
    const val = this._how.getProperty(idOrIds);
    return val ? new ScriptDbMap(JSON.parse(val)) : null;
  }

  /**
   * Returns a query operator that evaluates to true if the field's value does not match the passed in value.
   * @param {*} value
   * @returns {QueryOperator}
   */
  not(value) {
    return new QueryOperator("not", [value]);
  }

  /**
   * Helper function to perform deep matching for queries.
   * @param {*} expected 
   * @param {*} actual 
   * @returns {Boolean}
   */
  _matchField(expected, actual) {
    if (expected instanceof QueryOperator) {
      return expected.match(actual);
    }

    // Support array inclusion: query({tags: "common"}) matches {tags: ["tag1", "common"]}
    if (Array.isArray(actual) && !(expected instanceof QueryOperator) && typeof expected !== 'object') {
       return actual.includes(expected);
    }

    if (typeof expected === 'object' && expected !== null) {
      if (typeof actual !== 'object' || actual === null) {
        return false;
      }
      for (const k in expected) {
        if (!this._matchField(expected[k], actual[k])) {
          return false;
        }
      }
      return true;
    }
    return expected === actual;
  }

  /**
   * Query the database for matching items.
   * @param {Object} query
   * @returns {ScriptDbResult}
   */
  query(query) {
    const allItems = this._how.getProperties();
    const results = [];
    
    if (!allItems) {
      console.warn("Backend getProperties() returned null or undefined");
      return new ScriptDbResult([]);
    }

    for (const key in allItems) {
      try {
        const val = allItems[key];
        // Handle potential auto-parsing by backend or double-stringified data
        const itemData = typeof val === 'string' ? JSON.parse(val) : val;
        
        if (!itemData || typeof itemData !== 'object') {
          console.warn(`Skipping invalid item at key ${key}:`, itemData);
          continue;
        }

        let matches = true;
        
        if (query) {
          for (const field in query) {
            if (!this._matchField(query[field], itemData[field])) {
              matches = false;
              break;
            }
          }
        }
        
        if (matches) {
          results.push(new ScriptDbMap(itemData));
        }
      } catch (e) {
        console.error(`Error processing item at key ${key}: ${e.message}`);
      }
    }
    
    return new ScriptDbResult(results);
  }

  /**
   * Removes an item from the database.
   * @param {ScriptDbMap|Object|ScriptDbResult|String} item
   * @returns {void}
   */
  remove(item) {
    if (!item) return;
    
    // Handle string ID
    if (typeof item === 'string') {
      this.removeById(item);
      return;
    }

    // Handle ScriptDbResult (remove all items in the result set)
    if (item && typeof item.hasNext === 'function' && typeof item.next === 'function') {
      while (item.hasNext()) {
        this.remove(item.next());
      }
      return;
    }

    const id = item.id || (item.getId && typeof item.getId === 'function' ? item.getId() : null);
    if (id) {
      this._how.deleteProperty(id);
    }
  }

  /**
   * Removes items from the database.
   * @param {ScriptDbMap[]} items
   * @param {Boolean} atomic
   * @returns {MutationResult[]}
   */
  removeBatch(items, atomic) {
    return items.map(item => {
      try {
        const id = item.id || (item.getId && typeof item.getId === 'function' ? item.getId() : null);
        this.remove(item);
        return new MutationResult({ id, item });
      } catch (e) {
        return new MutationResult({ item, error: e.message });
      }
    });
  }

  /**
   * Removes an item from the database by id.
   * @param {String} id
   * @returns {void}
   */
  removeById(id) {
    this._how.deleteProperty(id);
  }

  /**
   * Removes items from the database by id.
   * @param {String[]} ids
   * @param {Boolean} atomic
   * @returns {MutationResult[]}
   */
  removeByIdBatch(ids, atomic) {
    return ids.map(id => {
      try {
        this.removeById(id);
        return new MutationResult({ id });
      } catch (e) {
        return new MutationResult({ id, error: e.message });
      }
    });
  }

  /**
   * Saves a new or existing item to the database.
   * @param {ScriptDbMap|Object} item
   * @returns {ScriptDbMap}
   */
  save(item) {
    if (typeof item !== 'object' || item === null) {
      throw new Error("Item must be an object");
    }
    const id = item.id || (item.getId && typeof item.getId === 'function' ? item.getId() : null) || Utilities.getUuid();
    
    // Deep clone data and exclude functions by using JSON roundtrip
    // This correctly mimics ScriptDb's behavior of storing plain data
    const data = JSON.parse(JSON.stringify(item));
    
    // Ensure functions from ScriptDbMap (if passed back in) are removed if they somehow survived stringify
    Object.keys(data).forEach(k => {
      if (typeof data[k] === 'function') {
        delete data[k];
      }
    });

    data.id = id;
    
    this._how.setProperty(id, JSON.stringify(data));
    return new ScriptDbMap(data);
  }

  /**
   * Saves items to the database.
   * @param {ScriptDbMap[]} items
   * @param {Boolean} atomic
   * @returns {MutationResult[]}
   */
  saveBatch(items, atomic) {
    return items.map(item => {
      try {
        const saved = this.save(item);
        return new MutationResult({ item: saved });
      } catch (e) {
        return new MutationResult({ item, error: e.message });
      }
    });
  }
}
