// App.jsx
import { Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import Header from "./components/common/Header";
import Hero from "./components/landingPage/Hero";
import Services from "./components/landingPage/Services";
import About from "./components/about/About";
import ContactForm from "./components/contact/ContactForm";
import Footer from "./components/common/Footer";
// import AdminDashboard from "./components/admin/AdminDashboard";
import FAQ from "./components/contact/faq";
import "./App.css";
import "./globals.css";
// import LoginPage from "./components/auth/login-register";
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

import PaymentPage from "./components/payments/PaymentPage";
import PaymentSuccess from "./components/payments/PaymentSuccess";
import PaymentCancel from "./components/payments/PaymentCancel";

import DriverDashboard from "./components/driver/driver-dashboard";
import ProtectedRoute from "./components/auth/ProtectedRoute";

const backendUrl = import.meta.env.VITE_NEXT_PUBLIC_BACKEND_URL;

// Layout for pages with Header and Footer
function MainLayout({ children }) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  );
}

// HomePage now only includes content, no Header/Footer
function HomePage() {
  return (
    <>
      <Hero />
      <Services />
      <About />
      <ContactForm />
    </>
  );
}
// function to handle admin redirect (before the return)
function AdminRedirect() {
  
  useEffect(() => {
    console.log("🔄 AdminRedirect →", `${backendUrl}/admin/`);
    window.location.replace(`${backendUrl}/admin/`);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-8">
      <div className="text-center max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-4">👨‍💼 Admin Dashboard</h1>
        <p className="text-gray-400 mb-8">Redirecting to your dashboard...</p>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
      </div>
    </div>
  );
}

function App() {
  // Ensure VITE_APP_GOOGLE_CLIENT_ID is set in your .env file
  const googleClientId = import.meta.env.VITE_PUBLIC_GOOGLE_CLIENT_ID;

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <div className="min-h-screen bg-black text-white">
        <Routes>
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
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route
            path="/reset-password/:uid/:token"
            element={<ResetPassword />}
          />
          <Route path="/check-email" element={<CheckEmail />} />

          {/* login and register  */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/email-confirmation"
            element={<EmailConfirmationPage />}
          />
          <Route path="/account-confirmed" element={<AccountConfirmedPage />} />
          <Route
            path="/resend-confirmation"
            element={<ResendConfirmationPage />}
          />
          {/* ✅ ADMIN: PROTECTED + AUTO-REDIRECT */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminRedirect />
              </ProtectedRoute>
            }
          />

          <Route path="/quote" element={<QuotePage />} />
          <Route path="/booking" element={<BookingPage />} />
          <Route
            path="/history"
            element={
              <MainLayout>
                <BookingHistory />
              </MainLayout>
            }
          />
          <Route
            path="/profile-settings"
            element={
              <MainLayout>
                <div className="min-h-screen bg-black pt-24 pb-12">
                  <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h1 className="text-3xl font-bold text-white mb-8">
                      Profile Settings
                    </h1>
                    <div className="bg-gray-900 rounded-lg p-6">
                      <p className="text-gray-400">
                        Profile settings page coming soon...
                      </p>
                    </div>
                  </div>
                </div>
              </MainLayout>
            }
          />
          {/* Payment routes */}
          <Route path="/pay/:txId" element={<PaymentPage />} />
          <Route
            path="/pay/success"
            element={
              <MainLayout>
                {" "}
                <PaymentSuccess />{" "}
              </MainLayout>
            }
          />
          <Route path="/pay/cancel" element={<PaymentCancel />} />
          {/* Protected routes for customers */}
          <Route
            path="/"
            element={
              <ProtectedRoute allowedRoles={["customer"]}>
                <MainLayout>
                  <HomePage />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          {/* Protected routes for drivers */}
          <Route
            path="/driver-dashboard"
            element={
              <ProtectedRoute allowedRoles={["driver"]}>
                <DriverDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </GoogleOAuthProvider>
  );
}

export default App;
