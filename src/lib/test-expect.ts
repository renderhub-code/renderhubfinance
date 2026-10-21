// Subconjunto mínimo de `expect` (estilo vitest) sobre node:assert, para os testes rodarem com node:test.
import { deepStrictEqual, strictEqual } from "node:assert";

export function expect<T>(actual: T) {
  return {
    toBe: (expected: T) => strictEqual(actual, expected),
    toEqual: (expected: unknown) => deepStrictEqual(actual, expected),
    toHaveLength: (n: number) => strictEqual((actual as { length: number }).length, n),
    toMatchObject: (expected: Record<string, unknown>) => {
      const obj = actual as Record<string, unknown>;
      for (const [k, v] of Object.entries(expected)) deepStrictEqual(obj[k], v, `campo ${k}`);
    },
  };
}
