// Common Philippine e-wallets and banks customers pay with via GCash/e-payment
// at checkout. "Other" (handled separately in the picker UI) covers anything
// not on this list, e.g. an international e-wallet.
export const PAYMENT_PROVIDERS = [
  "GCash",
  "Maya (PayMaya)",
  "GrabPay",
  "ShopeePay",
  "Coins.ph",
  "GoTyme Bank",
  "UnionDigital Bank",
  "Tonik Bank",
  "UNObank",
  "BDO",
  "BPI (Bank of the Philippine Islands)",
  "Metrobank",
  "Landbank",
  "PNB (Philippine National Bank)",
  "China Bank",
  "Security Bank",
  "RCBC",
  "UnionBank",
  "EastWest Bank",
  "PSBank",
  "Robinsons Bank",
  "AUB (Asia United Bank)",
  "Maybank Philippines",
  "DBP (Development Bank of the Philippines)",
] as const;
