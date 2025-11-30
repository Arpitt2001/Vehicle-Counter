import React, { useState, useEffect } from 'react';
import { useTrafficAI } from './hooks/useTrafficAI';
import { CameraFeed } from './components/CameraFeed';
import { StatsBoard } from './components/StatsBoard';
import { LogPanel } from './components/LogPanel';
import { StreamState, ChartDataPoint } from './types';

function App() {
  const { 
    videoRef, 
    canvasRef, 
    streamState, 
    startStream, 
    stopStream, 
    stats,
    logs,
    volume,
    toggleCamera,
    facingMode,
    resetAnalysis,
    error
  } = useTrafficAI();

  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

  // Update chart history periodically
  useEffect(() => {
    const interval = setInterval(() => {
        setChartData(prev => {
            const now = new Date();
            const timeStr = now.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            const newPoint: ChartDataPoint = {
                time: timeStr,
                twoWheelers: stats.twoWheelers,
                threeWheelers: stats.threeWheelers,
                fourWheelers: stats.fourWheelers,
                heavyVehicles: stats.heavyVehicles
            };

            // Keep last 30 points
            const newHistory = [...prev, newPoint];
            if (newHistory.length > 30) newHistory.shift();
            return newHistory;
        });
    }, 1000); 

    return () => clearInterval(interval);
  }, [stats]);

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all counters?')) {
        resetAnalysis();
        setChartData([]);
    }
  };

  const handleExport = () => {
    if (chartData.length === 0) {
        alert("No data to export yet.");
        return;
    }
    
    // Generate CSV content
    const headers = ['Time', '2-Wheelers', '3-Wheelers', '4-Wheelers', 'Heavy Vehicles'];
    const rows = chartData.map(pt => [pt.time, pt.twoWheelers, pt.threeWheelers, pt.fourWheelers, pt.heavyVehicles]);
    const csvContent = [
        headers.join(','), 
        ...rows.map(r => r.join(','))
    ].join('\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `traffic_report_${new Date().toISOString().slice(0,19)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-brand-dark text-slate-200 font-sans selection:bg-brand-accent selection:text-white pb-20 lg:pb-0">
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-brand-dark/90 backdrop-blur-lg border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-accent to-blue-600 flex items-center justify-center shadow-lg shadow-brand-accent/20">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
            </div>
            <h1 className="text-lg md:text-xl font-bold tracking-tight text-white">TrafficFlow <span className="text-brand-accent">AI</span></h1>
          </div>

          <div className="flex items-center gap-4">
             <div className={`hidden md:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
                 streamState === StreamState.ACTIVE ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 
                 streamState === StreamState.CONNECTING ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                 streamState === StreamState.ERROR ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                 'bg-slate-700/30 text-slate-400 border border-slate-700'
             }`}>
                 <div className={`w-2 h-2 rounded-full ${
                     streamState === StreamState.ACTIVE ? 'bg-green-500 animate-pulse' : 
                     streamState === StreamState.CONNECTING ? 'bg-yellow-500 animate-bounce' :
                     streamState === StreamState.ERROR ? 'bg-red-500' :
                     'bg-slate-500'
                 }`} />
                 {streamState}
             </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 md:py-8">
        
        {/* Top Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 mb-8">
            
            {/* Camera Column */}
            <div className="lg:col-span-8 flex flex-col gap-4">
                <CameraFeed 
                    videoRef={videoRef} 
                    canvasRef={canvasRef} 
                    streamState={streamState} 
                    volume={volume}
                    onToggleCamera={toggleCamera}
                    facingMode={facingMode}
                    error={error}
                />
                
                {/* Control Bar */}
                <div className="bg-brand-card p-4 rounded-xl border border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
                    <div className="flex flex-col text-center sm:text-left">
                        <span className="text-sm font-medium text-white">Analysis Control</span>
                        <span className="text-xs text-slate-500">
                            {streamState === StreamState.ACTIVE ? 'System is actively monitoring traffic' : 'Start camera to begin counting'}
                        </span>
                    </div>
                    
                    {streamState === StreamState.IDLE || streamState === StreamState.ERROR ? (
                        <button 
                            onClick={() => startStream()}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-brand-accent hover:bg-sky-400 text-slate-900 px-8 py-3 rounded-lg font-bold transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(56,189,248,0.3)]"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                            </svg>
                            {streamState === StreamState.ERROR ? 'RETRY' : 'START'}
                        </button>
                    ) : (
                         <button 
                            onClick={stopStream}
                            disabled={streamState === StreamState.CONNECTING}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/50 px-8 py-3 rounded-lg font-bold transition-all disabled:opacity-50"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                            </svg>
                            STOP
                        </button>
                    )}
                </div>
            </div>

            {/* Logs Column (Hidden on mobile initially or stacked) */}
            <div className="lg:col-span-4 h-[300px] lg:h-auto">
                <LogPanel logs={logs} />
            </div>
        </div>

        {/* Dashboard */}
        <section>
             <div className="flex items-center gap-2 mb-4">
                 <h2 className="text-xl md:text-2xl font-bold text-white">Live Dashboard</h2>
                 <div className="h-px flex-grow bg-slate-800 ml-4"></div>
             </div>
             <StatsBoard 
                stats={stats} 
                history={chartData} 
                onReset={handleReset}
                onExport={handleExport}
             />
        </section>

      </main>
    </div>
  );
}

export default App;