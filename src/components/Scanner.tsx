import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { playBeep } from '@/src/lib/audio';
import { cn } from '@/src/lib/utils';
import { Volume2, VolumeX, Camera, AlertCircle, CheckCircle2, ExternalLink, Image as ImageIcon, Copy, Check, Settings } from 'lucide-react';

interface ScannerProps {
  onScan: (barcode: string) => void;
  lastScan?: { barcode: string; name: string; quantity: number } | null;
  isProcessing: boolean;
}

export default function Scanner({ onScan, lastScan, isProcessing }: ScannerProps) {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [manualBarcode, setManualBarcode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [hasRequestedStart, setHasRequestedStart] = useState(false);
  const [isScanningFile, setIsScanningFile] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getCameras = async () => {
    try {
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        setCameras(devices.map(d => ({ id: d.id, label: d.label || `Camera ${d.id.slice(0, 4)}` })));
        if (!selectedCameraId) setSelectedCameraId(devices[0].id);
      }
    } catch (err) {
      console.error("Error getting cameras:", err);
    }
  };

  const startScanner = async (cameraId?: string) => {
    try {
      setCameraError(null);
      
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
      }

      const html5QrCode = new Html5Qrcode("reader");
      html5QrCodeRef.current = html5QrCode;

      const config = { 
        fps: 10, 
        qrbox: { width: 250, height: 150 },
      };

      const targetCamera = cameraId || selectedCameraId || { facingMode: "environment" };

      await html5QrCode.start(
        targetCamera,
        config,
        (decodedText) => {
          if (soundEnabled) playBeep();
          onScan(decodedText);
        },
        () => {}
      );
      setIsCameraActive(true);
      setCameraError(null);
      getCameras(); // Refresh camera list once we have permission
    } catch (err: any) {
      console.error("Camera start error:", err);
      setIsCameraActive(false);
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message?.includes('Permission denied')) {
        setCameraError("Camera access is blocked. Browsers often restrict camera use inside preview windows.");
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError("No camera found on this device.");
      } else {
        setCameraError("Could not start camera. It might be in use by another application.");
      }
    }
  };

  const requestPermissionAndStart = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
      startScanner();
    } catch (err: any) {
      console.error("Manual permission request failed:", err);
      setCameraError("Permission denied. To fix this, you MUST open the app in a new tab using the button below.");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanningFile(true);
    try {
      const html5QrCode = new Html5Qrcode("reader");
      const result = await html5QrCode.scanFile(file, true);
      if (soundEnabled) playBeep();
      onScan(result);
    } catch (err) {
      console.error("File scan error:", err);
      alert("No barcode detected. Try a clearer photo with better lighting.");
    } finally {
      setIsScanningFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (hasRequestedStart) {
      startScanner();
    }
    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, [onScan, soundEnabled, hasRequestedStart]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualBarcode.trim()) {
      if (soundEnabled) playBeep();
      onScan(manualBarcode.trim());
      setManualBarcode('');
    }
  };

  return (
    <section className="p-6 bg-white flex flex-col gap-5 w-full">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-[#1E293B]">Scanner Terminal</h3>
          <p className="text-[13px] text-[#64748B]">Position barcode within the frame</p>
        </div>
        {cameras.length > 1 && (
          <div className="flex items-center gap-2 bg-[#F1F5F9] px-2 py-1 rounded-md border border-[#E2E8F0]">
            <Settings size={14} className="text-[#64748B]" />
            <select 
              className="bg-transparent text-[10px] font-semibold text-[#1E293B] focus:outline-none"
              value={selectedCameraId || ''}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedCameraId(id);
                startScanner(id);
              }}
            >
              {cameras.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="relative w-full max-h-[50vh] aspect-[4/3] bg-black rounded-2xl overflow-hidden shadow-xl flex items-center justify-center">
        <div id="reader" className="w-full h-full"></div>
        
        {!isCameraActive && !cameraError && !hasRequestedStart && (
          <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center z-20">
            <Camera className="text-slate-400 mb-4" size={32} />
            <button 
              onClick={() => setHasRequestedStart(true)}
              className="px-6 py-3 bg-[#4F46E5] text-white rounded-lg font-bold hover:bg-[#3730A3] transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/40"
            >
              <Camera size={18} />
              Start Camera Scanner
            </button>
            <p className="text-slate-400 text-xs mt-4 px-8 text-center">
              Click to enable camera. You can also use a physical barcode scanner at any time.
            </p>
          </div>
        )}

        {cameraError && (
          <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="text-red-500" size={28} />
            </div>
            <p className="text-white text-sm font-semibold mb-2">Camera Access Blocked</p>
            <p className="text-slate-400 text-[11px] mb-6 px-4 leading-relaxed">
              {cameraError}
            </p>
            
            <div className="flex flex-col gap-2.5 w-full max-w-[260px]">
              <button 
                onClick={() => window.open(window.location.href, '_blank')}
                className="px-4 py-3 bg-[#4F46E5] text-white rounded-lg text-xs font-bold hover:bg-[#3730A3] transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/40 animate-pulse"
              >
                <ExternalLink size={14} />
                FIX: OPEN IN NEW TAB
              </button>
              
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-2.5 bg-white/10 text-white border border-white/10 rounded-lg text-[10px] font-bold hover:bg-white/20 transition-all flex items-center justify-center gap-2"
                >
                  <ImageIcon size={14} />
                  Scan Image
                </button>
                <button 
                  onClick={requestPermissionAndStart}
                  className="px-3 py-2.5 bg-white/10 text-white border border-white/10 rounded-lg text-[10px] font-bold hover:bg-white/20 transition-all flex items-center justify-center gap-2"
                >
                  <Camera size={14} />
                  Retry Camera
                </button>
              </div>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleFileChange} />
          </div>
        )}

        {isScanningFile && (
          <div className="absolute inset-0 bg-slate-900/80 flex flex-col items-center justify-center z-30">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mb-3"></div>
            <p className="text-white text-xs font-medium">Analyzing Image...</p>
          </div>
        )}

        {isCameraActive && !cameraError && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
            <div className="w-[70%] h-[40%] border-2 border-[#10B981] rounded-lg shadow-[0_0_0_1000px_rgba(0,0,0,0.6)] relative">
              <div className="absolute top-1/2 left-0 w-full h-0.5 bg-[#10B981] shadow-[0_0_15px_#10B981] animate-pulse"></div>
            </div>
          </div>
        )}

        <div className="absolute bottom-3 left-3 text-[10px] text-white/50 font-mono z-10">
          FPS: 10 | AUTO_FOCUS: ON | MODE: ENV
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center mt-2">
          <label className="text-[11px] font-semibold uppercase text-[#64748B]">Manual Entry</label>
          <button 
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="text-[11px] text-[#4F46E5] flex items-center gap-1 hover:underline"
          >
            {soundEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
            Toggle Sound {soundEnabled ? 'OFF' : 'ON'}
          </button>
        </div>
        
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input 
            type="tel" 
            inputMode="numeric"
            pattern="[0-9]*"
            className="flex-1 px-4 py-3 border border-[#E2E8F0] rounded-lg text-sm bg-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20"
            placeholder="Enter barcode manually..."
            value={manualBarcode}
            onChange={(e) => setManualBarcode(e.target.value.replace(/\D/g, ''))}
          />
          <button 
            type="submit"
            disabled={isProcessing}
            className="px-5 py-3 bg-[#4F46E5] text-white rounded-lg font-semibold text-sm hover:bg-[#3730A3] transition-colors disabled:opacity-50"
          >
            Update
          </button>
        </form>
      </div>

      {lastScan && (
        <div className="bg-[#ECFDF5] border border-[#10B981] p-3 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="w-6 h-6 bg-[#10B981] rounded-full flex items-center justify-center text-white">
            <CheckCircle2 size={14} />
          </div>
          <div>
            <div className="font-bold text-sm text-[#065F46]">Scan Successful</div>
            <div className="text-[12px] text-[#065F46]/80">
              {lastScan.name} quantity updated to {lastScan.quantity}.
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
