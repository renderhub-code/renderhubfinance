export interface CashflowCell {
  expected: number;
  realized: number;
}

/** Stocks use the closing balance; flows use the sum of the period. */
export function periodTotal(months: CashflowCell[], closingBalance = false): CashflowCell {
  if (closingBalance) return months.at(-1) ?? { expected: 0, realized: 0 };
  return months.reduce(
    (sum, month) => ({ expected: sum.expected + month.expected, realized: sum.realized + month.realized }),
    { expected: 0, realized: 0 },
  );
}