const BELOW_TWENTY = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];

const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function wordsBelowHundred(n: number): string {
  if (n < 20) return BELOW_TWENTY[n] ?? String(n);
  const t = Math.floor(n / 10);
  const u = n % 10;
  const ten = TENS[t] ?? "";
  return u ? `${ten} ${BELOW_TWENTY[u]}` : ten;
}

function wordsBelowThousand(n: number): string {
  if (n < 100) return wordsBelowHundred(n);
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const head = `${BELOW_TWENTY[h]} hundred`;
  if (!rest) return head;
  return `${head} and ${wordsBelowHundred(rest)}`;
}

const INDIAN_SUFFIX = ["", "thousand", "lakh", "crore"];

function indianRupeesCore(n: number): string {
  if (n === 0) return "zero rupees";
  const groups: number[] = [];
  let x = n;
  groups.push(x % 1000);
  x = Math.floor(x / 1000);
  while (x > 0) {
    groups.push(x % 100);
    x = Math.floor(x / 100);
  }
  groups.reverse();
  const L = groups.length;
  const parts: string[] = [];
  for (let i = 0; i < L; i++) {
    const val = groups[i];
    if (!val) continue;
    const suffixIdx = L - 1 - i;
    const suffix = INDIAN_SUFFIX[suffixIdx] ?? "crore";
    const isLast = i === L - 1;
    const w = isLast ? wordsBelowThousand(val) : wordsBelowHundred(val);
    parts.push(suffix ? `${w} ${suffix}` : w);
  }
  return `${parts.join(" ")} rupees`;
}

function capitalizeFirst(s: string): string {
  const t = s.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Spells out a rupee amount (Indian numbering) for printed bills. */
export function rupeesInWords(amount: number): string {
  if (!Number.isFinite(amount)) return "—";
  const sign = amount < 0 ? "Minus " : "";
  const a = Math.abs(amount);
  const rupees = Math.floor(a + 1e-9);
  const paise = Math.round((a - rupees) * 100) % 100;

  if (rupees === 0 && paise === 0) return `${sign}Zero rupees only`;

  let core: string;
  if (rupees === 0) {
    core = `${wordsBelowHundred(paise)} paise`;
  } else {
    core = indianRupeesCore(rupees);
    if (paise > 0) {
      core += ` and ${wordsBelowHundred(paise)} paise`;
    }
  }

  return `${sign}${capitalizeFirst(core)} only`;
}
