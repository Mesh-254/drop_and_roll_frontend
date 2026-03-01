"use client";

import { motion } from "framer-motion";
import { MapPin, Zap, AlertCircle } from "lucide-react";
import { useState, useRef } from "react";

export default function Hero({ onBookDelivery, onQuickQuote }) {
  const [quickQuoteData, setQuickQuoteData] = useState({
    pickupPostcode: "",
    dropoffPostcode: "",
  });
  const [quickQuoteError, setQuickQuoteError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRefs = {
    pickup: useRef(null),
    dropoff: useRef(null),
  };

  const handleQuickQuoteChange = (field, value) => {
    setQuickQuoteData((prev) => ({
      ...prev,
      [field]: value.toUpperCase(),
    }));
    setQuickQuoteError("");
  };

  const validatePostcode = (postcode) => {
    // UK postcode validation regex
    const postcodeRegex = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
    return postcodeRegex.test(postcode.replace(/\s+/g, ""));
  };

  const handleQuickQuoteSubmit = async (e) => {
    e.preventDefault();
    setQuickQuoteError("");

    // Validate postcodes
    if (!quickQuoteData.pickupPostcode.trim()) {
      setQuickQuoteError("Please enter collection postcode");
      inputRefs.pickup.current?.focus();
      return;
    }

    if (!quickQuoteData.dropoffPostcode.trim()) {
      setQuickQuoteError("Please enter delivery postcode");
      inputRefs.dropoff.current?.focus();
      return;
    }

    if (!validatePostcode(quickQuoteData.pickupPostcode)) {
      setQuickQuoteError("Invalid collection postcode format (e.g., MK9 1AA)");
      inputRefs.pickup.current?.focus();
      return;
    }

    if (!validatePostcode(quickQuoteData.dropoffPostcode)) {
      setQuickQuoteError("Invalid delivery postcode format (e.g., OX1 1AA)");
      inputRefs.dropoff.current?.focus();
      return;
    }

    setIsSubmitting(true);

    // Call the parent's quick quote handler
    if (onQuickQuote) {
      await onQuickQuote({
        pickupPostcode: quickQuoteData.pickupPostcode.replace(/\s+/g, ""),
        dropoffPostcode: quickQuoteData.dropoffPostcode.replace(/\s+/g, ""),
      });
    }

    setIsSubmitting(false);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8 },
    },
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-black via-gray-900 to-black pt-20 overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{
            x: [0, 100, 0],
            y: [0, 50, 0],
          }}
          transition={{ duration: 20, repeat: Infinity }}
          className="absolute top-20 right-20 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            x: [0, -100, 0],
            y: [0, -50, 0],
          }}
          transition={{ duration: 25, repeat: Infinity }}
          className="absolute bottom-20 left-20 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl"
        />
      </div>

      {/* Main Content */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 max-w-6xl mx-auto w-full"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-16">
          {/* Left Side - Text Content */}
          <motion.div variants={itemVariants} className="space-y-8">
            <h1 className="text-6xl md:text-7xl font-bold text-white leading-tight font-montserrat text-balance">
              Delivery{" "}
              <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                Perfected
              </span>
            </h1>

            <p className="text-xl text-gray-400 leading-relaxed max-w-lg">
              Fast, reliable same-day and next-day delivery across Milton
              Keynes, Oxford, and surrounding areas. Get your items where they
              need to be, on time, every time.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="text-3xl font-bold text-orange-500 font-montserrat">
                  500+
                </div>
                <p className="text-sm text-gray-400">Daily Deliveries</p>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-orange-500 font-montserrat">
                  99.8%
                </div>
                <p className="text-sm text-gray-400">On-Time Rate</p>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-orange-500 font-montserrat">
                  24/7
                </div>
                <p className="text-sm text-gray-400">Support</p>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onBookDelivery}
                className="px-8 py-4 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold shadow-lg hover:shadow-orange-500/40 transition-all duration-300"
              >
                Get Quote & Book
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 rounded-full border-2 border-orange-500/50 text-orange-400 hover:text-orange-300 hover:border-orange-400 font-bold transition-all duration-300 flex items-center justify-center gap-2"
              >
                <Zap size={20} />
                Track Delivery
              </motion.button>
            </div>
          </motion.div>

          {/* Right Side - Illustration Placeholder */}
          <motion.div
            variants={itemVariants}
            className="hidden lg:flex items-center justify-center"
          >
            <motion.div
              animate={{
                y: [0, -20, 0],
              }}
              transition={{ duration: 4, repeat: Infinity }}
              className="relative w-full h-96 flex items-center justify-center"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-transparent rounded-3xl blur-2xl" />
              <div className="relative flex items-center justify-center">
                <div className="w-48 h-48 bg-gradient-to-br from-orange-500/20 to-transparent rounded-3xl border-2 border-orange-500/30 flex items-center justify-center">
                  <Zap className="w-24 h-24 text-orange-500/40" />
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Quick Quote Card - Floating Glass Effect */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -5 }}
          className="relative mt-12"
        >
          <div className="rounded-3xl border-2 border-orange-500/30 bg-gradient-to-br from-gray-900/50 via-black/50 to-gray-900/50 backdrop-blur-xl p-8 shadow-2xl hover:border-orange-500/50 transition-all duration-300">
            {/* Glow Effect */}
            <motion.div
              animate={{
                opacity: [0.5, 0.8, 0.5],
              }}
              transition={{ duration: 3, repeat: Infinity }}
              className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-transparent rounded-3xl blur-xl"
            />

            {/* Card Content */}
            <div className="relative z-10">
              <h3 className="text-2xl font-bold text-white mb-2 font-montserrat flex items-center gap-2">
                <Zap className="w-6 h-6 text-orange-500" />
                Get an instant quote in 10 seconds
              </h3>
              <p className="text-gray-400 text-sm mb-6">
                We deliver across Milton Keynes, Oxford & surrounding areas
              </p>

              {/* Form */}
              <form onSubmit={handleQuickQuoteSubmit} className="space-y-4">
                {/* Input Group */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Pickup Postcode */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                      <MapPin size={16} className="text-green-400" />
                      Collection Postcode
                    </label>
                    <input
                      ref={inputRefs.pickup}
                      type="text"
                      value={quickQuoteData.pickupPostcode}
                      onChange={(e) =>
                        handleQuickQuoteChange("pickupPostcode", e.target.value)
                      }
                      placeholder="MK9 1AA"
                      className="w-full px-4 py-3 rounded-lg bg-gray-800/50 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
                    />
                  </div>

                  {/* Dropoff Postcode */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                      <MapPin size={16} className="text-red-400" />
                      Delivery Postcode
                    </label>
                    <input
                      ref={inputRefs.dropoff}
                      type="text"
                      value={quickQuoteData.dropoffPostcode}
                      onChange={(e) =>
                        handleQuickQuoteChange(
                          "dropoffPostcode",
                          e.target.value,
                        )
                      }
                      placeholder="OX1 1AA"
                      className="w-full px-4 py-3 rounded-lg bg-gray-800/50 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
                    />
                  </div>
                </div>

                {/* Error Message */}
                {quickQuoteError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400"
                  >
                    <AlertCircle size={18} className="flex-shrink-0" />
                    <span className="text-sm">{quickQuoteError}</span>
                  </motion.div>
                )}

                {/* Submit Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 px-6 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-bold shadow-lg hover:shadow-orange-500/30 transition-all duration-300 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                        className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                      />
                      Calculating...
                    </>
                  ) : (
                    <>
                      <Zap size={20} />
                      Get Quote
                    </>
                  )}
                </motion.button>
              </form>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
