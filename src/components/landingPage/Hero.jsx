"use client";

import { useState, Suspense } from "react";
import GetQuoteBook from "../quote/GetQuoteBook";
import TrackParcelModal from "../track/TrackParcelModal";

export default function Hero() {
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showTrackModal, setShowTrackModal] = useState(false);

  const handleBookDelivery = () => {
    setShowQuoteModal(true);
  };

  const handleTracking = () => {
    setShowTrackModal(true);
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image with Fade Effect */}
      <div className="absolute inset-0">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('/images/van-dark.png')`,
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom, 
              rgba(0, 0, 0, 0.3) 0%, 
              rgba(0, 0, 0, 0.4) 20%, 
              rgba(0, 0, 0, 0.5) 40%, 
              rgba(31, 41, 55, 0.6) 60%, 
              rgba(75, 85, 99, 0.8) 80%, 
              rgba(156, 163, 175, 0.9) 90%, 
              rgba(255, 255, 255, 1) 100%)`,
          }}
        />
      </div>

      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-20 left-10 w-32 h-32 bg-orange-500 rounded-full blur-3xl animate-pulse"></div>
        <div
          className="absolute top-40 right-20 w-24 h-24 bg-orange-400 rounded-full blur-2xl animate-pulse"
          style={{ animationDelay: "2s" }}
        ></div>
        <div
          className="absolute bottom-40 left-1/4 w-40 h-40 bg-gray-600 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "4s" }}
        ></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-orange-500 mb-6 leading-tight tracking-tight font-montserrat">
            SAME DAY. NEXT DAY
            <br />
            <span className="text-white">NO DELAY</span>
          </h1>
          <p className="text-lg sm:text-xl lg:text-2xl text-gray-200 mb-12 max-w-4xl mx-auto font-poppins leading-relaxed">
            Fast, secure, and reliable delivery service with years of logistics
            experience
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16">
            <button
              onClick={handleBookDelivery}
              className="bg-orange-500 hover:bg-orange-600 text-black font-bold py-4 px-8 rounded-lg transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-orange-500/25 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              Get Quote & Book
            </button>
            <button
              onClick={handleTracking}
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 px-10 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-orange-500/25 shadow-lg min-w-[220px] border-2 border-orange-500 hover:border-orange-400 flex items-center justify-center gap-3 focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <span>Track</span>
              <svg
                className="w-5 h-5 group-hover:rotate-12 transition-transform duration-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"
                />
              </svg>
            </button>
          </div>
          {/* <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 animate-bounce">
            <div className="w-6 h-10 border-2 border-white rounded-full flex justify-center">
              <div className="w-1 h-3 bg-white rounded-full mt-2 animate-pulse"></div>
            </div>
          </div> */}
        </div>
      </div>

      {/* Quote Modal */}
      {showQuoteModal && (
        <Suspense
          fallback={
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
              Loading...
            </div>
          }
        >
          <GetQuoteBook
            isOpen={showQuoteModal}
            onClose={() => setShowQuoteModal(false)}
          />
        </Suspense>
      )}

      {/* Track Parcel Modal */}
      {showTrackModal && (
        <Suspense
          fallback={
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
              Loading...
            </div>
          }
        >
          <TrackParcelModal
            isOpen={showTrackModal}
            onClose={() => setShowTrackModal(false)}
          />
        </Suspense>
      )}
    </section>
  );
}
