"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "react-hot-toast";
import {
  X,
  Camera,
  Upload,
  Flashlight,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

// QR Scanner using qr-scanner library (faster, more reliable than manual canvas decoding)
// npm install qr-scanner
import QrScanner from "qr-scanner";

export function QRScannerModal({ jobId, onClose, onScanSuccess }) {
  const [scanMode, setScanMode] = useState("camera"); // "camera" or "upload"
  const [cameraError, setCameraError] = useState(null);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState("");

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const scannerInstanceRef = useRef(null);
  const hasDetectedRef = useRef(false);
  const isMountedRef = useRef(true);

  // Handle successful QR code detection
  const handleQrDetected = useCallback(
    async (qrContent) => {
      // Prevent duplicate detections
      if (hasDetectedRef.current || !qrContent || !qrContent.trim()) {
        console.log("[QRScanner] Duplicate detection prevented or invalid content");
        return;
      }

      hasDetectedRef.current = true;
      setQrData(qrContent);
      setDetectionStatus("QR code detected! Processing....");
      setLoading(true);

      try {
        console.log("[QRScanner] Calling onScanSuccess with:", qrContent.substring(0, 50));
        // Call parent handler which will call driverApi.scanQr()
        await onScanSuccess(qrContent);
        // If successful, parent will close the modal automatically
      } catch (error) {
        console.error("[QRScanner] Failed to process detected QR:", error);
        setQrData(null);
        hasDetectedRef.current = false;
        setDetectionStatus("Detection failed. Try again.");
        toast.error("Failed to process QR. Try scanning again.");
      } finally {
        setLoading(false);
      }
    },
    [onScanSuccess]
  );


  // Initialize and start QR scanner with qr-scanner library
  const startCamera = useCallback(async () => {
    // Check if already scanning or unmounted
    if (scanning || !isMountedRef.current) {
      console.log("[QRScanner] Already scanning or component unmounted - skipping start");
      return;
    }

    // Check if we have an active scanner - don't restart if still running
    if (scannerInstanceRef.current) {
      console.log("[QRScanner] Scanner already exists and running");
      return;
    }

    setCameraError(null);
    setScanning(true);
    setDetectionStatus("Initializing camera...");
    hasDetectedRef.current = false;

    try {
      if (!videoRef.current) {
        throw new Error("Video element not found");
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera not supported on this device");
      }

      // Create a completely fresh scanner instance
      const qrScanner = new QrScanner(
        videoRef.current,
        (result) => {
          if (isMountedRef.current) {
            console.log("[QRScanner] QR detected:", result.data.substring(0, 50));
            handleQrDetected(result.data);
          }
        },
        {
          onDecodeError: () => {
            // Silently ignore decode errors - scanning continues
          },
          preferredCamera: "environment",
          maxScansPerSecond: 25,
          highlightCodeOutline: true,
          highlightScanRegion: true,
        }
      );

      scannerInstanceRef.current = qrScanner;

      // Torch check
      try {
        const hasFlash = await qrScanner.hasFlash();
        if (isMountedRef.current) {
          setTorchAvailable(hasFlash);
        }
      } catch (error) {
        console.warn("[QRScanner] Torch check failed:", error);
        // Continue even if torch check fails
      }

      // Only start if still mounted and scanner exists
      if (isMountedRef.current && scannerInstanceRef.current === qrScanner) {
        await qrScanner.start();
        if (isMountedRef.current) {
          setDetectionStatus("Point camera at QR code on shipping label");
          setScanning(true);
          console.log("[QRScanner] Camera started successfully");
        }
      }
    } catch (error) {
      console.error("[QRScanner] Camera initialization error:", error);
      if (isMountedRef.current) {
        const errorMsg = error.message || "Unable to access camera. Try uploading instead.";
        setCameraError(errorMsg);
        toast.error(errorMsg);
        setScanning(false);
        setScanMode("upload");
        // Cleanup on error
        if (scannerInstanceRef.current) {
          try {
            scannerInstanceRef.current.destroy();
          } catch (e) {
            console.warn("[QRScanner] Cleanup error:", e);
          }
          scannerInstanceRef.current = null;
        }
      }
    }
  }, [handleQrDetected]);

  
  // Stop scanner and cleanup - safe to call multiple times
  const stopCamera = useCallback(() => {
    if (scannerInstanceRef.current) {
      try {
        // Stop must be called before destroy
        if (scannerInstanceRef.current._isRunning) {
          scannerInstanceRef.current.stop();
        }
      } catch (error) {
        console.warn("[QRScanner] Stop error:", error);
      }

      try {
        scannerInstanceRef.current.destroy();
      } catch (error) {
        console.warn("[QRScanner] Destroy error:", error);
      }

      scannerInstanceRef.current = null;
    }

    if (isMountedRef.current) {
      setScanning(false);
      setQrData(null);
      setCameraError(null);
    }
    hasDetectedRef.current = false;
  }, []);

  // Toggle torch/flashlight
  const toggleTorch = async () => {
    if (!scannerInstanceRef.current) return;

    try {
      await scannerInstanceRef.current.toggleFlash();
      setTorchOn((prev) => !prev);
      toast.success(torchOn ? "Flashlight off" : "Flashlight on", {
        duration: 1,
      });
    } catch (error) {
      console.error("[QRScanner] Torch toggle error:", error);
      toast.error("Flashlight not available");
    }
  };

  // Handle QR code from uploaded image file
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }

    setLoading(true);

    try {
      // Use QrScanner.scanImage() to decode QR from uploaded image
      const result = await QrScanner.scanImage(file);
      if (result) {
        setUploadedImage(URL.createObjectURL(file));
        console.log("[QRScanner] QR code found in uploaded image");
        await handleQrDetected(result);
      } else {
        toast.error("No QR code found in the image. Try a different photo.");
        setUploadedImage(null);
      }
    } catch (error) {
      console.error("[QRScanner] Image scan error:", error);
      toast.error("Could not read QR code from image");
      setUploadedImage(null);
    } finally {
      setLoading(false);
    }
  };

  // Setup mount/unmount tracking
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      console.log("[QRScanner] Component unmounting - cleaning up");
      isMountedRef.current = false;
      stopCamera();
    };
  }, [stopCamera]);

  // Auto-start camera when entering camera mode (but only if safe)
  useEffect(() => {
    if (isMountedRef.current && scanMode === "camera" && !scanning && !scannerInstanceRef.current) {
      const timer = setTimeout(() => {
        if (isMountedRef.current) {
          startCamera();
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [scanMode, scanning, startCamera]);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Scan QR Label</h2>
            <p className="text-xs text-slate-600 mt-1">
              {scanMode === "camera"
                ? detectionStatus || "Point camera at shipping label"
                : "Upload a photo of the QR code"}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 hover:bg-white/50 rounded-lg transition-colors disabled:opacity-50"
            aria-label="Close scanner"
          >
            <X className="h-5 w-5 text-slate-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* QR Detected Success Message */}
          {qrData && (
            <div className="p-4 bg-green-50 border-2 border-green-300 rounded-xl flex items-start gap-3 animate-pulse">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-green-900">QR Code Detected! ✓</p>
                <p className="text-xs text-green-700 mt-1 break-all font-mono">
                  {qrData.substring(0, 50)}...
                </p>
              </div>
            </div>
          )}

          {/* Camera Error Message */}
          {cameraError && (
            <div className="p-4 bg-red-50 border-2 border-red-300 rounded-xl flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-900">Camera Error</p>
                <p className="text-sm text-red-700 mt-1">{cameraError}</p>
              </div>
            </div>
          )}

          {/* Camera Mode */}
          {scanMode === "camera" ? (
            <div className="space-y-4">
              {/* Video Stream Container */}
              <div className="relative bg-black rounded-2xl overflow-hidden aspect-video border-4 border-slate-900">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />

                {/* Animated Scanning Frame Overlay */}
                {scanning && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="relative w-48 h-48">
                      {/* Corner markers for visual scanning area */}
                      <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-green-400"></div>
                      <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-green-400"></div>
                      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-green-400"></div>
                      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-green-400"></div>

                      {/* Animated center scan line */}
                      <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-green-400 to-transparent animate-pulse top-1/2 -translate-y-1/2"></div>
                    </div>
                  </div>
                )}

                {/* Loading state overlay */}
                {!scanning && (
                  <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-3">
                    <Camera className="h-12 w-12 text-white/60" />
                    <p className="text-white/70 font-medium text-sm">
                      Initializing camera...
                    </p>
                  </div>
                )}
              </div>

              {/* Camera Control Buttons */}
              <div className="flex gap-3">
                {scanning && torchAvailable && (
                  <button
                    onClick={toggleTorch}
                    disabled={loading}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-semibold transition-all disabled:opacity-50 ${
                      torchOn
                        ? "bg-yellow-500 text-white hover:bg-yellow-600 shadow-lg"
                        : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                    }`}
                  >
                    <Flashlight className="h-4 w-4" />
                    {torchOn ? "Light On" : "Light Off"}
                  </button>
                )}

                <button
                  onClick={stopCamera}
                  disabled={loading}
                  className="flex-1 py-3 px-4 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition-colors disabled:opacity-50"
                >
                  Stop
                </button>
              </div>

              {/* Fallback to Upload */}
              <button
                onClick={() => {
                  stopCamera();
                  setScanMode("upload");
                }}
                disabled={loading}
                className="w-full py-2.5 text-blue-600 hover:text-blue-700 font-semibold text-sm"
              >
                Can&apos;t scan? Upload photo instead
              </button>
            </div>
          ) : (
            /* Upload Mode */
            <div className="space-y-4">
              {uploadedImage && (
                <div className="bg-slate-100 rounded-xl p-3 flex justify-center">
                  <img
                    src={uploadedImage}
                    alt="Uploaded QR"
                    className="max-h-64 object-contain rounded-lg"
                  />
                </div>
              )}

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-4 px-4 border-3 border-dashed border-blue-300 rounded-xl text-slate-700 hover:border-blue-400 hover:bg-blue-50 transition-all disabled:opacity-50 font-semibold"
              >
                <Upload className="h-5 w-5" />
                Choose QR Photo
              </button>

                            <button
                onClick={() => {
                  stopCamera();                    // Force cleanup
                  setUploadedImage(null);
                  // Slightly longer delay to ensure previous scanner is fully destroyed
                  setTimeout(() => {
                    if (isMountedRef.current) {
                      setScanMode("camera");
                    }
                  }, 100);
                }}
                disabled={loading}
                className="w-full py-2.5 text-blue-600 hover:text-blue-700 font-semibold text-sm"
              >
                Back to camera
              </button>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                disabled={loading}
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-200 p-5 bg-slate-50 flex gap-3">
          {loading ? (
            <button
              disabled
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-lg font-semibold"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 bg-white border-2 border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              {qrData && (
                <button
                  onClick={() => handleQrDetected(qrData)}
                  disabled={loading}
                  className="flex-1 py-3 px-4 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 shadow-md"
                >
                  Confirm Scan
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default QRScannerModal;
