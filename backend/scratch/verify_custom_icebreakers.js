// Verification test script for custom icebreaker sanitization logic
const assert = require("assert");

function sanitizeOpeners(openers) {
  if (!Array.isArray(openers)) return [];
  return openers
    .filter(
      (o) =>
        o &&
        typeof o.prompt === "string" &&
        typeof o.response === "string"
    )
    .slice(0, 3)
    .map((o) => {
      const entry = {
        prompt: o.prompt.trim().substring(0, 200),
        response: o.response.trim().substring(0, 200),
      };
      if (typeof o.category === "string" && o.category.trim()) {
        entry.category = o.category.trim().substring(0, 50);
      }
      if (typeof o.theme === "string" && o.theme.trim()) {
        entry.theme = o.theme.trim().substring(0, 30);
      }
      if (typeof o.is_custom === "boolean") {
        entry.is_custom = o.is_custom;
      }
      return entry;
    });
}

// 1. Legacy opener test
const legacy = [
  { prompt: "My go-to icebreaker is...", response: "Asking about favorite travel destinations." }
];
const sanitizedLegacy = sanitizeOpeners(legacy);
assert.strictEqual(sanitizedLegacy.length, 1);
assert.strictEqual(sanitizedLegacy[0].prompt, "My go-to icebreaker is...");
assert.strictEqual(sanitizedLegacy[0].response, "Asking about favorite travel destinations.");
assert.strictEqual(sanitizedLegacy[0].category, undefined);
assert.strictEqual(sanitizedLegacy[0].theme, undefined);
assert.strictEqual(sanitizedLegacy[0].is_custom, undefined);
console.log("PASS: Legacy opener backwards compatibility verified.");

// 2. Custom opener test
const custom = [
  {
    prompt: "Hot take: Pineapple on pizza is the pinnacle of culinary balance",
    response: "Sweet, acidic, savory, and salty all in one bite. Fight me!",
    category: "hottakes",
    theme: "sunset",
    is_custom: true
  },
  {
    prompt: "Two truths & a lie: I've climbed Kilimanjaro, lived in Tokyo, can't ride a bike",
    response: "Guess which one is false when you say hi!",
    category: "fun",
    theme: "emerald",
    is_custom: true
  }
];
const sanitizedCustom = sanitizeOpeners(custom);
assert.strictEqual(sanitizedCustom.length, 2);
assert.strictEqual(sanitizedCustom[0].category, "hottakes");
assert.strictEqual(sanitizedCustom[0].theme, "sunset");
assert.strictEqual(sanitizedCustom[0].is_custom, true);
assert.strictEqual(sanitizedCustom[1].category, "fun");
assert.strictEqual(sanitizedCustom[1].theme, "emerald");
assert.strictEqual(sanitizedCustom[1].is_custom, true);
console.log("PASS: Custom opener attributes preserved verified.");

// 3. Length capping test
const longEntry = [
  {
    prompt: "A".repeat(300),
    response: "B".repeat(300),
    category: "C".repeat(100),
    theme: "D".repeat(50),
    is_custom: true
  }
];
const sanitizedLong = sanitizeOpeners(longEntry);
assert.strictEqual(sanitizedLong[0].prompt.length, 200);
assert.strictEqual(sanitizedLong[0].response.length, 200);
assert.strictEqual(sanitizedLong[0].category.length, 50);
assert.strictEqual(sanitizedLong[0].theme.length, 30);
console.log("PASS: String truncation & safety verified.");

// 4. Max 3 limit test
const fourEntries = [
  { prompt: "P1", response: "R1" },
  { prompt: "P2", response: "R2" },
  { prompt: "P3", response: "R3" },
  { prompt: "P4", response: "R4" }
];
const sanitizedFour = sanitizeOpeners(fourEntries);
assert.strictEqual(sanitizedFour.length, 3);
console.log("PASS: Max 3 limit enforced verified.");

console.log("ALL TESTS PASSED SUCCESSFULLY!");
