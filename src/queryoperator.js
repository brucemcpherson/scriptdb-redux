/**
 * An object used to construct advanced queries.
 */
export class QueryOperator {
  constructor(operator, values) {
    this.operator = operator;
    this.values = values;
  }

  /**
   * Matches a value against the operator.
   * @param {*} value
   * @returns {Boolean}
   */
  match(value) {
    switch (this.operator) {
      case "anyOf":
        return this.values.includes(value);
      case "anyValue":
        return value !== null && typeof value !== "undefined";
      case "between":
        return value >= this.values[0] && value < this.values[1];
      case "greaterThan":
        return value > this.values[0];
      case "greaterThanOrEqualTo":
        return value >= this.values[0];
      case "lessThan":
        return value < this.values[0];
      case "lessThanOrEqualTo":
        return value <= this.values[0];
      case "not":
        return value !== this.values[0];
      default:
        return false;
    }
  }
}
