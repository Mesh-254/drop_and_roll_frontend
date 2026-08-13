"use client";

import { useState, useEffect } from "react";
import {
  PaymentRequestButtonElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { paymentApi } from "../../api/PaymentApi";
import { Loader2, AlertCircle } from "lucide-react";

export default function StripeApplePay({
  txId,
  amount,
  guestEmail,
  isAuthenticated,
  onSuccess,
  onError,
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [paymentRequest, setPaymentRequest] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!stripe || !elements) return;
    const init = async () => {
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
        const pr = stripe.paymentRequest({
          country: "KE",
          currency: "kes",
          total: { label: "Booking Payment", amount: Math.round(amount * 100) },
          requestPayerEmail: true,
        });
        const canPay = await pr.canMakePayment();
        if (canPay?.applePay) {
          pr.on("paymentmethod", async (ev) => {
            const { error: confirmError } = await stripe.confirmCardPayment(
              client_secret,
              { payment_method: ev.paymentMethod.id },
              { handleActions: false }
            );
            if (confirmError) {
              ev.complete("fail");
              setError(confirmError.message);
              onError(confirmError.message);
            } else {
              ev.complete("success");
              onSuccess();
            }
          });
          setPaymentRequest(pr);
        } else {
          setError("Apple Pay is not available on this device");
        }
      } catch (err) {
        setError(err.message);
        onError(err.message);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [
    stripe,
    elements,
    txId,
    amount,
    guestEmail,
    isAuthenticated,
    onSuccess,
    onError,
  ]);

  if (loading) {
    return <Loader2 className="h-6 w-6 text-brand-text animate-spin mx-auto" />;
  }
  if (!paymentRequest) return null;

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center text-destructive text-sm">
          <AlertCircle size={16} className="mr-2" />
          {error}
        </div>
      )}
      <PaymentRequestButtonElement options={{ paymentRequest }} />
    </div>
  );
}
