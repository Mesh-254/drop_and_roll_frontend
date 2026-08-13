// PaymentCancel.jsx (Added localStorage clear for guestEmail after cancel)
"use client";

import { useNavigate, useLocation } from "react-router-dom";
import { XCircle, ArrowLeft, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";

export default function PaymentCancel() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const transaction = location.state?.transaction;

  useEffect(() => {
    if (!isAuthenticated) {
      localStorage.removeItem("guestEmail");
      localStorage.removeItem("guestIdentifier");
    }
  }, [isAuthenticated]);

  return (
    <div className="min-h-screen bg-muted py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Cancel Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-destructive-surface rounded-full mb-4">
            <XCircle className="h-12 w-12 text-destructive" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Payment Cancelled
          </h1>
          <p className="text-muted-foreground">
            Your payment was cancelled and no charges were made.
          </p>
        </div>

        {/* Transaction Details */}
        {transaction && (
          <div className="bg-card rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-foreground mb-4">
              Transaction Details
            </h2>

            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-muted-foreground">Transaction ID:</span>
                <span className="font-mono text-sm text-foreground">
                  {transaction.reference}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-muted-foreground">Amount:</span>
                <span className="text-2xl font-bold text-foreground">
                  GBP {Number.parseFloat(transaction.amount).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-muted-foreground">Status:</span>
                <span className="px-3 py-1 bg-destructive-surface text-destructive rounded-full text-sm font-medium">
                  Cancelled
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Information Box */}
        <div className="bg-info-surface rounded-2xl p-6 mb-6">
          <h3 className="text-lg font-bold text-foreground mb-3">
            What Happened?
          </h3>
          <p className="text-muted-foreground mb-4">
            Your payment was cancelled before completion. This could happen if:
          </p>
          <ul className="space-y-2 text-muted-foreground">
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-info rounded-full mt-2 mr-3 flex-shrink-0"></span>
              You clicked "Cancel" during the payment process
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-info rounded-full mt-2 mr-3 flex-shrink-0"></span>
              You closed the payment window before completing
            </li>
            <li className="flex items-start">
              <span className="inline-block w-2 h-2 bg-info rounded-full mt-2 mr-3 flex-shrink-0"></span>
              There was a technical issue with the payment provider
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          {transaction && (
            <button
              onClick={() => navigate(`/pay/${transaction.id}`)}
              className="flex-1 bg-primary hover:bg-primary-hover text-primary-foreground font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
            >
              <RefreshCw className="h-5 w-5 mr-2" />
              Try Payment Again
            </button>
          )}

          <button
            onClick={() => navigate("/history")}
            className="flex-1 bg-card hover:bg-muted text-muted-foreground font-bold py-3 px-6 rounded-lg border border-border-strong transition-colors flex items-center justify-center"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Bookings
          </button>
        </div>

        {/* Support Information */}
        <div className="bg-muted rounded-2xl p-6 mt-6">
          <h3 className="text-lg font-bold text-foreground mb-3">Need Help?</h3>
          <p className="text-muted-foreground mb-4">
            If you're experiencing issues with payment, our support team is here
            to help.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="mailto:support@example.com"
              className="flex-1 bg-surface hover:bg-card text-foreground font-bold py-2 px-4 rounded-lg transition-colors text-center"
            >
              Contact Support
            </a>
            <a
              href="tel:+1234567890"
              className="flex-1 bg-card hover:bg-muted text-muted-foreground font-bold py-2 px-4 rounded-lg border border-border-strong transition-colors text-center"
            >
              Call Us
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}