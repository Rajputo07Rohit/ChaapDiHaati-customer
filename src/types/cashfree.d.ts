interface CashfreeCheckoutResult {
  /** Set when the payment failed or the customer closed the popup. */
  error?: { message?: string };
  redirect?: boolean;
  paymentDetails?: { paymentMessage?: string };
}

interface CashfreeInstance {
  checkout: (options: {
    paymentSessionId: string;
    /** "_modal" opens Cashfree's popup; an element renders the checkout inline inside it. */
    redirectTarget?: "_modal" | "_self" | "_blank" | HTMLElement;
    appearance?: { width?: string; height?: string };
  }) => Promise<CashfreeCheckoutResult | undefined>;
}

interface Window {
  Cashfree?: (config: { mode: "sandbox" | "production" }) => CashfreeInstance;
}
