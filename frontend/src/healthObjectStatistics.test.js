import assert from "node:assert/strict";
import { test } from "node:test";
import { groupHealthObjects, normalizeObjectType, isUnder18Object, isElderlyObject } from "./healthObjectStatistics.js";

test("hamlet object counts match object chart despite missing or conflicting birth dates", () => {
  const customers = [
    { objectType: "DƯỚI 18", birthDate: null, hamlet: "A" },
    { objectType: "  dưới   18 ", birthDate: "1990-01-01", hamlet: "B" },
    { objectType: "DƯỚI 18".normalize("NFD"), hamlet: null },
    { objectType: "NGƯỜI DÂN", birthDate: "2015-01-01", hamlet: "A" },
    { objectType: "NGƯỜI CAO TUỔI", hamlet: "B" },
    { objectType: "người cao tuổi", hamlet: null },
    { objectType: "KHÁC NGƯỜI CAO TUỔI", hamlet: "A" },
    { objectType: null, birthDate: "2015-01-01", hamlet: "A" },
  ];
  const groups = groupHealthObjects(customers, []);
  for (const [label, predicate, expected] of [["DƯỚI 18", isUnder18Object, 3], ["NGƯỜI CAO TUỔI", isElderlyObject, 2]]) {
    const chartCount = groups.find(group => group.key === normalizeObjectType(label)).records.length;
    const hamletCount = [...new Set(customers.map(customer => customer.hamlet))]
      .reduce((total, hamlet) => total + customers.filter(customer => customer.hamlet === hamlet).filter(predicate).length, 0);
    assert.equal(customers.filter(predicate).length, expected);
    assert.equal(hamletCount, chartCount);
  }
});