/**
 * ErrorBoundary.jsx
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * Error boundary component for graceful error handling in React.
 * Catches JavaScript errors anywhere in the child component tree and displays
 * a fallback UI with options to retry or report the issue.
 */

import React from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details for debugging
    if (process.env.NODE_ENV === "development") {
      console.error("[ErrorBoundary] Caught error:", error);
      console.error("[ErrorBoundary] Error info:", errorInfo);
    }
    
    this.setState({
      error,
      errorInfo,
    });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}

function ErrorFallback({ error, onRetry }) {
  const navigate = useNavigate();
  const errorMessage = error?.message || "An unexpected error occurred";
  const isNetworkError = error?.message?.includes("network") || error?.message?.includes("fetch");

  return (
    <div className="min-h-screen bg-red-50 dark:bg-red-900/10 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <div className="mb-4 inline-flex items-center justify-center w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-lg">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>

          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Something went wrong
          </h1>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 line-clamp-3">
            {isNetworkError
              ? "We couldn't reach the server. Please check your connection and try again."
              : errorMessage}
          </p>

          <div className="space-y-3">
            <button
              onClick={onRetry}
              className="w-full px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-all"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>

            <button
              onClick={() => navigate("/")}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg font-medium flex items-center justify-center gap-2 transition-all"
            >
              <Home className="h-4 w-4" />
              Go Home
            </button>
          </div>

          {process.env.NODE_ENV === "development" && error?.message && (
            <div className="mt-6 p-3 bg-gray-100 dark:bg-gray-900 rounded text-left">
              <p className="text-xs font-mono text-gray-700 dark:text-gray-300 break-words">
                {error.message}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
