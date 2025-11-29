import { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { TrafficStats, StreamState, LogEntry } from '../types';
import { blobToBase64, createPcmBlob, decodeAudioData, base64ToUint8Array } from '../utils/audio-utils';

const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-09-2025';
const VIDEO_FRAME_RATE = 1; 
const JPEG_QUALITY = 0.6;

const updateTrafficCountTool: FunctionDeclaration = {
  name: 'update_traffic_count',
  description: 'Call this function when vehicles CROSS the detected line. Accumulate counts if multiple pass simultaneously.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      two_wheelers: {
        type: Type.NUMBER,
        description: 'Count of new 2-wheelers (motorcycles, scooters) crossing the line.',
      },
      four_wheelers: {
        type: Type.NUMBER,
        description: 'Count of new 4-wheelers (cars, trucks, buses) crossing the line.',
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

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  
  // Audio
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
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
          addLog(`Vehicle detected: ${parts.join(', ')}`, 'vehicle');
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
    try {
      setStreamState(StreamState.CONNECTING);
      const modeToUse = forceMode || facingMode;

      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("API Key not found");

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
          width: { ideal: 640 }, 
          height: { ideal: 480 },
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
            You are a precise Traffic Counting AI.
            
            INPUT:
            - You will receive a video stream with a visible GREEN LINE drawn across the screen.
            - You will receive live audio from the street.

            TASK:
            - Count vehicles (2-Wheelers vs 4-Wheelers) ONLY when they CROSS the GREEN LINE.
            - Use the LINE as a tripwire. Do not count vehicles in the distance or background.
            - Use Audio cues (engine noise) to confirm presence and type (e.g. heavy diesel sound vs high-pitched motorbike).
            
            OUTPUT:
            - Call 'update_traffic_count' immediately when the line is crossed.
            - Be extremely concise with audio feedback.
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
            addLog(`Error: ${err.message}`, 'error');
            setStreamState(StreamState.ERROR);
          }
        }
      });

    } catch (error: any) {
      addLog(`Failed to start: ${error.message}`, 'error');
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

        // Draw video
        canvas.width = video.videoWidth / 2;
        canvas.height = video.videoHeight / 2;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Draw Virtual Tripwire (Green Line)
        const lineY = canvas.height * 0.75; // 75% down
        ctx.beginPath();
        ctx.moveTo(0, lineY);
        ctx.lineTo(canvas.width, lineY);
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 3;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        ctx.stroke();

        // Add "TRIPWIRE" text for Model Context
        ctx.fillStyle = '#00ff00';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('COUNT LINE', 10, lineY - 5);
        
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
    if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
    }
    
    // Close audio contexts
    if (inputAudioContextRef.current?.state !== 'closed') await inputAudioContextRef.current?.close();
    if (outputAudioContextRef.current?.state !== 'closed') await outputAudioContextRef.current?.close();

    setStreamState(StreamState.IDLE);
    setVolume(0);
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
    startStream,
    stopStream,
    toggleCamera,
    resetAnalysis
  };
};
