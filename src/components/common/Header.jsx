"use client"

import { useState } from "react"
import { Menu, X } from "lucide-react"

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: "smooth" })
    }
    setIsMenuOpen(false)
  }

  return (
    <header className="bg-black/95 backdrop-blur-sm fixed w-full top-0 z-50 border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <img src="/images/logo-clean.jpeg" alt="Drop 'n Roll Logo" className="w-12 h-12 rounded-lg" />
            <div className="text-white font-bold text-xl">
              DROP<span className="text-orange-500">'N</span>ROLL
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
            <button
              onClick={() => scrollToSection("about")}
              className="text-gray-300 hover:text-orange-500 transition-colors font-medium"
            >
              About Us
            </button>
            <button
              onClick={() => scrollToSection("services")}
              className="text-gray-300 hover:text-orange-500 transition-colors font-medium"
            >
              Services
            </button>
            <button
              onClick={() => scrollToSection("contact")}
              className="text-gray-300 hover:text-orange-500 transition-colors font-medium"
            >
              Contact
            </button>
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-white hover:text-orange-500 transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-800">
            <nav className="flex flex-col space-y-4">
              <button
                onClick={() => scrollToSection("about")}
                className="text-gray-300 hover:text-orange-500 transition-colors text-left font-medium"
              >
                About Us
              </button>
              <button
                onClick={() => scrollToSection("services")}
                className="text-gray-300 hover:text-orange-500 transition-colors text-left font-medium"
              >
                Services
              </button>
              <button
                onClick={() => scrollToSection("contact")}
                className="text-gray-300 hover:text-orange-500 transition-colors text-left font-medium"
              >
                Contact
              </button>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
