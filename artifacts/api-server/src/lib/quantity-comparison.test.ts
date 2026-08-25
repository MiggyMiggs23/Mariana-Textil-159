import assert from "node:assert/strict";
import test from "node:test";
import {
  formatQuantityThousandths,
  quantityToThousandths,
} from "./quantity-comparison";

test("treats equivalent decimal representations as equal", () => {
  assert.equal(
    quantityToThousandths("44499.000"),
    quantityToThousandths("44499.00"),
  );
  assert.equal(quantityToThousandths("0"), quantityToThousandths("0.000"));
});

test("compares and subtracts quantities at exactly three decimals", () => {
  const difference =
    quantityToThousandths("10000.125") -
    quantityToThousandths("9999.875");
  assert.equal(formatQuantityThousandths(difference), "0.250");
});

test("rounds extra precision consistently to thousandths", () => {
  assert.equal(quantityToThousandths("1.2344"), 1234);
  assert.equal(quantityToThousandths("1.2345"), 1235);
  assert.equal(quantityToThousandths("-1.2345"), -1235);
});