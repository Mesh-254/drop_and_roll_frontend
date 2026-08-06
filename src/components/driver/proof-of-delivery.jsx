"use client";

import { useState, useRef, useEffect } from "react";
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
import { compressImage } from "../../utils/imageCompression";
import {
  ACCURACY_GOOD_M,
  LOCATION_WINDOW_MS,
  acquireFirstFix,
  classifyAccuracy,
  exifHorizontalError,
  formatAccuracy,
} from "../../utils/geoAccuracy";

// exifr is loaded on demand inside extractExifLocation via a dynamic import(),
// which is what keeps it out of the initial bundle. React.lazy/Suspense are for
// components, not libraries, and importing them here only produced a lint error.

export function ProofOfDelivery({ jobId, onClose, onSubmit }) {
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [notes, setNotes] = useState("");
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [captureMethod, setCaptureMethod] = useState("upload");
  const [cameraError, setCameraError] = useState(null);
  const [hasActiveStream, setHasActiveStream] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Cleanup camera stream on unmount
  useEffect(() => {
    console.log("[ProofOfDelivery] Component mounted");
    return () => {
      console.log(
        "[ProofOfDelivery] Component unmounting, cleaning up video stream",
      );
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
        setCameraStream(null);
        setHasActiveStream(false);
      }
    };
  }, [cameraStream]);

  // Pre-fetch location on mount for speed
  useEffect(() => {
    if (jobId && navigator.geolocation) {
      console.log("[ProofOfDelivery] Pre-fetching location on mount");
      getCurrentLocation().catch((err) => {
        console.warn("[ProofOfDelivery] Pre-fetch failed:", err);
        // Silent on pre-fetch to avoid spamming user
      });
    }
  }, [jobId]);

  // Assign camera stream when captureMethod is "camera"
  useEffect(() => {
    if (captureMethod !== "camera" || !cameraStream) return;
    console.log("[ProofOfDelivery] Assigning stream to videoRef");
    if (!videoRef.current) {
      console.error("[ProofOfDelivery] videoRef is null");
      setCameraError("Video element not ready");
      toast.error("Camera setup failed. Use file upload.");
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
      setCaptureMethod("upload");
      return;
    }
    videoRef.current.srcObject = cameraStream;
    videoRef.current.onloadedmetadata = () => {
      console.log("[ProofOfDelivery] Video metadata loaded:", {
        videoWidth: videoRef.current.videoWidth,
        videoHeight: videoRef.current.videoHeight,
      });
      if (
        videoRef.current.videoWidth === 0 ||
        videoRef.current.videoHeight === 0
      ) {
        console.error("[ProofOfDelivery] Invalid video dimensions");
        toast.error("Camera feed has invalid dimensions");
        cameraStream.getTracks().forEach((track) => track.stop());
        setCameraStream(null);
        setCaptureMethod("upload");
        return;
      }
      videoRef.current.play().catch((err) => {
        console.error("[ProofOfDelivery] Video play failed:", err);
        toast.error("Failed to start video feed. Use upload.");
        cameraStream.getTracks().forEach((track) => track.stop());
        setCameraStream(null);
        setCaptureMethod("upload");
      });
      setHasActiveStream(true);
    };
  }, [captureMethod, cameraStream]);

  const startCamera = async () => {
    console.log("[ProofOfDelivery] Starting camera");
    setCameraError(null);
    setHasActiveStream(false);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error("[ProofOfDelivery] getUserMedia not supported");
      toast.error("Camera not supported by this browser");
      setCaptureMethod("upload");
      return;
    }
    let videoDevices = [];
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      videoDevices = devices.filter((device) => device.kind === "videoinput");
      console.log("[ProofOfDelivery] Available video devices:", videoDevices);
      if (videoDevices.length === 0) {
        console.error("[ProofOfDelivery] No video devices found");
        toast.error("No camera detected. Please use file upload.");
        setCaptureMethod("upload");
        return;
      }
    } catch (error) {
      console.error("[ProofOfDelivery] Device enumeration failed:", error);
      toast.error("Failed to enumerate devices");
      setCaptureMethod("upload");
      return;
    }
    let stream = null;
    for (const device of videoDevices) {
      try {
        console.log(
          `[ProofOfDelivery] Attempting to use device: ${
            device.label || device.deviceId
          }`,
        );
        stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: device.deviceId, facingMode: "environment" },
        });
        const tracks = stream.getVideoTracks();
        console.log("[ProofOfDelivery] Camera stream obtained:", tracks);
        if (tracks.length === 0) {
          console.error("[ProofOfDelivery] Stream has no video tracks");
          continue;
        }
        setCameraStream(stream);
        setCaptureMethod("camera");
        return;
      } catch (error) {
        console.error(
          `[ProofOfDelivery] Camera access error for device ${
            device.label || device.deviceId
          }:`,
          error,
        );
        continue;
      }
    }
    console.error("[ProofOfDelivery] No usable camera stream found");
    setCameraError("No usable camera found");
    toast.error("Unable to access camera. Please use file upload.");
    setCaptureMethod("upload");
  };

  const capturePhoto = async () => {
    console.log("[ProofOfDelivery] Capturing photo");
    if (!videoRef.current || !canvasRef.current) {
      console.error("[ProofOfDelivery] Missing video or canvas ref");
      toast.error("Cannot capture: Video or canvas not initialized");
      return;
    }
    if (!hasActiveStream) {
      console.error("[ProofOfDelivery] No active video stream");
      toast.error("No active camera feed. Please restart camera.");
      return;
    }
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    console.log("[ProofOfDelivery] Canvas set to:", {
      width: canvas.width,
      height: canvas.height,
    });
    const context = canvas.getContext("2d");
    if (!context) {
      console.error("[ProofOfDelivery] Failed to get canvas 2D context");
      toast.error("Canvas context error");
      return;
    }
    context.drawImage(video, 0, 0);
    console.log("[ProofOfDelivery] Image drawn to canvas");
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          console.error("[ProofOfDelivery] Blob creation failed");
          toast.error("Failed to create image");
          return;
        }
        console.log("[ProofOfDelivery] Blob created:", {
          size: blob.size,
          type: blob.type,
        });
        const file = new File([blob], "delivery-photo.jpg", {
          type: "image/jpeg",
        });
        setPhoto(file);
        setPhotoPreview(URL.createObjectURL(blob));
        console.log("[ProofOfDelivery] Photo set, preview URL:", photoPreview);
        const exifLocation = await extractExifLocation(file);
        if (exifLocation) {
          console.log(
            "[ProofOfDelivery] EXIF location extracted:",
            exifLocation,
          );
          setLocation(exifLocation);
          toast.success("Location auto-detected from photo metadata");
        } else {
          console.log(
            "[ProofOfDelivery] No EXIF location found, attempting geolocation",
          );
          await getCurrentLocation();
        }
        if (cameraStream) {
          cameraStream.getTracks().forEach((track) => track.stop());
          console.log("[ProofOfDelivery] Camera stream stopped");
          setCameraStream(null);
          setHasActiveStream(false);
        }
        setCaptureMethod("upload");
      },
      "image/jpeg",
      0.8,
    );
  };

  const handleFileUpload = async (event) => {
    console.log("[ProofOfDelivery] Handling file upload");
    const file = event.target.files[0];
    if (!file || !file.type.startsWith("image/")) {
      console.error("[ProofOfDelivery] Invalid file:", file);
      toast.error("Please select a valid image file");
      return;
    }
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    console.log("[ProofOfDelivery] File uploaded, preview URL:", photoPreview);
    const exifLocation = await extractExifLocation(file);
    if (exifLocation) {
      console.log("[ProofOfDelivery] EXIF location extracted:", exifLocation);
      setLocation(exifLocation);
      toast.success("Location auto-detected from photo metadata");
    } else {
      console.log(
        "[ProofOfDelivery] No EXIF location found, attempting geolocation",
      );
      await getCurrentLocation();
    }
  };

  const retakePhoto = () => {
    console.log("[ProofOfDelivery] Retaking photo");
    setPhoto(null);
    setPhotoPreview(null);
    setLocation(null);
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
      setHasActiveStream(false);
    }
    setCaptureMethod("upload");
  };

  const extractExifLocation = async (file) => {
    console.log("[ProofOfDelivery] Extracting EXIF from file:", file.name);
    try {
      // Dynamically import exifr only when needed (code-splitting still works)
      const exifrLib = await import("exifr");
      const exif = await exifrLib.parse(file, { gps: true });

      if (!exif || !exif.latitude || !exif.longitude) {
        console.log("[ProofOfDelivery] No GPS data in EXIF");
        return null;
      }

      // See exifHorizontalError: this used to read `gpsAltitudeAccuracy || 10`,
      // which is the error on the wrong axis with a fabricated fallback.
      const horizontalError = exifHorizontalError(exif);

      return {
        lat: exif.latitude,
        lng: exif.longitude,
        accuracy: horizontalError,
        source: "exif",
        quality: classifyAccuracy(horizontalError),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("[ProofOfDelivery] EXIF extraction failed:", error);
      return null;
    }
  };

  const getCurrentLocation = async (
    retries = 2,
    windowMs = LOCATION_WINDOW_MS,
  ) => {
    console.log(
      "[ProofOfDelivery] Attempting to get current location, retries left:",
      retries,
    );
    if (!navigator.geolocation) {
      console.error("[ProofOfDelivery] Geolocation not supported");
      toast.error("Geolocation not supported by this browser");
      return;
    }
    setLoading(true);
    try {
      const position = await acquireFirstFix(navigator.geolocation, {
        timeoutMs: windowMs,
      });
      const { latitude: lat, longitude: lng, accuracy } = position.coords;
      console.log("[ProofOfDelivery] Geolocation success:", {
        lat,
        lng,
        accuracy,
      });

      // NO ACCURACY-DRIVEN RETRY. There used to be one here: a fix wider than
      // ACCURACY_MAX_M was thrown away and re-acquired with a longer window,
      // twice, so a driver on a device with a weak fix waited through 8 s, then
      // 16 s, then 24 s plus back-off before the button did anything — on every
      // delivery, holding a parcel at a door.
      //
      // It also could not succeed where it mattered. The devices that produce a
      // wide fix are the ones with no GPS radio to warm up, so a longer window
      // returns the same WiFi estimate more slowly. The retry spent the
      // driver's time to re-measure a number that was not going to change.
      //
      // The fix is kept, labelled, and submitted. Accuracy is metadata, not a
      // gate: the server's verdict ladder records `rejected` / `off_area` for
      // the admin either way, so a bad fix is still caught — just not at the
      // driver's expense. Evidence flagged beats a driver waiting.
      const quality = classifyAccuracy(accuracy);
      setLocation({
        lat,
        lng,
        accuracy,
        // The server needs to know whether this came off the GPS chip or out of
        // a photo's EXIF, because the two have completely different trust.
        source: "gps",
        quality,
        timestamp: new Date().toISOString(),
      });

      if (quality === "rejected") {
        toast(
          `Location is only accurate to ±${formatAccuracy(accuracy)}, so it cannot ` +
            "confirm the address. You can still submit — it will be flagged for review.",
          { id: "location-toast", icon: "⚑", duration: 9000 },
        );
        return;
      }

      if (accuracy <= ACCURACY_GOOD_M) {
        toast.success(`Location captured (±${formatAccuracy(accuracy)})`, {
          id: "location-toast",
        });
      } else {
        // Usable but not good. Saying so lets the driver decide whether to move
        // a few metres and re-capture before this becomes the delivery record.
        toast(
          `Location captured but only accurate to ±${formatAccuracy(accuracy)}. ` +
            "Tap update outdoors for a better fix.",
          { id: "location-toast", icon: "⚠️", duration: 6000 },
        );
      }
    } catch (error) {
      console.error("[ProofOfDelivery] Geolocation failed:", error);
      if (error?.code === error?.PERMISSION_DENIED) {
        toast.error(
          "Location permission is off. Enable it for this site to record proof of delivery.",
          { id: "location-toast", duration: 8000 },
        );
        return;
      }
      // This retry is for a genuine FAILURE — no position at all — which is a
      // different thing from a position we merely dislike, and the only way to
      // get anything is to ask again. The window is NOT extended: a longer wait
      // does not conjure a GPS radio, and the low-accuracy fallback below is
      // the actual answer for a device that has none. Growing it only delayed
      // reaching that fallback.
      if (retries > 0) {
        console.log(
          "[ProofOfDelivery] Retrying location capture, attempts left:",
          retries - 1,
        );
        setTimeout(() => getCurrentLocation(retries - 1, windowMs), 1000);
        return;
      }

      // LAST RESORT, and the reason the driver is not stranded here.
      //
      // `acquireFirstFix` asks for high accuracy, and a device with no GPS
      // radio can answer that with neither a position nor an error — the watch
      // simply stays silent until the timeout closes ("no position acquired").
      // Submission requires a location, so without this the driver is stuck on
      // a screen with nothing left to try, holding a parcel they have already
      // delivered.
      //
      // Dropping to enableHighAccuracy:false asks for the WiFi/IP estimate
      // explicitly. It is a poor location and it is labelled as one — quality
      // `rejected`, source `network` — but it is honest, it is submittable, and
      // the server records the verdict instead of refusing the POD.
      try {
        console.log("[ProofOfDelivery] Falling back to low-accuracy position");
        const fallback = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 15000,
            maximumAge: 60000,
          });
        });
        const { latitude: lat, longitude: lng, accuracy } = fallback.coords;
        setLocation({
          lat,
          lng,
          accuracy: accuracy ?? null,
          source: "network",
          quality: classifyAccuracy(accuracy),
          timestamp: new Date().toISOString(),
        });
        toast(
          `Only an approximate location was available (±${formatAccuracy(accuracy)}). ` +
            "You can still submit — it will be flagged for review.",
          { id: "location-toast", icon: "⚑", duration: 9000 },
        );
        return;
      } catch (fallbackError) {
        console.error(
          "[ProofOfDelivery] Low-accuracy fallback also failed:",
          fallbackError,
        );
      }

      toast.error(
        "Failed to capture location. Ensure location services are enabled.",
        { id: "location-toast" },
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    console.log("[ProofOfDelivery] Submitting proof of delivery");
    if (!photo) {
      console.error("[ProofOfDelivery] No photo provided");
      toast.error("Photo is required for proof of delivery");
      return;
    }
    if (!location) {
      console.error("[ProofOfDelivery] No location provided");
      toast.error(
        "Location is required. Please capture location or ensure photo contains GPS metadata.",
      );
      return;
    }
    setLoading(true);
    try {
      // Compress before it enters the (possibly offline) queue so a spotty-
      // connection sync isn't uploading a multi-MB raw capture.
      const compressedPhoto = await compressImage(photo);
      const proofData = {
        photo: compressedPhoto,
        notes: notes.trim(),
        location,
        booking: jobId,
        // Device capture time — preserved through the offline queue so the
        // delivery timestamp is correct even if this POD syncs later.
        recorded_at: new Date().toISOString(),
      };
      console.log("[ProofOfDelivery] Sending proofData:", {
        hasPhoto: !!proofData.photo,
        notes: proofData.notes,
        location: proofData.location,
        booking: proofData.booking,
      });
      await onSubmit(proofData);
      console.log("[ProofOfDelivery] Submission successful");
    } catch (error) {
      console.error("[ProofOfDelivery] Submission failed:", error);
      toast.error(error.message || "Failed to submit proof of delivery");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-900 w-full max-w-md mx-4 rounded-xl shadow-2xl">
        <div className="flex justify-between items-center p-4 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white">Proof of Delivery</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-4 space-y-6 max-h-[90vh] overflow-y-auto">
          <div className="space-y-4">
            <label className="text-base font-medium text-white">
              Delivery Photo (Required)
            </label>
            <div className="border border-dashed border-gray-700 rounded-lg p-6 text-center">
              {cameraError && (
                <p className="text-red-500 text-sm mb-4">{cameraError}</p>
              )}
              {photoPreview ? (
                <div className="space-y-2">
                  <div className="relative">
                    <img
                      src={photoPreview}
                      alt="Proof"
                      className="max-h-48 mx-auto rounded-lg object-contain"
                    />
                    <button
                      onClick={retakePhoto}
                      className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    onClick={retakePhoto}
                    className="bg-orange-500 hover:bg-orange-600 text-white py-2 px-4 rounded-lg text-sm"
                    disabled={loading}
                  >
                    Retake Photo
                  </button>
                </div>
              ) : captureMethod === "camera" ? (
                <div className="space-y-4">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full min-h-[200px] max-h-48 rounded-lg object-contain bg-black"
                  />
                  <button
                    onClick={capturePhoto}
                    className="bg-orange-500 hover:bg-orange-600 text-white py-2 px-4 rounded-lg disabled:opacity-50"
                    disabled={loading || !hasActiveStream}
                  >
                    Capture Photo
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <FileImage className="h-12 w-12 mx-auto text-gray-500" />
                  <p className="text-sm text-gray-400">
                    Capture or upload a clear photo of the delivery
                  </p>
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={startCamera}
                      className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white py-2 px-4 rounded-lg"
                      disabled={loading}
                    >
                      <Camera className="h-4 w-4" /> Camera
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 border border-gray-600 text-gray-300 py-2 px-4 rounded-lg hover:bg-gray-800"
                      disabled={loading}
                    >
                      <Upload className="h-4 w-4" /> Upload
                    </button>
                  </div>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="notes" className="text-base font-medium text-white">
              Delivery Notes (Optional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-orange-500"
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-base font-medium text-white">
                Delivery Location (Required)
              </label>
              <button
                onClick={() => getCurrentLocation()}
                disabled={loading}
                className="flex items-center gap-2 border border-gray-600 text-gray-300 py-2 px-3 rounded-lg hover:bg-gray-800 disabled:opacity-50"
              >
                <MapPin className="h-4 w-4" />
                {location
                  ? `Update (±${
                      location.accuracy == null
                        ? "?"
                        : formatAccuracy(location.accuracy)
                    })`
                  : "Capture Location"}
              </button>
            </div>
            {location && (
              // The error radius is shown, and coloured, because it is the part
              // of a POD that decides whether the coordinates prove anything. A
              // bare pin from a 374 km fix looks exactly like a good one.
              <p
                className={`text-sm ${
                  location.accuracy != null &&
                  location.accuracy <= ACCURACY_GOOD_M
                    ? "text-green-400"
                    : "text-amber-400"
                }`}
              >
                ✓ Lat: {location.lat.toFixed(6)}, Lng: {location.lng.toFixed(6)}
                {location.accuracy == null
                  ? " — accuracy unknown (from photo metadata)"
                  : ` — accurate to ±${formatAccuracy(location.accuracy)}`}
                {location.source === "exif" && " · from photo"}
              </p>
            )}
          </div>
          <div className="flex gap-2 pt-4 border-t border-gray-800">
            <button
              onClick={handleSubmit}
              disabled={loading || !photo || !location}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 px-4 rounded-lg disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Submit Proof"}
            </button>
            <button
              onClick={onClose}
              disabled={loading}
              className="border border-gray-600 text-gray-300 py-2 px-4 rounded-lg hover:bg-gray-800"
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
