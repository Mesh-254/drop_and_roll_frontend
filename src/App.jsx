// App.jsx
import { Routes, Route } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import Header from "./components/common/Header";
import Hero from "./components/landingPage/Hero";
import Services from "./components/landingPage/Services";
import About from "./components/about/About";
import ContactForm from "./components/contact/ContactForm";
import Footer from "./components/common/Footer";
import AdminDashboard from "./components/admin/AdminDashboard";
import FAQ from "./components/contact/faq";
import "./App.css";
// import LoginPage from "./components/auth/login-register";
import ForgotPassword from "./components/auth/forgot-password";
import ResetPassword from "./components/auth/reset-password";

import LoginPage from "./components/auth/LoginPage";
import RegisterPage from "./components/auth/RegisterPage";
import EmailConfirmationPage from "./components/auth/EmailConfirmationPage";
import AccountConfirmedPage from "./components/auth/AccountConfirmedPage";
import ResendConfirmationPage from "./components/auth/ResendConfirmationPage";
import BookingModal from "./components/bookings/BookingModal";
import QuotePage from "./components/quote/QuotePage";


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
          {/* <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
 
        
        <Route path="/reset-password/:token" element={<ResetPassword />} /> */}
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
          <Route path="/admin" element={<AdminDashboard />} />{" "}
          {/* No header/footer for admin */}
          <Route path="/quote" element={<QuotePage />} />
          <Route path="/booking" element={<BookingModal />} />
        </Routes>
      </div>
    </GoogleOAuthProvider>
  );
}

export default App;
