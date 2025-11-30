import React from 'react';
import { StreamState } from '../types';

interface CameraFeedProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  streamState: StreamState;
  volume: number;
  onToggleCamera: () => void;
  facingMode: 'user' | 'environment';
  error?: string | null;
}

export const CameraFeed: React.FC<CameraFeedProps> = ({ 
  videoRef, 
  canvasRef, 
  streamState, 
  volume,
  onToggleCamera,
  facingMode,
  error
}) => {
  return (
    <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-700">
      <video
        ref={videoRef}
        className={`w-full h-full object-cover transform transition-transform ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
        autoPlay
        playsInline
        muted
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Switch Camera Button (Always visible for easy access) */}
      <button 
        onClick={onToggleCamera}
        className="absolute top-4 right-4 z-20 bg-slate-900/60 hover:bg-slate-800/80 text-white p-2 rounded-full backdrop-blur-md border border-slate-600 transition-all active:scale-95"
        title="Switch Camera"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>

      {/* State Overlays */}
      {streamState === StreamState.IDLE && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <p className="text-slate-400 text-lg font-medium flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Camera Offline
          </p>
        </div>
      )}

      {streamState === StreamState.CONNECTING && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-10">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-brand-accent border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-brand-accent font-semibold tracking-wider animate-pulse">CONNECTING...</p>
          </div>
        </div>
      )}
      
      {streamState === StreamState.ERROR && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md z-30 px-6 text-center">
            <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            </div>
            <p className="text-red-400 font-bold text-lg mb-2">Connection Error</p>
            <p className="text-slate-300 text-sm max-w-lg leading-relaxed bg-slate-800/50 p-4 rounded-lg border border-red-500/20">
              {error || "An unknown error occurred"}
            </p>
        </div>
      )}

      {/* Live Active Overlay */}
      {streamState === StreamState.ACTIVE && (
        <>
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-md border border-red-500/30 shadow-lg z-10">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></div>
                <span className="text-xs font-bold text-red-400 tracking-widest">LIVE</span>
            </div>

            {/* Visual Detection Zone Representation */}
            <div className="absolute inset-0 pointer-events-none">
                {/* Zone Area */}
                <div className="absolute top-[65%] bottom-0 left-0 right-0 bg-brand-accent/20 border-t-2 border-dashed border-brand-accent/70">
                   <div className="absolute top-2 left-2 bg-brand-accent/90 text-slate-900 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                     DETECTION ZONE
                   </div>
                </div>
            </div>

            {/* Audio Visualizer */}
            {volume > 0 && (
                <div className="absolute bottom-4 right-4 flex items-end gap-1 h-8 z-10">
                    <div className="w-1.5 bg-brand-accent rounded-full transition-all duration-75 shadow-[0_0_8px_#38bdf8]" style={{ height: `${Math.min(100, volume * 0.5)}%` }}></div>
                    <div className="w-1.5 bg-brand-accent rounded-full transition-all duration-75 delay-75 shadow-[0_0_8px_#38bdf8]" style={{ height: `${Math.min(100, volume * 0.8)}%` }}></div>
                    <div className="w-1.5 bg-brand-accent rounded-full transition-all duration-75 delay-100 shadow-[0_0_8px_#38bdf8]" style={{ height: `${Math.min(100, volume * 1.2)}%` }}></div>
                </div>
            )}
        </>
      )}
    </div>
  );
};
