import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

interface LogPanelProps {
  logs: LogEntry[];
}

export const LogPanel: React.FC<LogPanelProps> = ({ logs }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="w-full h-full bg-slate-900 rounded-xl border border-slate-800 flex flex-col overflow-hidden">
      <div className="p-3 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Live Analysis Log</span>
        <span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full">{logs.length} events</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 font-mono text-xs">
        {logs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p>Waiting for stream...</p>
            </div>
        )}
        {logs.map((log) => (
          <div key={log.id} className={`flex gap-2 animate-fadeIn ${log.type === 'transcript' ? 'opacity-80' : ''}`}>
            <span className="text-slate-600 flex-shrink-0">[{log.time}]</span>
            <span className={`${
              log.type === 'error' ? 'text-red-400 font-bold' : 
              log.type === 'success' ? 'text-green-400' : 
              log.type === 'vehicle' ? 'text-brand-accent font-bold' :
              log.type === 'transcript' ? 'text-slate-400 italic' :
              'text-slate-300'
            }`}>
              {log.type === 'vehicle' && '🚗 '}
              {log.type === 'transcript' && '💬 '}
              {log.message}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};