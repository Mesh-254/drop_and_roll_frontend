"use client"

import { useState, useEffect } from "react"
import { Menu, X } from "lucide-react"
import { NavLink, useLocation } from "react-router-dom"
import TrackParcelModal from "../track/TrackParcelModal"
import GetQuoteBook from "../quote/GetQuoteBook"

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showTrackModal, setShowTrackModal] = useState(false)
  const [showQuoteModal, setShowQuoteModal] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const handleTracking = () => {
    setShowTrackModal(true)
  }

  const handleModalClose = () => {
    setShowTrackModal(false)
  }

  const handleBookDelivery = () => {
    setShowQuoteModal(true)
  }

  const handleBookDeliveryClose = () => {
    setShowQuoteModal(false)
  }

  const navItems = [
    { name: "Home", href: "/" },
    { name: "Services", href: "#services" },
    {
      name: "Tracking",
      onClick: handleTracking, // Trigger modal instead of navigating
    },
    { name: "Support", href: "#support" },
    { name: "FAQ", href: "/faqs" },
  ]

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? "bg-black/95 backdrop-blur-md shadow-lg border-b border-orange-500/20 h-16"
            : "bg-transparent h-20"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className={`flex items-center justify-between transition-all duration-300 ${
              isScrolled ? "h-16" : "h-20"
            }`}
          >
            {/* Logo */}
            <div className="flex items-center">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                  <div className="w-4 h-4 bg-white rounded-sm"></div>
                </div>
                <span
                  className={`text-xl font-bold transition-colors duration-300 font-montserrat ${
                    isScrolled ? "text-white" : "text-white"
                  }`}
                >
                  Drop & Roll
                </span>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              {navItems.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onClick={item.onClick}
                  className={({ isActive }) =>
                    `font-medium transition-all duration-300 relative group ${
                      isActive && !item.onClick
                        ? "text-orange-500 font-bold"
                        : isScrolled
                        ? "text-white/90 hover:text-orange-500"
                        : "text-white/90 hover:text-orange-500"
                    }`
                  }
                >
                  {item.name}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-orange-500 transition-all duration-300 group-hover:w-full"></span>
                </NavLink>
              ))}
            </nav>

            {/* CTA Button */}
            <div className="hidden md:flex items-center">
              <button
                className="bg-orange-500 hover:bg-orange-600 text-white font-medium px-6 py-2 rounded-full transition-all duration-300 transform hover:scale-105 hover:shadow-orange-500/30"
                onClick={handleBookDelivery}
              >
                Send an Item
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`md:hidden p-2 rounded-lg transition-all duration-300 transform hover:scale-105 ${
                isScrolled
                  ? "text-white hover:text-orange-500"
                  : "text-white hover:text-orange-500"
              }`}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {/* Mobile Menu */}
          {isMobileMenuOpen && (
            <div className="md:hidden bg-black/95 backdrop-blur-md border-t border-orange-500/20 transition-all duration-300">
              <div className="px-2 pt-2 pb-3 space-y-1">
                {navItems.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    onClick={(e) => {
                      if (item.onClick) {
                        item.onClick(e)
                      }
                      setIsMobileMenuOpen(false)
                    }}
                    className={({ isActive }) =>
                      `block px-3 py-2 font-medium transition-all duration-300 hover:text-orange-500 hover:bg-orange-500/10 rounded-md ${
                        isActive && !item.onClick ? "text-orange-500 font-bold" : "text-white/90"
                      }`
                    }
                  >
                    {item.name}
                  </NavLink>
                ))}
                <div className="px-3 py-2">
                  <button
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium px-6 py-2 rounded-full transition-all duration-300 transform hover:scale-105"
                    onClick={() => {
                      handleBookDelivery()
                      setIsMobileMenuOpen(false)
                    }}
                  >
                    Send an Item
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Tracking Modal */}
      <TrackParcelModal isOpen={showTrackModal} onClose={handleModalClose} />

      {/* Quote Modal */}
      <GetQuoteBook isOpen={showQuoteModal} onClose={handleBookDeliveryClose} />
    </>
  )
}