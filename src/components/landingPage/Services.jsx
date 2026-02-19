"use client";

import { Zap, Clock, Building, Package, CheckCircle } from "lucide-react";
// eslint-disable-next-line no-unused-vars
import { motion } from "framer-motion";
import { useState } from "react";
import GetQuoteBook from "../quote/GetQuoteBook";

const services = [
  {
    icon: Zap,
    tier: "Same Day Delivery",
    title: "Collected today.",
    subtitle: "Delivered today.",
    description: "Direct, point-to-point service across Milton Keynes, Oxford & surrounding areas.",
    features: [
      { text: "pickup and delivery included", icon: CheckCircle },
      { text: "fully tracked", icon: CheckCircle },
    ],
    price: "From £ 19.99/exl VAT",
    action: "Same Day Delivery orders must be placed before 12:00 PM to guarantee same-day collection and delivery.",
  },
  {
    icon: Clock,
    tier: "Standard",
    title: "Next Day Delivery",
    subtitle: "Urgent delivery",
    description: "Ultra-fast delivery in urban areas.",
    features: [
      { text: "Fast next-working-day delivery for urgent parcels", icon: CheckCircle },
      { text: "Serving Milton Keynes, Oxford, and surrounding areas", icon: CheckCircle },
      { text: "Pickup from sender and delivery to recipient included", icon: CheckCircle },
      { text: "Simple, transparent pricing with no hidden fees", icon: CheckCircle },
      { text: "Fully tracked service with proof of delivery", icon: CheckCircle },
    ],
    price: "From £ 8.99/exl VAT",
    action: "Get Started",
  },
  {
    icon: Building,
    tier: "Business",
    title: "Recurring Business Deliveries",
    subtitle: "For B2B customers",
    description: "Reliable scheduled collections tailored to your business needs.",
    features: [
      { text: "Fixed weekly or monthly routes", icon: CheckCircle },
      { text: "Predictable pricing", icon: CheckCircle },
      { text: "Account-managed service", icon: CheckCircle },
      { text: "Custom delivery planning", icon: CheckCircle },
    ],
    price: "Get a quote.",
    action: "Learn More",
  },
  {
    icon: Package,
    tier: " Up to 200 miles.",
    title: "Reliable, tracked delivery.",
    subtitle: "Safe transport",
    description: "Pickup and delivery included.",
    features: [
      { text: "Temp monitoring", icon: CheckCircle },
      { text: "Insulated packaging", icon: CheckCircle },
    ],
    price: "Get a quote.",
    action: "Learn More",
  },
];

export default function Services() {
  const [showQuoteModal, setShowQuoteModal] = useState(false);

  const handleBookDelivery = () => {
    setShowQuoteModal(true);
  };

  return (
    <>
      <section id="services" className="py-20 bg-black">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center mb-12">
            <h2 className="text-4xl lg:text-4 xl font-bold text-white-500 mb-4 font-montserrat">
              Our Core Service Offerings
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed font-montserrat">
              Tailored delivery solutions for all your shipping needs.
            </p>
          </div>

          {/* Services Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((service, index) => {
              const IconComponent = service.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  whileHover={{ scale: 1.05, rotateY: 5 }}
                  className="bg-gradient-to-br from-gray-800 to-gray-900 p-5 rounded-2xl border border-gray-700 hover:border-orange-500/50 transition-all duration-300 group"
                >
                  {/* Service Icon */}
                  <div className="flex justify-center mb-3">
                    <div className="w-14 h-14 bg-orange-500/10 rounded-full flex items-center justify-center group-hover:bg-orange-500/20 transition-colors">
                      <IconComponent className="w-7 h-7 text-orange-500 group-hover:scale-110 transition-transform" />
                    </div>
                  </div>

                  {/* Service Tier */}
                  <div className="flex justify-center mb-2">
                    <span className="inline-block bg-orange-500/10 text-orange-500 text-sm font-bold px-2.5 py-1 rounded-full uppercase tracking-wide font-montserrat">
                      {service.tier}
                    </span>
                  </div>

                  {/* Service Title */}
                  <div className="flex justify-center mb-1">
                    <h3 className="text-xl font-bold text-white group-hover:text-orange-500 transition-colors font-montserrat">
                      {service.title}
                    </h3>
                  </div>

                  {/* Service Subtitle */}
                  <p className="text-sm text-gray-400 mb-2 text-center leading-relaxed font-montserrat">
                    {service.subtitle}
                  </p>

                  {/* Service Description */}
                  <p className="text-base text-gray-400 mb-3 text-center leading-relaxed font-montserrat">
                    {service.description}
                  </p>

                  {/* Features List */}
                  <ul className="space-y-1.5 mb-4">
                    {service.features.map((feature, featureIndex) => (
                      <li
                        key={featureIndex}
                        className="text-base text-gray-400 flex items-center leading-6 font-montserrat"
                      >
                        <feature.icon className="w-4 h-4 text-orange-500 mr-1.5 flex-shrink-0" />
                        {feature.text}
                      </li>
                    ))}
                  </ul>

                  {/* Price and Action */}
                  <div className="text-center pt-4 border-t border-gray-700">
                    <span className="text-lg text-orange-500 font-bold font-montserrat">
                      {service.price}
                    </span>
                    <div className="mt-3">
                      <button
                        onClick={handleBookDelivery}
                        className="w-full bg-orange-500/10 text-orange-500 py-1.5 rounded-lg hover:bg-orange-500 hover:text-white transition-colors duration-300 font-semibold text-sm font-montserrat"
                      >
                        {service.action}
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Quote Modal */}
      {showQuoteModal && (
        <GetQuoteBook
          isOpen={showQuoteModal}
          onClose={() => setShowQuoteModal(false)}
        />
      )}
    </>
  );
}
