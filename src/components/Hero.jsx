"use client"

import { useState } from "react"
import GetQuoteBook from "./GetQuoteBook"

export default function Hero() {
  const [showQuoteModal, setShowQuoteModal] = useState(false)

  const handleBookDelivery = () => {
    alert("Book a Delivery - Redirecting to booking system...")
  }

  const handleGetQuote = () => {
    setShowQuoteModal(true)
  }

  return (
    <>
      <section className="bg-black min-h-screen flex items-center justify-center relative overflow-hidden pt-20">
        {/* Background Image */}
        <div className="absolute inset-0 opacity-30">
          <img src="/images/van-dark.png" alt="Drop 'n Roll Van" className="w-full h-full object-cover" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Logo */}
          {/* <div className="mb-8">
            <img
              src="/images/logo-clean.jpeg"
              alt="Drop 'n Roll Logo"
              className="w-32 h-32 mx-auto mb-4 rounded-2xl shadow-2xl"
            />
          </div> */}

          {/* Main Heading */}
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-orange-500 mb-8 leading-tight">
            SAME DAY. NEXT DAY.
            <br />
            <span className="text-orange-400">NO DELAY.</span>
          </h1>

          {/* Subtitle */}
          <p className="text-xl sm:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto">
            Fast, secure, and reliable delivery service with years of logistics experience
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <button
              onClick={handleBookDelivery}
              className="bg-orange-500 hover:bg-orange-600 text-black font-bold py-4 px-8 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-orange-500/25 min-w-[200px]"
            >
              Book a Delivery
            </button>
            <button
              onClick={handleGetQuote}
              className="bg-transparent border-2 border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black font-bold py-4 px-8 rounded-lg transition-all duration-300 transform hover:scale-105 min-w-[200px]"
            >
              Get Quote & Book
            </button>
          </div>

          {/* Mobile Greeting Card */}
          <div className="sm:hidden bg-gray-900/80 backdrop-blur-sm rounded-2xl p-6 max-w-sm mx-auto border border-gray-700">
            <h2 className="text-white text-2xl font-bold mb-4">Hello, Jane!</h2>
            <div className="space-y-3">
              <button
                onClick={handleBookDelivery}
                className="w-full bg-orange-500 hover:bg-orange-600 text-black font-bold py-3 px-6 rounded-lg transition-colors"
              >
                Book Now
              </button>
              <button
                onClick={handleGetQuote}
                className="w-full bg-transparent border-2 border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black font-bold py-3 px-6 rounded-lg transition-colors"
              >
                Get Quote!
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Quote Modal */}
      <GetQuoteBook isOpen={showQuoteModal} onClose={() => setShowQuoteModal(false)} />
    </>
  )
}
