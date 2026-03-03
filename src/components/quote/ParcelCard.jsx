// UPDATED: Multi-parcel support component

import { motion } from "framer-motion";
import {
  AlertCircle,
  Trash2,
  ChevronDown,
  ChevronUp,
  HelpCircle,
} from "lucide-react";
import { useState } from "react";

export default function ParcelCard({
  parcel,
  parcelIndex,
  onUpdate,
  onRemove,
  validation,
  canRemove,
  totalParcels,
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleWeightChange = (value) => {
    onUpdate(parcelIndex, { ...parcel, weightKg: value });
  };

  const handleDimensionChange = (dimension, value) => {
    onUpdate(parcelIndex, {
      ...parcel,
      dimensions: {
        ...parcel.dimensions,
        [dimension]: value,
      },
    });
  };

  const handleFragileChange = (checked) => {
    onUpdate(parcelIndex, { ...parcel, fragile: checked });
  };

  const getValidationError = (field) => {
    if (!validation || !validation[parcelIndex]) return null;
    return validation[parcelIndex][field];
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border-2 border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/10 overflow-hidden hover:border-orange-300 dark:hover:border-orange-700 transition-colors"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-orange-100/50 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-800">
        <div className="flex items-center gap-3 flex-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-orange-200 dark:hover:bg-orange-900/40 rounded-lg transition-colors"
          >
            {isExpanded ? (
              <ChevronUp
                size={20}
                className="text-orange-600 dark:text-orange-400"
              />
            ) : (
              <ChevronDown
                size={20}
                className="text-orange-600 dark:text-orange-400"
              />
            )}
          </button>
          <h4 className="text-lg font-bold text-gray-900 dark:text-white font-montserrat">
            Parcel #{parcelIndex + 1}
          </h4>
          {parcel.weightKg && (
            <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
              {parcel.weightKg}kg
            </span>
          )}
        </div>

        {canRemove && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onRemove(parcelIndex)}
            className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors text-red-500 hover:text-red-600"
          >
            <Trash2 size={18} />
          </motion.button>
        )}
      </div>

      {/* Expandable Content */}
      {isExpanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="p-4 space-y-4"
        >
          {/* Weight Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Weight (kg) *
            </label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={parcel.weightKg}
              onChange={(e) => handleWeightChange(e.target.value)}
              placeholder="e.g., 2.5"
              className={`w-full px-4 py-3 rounded-lg border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors ${
                getValidationError("weightKg")
                  ? "border-red-500"
                  : "border-gray-300 dark:border-gray-600"
              }`}
            />
            {getValidationError("weightKg") && (
              <div className="flex items-center text-red-500 text-sm mt-2">
                <AlertCircle size={16} className="mr-2" />
                {getValidationError("weightKg")}
              </div>
            )}
          </div>

          {/* Dimensions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Dimensions (cm) - Length × Width × Height *
            </label>
            <div className="grid grid-cols-3 gap-3">
              {/* Length */}
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                  Length
                </label>
                <input
                  type="number"
                  min="1"
                  value={parcel.dimensions.length}
                  onChange={(e) =>
                    handleDimensionChange("length", e.target.value)
                  }
                  placeholder="0"
                  className={`w-full px-3 py-2 rounded-lg border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors text-sm ${
                    getValidationError("length")
                      ? "border-red-500"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                />
              </div>

              {/* Width */}
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                  Width
                </label>
                <input
                  type="number"
                  min="1"
                  value={parcel.dimensions.width}
                  onChange={(e) =>
                    handleDimensionChange("width", e.target.value)
                  }
                  placeholder="0"
                  className={`w-full px-3 py-2 rounded-lg border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors text-sm ${
                    getValidationError("width")
                      ? "border-red-500"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                />
              </div>

              {/* Height */}
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                  Height
                </label>
                <input
                  type="number"
                  min="1"
                  value={parcel.dimensions.height}
                  onChange={(e) =>
                    handleDimensionChange("height", e.target.value)
                  }
                  placeholder="0"
                  className={`w-full px-3 py-2 rounded-lg border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors text-sm ${
                    getValidationError("height")
                      ? "border-red-500"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                />
              </div>
            </div>
            {(getValidationError("length") ||
              getValidationError("width") ||
              getValidationError("height")) && (
              <div className="flex items-center text-red-500 text-sm mt-2">
                <AlertCircle size={16} className="mr-2" />
                Please enter valid dimensions
              </div>
            )}
          </div>

          {/* Fragile Checkbox */}
          <div className="flex items-center space-x-3 p-3 rounded-lg bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
            <input
              type="checkbox"
              id={`fragile-${parcelIndex}`}
              checked={parcel.fragile || false}
              onChange={(e) => handleFragileChange(e.target.checked)}
              className="w-5 h-5 text-orange-500 border-gray-300 dark:border-gray-600 rounded focus:ring-orange-500 focus:ring-2"
            />
            <label
              htmlFor={`fragile-${parcelIndex}`}
              className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1 cursor-pointer"
            >
              Mark as fragile
            </label>
            <div className="group relative">
              <HelpCircle
                size={16}
                className="text-gray-400 cursor-help hover:text-gray-600 dark:hover:text-gray-300"
              />
              <div className="absolute bottom-full right-0 transform translate-y-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                Extra handling for delicate items (may incur charges)
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
