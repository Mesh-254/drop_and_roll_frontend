// App.jsx
import { Routes, Route } from 'react-router-dom'
import Header from "./components/common/Header"
import Hero from "./components/landingPage/Hero"
import Services from "./components/landingPage/Services"
import About from "./components/about/About"
import ContactForm from "./components/contact/ContactForm"
import Footer from "./components/common/Footer"
import AdminDashboard from "./components/admin/AdminDashboard" // 👈 new admin component
import "./App.css"

function HomePage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Services />
        <About />
        <ContactForm />
      </main>
      <Footer />
    </>
  )
}

function App() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </div>
  )
}

export default App
