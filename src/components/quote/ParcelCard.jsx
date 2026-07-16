// UPDATED: Multi-parcel support component

import { motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Trash2,
  ChevronDown,
  ChevronUp,
  HelpCircle,
} from "lucide-react";
import { useState } from "react";
import { useDebouncedValidation } from "../../hooks/useDebouncedValidation";
import {
  weightSchema,
  lengthSchema,
  widthSchema,
  heightSchema,
  validateField,
  volumetricWeightKg,
  PARCEL_LIMITS,
} from "../../utils/parcelValidation";

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

  // Errors set by the parent on "Next" click (validateStep in GetQuoteBook.jsx).
  const getValidationError = (field) => {
    if (!validation || !validation[parcelIndex]) return null;
    return validation[parcelIndex][field];
  };

  // Bug 3: pristine-field suppression. A blank field is "untouched", not "invalid",
  // so skip live validation while it's empty — this stops the field from flashing a
  // required/type error the instant Step 3 mounts. The parent's on-submit validation
  // (getValidationError) still enforces the required rule when the user hits Next.
  const isBlank = (v) => v === "" || v === null || typeof v === "undefined";

  // Real-time, debounced (300ms) validation as the person types, independent
  // of the parent's on-submit validation above — whichever fires first wins.
  const weightLive = useDebouncedValidation(
    parcel.weightKg,
    (v) => validateField(weightSchema, v),
    { toastOnError: true, toastId: `parcel-${parcelIndex}-weight`, skip: isBlank(parcel.weightKg) },
  );
  const lengthLive = useDebouncedValidation(
    parcel.dimensions.length,
    (v) => validateField(lengthSchema, v),
    { toastOnError: true, toastId: `parcel-${parcelIndex}-length`, skip: isBlank(parcel.dimensions.length) },
  );
  const widthLive = useDebouncedValidation(
    parcel.dimensions.width,
    (v) => validateField(widthSchema, v),
    { toastOnError: true, toastId: `parcel-${parcelIndex}-width`, skip: isBlank(parcel.dimensions.width) },
  );
  const heightLive = useDebouncedValidation(
    parcel.dimensions.height,
    (v) => validateField(heightSchema, v),
    { toastOnError: true, toastId: `parcel-${parcelIndex}-height`, skip: isBlank(parcel.dimensions.height) },
  );

  // Merge: an on-submit error from the parent still shows even before the
  // debounce settles; once the person edits the field, the live result
  // (which starts re-validating immediately) takes over.
  const weightError = weightLive.error || getValidationError("weightKg");
  const lengthError = lengthLive.error || getValidationError("length");
  const widthError = widthLive.error || getValidationError("width");
  const heightError = heightLive.error || getValidationError("height");

  const weightValid = !weightError && parcel.weightKg !== "" && !weightLive.isValidating;
  const lengthValid = !lengthError && parcel.dimensions.length !== "" && !lengthLive.isValidating;
  const widthValid = !widthError && parcel.dimensions.width !== "" && !widthLive.isValidating;
  const heightValid = !heightError && parcel.dimensions.height !== "" && !heightLive.isValidating;

  const volumetric = volumetricWeightKg(parcel.dimensions);

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
            <label
              htmlFor={`weight-${parcelIndex}`}
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Weight (kg) *
            </label>
            <div className="relative">
              <input
                id={`weight-${parcelIndex}`}
                type="number"
                min={PARCEL_LIMITS.WEIGHT_MIN_KG}
                max={PARCEL_LIMITS.WEIGHT_MAX_KG}
                step="0.1"
                value={parcel.weightKg}
                onChange={(e) => handleWeightChange(e.target.value)}
                placeholder="e.g., 2.5"
                aria-invalid={!!weightError}
                aria-describedby={weightError ? `weight-${parcelIndex}-error` : undefined}
                className={`w-full px-4 py-3 pr-10 rounded-lg border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors ${
                  weightError
                    ? "border-red-500"
                    : weightValid
                      ? "border-green-500"
                      : "border-gray-300 dark:border-gray-600"
                }`}
              />
              {weightValid && (
                <CheckCircle2
                  size={18}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500"
                  aria-hidden="true"
                />
              )}
            </div>
            {weightError && (
              <div
                id={`weight-${parcelIndex}-error`}
                role="alert"
                className="flex items-center text-red-500 text-sm mt-2"
              >
                <AlertCircle size={16} className="mr-2 shrink-0" />
                {weightError}
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
                <label
                  htmlFor={`length-${parcelIndex}`}
                  className="block text-xs text-gray-600 dark:text-gray-400 mb-1"
                >
                  Length
                </label>
                <div className="relative">
                  <input
                    id={`length-${parcelIndex}`}
                    type="number"
                    min={PARCEL_LIMITS.DIMENSION_MIN_CM}
                    max={PARCEL_LIMITS.DIMENSION_MAX_CM}
                    value={parcel.dimensions.length}
                    onChange={(e) =>
                      handleDimensionChange("length", e.target.value)
                    }
                    placeholder="0"
                    aria-invalid={!!lengthError}
                    aria-describedby={lengthError ? `dimensions-${parcelIndex}-error` : undefined}
                    className={`w-full px-3 py-2 pr-8 rounded-lg border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors text-sm ${
                      lengthError
                        ? "border-red-500"
                        : lengthValid
                          ? "border-green-500"
                          : "border-gray-300 dark:border-gray-600"
                    }`}
                  />
                  {lengthValid && (
                    <CheckCircle2
                      size={14}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-green-500"
                      aria-hidden="true"
                    />
                  )}
                </div>
              </div>

              {/* Width */}
              <div>
                <label
                  htmlFor={`width-${parcelIndex}`}
                  className="block text-xs text-gray-600 dark:text-gray-400 mb-1"
                >
                  Width
                </label>
                <div className="relative">
                  <input
                    id={`width-${parcelIndex}`}
                    type="number"
                    min={PARCEL_LIMITS.DIMENSION_MIN_CM}
                    max={PARCEL_LIMITS.DIMENSION_MAX_CM}
                    value={parcel.dimensions.width}
                    onChange={(e) =>
                      handleDimensionChange("width", e.target.value)
                    }
                    placeholder="0"
                    aria-invalid={!!widthError}
                    aria-describedby={widthError ? `dimensions-${parcelIndex}-error` : undefined}
                    className={`w-full px-3 py-2 pr-8 rounded-lg border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors text-sm ${
                      widthError
                        ? "border-red-500"
                        : widthValid
                          ? "border-green-500"
                          : "border-gray-300 dark:border-gray-600"
                    }`}
                  />
                  {widthValid && (
                    <CheckCircle2
                      size={14}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-green-500"
                      aria-hidden="true"
                    />
                  )}
                </div>
              </div>

              {/* Height */}
              <div>
                <label
                  htmlFor={`height-${parcelIndex}`}
                  className="block text-xs text-gray-600 dark:text-gray-400 mb-1"
                >
                  Height
                </label>
                <div className="relative">
                  <input
                    id={`height-${parcelIndex}`}
                    type="number"
                    min={PARCEL_LIMITS.DIMENSION_MIN_CM}
                    max={PARCEL_LIMITS.DIMENSION_MAX_CM}
                    value={parcel.dimensions.height}
                    onChange={(e) =>
                      handleDimensionChange("height", e.target.value)
                    }
                    placeholder="0"
                    aria-invalid={!!heightError}
                    aria-describedby={heightError ? `dimensions-${parcelIndex}-error` : undefined}
                    className={`w-full px-3 py-2 pr-8 rounded-lg border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors text-sm ${
                      heightError
                        ? "border-red-500"
                        : heightValid
                          ? "border-green-500"
                          : "border-gray-300 dark:border-gray-600"
                    }`}
                  />
                  {heightValid && (
                    <CheckCircle2
                      size={14}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-green-500"
                      aria-hidden="true"
                    />
                  )}
                </div>
              </div>
            </div>
            {(lengthError || widthError || heightError) && (
              <div
                id={`dimensions-${parcelIndex}-error`}
                role="alert"
                className="flex items-center text-red-500 text-sm mt-2"
              >
                <AlertCircle size={16} className="mr-2 shrink-0" />
                {lengthError || widthError || heightError}
              </div>
            )}
            {!lengthError && !widthError && !heightError && volumetric > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Volumetric weight: <span className="font-medium">{volumetric.toFixed(1)} kg</span>
                {volumetric > (Number.parseFloat(parcel.weightKg) || 0) && (
                  <span className="ml-1">(may affect final pricing)</span>
                )}
              </p>
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
