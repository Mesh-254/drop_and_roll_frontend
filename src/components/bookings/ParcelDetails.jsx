import React, { useState, useCallback, useMemo } from 'react';
import { AlertCircle, Plus, Trash2, AlertTriangle, Package } from 'lucide-react';
import { validateParcel, validateAllParcels } from './parcelValidation';

const DEBUG = process.env.NODE_ENV === 'development' && false; // Set to true for dev debug logs

const ParcelDetails = ({ parcels = [], onUpdate, showErrors = false }) => {
  const [localErrors, setLocalErrors] = useState({});

  const debugLog = (msg, data) => {
    if (DEBUG) {
      console.log(`[ParcelDetails] ${msg}`, data);
    }
  };

  // Real-time validation whenever parcels change
  const validationResults = useMemo(() => {
    if (!parcels || parcels.length === 0) {
      debugLog('No parcels to validate');
      return { isValid: true, errors: {}, summary: [] };
    }

    const results = validateAllParcels(parcels);
    debugLog('Validation results:', results);
    return results;
  }, [parcels]);

  // Handle adding a new parcel
  const handleAddParcel = useCallback(() => {
    const newParcel = {
      id: Date.now(),
      weight_kg: '',
      dimensions: {
        length: '',
        width: '',
        height: '',
      },
      fragile: false,
    };
    debugLog('Adding new parcel:', newParcel);
    onUpdate([...parcels, newParcel]);
  }, [parcels, onUpdate]);

  // Handle removing a parcel
  const handleRemoveParcel = useCallback((index) => {
    const updatedParcels = parcels.filter((_, i) => i !== index);
    debugLog('Removing parcel at index:', index);
    onUpdate(updatedParcels);
  }, [parcels, onUpdate]);

  // Handle updating a parcel field
  const handleParcelUpdate = useCallback((index, field, value) => {
    const updatedParcels = [...parcels];
    const parcel = updatedParcels[index];

    debugLog(`Updating parcel ${index}.${field}:`, value);

    if (field === 'weight_kg') {
      // Only allow positive numbers and decimals, block negative values
      if (value === '' || value === null) {
        parcel.weight_kg = '';
      } else {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          return; // Reject non-numeric input
        }
        // Block negative values at input level
        if (numValue < 0) {
          debugLog('Blocking negative weight:', numValue);
          return;
        }
        parcel.weight_kg = numValue;
      }
    } else if (field === 'fragile') {
      parcel.fragile = value;
    } else if (field.startsWith('dimension_')) {
      const dimensionField = field.split('_')[1]; // 'length', 'width', or 'height'
      if (value === '' || value === null) {
        parcel.dimensions[dimensionField] = '';
      } else {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          return; // Reject non-numeric input
        }
        // Block negative values at input level
        if (numValue < 0) {
          debugLog(`Blocking negative ${dimensionField}:`, numValue);
          return;
        }
        parcel.dimensions[dimensionField] = numValue;
      }
    }

    onUpdate(updatedParcels);
  }, [parcels, onUpdate]);

  // Get error for a specific parcel field
  const getFieldError = (parcelIndex, field) => {
    return validationResults.errors[`parcel_${parcelIndex}_${field}`] || '';
  };

  // Bug 3: pristine-field suppression. A blank field is "untouched", not "invalid", so we
  // don't surface its "required" error until the user submits (showErrors). Non-empty
  // invalid values (e.g. over the 30kg / 100cm limit) still show immediately on change.
  const isBlank = (v) => v === '' || v === null || v === undefined;
  const showFieldError = (parcelIndex, field, rawValue) => {
    const err = getFieldError(parcelIndex, field);
    if (!err) return '';
    if (isBlank(rawValue) && !showErrors) return '';
    return err;
  };

  // Determine if there are overall form errors
  const hasErrors = validationResults.summary.length > 0 || !validationResults.isValid;

  debugLog('Rendering with validation:', {
    parcelCount: parcels.length,
    hasErrors,
    errorCount: validationResults.summary.length,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          <Package className="h-5 w-5 text-orange-500 mr-2" />
          Parcel Details
        </h3>
        <button
          type="button"
          onClick={handleAddParcel}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        >
          <Plus className="h-4 w-4" />
          Add Parcel
        </button>
      </div>

      {/* Error Summary Box */}
      {showErrors && hasErrors && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-red-800 dark:text-red-300 mb-2">
                Parcel Validation Errors
              </h4>
              <ul className="space-y-1 text-red-700 dark:text-red-400 text-sm">
                {validationResults.summary.map((error, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">•</span>
                    <span>{error}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {(!parcels || parcels.length === 0) && (
        <div className="text-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            No parcels added yet. Click "Add Parcel" to get started.
          </p>
        </div>
      )}

      {/* Parcel List */}
      <div className="space-y-4">
        {parcels && parcels.map((parcel, index) => (
          <div
            key={parcel.id || index}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-4"
          >
            {/* Parcel Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
              <h4 className="font-semibold text-gray-900 dark:text-white">
                Parcel {index + 1}
              </h4>
              <button
                type="button"
                onClick={() => handleRemoveParcel(index)}
                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                aria-label={`Remove parcel ${index + 1}`}
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>

            {/* Weight Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Weight (kg) *
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0.1"
                max="50"
                value={parcel.weight_kg ?? ''}
                onChange={(e) => handleParcelUpdate(index, 'weight_kg', e.target.value)}
                onPaste={(e) => {
                  // Prevent pasting negative values
                  const pastedText = e.clipboardData.getData('text');
                  if (pastedText.includes('-')) {
                    e.preventDefault();
                  }
                }}
                placeholder="e.g., 2.5"
                className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors ${
                  showFieldError(index, 'weight_kg', parcel.weight_kg)
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-gray-300 dark:border-gray-600 focus:ring-orange-500'
                }`}
              />
              {showFieldError(index, 'weight_kg', parcel.weight_kg) && (
                <div className="flex items-center text-red-500 text-sm mt-1">
                  <AlertCircle className="h-4 w-4 mr-1 flex-shrink-0" />
                  {showFieldError(index, 'weight_kg', parcel.weight_kg)}
                </div>
              )}
            </div>

            {/* Dimensions Section */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Dimensions (cm) *
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['length', 'width', 'height'].map((dim) => (
                  <div key={dim}>
                    <label className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1 block">
                      {dim}
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min="1"
                      max="200"
                      value={parcel.dimensions[dim] ?? ''}
                      onChange={(e) =>
                        handleParcelUpdate(index, `dimension_${dim}`, e.target.value)
                      }
                      onPaste={(e) => {
                        // Prevent pasting negative values
                        const pastedText = e.clipboardData.getData('text');
                        if (pastedText.includes('-')) {
                          e.preventDefault();
                        }
                      }}
                      placeholder="0"
                      className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 text-center focus:outline-none focus:ring-2 transition-colors ${
                        showFieldError(index, `dimension_${dim}`, parcel.dimensions[dim])
                          ? 'border-red-500 focus:ring-red-500'
                          : 'border-gray-300 dark:border-gray-600 focus:ring-orange-500'
                      }`}
                    />
                    {showFieldError(index, `dimension_${dim}`, parcel.dimensions[dim]) && (
                      <div className="text-red-500 text-xs mt-1 flex items-center">
                        <AlertCircle className="h-3 w-3 mr-0.5 flex-shrink-0" />
                        {showFieldError(index, `dimension_${dim}`, parcel.dimensions[dim])}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {/* Cross-field error: only once submitting or the user has started entering
                  dimensions (not on a pristine, all-blank parcel). */}
              {getFieldError(index, 'dimensions_overall') &&
                (showErrors || ['length', 'width', 'height'].some((d) => !isBlank(parcel.dimensions[d]))) && (
                <div className="flex items-center text-red-500 text-sm mt-2">
                  <AlertCircle className="h-4 w-4 mr-1 flex-shrink-0" />
                  {getFieldError(index, 'dimensions_overall')}
                </div>
              )}
            </div>

            {/* Fragile Checkbox */}
            <div className="flex items-center gap-3 pt-2">
              <input
                type="checkbox"
                id={`fragile_${index}`}
                checked={parcel.fragile || false}
                onChange={(e) => handleParcelUpdate(index, 'fragile', e.target.checked)}
                className="w-4 h-4 text-orange-500 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-orange-500 cursor-pointer"
              />
              <label
                htmlFor={`fragile_${index}`}
                className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
              >
                This parcel contains fragile items
              </label>
            </div>

            {/* Warning for large values */}
            {(parcel.weight_kg > 30 ||
              Object.values(parcel.dimensions).some((v) => v > 150)) && (
              <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-800 dark:text-amber-300">
                  <strong>Note:</strong> This is a large or heavy parcel. Ensure it's properly packed.
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ParcelDetails;
