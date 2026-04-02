export function normalizeMobileNumber(value: string) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length > 10) {
    return digits.slice(2, 12);
  }
  return digits.slice(0, 10);
}

export function isValidMobileNumber(value: string) {
  return /^[6-9]\d{9}$/.test(normalizeMobileNumber(value));
}
