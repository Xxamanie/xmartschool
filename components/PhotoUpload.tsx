import React, { useRef, useState, useEffect } from 'react';
import { Camera, Upload, X } from 'lucide-react';

interface PhotoUploadProps {
  value?: string;
  onChange: (dataUrl: string) => void;
  label?: string;
  name?: string;
}

// Resize and compress an image File to a JPEG data-URL (max 400 px on longest side).
const compressFile = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const MAX = 400;
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });

// Snapshot a video frame and compress it.
const captureFrame = (video: HTMLVideoElement): string => {
  const MAX = 400;
  const ratio = Math.min(MAX / video.videoWidth, MAX / video.videoHeight, 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(video.videoWidth * ratio);
  canvas.height = Math.round(video.videoHeight * ratio);
  canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.82);
};

export const PhotoUpload: React.FC<PhotoUploadProps> = ({
  value,
  onChange,
  label = 'Photo',
  name,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState('');
  const [videoReady, setVideoReady] = useState(false);

  // Attach stream to video element once both exist
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      setVideoReady(false);
    }
  }, [stream, showCamera]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressFile(file);
      onChange(dataUrl);
    } catch {
      // ignore compression errors — still pass through raw
    }
    e.target.value = '';
  };

  const openCamera = async () => {
    setCameraError('');
    setVideoReady(false);
    setShowCamera(true);
    try {
      const ms = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      setStream(ms);
    } catch {
      setCameraError('Camera unavailable — please upload a photo instead.');
    }
  };

  const closeCamera = () => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setShowCamera(false);
    setCameraError('');
    setVideoReady(false);
  };

  const capture = () => {
    if (!videoRef.current) return;
    onChange(captureFrame(videoRef.current));
    closeCamera();
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>

      <div className="flex items-center gap-4">
        {/* Avatar preview */}
        <div className="w-20 h-20 rounded-full border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
          {value ? (
            <img src={value} alt={name || 'Photo preview'} className="w-full h-full object-cover" />
          ) : (
            <Camera size={26} className="text-gray-300" />
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Upload size={13} /> Upload Photo
          </button>
          <button
            type="button"
            onClick={openCamera}
            className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Camera size={13} /> Use Camera
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:text-red-700 transition-colors"
            >
              <X size={13} /> Remove
            </button>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        id="photo-upload" name="photo-upload"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Camera modal */}
      {showCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Take Photo</h3>
              <button type="button" onClick={closeCamera} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            {cameraError ? (
              <div className="py-6 text-center">
                <Camera size={32} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-red-600">{cameraError}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl overflow-hidden bg-black w-full aspect-video">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    onCanPlay={() => setVideoReady(true)}
                    className="w-full h-full object-cover"
                  />
                  {!videoReady && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={capture}
                    disabled={!videoReady}
                    className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                  >
                    <Camera size={15} /> Capture
                  </button>
                  <button
                    type="button"
                    onClick={closeCamera}
                    className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
