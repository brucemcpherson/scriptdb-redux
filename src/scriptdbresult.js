import { ScriptDbMap } from "./scriptdbmap.js";
import { SortStrategy } from "./sortstrategy.js";
import { SortDirection } from "./sortdirection.js";

/**
 * An object used to iterate through results returned by a query.
 */
export class ScriptDbResult {
  constructor(results = []) {
    this._results = results;
    this._cursor = 0;
  }

  /**
   * Returns a result set that is a subset of the original results.
   * @param {Integer} start
   * @param {Integer} limit
   * @returns {ScriptDbResult}
   */
  getResultSet(start, limit) {
    return new ScriptDbResult(this._results.slice(start, start + limit));
  }

  /**
   * Returns a copy of the results, restricted to the given size.
   * @param {Integer} number
   * @returns {ScriptDbResult}
   */
  limit(number) {
    return new ScriptDbResult(this._results.slice(0, number));
  }

  /**
   * Returns a copy of the results, offset by the given amount.
   * @param {Integer} number
   * @returns {ScriptDbResult}
   */
  startAt(number) {
    return new ScriptDbResult(this._results.slice(number));
  }

  /**
   * Returns a copy of the results, offset by the given amount and restricted to the given size.
   * @param {Integer} pageNumber
   * @param {Integer} pageSize
   * @returns {ScriptDbResult}
   */
  paginate(pageNumber, pageSize) {
    const start = (pageNumber - 1) * pageSize;
    return new ScriptDbResult(this._results.slice(start, start + pageSize));
  }

  /**
   * Returns true if there are more results in the result set.
   * @returns {Boolean}
   */
  hasNext() {
    return this._cursor < this._results.length;
  }

  /**
   * Returns the next item in the result set.
   * @returns {ScriptDbMap}
   */
  next() {
    if (!this.hasNext()) {
      return null;
    }
    return this._results[this._cursor++];
  }

  /**
   * Returns the number of items that match the query.
   * @returns {Integer}
   */
  getSize() {
    return this._results.length;
  }

  /**
   * Returns a copy of the result set, sorted by the given field and strategy.
   * Overloads:
   * sortBy(field)
   * sortBy(field, direction)
   * sortBy(field, strategy)
   * sortBy(field, direction, strategy)
   * 
   * @param {String} field
   * @param {SortDirection|SortStrategy} [p1]
   * @param {SortDirection|SortStrategy} [p2]
   * @returns {ScriptDbResult}
   */
  sortBy(field, p1, p2) {
    let direction = SortDirection.ASCENDING;
    let strategy = SortStrategy.LEXICAL;

    const params = [p1, p2];
    params.forEach(p => {
      if (Object.values(SortDirection).includes(p)) {
        direction = p;
      } else if (Object.values(SortStrategy).includes(p)) {
        strategy = p;
      }
    });

    const sorted = [...this._results].sort((a, b) => {
      let valA = a[field];
      let valB = b[field];

      if (strategy === SortStrategy.NUMERIC) {
        valA = Number(valA);
        valB = Number(valB);
      } else {
        // Force lexical comparison
        valA = String(valA || "");
        valB = String(valB || "");
      }

      if (valA < valB) return direction === SortDirection.ASCENDING ? -1 : 1;
      if (valA > valB) return direction === SortDirection.ASCENDING ? 1 : -1;
      return 0;
    });
    return new ScriptDbResult(sorted);
  }
}
