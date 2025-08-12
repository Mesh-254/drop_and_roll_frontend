"use client"

import { Zap, Clock, Building, Package } from "lucide-react"

const services = [
  {
    icon: Zap,
    tier: "Standard",
    title: "Same-Day/Next-Day Delivery",
    description: "Reliable delivery service for your everyday shipping needs with guaranteed timeframes",
    features: ["Same day delivery available", "Next day guarantee", "Real-time tracking", "Signature confirmation"],
    price: "From $8",
  },
  {
    icon: Clock,
    tier: "Express",
    title: "1-2 Hour Urban Drop",
    description: "Ultra-fast delivery for urgent shipments within urban areas",
    features: ["1-2 hour delivery", "Priority handling", "Live GPS tracking", "Instant notifications"],
    price: "From $25",
  },
  {
    icon: Building,
    tier: "Business Solutions",
    title: "Recurring Pickups",
    description: "Scheduled pickup services designed for businesses with regular shipping needs",
    features: ["Weekly/Monthly schedules", "Bulk pricing discounts", "Dedicated account manager", "Custom routing"],
    price: "From $12",
  },
  {
    icon: Package,
    tier: "Specialized",
    title: "Temperature-Sensitive Shipping",
    description: "Climate-controlled transportation for sensitive items requiring specific conditions",
    features: ["Temperature monitoring", "Insulated packaging", "Special handling protocols", "Compliance reporting"],
    price: "From $30",
  },
]

export default function Services() {
  return (
    <section id="services" className="bg-black py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Our Core Service Offerings</h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Choose from our comprehensive range of delivery solutions designed to meet your specific needs
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {services.map((service, index) => {
            const IconComponent = service.icon
            return (
              <div
                key={index}
                className="bg-gray-900 p-6 rounded-xl border border-gray-800 hover:border-orange-500/50 transition-all duration-300 group hover:transform hover:scale-105"
              >
                {/* Service Icon */}
                <div className="mb-4 flex justify-center">
                  <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center group-hover:bg-orange-500/20 transition-colors">
                    <IconComponent className="w-8 h-8 text-orange-500 group-hover:scale-110 transition-transform" />
                  </div>
                </div>

                {/* Service Tier */}
                <div className="text-center mb-3">
                  <span className="inline-block bg-orange-500 text-black text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                    {service.tier}
                  </span>
                </div>

                {/* Service Title */}
                <h3 className="text-white font-bold text-lg mb-2 text-center group-hover:text-orange-500 transition-colors">
                  {service.title}
                </h3>

                {/* Service Description */}
                <p className="text-gray-400 text-sm leading-relaxed mb-4 text-center">{service.description}</p>

                {/* Features List */}
                <ul className="space-y-2 mb-4">
                  {service.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="text-gray-500 text-xs flex items-center">
                      <span className="w-1.5 h-1.5 bg-orange-500 rounded-full mr-2 flex-shrink-0"></span>
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* Price */}
                <div className="text-center pt-4 border-t border-gray-800">
                  <span className="text-orange-500 font-bold text-lg">{service.price}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
