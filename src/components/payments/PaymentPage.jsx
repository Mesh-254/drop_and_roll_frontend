"use client";

import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  PaymentRequestButtonElement,
  useStripe,
  useElements,
  PaymentElement,
} from "@stripe/react-stripe-js";
import { paymentApi } from "../../api/PaymentApi";
import { useAuth } from "../../contexts/AuthContext";
import {
  Loader2,
  CreditCard,
  AlertCircle,
  ArrowLeft,
  Shield,
  CheckCircle,
} from "lucide-react";

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// Payment Method Radio Button Component
function PaymentMethodOption({
  id,
  selected,
  onSelect,
  icon,
  label,
  description,
  color,
}) {
  return (
    <label
      className={`relative flex items-center p-6 rounded-2xl border-2 cursor-pointer transition-all duration-200 ${
        selected
          ? `border-${color}-500 bg-${color}-50 shadow-lg scale-[1.02]`
          : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-md"
      }`}
      onClick={() => onSelect(id)}
    >
      <input
        type="radio"
        name="payment-method"
        value={id}
        checked={selected}
        onChange={() => onSelect(id)}
        className="sr-only"
      />
      <div className="flex items-center flex-1">
        <div
          className={`flex items-center justify-center w-12 h-12 rounded-full ${
            color === "orange"
              ? "bg-orange-500"
              : color === "blue"
              ? "bg-blue-500"
              : color === "gray"
              ? "bg-gray-900"
              : color === "green"
              ? "bg-green-500"
              : "bg-yellow-500"
          } text-white mr-4`}
        >
          {icon}
        </div>
        <div className="flex-1">
          <div className="font-bold text-gray-900 text-lg">{label}</div>
          <div className="text-sm text-gray-600">{description}</div>
        </div>
        {selected && <CheckCircle className="h-6 w-6 text-orange-500 ml-4" />}
      </div>
    </label>
  );
}

// Stripe Credit Card Component
function StripeCreditCard({
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
      setError("Payment system not ready. Please try again.");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const result = await paymentApi.initiateStripeTransaction(
        txId,
        isAuthenticated,
        guestEmail,
        "card"
      );
      if (!result.success) {
        throw new Error(result.message || "Failed to initialize payment");
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
        throw confirmError;
      }

      if (paymentIntent.status === "succeeded") {
        onSuccess();
      } else {
        throw new Error("Payment did not succeed. Please try again.");
      }
    } catch (err) {
      setError(err.message || "An unexpected error occurred.");
      onError(err.message || "An unexpected error occurred.");
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
        className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white"
      />
      {error && (
        <div className="flex items-center text-red-500 text-sm">
          <AlertCircle size={16} className="mr-2" />
          {error}
        </div>
      )}
      <button
        onClick={handleSubmit}
        disabled={processing}
        className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
        aria-label="Pay with Credit Card"
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

// Stripe Apple Pay Component
function StripeApplePay({
  txId,
  amount,
  guestEmail,
  isAuthenticated,
  onSuccess,
  onError,
}) {
  const stripe = useStripe();
  const [paymentRequest, setPaymentRequest] = useState(null);
  const [error, setError] = useState(null);
  const [canMakePayment, setCanMakePayment] = useState(false);

  useEffect(() => {
    if (!stripe) return;

    const pr = stripe.paymentRequest({
      country: "GB",
      currency: "gbp",
      total: { label: "Total", amount: Math.round(amount * 100) },
      requestPayerName: true,
      requestPayerEmail: true,
    });

    pr.canMakePayment().then((result) => {
      if (result?.applePay) {
        setPaymentRequest(pr);
        setCanMakePayment(true);
      }
    });

    pr.on("paymentmethod", async (ev) => {
      try {
        const result = await paymentApi.initiateStripeTransaction(
          txId,
          isAuthenticated,
          guestEmail,
          "apple_pay"
        );
        if (!result.success) {
          throw new Error(result.message || "Failed to initialize payment");
        }

        const { client_secret } = result;

        const { error: confirmError, paymentIntent } =
          await stripe.confirmCardPayment(client_secret, {
            payment_method: ev.paymentMethod.id,
          });

        if (confirmError) {
          ev.complete("fail");
          throw confirmError;
        }

        ev.complete("success");
        if (paymentIntent.status === "succeeded") {
          onSuccess();
        } else {
          throw new Error("Payment did not succeed. Please try again.");
        }
      } catch (err) {
        ev.complete("fail");
        setError(err.message || "An unexpected error occurred.");
        onError(err.message || "An unexpected error occurred.");
      }
    });
  }, [stripe, txId, amount, guestEmail, isAuthenticated, onSuccess, onError]);

  if (!canMakePayment) {
    return (
      <p className="text-gray-600 text-sm">
        Apple Pay not available on this device.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center text-red-500 text-sm">
          <AlertCircle size={16} className="mr-2" />
          {error}
        </div>
      )}
      {paymentRequest && (
        <PaymentRequestButtonElement options={{ paymentRequest }} />
      )}
    </div>
  );
}

// Stripe Google Pay Component
function StripeGooglePay({
  txId,
  amount,
  guestEmail,
  isAuthenticated,
  onSuccess,
  onError,
}) {
  const stripe = useStripe();
  const [paymentRequest, setPaymentRequest] = useState(null);
  const [error, setError] = useState(null);
  const [canMakePayment, setCanMakePayment] = useState(false);

  useEffect(() => {
    if (!stripe) return;

    const pr = stripe.paymentRequest({
      country: "GB",
      currency: "gbp",
      total: { label: "Total", amount: Math.round(amount * 100) },
      requestPayerName: true,
      requestPayerEmail: true,
    });

    pr.canMakePayment().then((result) => {
      if (result?.googlePay) {
        setPaymentRequest(pr);
        setCanMakePayment(true);
      }
    });

    pr.on("paymentmethod", async (ev) => {
      try {
        const result = await paymentApi.initiateStripeTransaction(
          txId,
          isAuthenticated,
          guestEmail,
          "google_pay"
        );
        if (!result.success) {
          throw new Error(result.message || "Failed to initialize payment");
        }

        const { client_secret } = result;

        const { error: confirmError, paymentIntent } =
          await stripe.confirmCardPayment(client_secret, {
            payment_method: ev.paymentMethod.id,
          });

        if (confirmError) {
          ev.complete("fail");
          throw confirmError;
        }

        ev.complete("success");
        if (paymentIntent.status === "succeeded") {
          onSuccess();
        } else {
          throw new Error("Payment did not succeed. Please try again.");
        }
      } catch (err) {
        ev.complete("fail");
        setError(err.message || "An unexpected error occurred.");
        onError(err.message || "An unexpected error occurred.");
      }
    });
  }, [stripe, txId, amount, guestEmail, isAuthenticated, onSuccess, onError]);

  if (!canMakePayment) {
    return (
      <p className="text-gray-600 text-sm">
        Google Pay not available on this device.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center text-red-500 text-sm">
          <AlertCircle size={16} className="mr-2" />
          {error}
        </div>
      )}
      {paymentRequest && (
        <PaymentRequestButtonElement options={{ paymentRequest }} />
      )}
    </div>
  );
}

// StripeCashApp Component (outer wrapper)
function StripeCashApp({
  txId,
  amount,
  guestEmail,
  isAuthenticated,
  onSuccess,
  onError,
}) {
  const [clientSecret, setClientSecret] = useState("");
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const redirectStatus = params.get("redirect_status");
    const cs = params.get("payment_intent_client_secret");

    if (redirectStatus && cs) {
      setClientSecret(cs);
    } else {
      const fetchClientSecret = async () => {
        try {
          const result = await paymentApi.initiateStripeTransaction(
            txId,
            isAuthenticated,
            guestEmail,
            "cashapp"
          );
          if (result.success) {
            setClientSecret(result.client_secret);
          } else {
            throw new Error(result.message || "Failed to initialize payment");
          }
        } catch (err) {
          setError(err.message || "An unexpected error occurred.");
          onError(err.message || "An unexpected error occurred.");
        }
      };
      fetchClientSecret();
    }
  }, [txId, isAuthenticated, guestEmail, onError, location]);

  if (!clientSecret) {
    return <Loader2 className="h-6 w-6 animate-spin mx-auto" />;
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <CashAppForm
        onSuccess={onSuccess}
        onError={onError}
        processing={processing}
        setProcessing={setProcessing}
        error={error}
        setError={setError}
        clientSecret={clientSecret}
      />
    </Elements>
  );
}

// Inner Cash App Form
function CashAppForm({
  onSuccess,
  onError,
  processing,
  setProcessing,
  error,
  setError,
  clientSecret,
}) {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async () => {
    if (!stripe || !elements) {
      setError("Payment system not ready. Please try again.");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const result = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: "if_required",
      });

      if (result.error) {
        throw result.error;
      }

      if (result.paymentIntent?.status === "succeeded") {
        onSuccess();
      }
    } catch (err) {
      setError(err.message || "An unexpected error occurred.");
      onError(err.message || "An unexpected error occurred.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <PaymentElement />
      {error && (
        <div className="flex items-center text-red-500 text-sm">
          <AlertCircle size={16} className="mr-2" />
          {error}
        </div>
      )}
      <button
        onClick={handleSubmit}
        disabled={processing}
        className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
        aria-label="Pay with Cash App"
      >
        {processing ? (
          <>
            <Loader2 size={20} className="mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          "Pay with Cash App"
        )}
      </button>
    </div>
  );
}

// StripeAmazonPay Component (outer wrapper)
function StripeAmazonPay({
  txId,
  amount,
  guestEmail,
  isAuthenticated,
  onSuccess,
  onError,
}) {
  const [clientSecret, setClientSecret] = useState("");
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const redirectStatus = params.get("redirect_status");
    const cs = params.get("payment_intent_client_secret");

    if (redirectStatus && cs) {
      setClientSecret(cs);
    } else {
      const fetchClientSecret = async () => {
        try {
          const result = await paymentApi.initiateStripeTransaction(
            txId,
            isAuthenticated,
            guestEmail,
            "amazon_pay"
          );
          if (result.success) {
            setClientSecret(result.client_secret);
          } else {
            throw new Error(result.message || "Failed to initialize payment");
          }
        } catch (err) {
          setError(err.message || "An unexpected error occurred.");
          onError(err.message || "An unexpected error occurred.");
        }
      };
      fetchClientSecret();
    }
  }, [txId, isAuthenticated, guestEmail, onError, location]);

  if (!clientSecret) {
    return <Loader2 className="h-6 w-6 animate-spin mx-auto" />;
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <AmazonPayForm
        onSuccess={onSuccess}
        onError={onError}
        processing={processing}
        setProcessing={setProcessing}
        error={error}
        setError={setError}
        clientSecret={clientSecret}
      />
    </Elements>
  );
}

// Inner Amazon Pay Form
function AmazonPayForm({
  onSuccess,
  onError,
  processing,
  setProcessing,
  error,
  setError,
  clientSecret,
}) {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async () => {
    if (!stripe || !elements) {
      setError("Payment system not ready. Please try again.");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const result = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: "if_required",
      });

      if (result.error) {
        throw result.error;
      }

      if (result.paymentIntent?.status === "succeeded") {
        onSuccess();
      }
    } catch (err) {
      setError(err.message || "An unexpected error occurred.");
      onError(err.message || "An unexpected error occurred.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <PaymentElement />
      {error && (
        <div className="flex items-center text-red-500 text-sm">
          <AlertCircle size={16} className="mr-2" />
          {error}
        </div>
      )}
      <button
        onClick={handleSubmit}
        disabled={processing}
        className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
        aria-label="Pay with Amazon Pay"
      >
        {processing ? (
          <>
            <Loader2 size={20} className="mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          "Pay with Amazon Pay"
        )}
      </button>
    </div>
  );
}

// Main Payment Page Content
function PaymentPageContent() {
  const { txId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [transaction, setTransaction] = useState(null);
  const [amount, setAmount] = useState(0);
  const [guestEmail, setGuestEmail] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("card");
  const [processing, setProcessing] = useState(false);
  const [applePayAvailable, setApplePayAvailable] = useState(false);
  const [googlePayAvailable, setGooglePayAvailable] = useState(false);
  const [hasCaptured, setHasCaptured] = useState(false);

  const queryParams = new URLSearchParams(location.search);
  const paypalToken = queryParams.get("token");
  const payerId = queryParams.get("PayerID");
  const isCancelled = queryParams.get("cancelled");

  useEffect(() => {
    const checkWallets = async () => {
      const stripe = await stripePromise;
      const pr = stripe.paymentRequest({
        country: "GB",
        currency: "gbp",
        total: { label: "Test", amount: 1000 },
        requestPayerEmail: true,
      });
      const result = await pr.canMakePayment();
      setApplePayAvailable(!!result?.applePay);
      setGooglePayAvailable(!!result?.googlePay);
    };
    checkWallets();
  }, []);

  useEffect(() => {
    const loadTransaction = async () => {
      setLoading(true);
      try {
        const stateGuestEmail = location.state?.guestEmail;
        let effectiveGuestEmail = guestEmail;
        if (!isAuthenticated && stateGuestEmail) {
          effectiveGuestEmail = stateGuestEmail.toLowerCase();
          setGuestEmail(effectiveGuestEmail);
        }

        if (!isAuthenticated && !effectiveGuestEmail) {
          const storedGuestEmail = localStorage.getItem("guestEmail");
          if (storedGuestEmail) {
            effectiveGuestEmail = storedGuestEmail.toLowerCase();
            setGuestEmail(effectiveGuestEmail);
          }
        }

        if (!isAuthenticated && !effectiveGuestEmail) {
          setError("Guest email required for non-authenticated users");
          return;
        }

        const result = await paymentApi.getTransaction(
          txId,
          isAuthenticated,
          effectiveGuestEmail
        );
        if (result.success) {
          setTransaction(result.data);
          setAmount(Number.parseFloat(result.data.amount || 0));
          if (!isAuthenticated && result.data.guest_email && !guestEmail) {
            setGuestEmail(result.data.guest_email.toLowerCase());
          }
        } else {
          setError(result.message || "Failed to load transaction");
        }
      } catch (err) {
        setError(err.message || "Failed to load transaction");
      } finally {
        setLoading(false);
      }
    };
    loadTransaction();
  }, [txId, isAuthenticated, location.state, guestEmail]);

  useEffect(() => {
    if (paypalToken && payerId && transaction && !hasCaptured) {
      handleCapture();
    } else if (isCancelled && transaction) {
      handleCancel();
    }
  }, [paypalToken, payerId, isCancelled, transaction, hasCaptured]);

  const handleInitiatePayment = async () => {
    setProcessing(true);
    setError(null);
    try {
      if (!isAuthenticated && guestEmail) {
        localStorage.setItem("guestEmail", guestEmail.toLowerCase());
      }

      const result = await paymentApi.initiateTransaction(
        txId,
        isAuthenticated,
        guestEmail
      );
      if (result.approval_url) {
        window.location.href = result.approval_url;
      } else {
        setError(result.message || "Failed to initiate payment");
      }
    } catch (err) {
      setError(err.message || "Failed to initiate payment");
    } finally {
      setProcessing(false);
    }
  };

  const handleCapture = async () => {
    if (hasCaptured) return;
    setHasCaptured(true);
    setProcessing(true);
    setError(null);
    try {
      const result = await paymentApi.captureTransaction(
        txId,
        isAuthenticated,
        guestEmail
      );
      if (result.success) {
        navigate("/pay/success", {
          state: { transaction: result.data, guestEmail },
        });
      } else {
        setError(result.message || "Failed to capture payment");
      }
    } catch (err) {
      setError(err.message || "Failed to capture payment");
    } finally {
      setProcessing(false);
      if (!isAuthenticated) {
        localStorage.removeItem("guestEmail");
      }
    }
  };

  const handleCancel = async () => {
    setProcessing(true);
    try {
      const result = await paymentApi.cancelTransaction(
        txId,
        isAuthenticated,
        guestEmail
      );
      if (result.success) {
        navigate("/pay/cancel", {
          state: { transaction: result.data, guestEmail },
        });
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError("Failed to cancel payment");
    } finally {
      setProcessing(false);
      if (!isAuthenticated) {
        localStorage.removeItem("guestEmail");
      }
    }
  };

  const handleStripeSuccess = () => {
    if (!isAuthenticated) {
      localStorage.removeItem("guestEmail");
    }
    navigate("/pay/success", { state: { transaction, guestEmail } });
  };

  const handleStripeError = (message) => {
    setError(message);
  };

  const handleSelectMethod = (method) => {
    setSelectedPaymentMethod(method);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-12 w-12 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Payment Error
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate("/history")}
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-lg transition-colors w-full"
          >
            Back to Bookings
          </button>
        </div>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <AlertCircle className="h-16 w-16 text-orange-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            No Transaction Found
          </h2>
          <p className="text-gray-600 mb-6">
            Please start a new booking or check your history.
          </p>
          <button
            onClick={() => navigate("/history")}
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-lg transition-colors w-full"
          >
            View Bookings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back
          </button>
          <div className="text-sm text-gray-500">
            Transaction #{transaction.reference}
          </div>
        </div>

        {/* Transaction Summary Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            Complete Your Payment
          </h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-sm text-gray-600 mb-2">Amount Due</div>
              <div className="text-4xl font-bold text-gray-900">
                £{amount.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-2">Status</div>
              <div className="inline-flex items-center px-4 py-2 bg-orange-100 text-orange-700 rounded-full font-medium">
                {transaction.status.charAt(0).toUpperCase() +
                  transaction.status.slice(1)}
              </div>
            </div>
          </div>
        </div>

        {/* Payment Methods Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Choose Payment Method
          </h2>
          <div className="space-y-4 mb-8">
            <PaymentMethodOption
              id="paypal"
              selected={selectedPaymentMethod === "paypal"}
              onSelect={handleSelectMethod}
              icon={<CreditCard className="h-6 w-6" />}
              label="PayPal"
              description="Pay securely with your PayPal account"
              color="blue"
            />
            <PaymentMethodOption
              id="card"
              selected={selectedPaymentMethod === "card"}
              onSelect={handleSelectMethod}
              icon={<CreditCard className="h-6 w-6" />}
              label="Credit/Debit Card"
              description="Visa, MasterCard, Amex accepted"
              color="orange"
            />
            {applePayAvailable && (
              <PaymentMethodOption
                id="apple"
                selected={selectedPaymentMethod === "apple"}
                onSelect={handleSelectMethod}
                icon={<CheckCircle className="h-6 w-6" />}
                label="Apple Pay"
                description="Quick payment with Apple Wallet"
                color="gray"
              />
            )}
            {googlePayAvailable && (
              <PaymentMethodOption
                id="google"
                selected={selectedPaymentMethod === "google"}
                onSelect={handleSelectMethod}
                icon={<CheckCircle className="h-6 w-6" />}
                label="Google Pay"
                description="Pay with your Google account"
                color="blue"
              />
            )}
            <PaymentMethodOption
              id="cashapp"
              selected={selectedPaymentMethod === "cashapp"}
              onSelect={handleSelectMethod}
              icon={<CheckCircle className="h-6 w-6" />}
              label="Cash App"
              description="Simple mobile payments"
              color="green"
            />
            <PaymentMethodOption
              id="amazon"
              selected={selectedPaymentMethod === "amazon"}
              onSelect={handleSelectMethod}
              icon={<CheckCircle className="h-6 w-6" />}
              label="Amazon Pay"
              description="Use your Amazon account"
              color="yellow"
            />
          </div>

          {/* Payment Form */}
          <div className="bg-gray-50 rounded-2xl p-6 mb-6">
            {selectedPaymentMethod === "paypal" && (
              <button
                onClick={handleInitiatePayment}
                disabled={processing}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 rounded-lg transition-colors flex items-center justify-center text-lg"
              >
                <CreditCard className="h-6 w-6 mr-3" />
                Continue to PayPal
              </button>
            )}

            {selectedPaymentMethod === "card" && (
              <StripeCreditCard
                txId={txId}
                amount={amount}
                guestEmail={guestEmail}
                isAuthenticated={isAuthenticated}
                onSuccess={handleStripeSuccess}
                onError={handleStripeError}
              />
            )}

            {selectedPaymentMethod === "apple" && applePayAvailable && (
              <StripeApplePay
                txId={txId}
                amount={amount}
                guestEmail={guestEmail}
                isAuthenticated={isAuthenticated}
                onSuccess={handleStripeSuccess}
                onError={handleStripeError}
              />
            )}

            {selectedPaymentMethod === "google" && googlePayAvailable && (
              <StripeGooglePay
                txId={txId}
                amount={amount}
                guestEmail={guestEmail}
                isAuthenticated={isAuthenticated}
                onSuccess={handleStripeSuccess}
                onError={handleStripeError}
              />
            )}

            {selectedPaymentMethod === "cashapp" && (
              <StripeCashApp
                txId={txId}
                amount={amount}
                guestEmail={guestEmail}
                isAuthenticated={isAuthenticated}
                onSuccess={handleStripeSuccess}
                onError={handleStripeError}
              />
            )}

            {selectedPaymentMethod === "amazon" && (
              <StripeAmazonPay
                txId={txId}
                amount={amount}
                guestEmail={guestEmail}
                isAuthenticated={isAuthenticated}
                onSuccess={handleStripeSuccess}
                onError={handleStripeError}
              />
            )}
          </div>

          {/* Cancel Button */}
          <button
            onClick={handleCancel}
            disabled={processing}
            className="w-full bg-white hover:bg-gray-50 text-gray-700 font-bold py-4 rounded-lg border border-gray-300 transition-colors text-lg"
          >
            Cancel Payment
          </button>
        </div>

        {/* Security Footer */}
        <div className="bg-gray-100 rounded-2xl p-6">
          <div className="flex items-center justify-center text-gray-700">
            <Shield className="h-5 w-5 text-green-500 mr-2" />
            <span className="font-medium">
              Secure Payment • Your data is encrypted and protected
            </span>
          </div>
        </div>
      </div>

      {/* Processing Overlay */}
      {processing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 text-center">
            <Loader2 className="h-12 w-12 text-orange-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-900 font-bold text-xl">
              Processing your payment...
            </p>
            <p className="text-gray-600 mt-2">
              Please do not close this window
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Main Export with Elements Provider
export default function PaymentPage() {
  return (
    <Elements stripe={stripePromise}>
      <PaymentPageContent />
    </Elements>
  );
}
