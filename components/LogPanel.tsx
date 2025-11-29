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
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">System Logs</span>
        <span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full">{logs.length} events</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 font-mono text-xs">
        {logs.length === 0 && (
            <p className="text-slate-600 text-center mt-10">No activity recorded yet.</p>
        )}
        {logs.map((log) => (
          <div key={log.id} className="flex gap-2 animate-fadeIn">
            <span className="text-slate-500 flex-shrink-0">[{log.time}]</span>
            <span className={`${
              log.type === 'error' ? 'text-red-400' : 
              log.type === 'success' ? 'text-green-400' : 
              log.type === 'vehicle' ? 'text-brand-accent' :
              'text-slate-300'
            }`}>
              {log.type === 'vehicle' && '🚗 '}
              {log.message}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};