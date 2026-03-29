/** Per-line offer: amount off (currency), capped at line gross. */
export function clampLineOffer(lineGross: number, lineOffer: number): number {
  const g = Math.max(0, lineGross);
  const o = Math.max(0, Number(lineOffer) || 0);
  return Math.min(o, g);
}

export function lineNetAfterOffer(lineGross: number, lineOffer: number): number {
  const g = Math.max(0, lineGross);
  return Math.max(0, g - clampLineOffer(g, lineOffer));
}

/** Bill-level offer: amount off after line nets, capped at sum of line nets. */
export function clampBillOffer(linesNetSum: number, billOffer: number): number {
  const s = Math.max(0, linesNetSum);
  const o = Math.max(0, Number(billOffer) || 0);
  return Math.min(o, s);
}

export function grandTotalAfterBillOffer(linesNetSum: number, billOffer: number): number {
  return Math.max(0, linesNetSum - clampBillOffer(linesNetSum, billOffer));
}
