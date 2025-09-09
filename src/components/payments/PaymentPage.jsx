"use client";

import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { paymentApi } from "../../api/PaymentApi";
import { useAuth } from "../../contexts/AuthContext";
import StripeCreditCard from "./StripeCreditCard";
import StripeApplePay from "./StripeApplePay";
import {
  Loader2,
  CreditCard,
  AlertCircle,
  ArrowLeft,
  Shield,
} from "lucide-react";

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export default function PaymentPage() {
  const { txId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [transaction, setTransaction] = useState(
    location.state?.transaction || null
  );
  const [guestEmail, setGuestEmail] = useState(
    location.state?.guestEmail?.toLowerCase() || ""
  );

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("paypal");
  const [applePayAvailable, setApplePayAvailable] = useState(false);

  const queryParams = new URLSearchParams(location.search);
  const paypalToken = queryParams.get("token");
  const isCancelled = queryParams.has("cancelled");
  const [hasCaptured, setHasCaptured] = useState(false);

  useEffect(() => {
    const checkApplePayAvailability = async () => {
      if (window.ApplePaySession && window.ApplePaySession.canMakePayments()) {
        setApplePayAvailable(true);
      }
    };
    checkApplePayAvailability();
  }, []);

  useEffect(() => {
    const loadTransactionData = async () => {
      try {
        let effectiveGuestEmail = guestEmail.toLowerCase();
        if (
          !isAuthenticated &&
          !effectiveGuestEmail &&
          transaction?.guest_email
        ) {
          effectiveGuestEmail = transaction.guest_email;
          setGuestEmail(effectiveGuestEmail);
        }

        // New: Retrieve guestEmail from localStorage if not in state (for PayPal redirect)
        if (!isAuthenticated && !effectiveGuestEmail) {
          const storedGuestEmail = localStorage.getItem("guestEmail");
          if (storedGuestEmail) {
            effectiveGuestEmail = storedGuestEmail.toLowerCase();
            setGuestEmail(effectiveGuestEmail);
          }
        }

        if (!isAuthenticated && !effectiveGuestEmail) {
          setError("Guest email not available");
          setLoading(false);
          return;
        }

        const result = await paymentApi.getTransaction(
          txId,
          isAuthenticated,
          effectiveGuestEmail
        );

        if (result.success) {
          setTransaction(result.data);
          if (!isAuthenticated && result.data.guest_email && !guestEmail) {
            setGuestEmail(result.data.guest_email);
          }
          if (result.data.status === "success") {
            navigate("/pay/success", {
              state: {
                transaction: result.data,
                guestEmail: effectiveGuestEmail,
              },
            });
          } else if (result.data.status === "cancelled") {
            navigate("/pay/cancel", {
              state: {
                transaction: result.data,
                guestEmail: effectiveGuestEmail,
              },
            });
          } else if (Number.parseFloat(result.data.amount || 0) === 0) {
            navigate("/pay/success", {
              state: {
                transaction: result.data,
                guestEmail: effectiveGuestEmail,
              },
            });
          }
        } else {
          console.error("getTransaction failed:", result);
          setError(result.message || "Failed to load transaction details");
        }
      } catch (err) {
        console.error("loadTransaction error:", err, err.response?.data);
        setError(
          "Failed to load transaction details: " +
            (err.response?.data?.detail || err.message)
        );
      } finally {
        setLoading(false);
      }
    };

    loadTransactionData();
  }, [txId, isAuthenticated, guestEmail, navigate]);

  useEffect(() => {
    if (!loading && transaction?.status === "pending" && paypalToken) {
      handleCapture();
    } else if (!loading && isCancelled) {
      handleCancel();
    }
  }, [loading, transaction, paypalToken, isCancelled]);

  // Optional: Polling for webhook delay
  useEffect(() => {
    if (!loading && transaction?.status === "pending" && !paypalToken) {
      const pollInterval = setInterval(async () => {
        try {
          const result = await paymentApi.getTransaction(
            txId,
            isAuthenticated,
            guestEmail
          );
          if (result.success && result.data.status !== "pending") {
            setTransaction(result.data);
            clearInterval(pollInterval);
            if (result.data.status === "success") {
              navigate("/pay/success", {
                state: { transaction: result.data, guestEmail },
              });
            } else if (result.data.status === "cancelled") {
              navigate("/pay/cancel", {
                state: { transaction: result.data, guestEmail },
              });
            }
          }
        } catch (err) {
          console.error("Poll error:", err);
        }
      }, 5000);
      return () => clearInterval(pollInterval);
    }
  }, [loading, transaction, txId, isAuthenticated, guestEmail, navigate]);

  const handleInitiatePayment = async () => {
    setProcessing(true);
    setError(null);
    try {
      // New: Store guestEmail in localStorage before redirect (for guest users)
      if (!isAuthenticated && guestEmail) {
        localStorage.setItem("guestEmail", guestEmail);
      }

      const initiateResult = await paymentApi.initiateTransaction(
        txId,
        isAuthenticated,
        guestEmail
      );
      console.log("Initiate result:", initiateResult);
      if (
        initiateResult.success &&
        initiateResult.links &&
        Array.isArray(initiateResult.links)
      ) {
        const approvalUrl = initiateResult.links.find(
          (link) => link.rel === "approve"
        )?.href;
        if (approvalUrl) {
          console.log("Redirecting to PayPal approval URL:", approvalUrl);
          window.location.href = approvalUrl;
        } else {
          console.error("No approval URL in PayPal response:", initiateResult);
          throw new Error("No approval URL found in PayPal response");
        }
      } else {
        console.error("Invalid initiate result:", initiateResult);
        setError(
          initiateResult.error ||
            "Failed to initiate payment: Invalid response from server"
        );
      }
    } catch (err) {
      console.error("Initiate payment error:", err);
      setError(err.message || "Failed to initiate payment");
    } finally {
      setProcessing(false);
    }
  };

  const handleCapture = async () => {
    if (hasCaptured) return; // Prevent multiple captures
    setHasCaptured(true);
    setProcessing(true);
    setError(null);
    try {
      const result = await paymentApi.captureTransaction(
        txId,
        isAuthenticated,
        guestEmail
      );
      if (result.success === false) {
        console.error("Capture failed:", result);
        setError(result.message || "Failed to capture payment");
      } else {
        setTransaction(result.data);
        console.log("Capture successful, navigating to success");
        navigate("/pay/success", {
          state: { transaction: result.data, guestEmail },
        });
      }
    } catch (err) {
      console.error("Capture error:", err);
      setError(err.message || "Failed to complete payment capture");
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    try {
      const result = await paymentApi.cancelTransaction(
        txId,
        isAuthenticated,
        guestEmail
      );
      console.log("Cancel result:", result);
      navigate("/pay/cancel", { state: { transaction } });
    } catch (err) {
      console.error("Cancel error:", err);
      setError("Failed to cancel transaction: " + err.message);
      navigate("/pay/cancel", { state: { transaction } });
    } finally {
      // New: Clear guestEmail from localStorage after cancel
      if (!isAuthenticated) {
        localStorage.removeItem("guestEmail");
      }
    }
  };

  const handleStripeSuccess = () => {
    navigate("/pay/success", {
      state: { transaction, guestEmail },
    });
  };

  const handleStripeError = (errorMessage) => {
    setError(errorMessage);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-orange-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">
            Loading payment details...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Payment Error
          </h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate("/history")}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            Return to Bookings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-600 hover:text-gray-800 mb-4 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Complete Payment
          </h1>
          <p className="text-gray-600">Choose your preferred payment method</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <CreditCard className="h-6 w-6 text-orange-500 mr-2" />
            Payment Details
          </h2>

          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600">Transaction ID:</span>
              <span className="font-mono text-sm text-gray-900">
                {transaction?.reference}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600">Amount:</span>
              <span className="text-2xl font-bold text-gray-900">
                KSh {Number.parseFloat(transaction?.amount || 0).toFixed(2)}{" "}
                (~USD{" "}
                {(
                  Number.parseFloat(transaction?.amount || 0) * 0.00775
                ).toFixed(2)}
                )
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600">Status:</span>
              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium capitalize">
                {transaction?.status}
              </span>
            </div>
            {transaction?.booking && (
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600">Booking ID:</span>
                <span className="font-mono text-sm text-gray-900">
                  {transaction.booking}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Choose Payment Method
          </h2>

          <div className="space-y-4 mb-6">
            {/* PayPal Option */}
            <label className="flex items-center p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                name="paymentMethod"
                value="paypal"
                checked={selectedPaymentMethod === "paypal"}
                onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300"
              />
              <div className="ml-3 flex items-center">
                <div className="bg-blue-600 text-white px-3 py-1 rounded text-sm font-bold mr-3">
                  PayPal
                </div>
                <span className="text-gray-900 font-medium">
                  Pay with PayPal
                </span>
              </div>
            </label>

            {/* Credit Card Option */}
            <label className="flex items-center p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                name="paymentMethod"
                value="creditcard"
                checked={selectedPaymentMethod === "creditcard"}
                onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300"
              />
              <div className="ml-3 flex items-center">
                <CreditCard className="h-6 w-6 text-gray-600 mr-3" />
                <span className="text-gray-900 font-medium">
                  Credit or Debit Card
                </span>
              </div>
            </label>

            {/* Apple Pay Option - Only show if available */}
            {applePayAvailable && (
              <label className="flex items-center p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="applepay"
                  checked={selectedPaymentMethod === "applepay"}
                  onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                  className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300"
                />
                <div className="ml-3 flex items-center">
                  <div className="bg-black text-white px-3 py-1 rounded text-sm font-bold mr-3">
                    Apple Pay
                  </div>
                  <span className="text-gray-900 font-medium">
                    Pay with Apple Pay
                  </span>
                </div>
              </label>
            )}
          </div>

          {processing && (
            <div className="text-center py-8">
              <Loader2 className="h-12 w-12 text-orange-500 animate-spin mx-auto mb-4" />
              <p className="text-gray-600 font-medium">Processing payment...</p>
            </div>
          )}

          {!processing && (
            <div className="space-y-4">
              {selectedPaymentMethod === "paypal" && (
                <div className="space-y-4">
                  <p className="text-gray-600 text-sm mb-4">
                    Click below to proceed with your PayPal payment. You will be
                    redirected to PayPal to complete the transaction.
                  </p>
                  <button
                    onClick={handleInitiatePayment}
                    disabled={processing}
                    className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
                  >
                    <CreditCard className="h-5 w-5 mr-2" />
                    Pay with PayPal
                  </button>
                </div>
              )}

              {selectedPaymentMethod === "creditcard" && (
                <Elements stripe={stripePromise}>
                  <StripeCreditCard
                    txId={txId}
                    amount={Number.parseFloat(transaction?.amount || 0)}
                    guestEmail={guestEmail}
                    isAuthenticated={isAuthenticated}
                    onSuccess={handleStripeSuccess}
                    onError={handleStripeError}
                  />
                </Elements>
              )}

              {selectedPaymentMethod === "applepay" && applePayAvailable && (
                <Elements stripe={stripePromise}>
                  <StripeApplePay
                    txId={txId}
                    amount={Number.parseFloat(transaction?.amount || 0)}
                    guestEmail={guestEmail}
                    isAuthenticated={isAuthenticated}
                    onSuccess={handleStripeSuccess}
                    onError={handleStripeError}
                  />
                </Elements>
              )}

              <div className="flex flex-col sm:flex-row gap-4 mt-6">
                <button
                  onClick={handleCancel}
                  disabled={processing}
                  className="flex-1 bg-white hover:bg-gray-50 text-gray-700 font-bold py-3 px-6 rounded-lg border border-gray-300 transition-colors"
                >
                  Cancel Payment
                </button>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mt-6">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <Shield className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-gray-900">
                      Secure Payment
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Your payment information is encrypted and secure. We
                      support PayPal, credit cards, and Apple Pay for your
                      convenience.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
