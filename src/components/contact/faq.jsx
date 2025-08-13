"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(null)

  const faqs = [
    {
      question: "Why can I change my delivery address?",
      answer:
        "You can change your delivery address up to 2 hours before the scheduled delivery time through our tracking system or by contacting customer support.",
    },
    {
      question: "Can I track my parcel?",
      answer:
        "Yes, you can track your parcel in real-time using the tracking number provided after booking. Our system provides live updates on your delivery status.",
    },
    {
      question: "Can my driver come back today?",
      answer:
        "If you missed your delivery, you can reschedule for the same day if there are available time slots. Contact our support team for immediate assistance.",
    },
    {
      question: "What is my delivery number?",
      answer:
        "Your delivery number is sent via SMS and email after booking confirmation. You can also find it in your account dashboard.",
    },
    {
      question: "What will happen if I am not at home?",
      answer:
        "If you're not available, our driver will attempt delivery up to 3 times. You can also arrange for delivery to a neighbor or safe location.",
    },
    {
      question: "How can I collect my parcel?",
      answer:
        "You can collect your parcel from our pickup points or arrange for redelivery at a convenient time through our customer portal.",
    },
  ]

  return (
    <section className="py-16 bg-gray-400">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="font-serif font-bold text-3xl sm:text-4xl text-gray-900 mb-4">Frequently Asked Questions</h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200">
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors duration-200"
              >
                <span className="font-semibold text-gray-900">{faq.question}</span>
                {openIndex === index ? (
                  <ChevronUp className="w-5 h-5 text-orange-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>
              {openIndex === index && (
                <div className="px-6 pb-4">
                  <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
