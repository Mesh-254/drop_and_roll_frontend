"use client";

import { useState } from "react";
import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { paymentApi } from "../../api/PaymentApi";
import { Loader2, AlertCircle } from "lucide-react";

export default function StripeCreditCard({
  txId,
  amount,
  guestEmail,
  isAuthenticated,
  onSuccess,
  onError,
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!stripe || !elements) {
      setError("Stripe not initialized");
      return;
    }
    setProcessing(true);
    setError(null);
    try {
      const result = await paymentApi.initiateStripeTransaction(
        txId,
        isAuthenticated,
        guestEmail
      );
      if (!result.success) {
        throw new Error(result.message);
      }
      const { client_secret } = result;
      const { error: confirmError, paymentIntent } =
        await stripe.confirmCardPayment(client_secret, {
          payment_method: {
            card: elements.getElement(CardElement),
            billing_details: { email: guestEmail || undefined },
          },
        });
      if (confirmError) {
        setError(confirmError.message);
        onError(confirmError.message);
      } else if (paymentIntent.status === "succeeded") {
        onSuccess();
      }
    } catch (err) {
      setError(err.message);
      onError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <CardElement
        options={{
          style: {
            base: {
              fontSize: "16px",
              color: "#1F2937",
              "::placeholder": { color: "#6B7280" },
            },
            invalid: { color: "#EF4444" },
          },
        }}
        className="w-full px-4 py-3 border border-border-strong rounded-lg bg-card"
      />
      {error && (
        <div className="flex items-center text-destructive text-sm">
          <AlertCircle size={16} className="mr-2" />
          {error}
        </div>
      )}
      <button
        onClick={handleSubmit}
        disabled={processing || !stripe || !elements}
        className="w-full bg-primary hover:bg-primary-hover disabled:bg-surface-hover disabled:cursor-not-allowed text-primary-foreground font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
      >
        {processing ? (
          <>
            <Loader2 size={20} className="mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          "Pay with Credit Card"
        )}
      </button>
    </div>
  );
}
