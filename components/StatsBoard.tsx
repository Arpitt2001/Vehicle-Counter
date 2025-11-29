import React from 'react';
import { TrafficStats, ChartDataPoint } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface StatsBoardProps {
  stats: TrafficStats;
  history: ChartDataPoint[];
  onReset: () => void;
  onExport: () => void;
}

export const StatsBoard: React.FC<StatsBoardProps> = ({ stats, history, onReset, onExport }) => {
  const total = stats.twoWheelers + stats.fourWheelers;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 w-full">
      {/* Key Metrics Panel */}
      <div className="md:col-span-2 lg:col-span-1 flex flex-col gap-4">
        
        {/* Metric Cards Container */}
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
            {/* 2-Wheelers */}
            <div className="bg-brand-card p-5 rounded-2xl border border-slate-700 shadow-xl relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-20 h-20 bg-brand-accent/10 rounded-full blur-xl"></div>
            <div className="flex justify-between items-start mb-2">
                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">2-Wheelers</h3>
                <svg className="h-5 w-5 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            </div>
            <p className="text-4xl font-black text-white">{stats.twoWheelers}</p>
            </div>

            {/* 4-Wheelers */}
            <div className="bg-brand-card p-5 rounded-2xl border border-slate-700 shadow-xl relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-20 h-20 bg-purple-500/10 rounded-full blur-xl"></div>
            <div className="flex justify-between items-start mb-2">
                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">4-Wheelers</h3>
                <svg className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 012-2h5a2 2 0 012 2" />
                </svg>
            </div>
            <p className="text-4xl font-black text-white">{stats.fourWheelers}</p>
            </div>
        </div>

        {/* Tools & Total */}
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex flex-col gap-3">
             <div className="flex justify-between items-center border-b border-slate-700 pb-3">
                 <span className="text-slate-400 font-medium text-sm">Total Detected</span>
                 <span className="text-xl font-bold text-white">{total}</span>
             </div>
             <div className="grid grid-cols-2 gap-2">
                 <button 
                    onClick={onExport}
                    className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold py-2 rounded-lg transition-colors"
                 >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                     </svg>
                     Export CSV
                 </button>
                 <button 
                    onClick={onReset}
                    className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-red-900/30 text-slate-200 hover:text-red-400 text-xs font-semibold py-2 rounded-lg transition-colors border border-transparent hover:border-red-900/50"
                 >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                     </svg>
                     Reset
                 </button>
             </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="md:col-span-2 bg-brand-card rounded-2xl border border-slate-700 shadow-xl p-4 lg:p-6 flex flex-col">
        <h3 className="text-slate-300 font-semibold mb-4 lg:mb-6 flex items-center gap-2 text-sm lg:text-base">
            <span className="w-2 h-2 rounded-full bg-brand-success animate-pulse"></span>
            Traffic Density (Live)
        </h3>
        <div className="flex-grow w-full h-[200px] lg:h-[250px] min-h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history}>
              <defs>
                <linearGradient id="colorTwo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorFour" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="time" stroke="#64748b" tick={{fontSize: 10}} tickMargin={10} minTickGap={30} />
              <YAxis stroke="#64748b" tick={{fontSize: 10}} allowDecimals={false} width={30} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#fff', fontSize: '12px' }}
                itemStyle={{ color: '#fff' }}
              />
              <Area 
                type="monotone" 
                dataKey="twoWheelers" 
                name="2-Wheelers"
                stroke="#38bdf8" 
                fillOpacity={1} 
                fill="url(#colorTwo)" 
                strokeWidth={2}
                isAnimationActive={false}
              />
              <Area 
                type="monotone" 
                dataKey="fourWheelers" 
                name="4-Wheelers"
                stroke="#a855f7" 
                fillOpacity={1} 
                fill="url(#colorFour)" 
                strokeWidth={2}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
