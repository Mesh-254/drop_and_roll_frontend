// App.jsx
//
// ── Fix changelog ────────────────────────────────────────────────────────────
// FIX-C  Route order: /pay/success and /pay/cancel appeared AFTER /pay/:txId
//        in the route list. React Router v6 matches by specificity, but when
//        routes are peers under the same <Routes>, a literal path like
//        /pay/success IS more specific than a dynamic :txId param. However
//        keeping the literal routes declared first makes the intent explicit
//        and prevents any future regression if route nesting changes.
//        Moved /pay/success and /pay/cancel ABOVE /pay/:txId.
//
// FIX-D  Missing routes: /invoices/:id (InvoiceDetailPage) and /billing
//        (BillingPage) were navigated to by useBulkUpload, BulkPaymentPage,
//        and InvoiceDetailPage but never registered, causing blank-page 404s.
//        Both routes added under ProtectedRoute allowedRoles=["customer"].

import { Routes, Route, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { Toaster } from "react-hot-toast";
import ErrorBoundary from "./components/common/ErrorBoundary";
import { AuthModalProvider, useAuthModal } from "./contexts/AuthModalContext";
import { useAuth } from "./contexts/AuthContext";
import AuthModal from "./components/auth/AuthModal";
import { QuoteProvider } from "./contexts/QuoteContext";
import Header from "./components/common/Header";
import Hero from "./components/landingPage/Hero";
import Services from "./components/landingPage/Services";
import About from "./components/about/About";
import ContactForm from "./components/contact/ContactForm";
import Footer from "./components/common/Footer";
import AdminLiveTrackingDashboard from "./components/admin/admin-live-tracking-dashboard";
import FAQ from "./components/contact/faq";
import "./App.css";
import "./globals.css";
import ForgotPassword from "./components/auth/forgot-password";
import ResetPassword from "./components/auth/reset-password";

import LoginPage from "./components/auth/LoginPage";
import RegisterPage from "./components/auth/RegisterPage";
import EmailConfirmationPage from "./components/auth/EmailConfirmationPage";
import AccountConfirmedPage from "./components/auth/AccountConfirmedPage";
import ResendConfirmationPage from "./components/auth/ResendConfirmationPage";
import CheckEmail from "./components/auth/check-email";

import QuotePage from "./components/quote/QuotePage";
import BookingPage from "./components/bookings/BookingPage";
import BookingHistory from "./components/bookings/BookingHistory";

import ProfilePage from "./components/profile/ProfilePage";

import PaymentPage from "./components/payments/PaymentPage";
import ResumePaymentPage from "./components/payments/ResumePaymentPage";
import BulkPaymentPage from "./components/payments/BulkPaymentPage";
import PaymentSuccess from "./components/payments/PaymentSuccess";
import PaymentCancel from "./components/payments/PaymentCancel";
// FIX-D: import the invoice/billing pages that were missing from the router
import BillingPage from "./components/payments/BillingPage";
import InvoiceDetailPage from "./components/payments/InvoiceDetailPage";
// FIX-E: import the missing bulk payment success page
import BulkPaymentSuccessPage from "./components/payments/BulkPaymentSuccessPage";



import DriverDashboard from "./components/driver/driver-dashboard";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import {
  BulkUploadDashboard,
  BulkUploadDetail,
  BusinessProfileOnboarding,
  BusinessProfilePage,
} from "./components/business";

const backendUrl = import.meta.env.VITE_NEXT_PUBLIC_BACKEND_URL;

function MainLayout({ children }) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  );
}

function HomePage() {
  return (
    <QuoteProvider>
      <Hero />
      <Services />
      <About />
      <ContactForm />
    </QuoteProvider>
  );
}

function AdminRedirect() {
  useEffect(() => {
    console.log("AdminRedirect →", `${backendUrl}/admin/`);
    window.location.replace(`${backendUrl}/admin/`);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-8">
      <div className="text-center max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
        <p className="text-gray-400 mb-8">Redirecting to your dashboard...</p>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
      </div>
    </div>
  );
}

/**
 * AuthModalRoute — handles deep-linked /login and /register URLs.
 * Opens the auth modal immediately and renders the home page as the background
 * so the user doesn't land on a blank page.
 */
function AuthModalRoute({ view }) {
  const { openLogin, openRegister, isOpen } = useAuthModal();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (view === "login") openLogin();
    else openRegister();
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  // When the modal closes, honour a ?next= deep link (e.g. the reminder-email
  // resume page: /login?next=/pay/resume/<token>). Only follow `next` once the
  // user is actually authenticated — a dismissed modal still just goes home, so
  // `next` can never be used to bounce an un-authed visitor into a gated page.
  useEffect(() => {
    if (isOpen) return;
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    if (next && isAuthenticated && isSafeInternalPath(next)) {
      navigate(next, { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  }, [isOpen, isAuthenticated, navigate]);

  return (
    <MainLayout>
      <HomePage />
    </MainLayout>
  );
}

/**
 * Only allow same-origin, path-only redirects for `next` — never an absolute
 * URL or protocol-relative "//evil.com", so the login redirect can't be turned
 * into an open redirect.
 */
function isSafeInternalPath(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//");
}

function App() {
  const googleClientId = import.meta.env.VITE_PUBLIC_GOOGLE_CLIENT_ID;

  return (
    <ErrorBoundary>
    <GoogleOAuthProvider clientId={googleClientId}>
    <AuthModalProvider>
      <AuthModal />
      <div className="min-h-screen bg-black text-white">
        {/*
          Single app-wide Toaster. Several components already call
          `toast.success/.error(...)` from "react-hot-toast" (driver
          dashboard, quote/booking validation, address geofencing) but
          nothing was mounting the portal that actually renders them —
          those calls were silently no-ops. Mounted once here so every
          toast in the app shows up, styled to match the brand accent.
        */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4500,
            style: {
              background: "#1f2937",
              color: "#fff",
              border: "1px solid rgba(249,115,22,0.35)",
              fontSize: "0.875rem",
            },
            success: {
              iconTheme: { primary: "#f97316", secondary: "#fff" },
            },
            error: {
              iconTheme: { primary: "#ef4444", secondary: "#fff" },
              style: {
                border: "1px solid rgba(239,68,68,0.45)",
              },
            },
          }}
        />
        <Routes>
          {/* ── Public ──────────────────────────────────────────────── */}
          <Route
            path="/"
            element={
              <MainLayout>
                <HomePage />
              </MainLayout>
            }
          />
          <Route
            path="/faqs"
            element={
              <MainLayout>
                <FAQ />
              </MainLayout>
            }
          />
          {/* /login and /register open the auth modal over the home page.
              Deep-linking still works: the URL is valid, user sees content,
              modal appears immediately. */}
          <Route path="/login" element={<AuthModalRoute view="login" />} />
          <Route path="/register" element={<AuthModalRoute view="register" />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route
            path="/reset-password/:uid/:token"
            element={<ResetPassword />}
          />
          <Route path="/check-email" element={<CheckEmail />} />
          <Route
            path="/email-confirmation"
            element={<EmailConfirmationPage />}
          />
          <Route path="/account-confirmed" element={<AccountConfirmedPage />} />
          <Route
            path="/resend-confirmation"
            element={<ResendConfirmationPage />}
          />

          {/* ── Admin ────────────────────────────────────────────────── */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminRedirect />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin-live-tracking"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminLiveTrackingDashboard />
              </ProtectedRoute>
            }
          />

          {/* ── Booking & quote ──────────────────────────────────────── */}
          <Route path="/quote" element={<QuotePage />} />
          <Route path="/booking" element={<BookingPage />} />
          <Route
            path="/history"
            element={
              <ProtectedRoute allowedRoles={["customer"]}>
                <MainLayout>
                  <BookingHistory />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          {/* ── Profile ─────────────────────────────────────────────── */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute allowedRoles={["customer", "driver"]}>
                <MainLayout>
                  <ProfilePage />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile-settings"
            element={
              <ProtectedRoute allowedRoles={["customer", "driver"]}>
                <MainLayout>
                  <ProfilePage />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          {/* ── Payment routes ───────────────────────────────────────── */}
          {/*
            FIX-C: Literal paths MUST come before the dynamic /pay/:txId route.
            /pay/success and /pay/cancel are more specific, but declaring them
            first makes the intent explicit and prevents future regressions.
          */}
          <Route
            path="/pay/success"
            element={
              <MainLayout>
                <PaymentSuccess />
              </MainLayout>
            }
          />
          <Route path="/pay/cancel" element={<PaymentCancel />} />
          
          {/* Bulk-upload Checkout redirect — /pay/bulk/:uploadId (MUST be before /pay/:txId) */}
          <Route
            path="/pay/bulk/:uploadId"
            element={
              <ProtectedRoute allowedRoles={["customer"]}>
                <BulkPaymentPage />
              </ProtectedRoute>
            }
          />


          {/* FIX-E: /bulk-uploads/:uploadId/success — navigated to by BulkPaymentPage
              after Stripe Checkout completes. This route was MISSING, causing a blank
              page after every successful bulk payment. */}
          <Route
            path="/bulk-uploads/:uploadId/success"
            element={
              <ProtectedRoute allowedRoles={["customer"]}>
                <BulkPaymentSuccessPage />
              </ProtectedRoute>
            }
          />

          {/* Reminder-email deep link — literal /pay/resume/... MUST precede /pay/:txId */}
          <Route path="/pay/resume/:resumeToken" element={<ResumePaymentPage />} />

          {/* Dynamic route last — catches /pay/:txId (any UUID) */}
          <Route path="/pay/:txId" element={<PaymentPage />} />

          {/* ── Invoice / billing routes (FIX-D: were missing) ──────── */}
          <Route
            path="/billing"
            element={
              <ProtectedRoute allowedRoles={["customer"]}>
                <MainLayout>
                  <BillingPage />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/invoices/:id"
            element={
              <ProtectedRoute allowedRoles={["customer"]}>
                <MainLayout>
                  <InvoiceDetailPage />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          {/* ── Driver ──────────────────────────────────────────────── */}
          <Route
            path="/driver-dashboard"
            element={
              <ProtectedRoute allowedRoles={["driver"]}>
                <DriverDashboard />
              </ProtectedRoute>
            }
          />

          {/* ── Bulk Upload (business accounts) ─────────────────────── */}
          <Route
            path="/bulk-upload"
            element={
              <ProtectedRoute allowedRoles={["customer"]}>
                <MainLayout>
                  <BulkUploadDashboard />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/bulk-upload/:id"
            element={
              <ProtectedRoute allowedRoles={["customer"]}>
                <MainLayout>
                  <BulkUploadDetail />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          {/* ── Business profile ────────────────────────────────────── */}
          <Route
            path="/business/register"
            element={
              <ProtectedRoute allowedRoles={["customer"]}>
                <MainLayout>
                  <BusinessProfileOnboarding
                    isPage={true}
                    onClose={() => window.history.back()}
                    onSuccess={() => (window.location.href = "/profile")}
                  />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/business/profile"
            element={
              <ProtectedRoute allowedRoles={["customer"]}>
                <MainLayout>
                  <BusinessProfilePage />
                </MainLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </AuthModalProvider>
    </GoogleOAuthProvider>
    </ErrorBoundary>
  );
}

export default App;
