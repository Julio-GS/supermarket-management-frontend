/** Backend-safe payment method codes sent to / validated from API */
export type PaymentMethodCode = "cash" | "transfer" | "card" | "qr"

/** Display labels keyed by PaymentMethodCode */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethodCode, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  card: "Tarjeta",
  qr: "QR",
}

/** All supported payment method codes */
export const ALL_PAYMENT_METHODS: PaymentMethodCode[] = ["cash", "transfer", "card", "qr"]
