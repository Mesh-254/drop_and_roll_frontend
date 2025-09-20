"use client";

import { useState, useRef } from "react";
import { toast } from "react-hot-toast";
import {
  Camera,
  Upload,
  MapPin,
  CheckCircle,
  X,
  FileImage,
  Trash2,
} from "lucide-react";

export function ProofOfDelivery({
  job,
  onClose,
  onSubmit,
  usingMockData = false,
}) {
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [signature, setSignature] = useState(null);
  const [notes, setNotes] = useState("");
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [captureMethod, setCaptureMethod] = useState("upload");

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const signatureCanvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCaptureMethod("camera");
    } catch (error) {
      console.error("Camera access denied:", error);
      toast.error("Camera access denied. Please use file upload instead.");
      setCaptureMethod("upload");
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext("2d");

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);

      canvas.toBlob(
        (blob) => {
          const file = new File([blob], "delivery-photo.jpg", {
            type: "image/jpeg",
          });
          setPhoto(file);
          setPhotoPreview(URL.createObjectURL(blob));

          const stream = video.srcObject;
          if (stream) {
            stream.getTracks().forEach((track) => track.stop());
          }
          setCaptureMethod("upload");
        },
        "image/jpeg",
        0.8
      );
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith("image/")) {
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    } else {
      toast.error("Please select a valid image file");
    }
  };

  const startDrawing = (e) => {
    setIsDrawing(true);
    const canvas = signatureCanvasRef.current;
    const rect = canvas.getBoundingClientRect();

    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const context = canvas.getContext("2d");
    context.strokeStyle = "#FF6600";
    context.lineWidth = 2;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;

    const canvas = signatureCanvasRef.current;
    const rect = canvas.getBoundingClientRect();

    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const context = canvas.getContext("2d");
    context.lineTo(x, y);
    context.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      const canvas = signatureCanvasRef.current;
      canvas.toBlob((blob) => {
        const file = new File([blob], "signature.png", { type: "image/png" });
        setSignature(file);
      });
    }
  };

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    setSignature(null);
  };

  const getCurrentLocation = async () => {
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        });
      });

      const locationData = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: new Date().toISOString(),
      };

      setLocation(locationData);
      toast.success("Location captured successfully");
    } catch (error) {
      console.error("Failed to get location:", error);
      toast.error(
        "Failed to capture location. Please ensure location services are enabled."
      );
    }
  };

  const handleSubmit = async () => {
    if (!photo && !signature) {
      toast.error(
        "Please provide either a photo or signature as proof of delivery"
      );
      return;
    }

    try {
      setLoading(true);

      if (!location && !usingMockData) {
        await getCurrentLocation();
      }

      const proofData = {
        photo,
        signature,
        notes: notes.trim(),
        location: location || {
          lat: 40.7128,
          lng: -74.006,
          timestamp: new Date().toISOString(),
        },
        job_id: job.id,
        timestamp: new Date().toISOString(),
      };

      await onSubmit(proofData);
    } catch (error) {
      console.error("Failed to submit proof:", error);
      toast.error("Failed to submit proof of delivery");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto bg-gray-900 border border-gray-800 text-white rounded-lg">
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <h3 className="font-montserrat font-semibold">
                Proof of Delivery - Job #{job.id.slice(-8)}
                {usingMockData && (
                  <span className="text-sm text-yellow-500 ml-2">
                    (Demo Mode)
                  </span>
                )}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Job Summary */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center">
                <MapPin className="h-4 w-4 text-orange-400" />
              </div>
              <div>
                <p className="font-medium text-white">Delivery Address</p>
                <p className="text-sm text-gray-400">{job.delivery_address}</p>
                {job.customer_name && (
                  <p className="text-sm text-gray-400 mt-1">
                    Customer: {job.customer_name}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Photo Capture */}
          <div className="space-y-4">
            <label className="text-base font-medium text-white">
              Delivery Photo
            </label>

            {captureMethod === "camera" ? (
              <div className="space-y-4">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full rounded-lg bg-black"
                />
                <div className="flex gap-2">
                  <button
                    onClick={capturePhoto}
                    className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                  >
                    <Camera className="h-4 w-4" />
                    Capture Photo
                  </button>
                  <button
                    onClick={() => setCaptureMethod("upload")}
                    className="border border-gray-600 text-gray-300 hover:bg-gray-800 py-2 px-4 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {photoPreview ? (
                  <div className="relative">
                    <img
                      src={photoPreview || "/placeholder.svg"}
                      alt="Delivery proof"
                      className="w-full h-48 object-cover rounded-lg border border-gray-700"
                    />
                    <button
                      className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-1 rounded-full transition-colors"
                      onClick={() => {
                        setPhoto(null);
                        setPhotoPreview(null);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center">
                    <FileImage className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-400 mb-4">
                      Take a photo or upload an image as proof of delivery
                    </p>
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={startCamera}
                        className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                      >
                        <Camera className="h-4 w-4" />
                        Use Camera
                      </button>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 border border-gray-600 text-gray-300 hover:bg-gray-800 py-2 px-4 rounded-lg transition-colors"
                      >
                        <Upload className="h-4 w-4" />
                        Upload File
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* Signature Capture */}
          <div className="space-y-4">
            <label className="text-base font-medium text-white">
              Customer Signature (Optional)
            </label>
            <div className="border border-gray-700 rounded-lg p-4 bg-gray-800">
              <canvas
                ref={signatureCanvasRef}
                width={400}
                height={200}
                className="w-full border border-gray-600 rounded cursor-crosshair bg-white"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                style={{ touchAction: "none" }}
              />
              <div className="flex justify-between items-center mt-2">
                <p className="text-sm text-gray-400">
                  Draw customer signature above
                </p>
                <button
                  onClick={clearSignature}
                  className="flex items-center gap-1 border border-gray-600 text-gray-300 bg-transparent hover:bg-gray-700 py-1 px-2 rounded text-sm transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                  Clear
                </button>
              </div>
            </div>
          </div>

          {/* Delivery Notes */}
          <div className="space-y-2">
            <label htmlFor="notes" className="text-base font-medium text-white">
              Delivery Notes (Optional)
            </label>
            <textarea
              id="notes"
              placeholder="Add any additional notes about the delivery..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 resize-none focus:outline-none focus:border-orange-500"
            />
          </div>

          {/* Location Capture */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-base font-medium text-white">
                Delivery Location
              </label>
              <button
                onClick={getCurrentLocation}
                disabled={loading || usingMockData}
                className="flex items-center gap-2 border border-gray-600 text-gray-300 bg-transparent hover:bg-gray-700 py-2 px-3 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MapPin className="h-4 w-4" />
                {location
                  ? "Update Location"
                  : usingMockData
                  ? "Demo Location"
                  : "Capture Location"}
              </button>
            </div>
            {(location || usingMockData) && (
              <p className="text-sm text-green-400">
                ✓ Location {usingMockData ? "simulated" : "captured"} (
                {location?.lat?.toFixed(6) || "40.712800"},{" "}
                {location?.lng?.toFixed(6) || "-74.006000"})
              </p>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-2 pt-4 border-t border-gray-800">
            <button
              onClick={handleSubmit}
              disabled={loading || (!photo && !signature)}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Submitting..." : "Submit Proof of Delivery"}
            </button>
            <button
              onClick={onClose}
              disabled={loading}
              className="border border-gray-600 text-gray-300 bg-transparent hover:bg-gray-800 py-2 px-4 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
