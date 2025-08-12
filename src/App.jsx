// App.jsx
import { Routes, Route } from 'react-router-dom'
import Header from "./components/Header"
import Hero from "./components/Hero"
import Services from "./components/Services"
import About from "./components/About"
import ContactForm from "./components/ContactForm"
import Footer from "./components/Footer"
import AdminDashboard from "./components/AdminDashboard" // 👈 new admin component
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
