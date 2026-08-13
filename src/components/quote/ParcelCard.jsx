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

  // Blank field = "untouched", not "invalid": skip validation while empty so the
  // field never flashes a required/type error the instant Step 3 mounts. The
  // parent's on-submit validation (getValidationError) still enforces the
  // required rule when the user hits Next.
  const isBlank = (v) => v === "" || v === null || typeof v === "undefined";

  // Per-field "touched" state. Inline errors are shown only after the field has
  // been blurred (or when the parent's on-submit validation flags it on Next) —
  // never mid-keystroke. This eliminates the annoying real-time errors (and the
  // false "Length is required" toast) that fired while the user was still typing.
  const [touched, setTouched] = useState({});
  const markTouched = (field) => setTouched((t) => ({ ...t, [field]: true }));

  // Debounced (300ms) validity computation. No toast-on-type: surfacing is
  // gated on blur/submit below, not fired as the person types.
  const weightLive = useDebouncedValidation(
    parcel.weightKg,
    (v) => validateField(weightSchema, v),
    { skip: isBlank(parcel.weightKg) },
  );
  const lengthLive = useDebouncedValidation(
    parcel.dimensions.length,
    (v) => validateField(lengthSchema, v),
    { skip: isBlank(parcel.dimensions.length) },
  );
  const widthLive = useDebouncedValidation(
    parcel.dimensions.width,
    (v) => validateField(widthSchema, v),
    { skip: isBlank(parcel.dimensions.width) },
  );
  const heightLive = useDebouncedValidation(
    parcel.dimensions.height,
    (v) => validateField(heightSchema, v),
    { skip: isBlank(parcel.dimensions.height) },
  );

  // Real validity per field (drives the green check) — always reflects the
  // settled value, independent of whether the field has been blurred yet.
  const weightOk = !weightLive.error && parcel.weightKg !== "" && !weightLive.isValidating;
  const lengthOk = !lengthLive.error && parcel.dimensions.length !== "" && !lengthLive.isValidating;
  const widthOk = !widthLive.error && parcel.dimensions.width !== "" && !widthLive.isValidating;
  const heightOk = !heightLive.error && parcel.dimensions.height !== "" && !heightLive.isValidating;

  // Displayed error: the parent's on-submit error always shows; the live error
  // only after the field is blurred (touched). While typing → nothing.
  const weightError = getValidationError("weightKg") || (touched.weight ? weightLive.error : null);
  const lengthError = getValidationError("length") || (touched.length ? lengthLive.error : null);
  const widthError = getValidationError("width") || (touched.width ? widthLive.error : null);
  const heightError = getValidationError("height") || (touched.height ? heightLive.error : null);

  const weightValid = weightOk && !getValidationError("weightKg");
  const lengthValid = lengthOk && !getValidationError("length");
  const widthValid = widthOk && !getValidationError("width");
  const heightValid = heightOk && !getValidationError("height");

  const volumetric = volumetricWeightKg(parcel.dimensions);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border-2 border-primary/30 bg-brand-surface overflow-hidden hover:border-primary/30 transition-colors"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-brand-surface border-b border-primary/30">
        <div className="flex items-center gap-3 flex-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-brand-surface rounded-lg transition-colors"
          >
            {isExpanded ? (
              <ChevronUp
                size={20}
                className="text-brand-text"
              />
            ) : (
              <ChevronDown
                size={20}
                className="text-brand-text"
              />
            )}
          </button>
          <h4 className="text-lg font-bold text-foreground font-montserrat">
            Parcel #{parcelIndex + 1}
          </h4>
          {parcel.weightKg && (
            <span className="text-sm text-muted-foreground ml-2">
              {parcel.weightKg}kg
            </span>
          )}
        </div>

        {canRemove && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onRemove(parcelIndex)}
            className="p-2 hover:bg-destructive-surface rounded-lg transition-colors text-destructive hover:text-destructive"
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
              className="block text-sm font-medium text-muted-foreground mb-2"
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
                onBlur={() => markTouched("weight")}
                placeholder="e.g., 2.5"
                aria-invalid={!!weightError}
                aria-describedby={weightError ? `weight-${parcelIndex}-error` : undefined}
                className={`w-full px-4 py-3 pr-10 rounded-lg border-2 bg-card dark:bg-surface text-foreground placeholder-subtle-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors ${
                  weightError
                    ? "border-destructive"
                    : weightValid
                      ? "border-success"
                      : "border-border-strong"
                }`}
              />
              {weightValid && (
                <CheckCircle2
                  size={18}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-success"
                  aria-hidden="true"
                />
              )}
            </div>
            {weightError && (
              <div
                id={`weight-${parcelIndex}-error`}
                role="alert"
                className="flex items-center text-destructive text-sm mt-2"
              >
                <AlertCircle size={16} className="mr-2 shrink-0" />
                {weightError}
              </div>
            )}
          </div>

          {/* Dimensions */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-3">
              Dimensions (cm) - Length × Width × Height *
            </label>
            <div className="grid grid-cols-3 gap-3">
              {/* Length */}
              <div>
                <label
                  htmlFor={`length-${parcelIndex}`}
                  className="block text-xs text-muted-foreground mb-1"
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
                    onBlur={() => markTouched("length")}
                    placeholder="0"
                    aria-invalid={!!lengthError}
                    aria-describedby={lengthError ? `dimensions-${parcelIndex}-error` : undefined}
                    className={`w-full px-3 py-2 pr-8 rounded-lg border-2 bg-card dark:bg-surface text-foreground placeholder-subtle-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors text-sm ${
                      lengthError
                        ? "border-destructive"
                        : lengthValid
                          ? "border-success"
                          : "border-border-strong"
                    }`}
                  />
                  {lengthValid && (
                    <CheckCircle2
                      size={14}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-success"
                      aria-hidden="true"
                    />
                  )}
                </div>
              </div>

              {/* Width */}
              <div>
                <label
                  htmlFor={`width-${parcelIndex}`}
                  className="block text-xs text-muted-foreground mb-1"
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
                    onBlur={() => markTouched("width")}
                    placeholder="0"
                    aria-invalid={!!widthError}
                    aria-describedby={widthError ? `dimensions-${parcelIndex}-error` : undefined}
                    className={`w-full px-3 py-2 pr-8 rounded-lg border-2 bg-card dark:bg-surface text-foreground placeholder-subtle-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors text-sm ${
                      widthError
                        ? "border-destructive"
                        : widthValid
                          ? "border-success"
                          : "border-border-strong"
                    }`}
                  />
                  {widthValid && (
                    <CheckCircle2
                      size={14}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-success"
                      aria-hidden="true"
                    />
                  )}
                </div>
              </div>

              {/* Height */}
              <div>
                <label
                  htmlFor={`height-${parcelIndex}`}
                  className="block text-xs text-muted-foreground mb-1"
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
                    onBlur={() => markTouched("height")}
                    placeholder="0"
                    aria-invalid={!!heightError}
                    aria-describedby={heightError ? `dimensions-${parcelIndex}-error` : undefined}
                    className={`w-full px-3 py-2 pr-8 rounded-lg border-2 bg-card dark:bg-surface text-foreground placeholder-subtle-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors text-sm ${
                      heightError
                        ? "border-destructive"
                        : heightValid
                          ? "border-success"
                          : "border-border-strong"
                    }`}
                  />
                  {heightValid && (
                    <CheckCircle2
                      size={14}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-success"
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
                className="flex items-center text-destructive text-sm mt-2"
              >
                <AlertCircle size={16} className="mr-2 shrink-0" />
                {lengthError || widthError || heightError}
              </div>
            )}
            {!lengthError && !widthError && !heightError && volumetric > 0 && (
              <p className="text-xs text-subtle-foreground dark:text-muted-foreground mt-2">
                Volumetric weight: <span className="font-medium">{volumetric.toFixed(1)} kg</span>
                {volumetric > (Number.parseFloat(parcel.weightKg) || 0) && (
                  <span className="ml-1">(may affect final pricing)</span>
                )}
              </p>
            )}
          </div>

          {/* Fragile Checkbox */}
          <div className="flex items-center space-x-3 p-3 rounded-lg bg-card dark:bg-surface/50 border border-border">
            <input
              type="checkbox"
              id={`fragile-${parcelIndex}`}
              checked={parcel.fragile || false}
              onChange={(e) => handleFragileChange(e.target.checked)}
              className="w-5 h-5 text-brand-text border-border-strong rounded focus:ring-ring focus:ring-2"
            />
            <label
              htmlFor={`fragile-${parcelIndex}`}
              className="text-sm font-medium text-muted-foreground flex-1 cursor-pointer"
            >
              Mark as fragile
            </label>
            <div className="group relative">
              <HelpCircle
                size={16}
                className="text-muted-foreground cursor-help hover:text-muted-foreground"
              />
              <div className="absolute bottom-full right-0 transform translate-y-2 px-3 py-2 bg-card text-foreground text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                Extra handling for delicate items (may incur charges)
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
