"use client";

import { motion } from "framer-motion";
import { Zap, Truck, Briefcase, MapPin, Check } from "lucide-react";
import { useState } from "react";

const services = [
  {
    id: 1,
    name: "Same Day",
    tier: "Express",
    subtitle: "Ultra-fast local delivery",
    icon: Zap,
    features: [
      "Within 4 hours",
      "Milton Keynes area",
      "Priority handling",
      "Real-time tracking",
    ],
    price: "£12.99",
    color: "from-orange-500 to-red-500",
    bgColor: "bg-orange-50 dark:bg-orange-900/10",
    borderColor: "border-orange-300 dark:border-orange-700",
  },
  {
    id: 2,
    name: "Standard",
    tier: "Standard",
    subtitle: "Reliable next-day delivery",
    icon: Truck,
    features: [
      "Next business day",
      "Full tracking",
      "Insured delivery",
      "SMS updates",
    ],
    price: "£6.99",
    color: "from-blue-500 to-cyan-500",
    bgColor: "bg-blue-50 dark:bg-blue-900/10",
    borderColor: "border-blue-300 dark:border-blue-700",
  },
  {
    id: 3,
    name: "Business",
    tier: "Business",
    subtitle: "Multi-location routing",
    icon: Briefcase,
    features: [
      "Scheduled delivery",
      "Multiple stops",
      "Signature required",
      "Invoice billing",
    ],
    price: "£8.99",
    color: "from-purple-500 to-pink-500",
    bgColor: "bg-purple-50 dark:bg-purple-900/10",
    borderColor: "border-purple-300 dark:border-purple-700",
  },
  {
    id: 4,
    name: "Up to 200 miles",
    tier: "Nationwide",
    subtitle: "Extended coverage delivery",
    icon: MapPin,
    features: [
      "UK-wide service",
      "Flexible timing",
      "Route optimized",
      "24/7 support",
    ],
    price: "£14.99",
    color: "from-green-500 to-emerald-500",
    bgColor: "bg-green-50 dark:bg-green-900/10",
    borderColor: "border-green-300 dark:border-green-700",
  },
];

const ServiceCard = ({ service, onGetQuote, index }) => {
  const [isHovered, setIsHovered] = useState(false);
  const Icon = service.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      viewport={{ once: true }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={`relative rounded-2xl overflow-hidden transition-all duration-300 ${
        isHovered ? "transform scale-105" : ""
      }`}
    >
      {/* Glowing Background Effect */}
      {isHovered && (
        <motion.div
          layoutId={`glow-${service.id}`}
          className={`absolute inset-0 bg-gradient-to-br ${service.color} opacity-5 blur-xl`}
        />
      )}

      {/* Card Container */}
      <div
        className={`relative h-full rounded-2xl border-2 p-6 transition-all duration-300 backdrop-blur-sm
          ${service.bgColor} ${service.borderColor}
          ${isHovered ? "border-orange-500/50 shadow-2xl" : "shadow-lg"}`}
      >
        {/* Tier Badge */}
        <div className="mb-4 flex items-center justify-between">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold tracking-wider text-orange-500 bg-orange-100 dark:bg-orange-900/40 uppercase">
            {service.tier}
          </span>
        </div>

        {/* Icon Circle */}
        <motion.div
          animate={
            isHovered ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }
          }
          transition={{ duration: 0.3 }}
          className="mb-6 flex items-center justify-center"
        >
          <div className={`relative w-20 h-20 rounded-full bg-orange-500/10 flex items-center justify-center border-2 border-orange-500/30
            ${isHovered ? "bg-orange-500/20 border-orange-500/60 shadow-lg shadow-orange-500/30" : ""}`}
          >
            <Icon className="w-10 h-10 text-orange-500" />
          </div>
        </motion.div>

        {/* Title and Subtitle */}
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 font-montserrat">
          {service.name}
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
          {service.subtitle}
        </p>

        {/* Features List */}
        <ul className="space-y-3 mb-6">
          {service.features.map((feature, idx) => (
            <motion.li
              key={idx}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 + idx * 0.05 }}
              viewport={{ once: true }}
              className="flex items-center text-sm text-gray-700 dark:text-gray-300"
            >
              <Check className="w-5 h-5 text-orange-500 mr-3 flex-shrink-0" />
              {feature}
            </motion.li>
          ))}
        </ul>

        {/* Price Section */}
        <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
          <div className="text-3xl font-bold text-orange-500 font-montserrat">
            {service.price}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            excl. VAT
          </p>
        </div>

        {/* CTA Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onGetQuote(service)}
          className={`w-full py-3 px-4 rounded-lg font-bold transition-all duration-300
            bg-gradient-to-r from-orange-500 to-orange-600 
            hover:from-orange-600 hover:to-orange-700
            text-white shadow-lg hover:shadow-orange-500/30
            transform hover:scale-105 active:scale-95
            focus:outline-none focus:ring-2 focus:ring-orange-500/50`}
        >
          Get Quote
        </motion.button>
      </div>
    </motion.div>
  );
};

export default function Services({ onBookDelivery }) {
  const handleGetQuote = (service) => {
    if (onBookDelivery) {
      onBookDelivery(service);
    }
  };

  return (
    <section id="services" className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-black">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6 font-montserrat text-balance">
            Our Services
          </h2>
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="h-1 w-12 bg-gray-200 dark:bg-gray-800"></div>
            <div className="h-1 w-20 bg-orange-500 rounded-full"></div>
            <div className="h-1 w-12 bg-gray-200 dark:bg-gray-800"></div>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Choose the perfect delivery service for your needs. Fast, reliable,
            and transparent pricing.
          </p>
        </motion.div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map((service, index) => (
            <ServiceCard
              key={service.id}
              service={service}
              onGetQuote={handleGetQuote}
              index={index}
            />
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className="mt-16 text-center"
        >
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Not sure which service is right for you?
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleGetQuote(null)}
            className="px-8 py-4 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-bold shadow-lg hover:shadow-orange-500/30 transition-all duration-300 transform hover:scale-105"
          >
            Get a Custom Quote
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
}
