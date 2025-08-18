// App.jsx
import { Routes, Route } from "react-router-dom";
import Header from "./components/common/Header";
import Hero from "./components/landingPage/Hero";
import Services from "./components/landingPage/Services";
import About from "./components/about/About";
import ContactForm from "./components/contact/ContactForm";
import Footer from "./components/common/Footer";
import AdminDashboard from "./components/admin/AdminDashboard";
import FAQ from "./components/contact/faq";
import "./App.css";
import LoginPage from "./components/auth/login-register";
import ForgotPassword from "./components/auth/forgot-password";
import CheckEmail from "./components/auth/check-email";
import ResetPassword from "./components/auth/reset-password";

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
  return (
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
        <Route path="/login" element={<LoginPage />} />
         <Route path="/register" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/check-email" element={<CheckEmail />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/admin" element={<AdminDashboard />} />{" "}
        {/* No header/footer for admin */}
      </Routes>
    </div>
  );
}

export default App;
