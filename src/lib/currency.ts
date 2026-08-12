const egpFormatter = new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP" });

export function formatEGP(amountQirsh: number): string {
  if (!Number.isInteger(amountQirsh) || amountQirsh < 0) return "—";
  return egpFormatter.format(amountQirsh / 100);
}
