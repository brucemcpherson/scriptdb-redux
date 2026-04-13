import { ScriptDbMap } from "./scriptdbmap.js";

/**
 * An object indicating the success or failure of a batch operation.
 */
export class MutationResult {
  constructor({ item, error, id }) {
    this._item = item;
    this._error = error;
    this._id = id || (item ? item.getId() : null);
  }

  /**
   * Returns the error message if the operation failed.
   * @returns {String}
   */
  getErrorMessage() {
    return this._error || null;
  }

  /**
   * Returns the ID of the item.
   * @returns {String}
   */
  getId() {
    return this._id;
  }

  /**
   * Returns the item that was saved or removed.
   * @returns {ScriptDbMap}
   */
  getItem() {
    return this._item;
  }

  /**
   * Returns true if the operation was successful.
   * @returns {Boolean}
   */
  isOk() {
    return !this._error;
  }

  /**
   * Returns true if the operation was successful.
   * @returns {Boolean}
   */
  successful() {
    return this.isOk();
  }
}
