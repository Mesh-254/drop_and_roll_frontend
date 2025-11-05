// components/common/Footer.jsx
"use client";

import { useState } from "react";
import TrackParcelModal from "../track/TrackParcelModal";

export default function Footer() {
  const [showTrackModal, setShowTrackModal] = useState(false);

  const handleTracking = () => setShowTrackModal(true);

  return (
    <>
      <footer className="bg-gray-900 border-t border-gray-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Logo and Description */}
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <img
                  src="/images/logo-clean.jpeg"
                  alt="Drop 'n Roll Logo"
                  className="w-10 h-10 rounded-lg"
                />
                <div className="text-white font-bold text-xl">
                  DROP<span className="text-orange-500">'N</span>ROLL
                </div>
              </div>
              <p className="text-gray-400 mb-4 max-w-md">
                Fast, secure, and reliable delivery service with years of
                logistics experience. Same day, next day, no delay.
              </p>
              <div className="flex space-x-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-orange-500">500+</div>
                  <div className="text-gray-500 text-xs">Daily Deliveries</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-orange-500">99.8%</div>
                  <div className="text-gray-500 text-xs">On-Time Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-orange-500">24/7</div>
                  <div className="text-gray-500 text-xs">Support</div>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-white font-semibold mb-4">Quick Links</h3>
              <ul className="space-y-2">
                <li>
                  <a
                    href="#services"
                    className="text-gray-400 hover:text-orange-500 transition-colors"
                  >
                    Services
                  </a>
                </li>
                <li>
                  <a
                    href="#about"
                    className="text-gray-400 hover:text-orange-500 transition-colors"
                  >
                    About Us
                  </a>
                </li>
                <li>
                  <a
                    href="#contact"
                    className="text-gray-400 hover:text-orange-500 transition-colors"
                  >
                    Contact
                  </a>
                </li>

                {/* TRACK PACKAGE – opens modal */}
                <li>
                  <button
                    onClick={handleTracking}
                    className="text-gray-400 hover:text9 hover:text-orange-500 transition-colors bg-transparent border-none cursor-pointer p-0 font-inherit"
                  >
                    Track Package
                  </button>
                </li>
              </ul>
            </div>

            {/* Contact Info */}
            <div>
              <h3 className="text-white font-semibold mb-4">Contact Info</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>Phone 902-450-2850</li>
                <li>Email info@dropnroll.com</li>
                <li>Location 400 Service St, Suite 1326</li>
                <li>Support 24/7 Customer Support</li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
            <div className="text-gray-400 text-sm text-center md:text-left mb-4 md:mb-0">
              <p>© 2024 Drop 'n Roll. All rights reserved.</p>
            </div>
            <div className="flex space-x-6 text-gray-400 text-sm">
              <a href="#" className="hover:text-orange-500 transition-colors">
                Privacy Policy
              </a>
              <a href="#" className="hover:text-orange-500 transition-colors">
                Terms of Service
              </a>
              <a href="#" className="hover:text-orange-500 transition-colors">
                Cookie Policy
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Tracking Modal – shared with Header */}
      <TrackParcelModal
        isOpen={showTrackModal}
        onClose={() => setShowTrackModal(false)}
      />
    </>
  );
}