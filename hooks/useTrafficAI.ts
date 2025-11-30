import { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { TrafficStats, StreamState, LogEntry } from '../types';
import { blobToBase64, createPcmBlob, decodeAudioData, base64ToUint8Array } from '../utils/audio-utils';

const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-09-2025';
// Increased frame rate for better tracking of moving vehicles
const VIDEO_FRAME_RATE = 2; 
const JPEG_QUALITY = 0.8;

const updateTrafficCountTool: FunctionDeclaration = {
  name: 'update_traffic_count',
  description: 'Call this function when vehicles are detected inside the BLUE DETECTION ZONE.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      two_wheelers: {
        type: Type.NUMBER,
        description: 'Count of 2-wheelers (motorcycles, scooters, bikes) currently in the zone.',
      },
      four_wheelers: {
        type: Type.NUMBER,
        description: 'Count of 4-wheelers (cars, trucks, buses, vans) currently in the zone.',
      },
    },
    required: ['two_wheelers', 'four_wheelers'],
  },
};

export const useTrafficAI = () => {
  const [streamState, setStreamState] = useState<StreamState>(StreamState.IDLE);
  const [stats, setStats] = useState<TrafficStats>({ twoWheelers: 0, fourWheelers: 0, lastUpdated: new Date() });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [volume, setVolume] = useState<number>(0);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [error, setError] = useState<string | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  
  // Audio
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [
      { id: Math.random().toString(36).substring(7), time: new Date().toLocaleTimeString(), message, type },
      ...prev.slice(0, 49)
    ]);
  };

  const processToolCall = useCallback((functionCalls: any[]) => {
    if (!functionCalls || functionCalls.length === 0) return;

    functionCalls.forEach(fc => {
      if (fc.name === 'update_traffic_count') {
        const newTwo = Number(fc.args.two_wheelers) || 0;
        const newFour = Number(fc.args.four_wheelers) || 0;

        if (newTwo > 0 || newFour > 0) {
          setStats(prev => ({
            twoWheelers: prev.twoWheelers + newTwo,
            fourWheelers: prev.fourWheelers + newFour,
            lastUpdated: new Date()
          }));
          
          const parts = [];
          if (newTwo) parts.push(`${newTwo} Bike(s)`);
          if (newFour) parts.push(`${newFour} Car(s)`);
          addLog(`Detected: ${parts.join(', ')}`, 'vehicle');
        }

        // Send confirmation
        sessionPromiseRef.current?.then(session => {
            session.sendToolResponse({
              functionResponses: {
                id: fc.id,
                name: fc.name,
                response: { result: "OK" }
              }
            });
        });
      }
    });
  }, []);

  const toggleCamera = async () => {
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newMode);
    
    // If currently streaming, we need to restart to apply the new camera
    if (streamState === StreamState.ACTIVE || streamState === StreamState.CONNECTING) {
        addLog('Switching camera...', 'info');
        await stopStream();
        // Allow a brief moment for cleanup before restarting
        setTimeout(() => startStream(newMode), 500);
    }
  };

  const resetAnalysis = () => {
    setStats({ twoWheelers: 0, fourWheelers: 0, lastUpdated: new Date() });
    setLogs([]);
    addLog('Statistics reset', 'info');
  };

  const startStream = async (forceMode?: 'user' | 'environment') => {
    setError(null);
    try {
      setStreamState(StreamState.CONNECTING);
      const modeToUse = forceMode || facingMode;

      const apiKey = process.env.API_KEY;
      if (!apiKey || apiKey === 'undefined' || apiKey === '""') {
        throw new Error("API Key missing. Set 'GEMINI_API_KEY' in Vercel Env Vars.");
      }

      const ai = new GoogleGenAI({ apiKey });

      // 1. Audio Setup
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      // 2. Media Setup
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
            echoCancellation: true,
            noiseSuppression: true
        }, 
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          facingMode: modeToUse 
        } 
      });
      streamRef.current = mediaStream;

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }

      // 3. Connect Gemini
      sessionPromiseRef.current = ai.live.connect({
        model: MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: [updateTrafficCountTool] }],
          systemInstruction: `
            You are a highly accurate Traffic Monitor.
            
            VISUAL CONTEXT:
            - You see a live street feed.
            - There is a semi-transparent BLUE DETECTION ZONE overlay at the bottom of the video.
            
            YOUR TASK:
            1. Monitor vehicles entering the BLUE DETECTION ZONE.
            2. When a vehicle is clearly inside the Blue Zone, count it.
            3. Classify strictly:
               - "two_wheelers": Motorbikes, scooters, bicycles.
               - "four_wheelers": Cars, SUVs, trucks, buses, vans.
            4. Do NOT count vehicles in the distance or background. Only count when they overlap the BLUE ZONE.
            5. Ignore pedestrians.
            6. If you see a vehicle, call 'update_traffic_count' immediately.
            
            AUDIO CONTEXT:
            - Use audio to confirm engine types (e.g., loud motorbike exhaust vs heavy truck diesel) to improve classification accuracy if visual is blurry.
          `,
        },
        callbacks: {
          onopen: () => {
            setStreamState(StreamState.ACTIVE);
            addLog(`Session started (${modeToUse} camera)`, 'success');
            
            // Audio In
            if (inputAudioContextRef.current && streamRef.current) {
              const source = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
              const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
              
              processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmBlob = createPcmBlob(inputData);
                sessionPromiseRef.current?.then(session => {
                  session.sendRealtimeInput({ media: pcmBlob });
                });
              };
              
              source.connect(processor);
              processor.connect(inputAudioContextRef.current.destination);
            }

            // Video In
            startVideoProcessing();
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.toolCall) {
              processToolCall(msg.toolCall.functionCalls);
            }

            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && outputAudioContextRef.current) {
              const ctx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              
              const buffer = await decodeAudioData(base64ToUint8Array(audioData), ctx);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              
              // Visualizer
              const analyser = ctx.createAnalyser();
              analyser.fftSize = 32;
              source.connect(analyser);
              const dataArray = new Uint8Array(analyser.frequencyBinCount);
              const updateVol = () => {
                if (streamState !== StreamState.ACTIVE) return;
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for(let i=0; i<dataArray.length; i++) sum += dataArray[i];
                setVolume(sum / dataArray.length);
                requestAnimationFrame(updateVol);
              };
              updateVol();

              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
            }
          },
          onclose: () => {
            setStreamState(StreamState.IDLE);
          },
          onerror: (err) => {
            console.error("Gemini Error:", err);
            const msg = err.message || "Connection failed. Check API Key or Network.";
            addLog(`Error: ${msg}`, 'error');
            setError(msg);
            setStreamState(StreamState.ERROR);
            
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
          }
        }
      });

    } catch (error: any) {
      console.error("Start Stream Error:", error);
      const msg = error.message || "Failed to start. Check API Key.";
      addLog(`Failed to start: ${msg}`, 'error');
      setError(msg);
      setStreamState(StreamState.ERROR);
      if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
      }
    }
  };

  const startVideoProcessing = () => {
    if (!videoRef.current || !canvasRef.current) return;
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    frameIntervalRef.current = window.setInterval(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        if (!video || !canvas || video.readyState !== 4) return;

        // Use a standard width for consistent token usage, maintaining aspect ratio
        const targetWidth = 640;
        const scaleFactor = targetWidth / video.videoWidth;
        const targetHeight = video.videoHeight * scaleFactor;

        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        // Draw the raw video frame
        ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

        // Define Detection Zone (Bottom 35% of the screen)
        const zoneY = targetHeight * 0.65;
        const zoneHeight = targetHeight * 0.35;
        
        // Draw Detection Zone Overlay
        ctx.fillStyle = 'rgba(56, 189, 248, 0.2)'; // Blue tint
        ctx.fillRect(0, zoneY, targetWidth, zoneHeight);
        
        // Draw Zone Borders
        ctx.beginPath();
        ctx.moveTo(0, zoneY);
        ctx.lineTo(targetWidth, zoneY);
        ctx.strokeStyle = '#38bdf8'; // Brand accent
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 5]); // Dashed line for top border
        ctx.stroke();
        ctx.setLineDash([]); // Reset dash

        // Draw Label
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('DETECTION ZONE', 10, zoneY + 25);
        
        canvas.toBlob(async (blob) => {
            if (!blob) return;
            const base64 = await blobToBase64(blob);
            sessionPromiseRef.current?.then(session => {
                session.sendRealtimeInput({
                    media: { mimeType: 'image/jpeg', data: base64 }
                });
            });
        }, 'image/jpeg', JPEG_QUALITY);

    }, 1000 / VIDEO_FRAME_RATE); 
  };

  const stopStream = async () => {
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    }
    if (videoRef.current) {
        videoRef.current.srcObject = null;
    }
    if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
    }
    
    if (inputAudioContextRef.current?.state !== 'closed') await inputAudioContextRef.current?.close();
    if (outputAudioContextRef.current?.state !== 'closed') await outputAudioContextRef.current?.close();

    setStreamState(StreamState.IDLE);
    setVolume(0);
    setError(null);
    addLog('Analysis stopped', 'info');
  };

  return {
    videoRef,
    canvasRef,
    streamState,
    stats,
    logs,
    volume,
    facingMode,
    error,
    startStream,
    stopStream,
    toggleCamera,
    resetAnalysis
  };
};
