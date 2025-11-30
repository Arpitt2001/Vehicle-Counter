import { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { TrafficStats, StreamState, LogEntry } from '../types';
import { blobToBase64, createPcmBlob, decodeAudioData, base64ToUint8Array } from '../utils/audio-utils';

const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-09-2025';
const VIDEO_FRAME_RATE = 2.5; // Optimized balance for accuracy/bandwidth
const JPEG_QUALITY = 0.9;     // High quality for better detail recognition

const updateTrafficCountTool: FunctionDeclaration = {
  name: 'report_vehicle_detection',
  description: 'Call this function immediately when NEW vehicles are identified in the video feed.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      two_wheelers: {
        type: Type.NUMBER,
        description: 'Count of NEW 2-wheelers (motorcycles, scooters, bikes) detected since last report.',
      },
      three_wheelers: {
        type: Type.NUMBER,
        description: 'Count of NEW 3-wheelers (auto rickshaws, tuk-tuks) detected since last report.',
      },
      four_wheelers: {
        type: Type.NUMBER,
        description: 'Count of NEW 4-wheelers (cars, jeeps, vans) detected since last report.',
      },
      heavy_vehicles: {
        type: Type.NUMBER,
        description: 'Count of NEW Heavy Vehicles (buses, trucks, trailers, tankers) detected since last report.',
      },
      traffic_density: {
        type: Type.STRING,
        enum: ['LOW', 'MEDIUM', 'HIGH'],
        description: 'Current assessment of traffic congestion.'
      },
      description: {
          type: Type.STRING,
          description: 'Short description of the detected vehicles (e.g., "Red bus and two bikes").'
      }
    },
    required: ['two_wheelers', 'three_wheelers', 'four_wheelers', 'heavy_vehicles', 'traffic_density'],
  },
};

export const useTrafficAI = () => {
  const [streamState, setStreamState] = useState<StreamState>(StreamState.IDLE);
  const [stats, setStats] = useState<TrafficStats>({ 
    twoWheelers: 0, 
    threeWheelers: 0, 
    fourWheelers: 0, 
    heavyVehicles: 0, 
    density: 'LOW',
    lastUpdated: new Date() 
  });
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
  const currentTranscriptRef = useRef<string>("");
  
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
      if (fc.name === 'report_vehicle_detection') {
        const newTwo = Number(fc.args.two_wheelers) || 0;
        const newThree = Number(fc.args.three_wheelers) || 0;
        const newFour = Number(fc.args.four_wheelers) || 0;
        const newHeavy = Number(fc.args.heavy_vehicles) || 0;
        const density = fc.args.traffic_density as 'LOW' | 'MEDIUM' | 'HIGH' || 'LOW';
        const desc = fc.args.description;

        if (newTwo > 0 || newThree > 0 || newFour > 0 || newHeavy > 0) {
          setStats(prev => ({
            twoWheelers: prev.twoWheelers + newTwo,
            threeWheelers: prev.threeWheelers + newThree,
            fourWheelers: prev.fourWheelers + newFour,
            heavyVehicles: prev.heavyVehicles + newHeavy,
            density: density,
            lastUpdated: new Date()
          }));
          
          const parts = [];
          if (newTwo) parts.push(`${newTwo} Bike(s)`);
          if (newThree) parts.push(`${newThree} Auto(s)`);
          if (newFour) parts.push(`${newFour} Car(s)`);
          if (newHeavy) parts.push(`${newHeavy} Truck/Bus`);
          
          const msg = desc ? `${parts.join(', ')} - ${desc}` : parts.join(', ');
          addLog(`Detected: ${msg}`, 'vehicle');
        } else {
             // Update density even if no new vehicles
             setStats(prev => ({ ...prev, density }));
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
    
    if (streamState === StreamState.ACTIVE || streamState === StreamState.CONNECTING) {
        addLog('Switching camera...', 'info');
        await stopStream();
        setTimeout(() => startStream(newMode), 500);
    }
  };

  const resetAnalysis = () => {
    setStats({ 
        twoWheelers: 0, 
        threeWheelers: 0, 
        fourWheelers: 0, 
        heavyVehicles: 0, 
        density: 'LOW', 
        lastUpdated: new Date() 
    });
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

      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

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

      sessionPromiseRef.current = ai.live.connect({
        model: MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          },
          generationConfig: {
            temperature: 0.0, // Zero temperature for maximum deterministic accuracy
            topP: 0.95,
          },
          outputAudioTranscription: {},
          tools: [{ functionDeclarations: [updateTrafficCountTool] }],
          systemInstruction: `
            You are a HIGH-PRECISION Traffic Analysis AI. Your ONLY job is to count vehicles accurately.
            
            OPERATIONAL RULES:
            1. Analyze the video feed continuously with high vigilance.
            2. Report EVERY vehicle that enters the detection view.
            3. Do NOT double count the same vehicle if it stays in frame. Count it only once when it enters.
            4. If the video is unclear, do not guess. Only report confirmed sightings.
            
            STRICT CLASSIFICATION GUIDE:
            - 2-Wheeler: Motorbikes, Scooters, Bicycles. Look for riders exposed.
            - 3-Wheeler: Auto Rickshaws (Tuk-Tuks). Look for the distinctive canopy, 3 wheels, and yellow/black or green bodies.
            - 4-Wheeler: Passenger Cars, SUVs, Jeeps, Taxis, Vans.
            - Heavy Vehicle: Buses, Trucks, Tankers, Lorries, Large Construction Vehicles.
            
            TRAFFIC DENSITY:
            - LOW: < 2 vehicles in view.
            - MEDIUM: 3-5 vehicles in view.
            - HIGH: > 5 vehicles or stopped traffic.
            
            Be concise. If you see vehicles, call the tool 'report_vehicle_detection' IMMEDIATELY.
            Ignore pedestrians. Focus solely on vehicles on the road.
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

            if (msg.serverContent?.outputTranscription?.text) {
                currentTranscriptRef.current += msg.serverContent.outputTranscription.text;
            }
            if (msg.serverContent?.turnComplete && currentTranscriptRef.current) {
                const text = currentTranscriptRef.current.trim();
                if (text.length > 0) {
                    addLog(text, 'transcript');
                }
                currentTranscriptRef.current = "";
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
            stopStream();
          }
        }
      });

    } catch (error: any) {
      console.error("Start Stream Error:", error);
      const msg = error.message || "Failed to start. Check API Key.";
      addLog(`Failed to start: ${msg}`, 'error');
      setError(msg);
      setStreamState(StreamState.ERROR);
      stopStream();
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

        // Increased resolution for better detection accuracy (approx 480p width)
        const targetWidth = 854; 
        const scaleFactor = targetWidth / video.videoWidth;
        const targetHeight = video.videoHeight * scaleFactor;

        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

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
