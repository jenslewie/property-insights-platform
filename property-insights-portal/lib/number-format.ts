const numericFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 20,
});

export function formatNumericValue(value: number) {
  return numericFormatter.format(value);
}

export function formatCompactNumber(value: number) {
  return `${Math.round(value / 1000)}k`;
}
