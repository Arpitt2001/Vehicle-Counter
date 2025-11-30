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
  const total = stats.twoWheelers + stats.threeWheelers + stats.fourWheelers + stats.heavyVehicles;

  const densityColor = {
    LOW: 'text-green-400 bg-green-500/10 border-green-500/30',
    MEDIUM: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
    HIGH: 'text-red-400 bg-red-500/10 border-red-500/30'
  }[stats.density];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 w-full">
      
      {/* Metrics Column */}
      <div className="md:col-span-2 lg:col-span-1 flex flex-col gap-4">
        
        {/* Total & Density Panel */}
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex flex-col gap-3">
             <div className="flex justify-between items-center pb-2 border-b border-slate-700/50">
                 <span className="text-slate-400 font-medium text-sm">Total Detected</span>
                 <span className="text-2xl font-bold text-white">{total}</span>
             </div>
             <div className="flex justify-between items-center">
                 <span className="text-slate-400 font-medium text-sm">Traffic Density</span>
                 <span className={`px-2 py-0.5 rounded text-xs font-bold border ${densityColor}`}>
                     {stats.density}
                 </span>
             </div>
             <div className="grid grid-cols-2 gap-2 mt-2">
                 <button 
                    onClick={onExport}
                    className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold py-2 rounded-lg transition-colors"
                 >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                     </svg>
                     CSV
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

        {/* 4-Grid Vehicle Stats */}
        <div className="grid grid-cols-2 gap-3">
            {/* 2-Wheelers */}
            <div className="bg-brand-card p-4 rounded-xl border border-slate-700 relative overflow-hidden group">
                <div className="absolute -right-2 -top-2 w-16 h-16 bg-blue-500/10 rounded-full blur-xl"></div>
                <h3 className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">2-Wheelers</h3>
                <div className="flex justify-between items-end">
                    <p className="text-2xl font-black text-blue-400">{stats.twoWheelers}</p>
                    <span className="text-xs text-slate-500">Bike</span>
                </div>
            </div>

            {/* 3-Wheelers */}
            <div className="bg-brand-card p-4 rounded-xl border border-slate-700 relative overflow-hidden group">
                <div className="absolute -right-2 -top-2 w-16 h-16 bg-orange-500/10 rounded-full blur-xl"></div>
                <h3 className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">3-Wheelers</h3>
                <div className="flex justify-between items-end">
                    <p className="text-2xl font-black text-orange-400">{stats.threeWheelers}</p>
                    <span className="text-xs text-slate-500">Auto</span>
                </div>
            </div>

            {/* 4-Wheelers */}
            <div className="bg-brand-card p-4 rounded-xl border border-slate-700 relative overflow-hidden group">
                <div className="absolute -right-2 -top-2 w-16 h-16 bg-purple-500/10 rounded-full blur-xl"></div>
                <h3 className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">4-Wheelers</h3>
                <div className="flex justify-between items-end">
                    <p className="text-2xl font-black text-purple-400">{stats.fourWheelers}</p>
                    <span className="text-xs text-slate-500">Car</span>
                </div>
            </div>

             {/* Heavy Vehicles */}
             <div className="bg-brand-card p-4 rounded-xl border border-slate-700 relative overflow-hidden group">
                <div className="absolute -right-2 -top-2 w-16 h-16 bg-red-500/10 rounded-full blur-xl"></div>
                <h3 className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Heavy</h3>
                <div className="flex justify-between items-end">
                    <p className="text-2xl font-black text-red-400">{stats.heavyVehicles}</p>
                    <span className="text-xs text-slate-500">Bus/Truck</span>
                </div>
            </div>
        </div>

      </div>

      {/* Chart Section */}
      <div className="md:col-span-2 bg-brand-card rounded-2xl border border-slate-700 shadow-xl p-4 lg:p-6 flex flex-col">
        <h3 className="text-slate-300 font-semibold mb-4 lg:mb-6 flex items-center gap-2 text-sm lg:text-base">
            <span className="w-2 h-2 rounded-full bg-brand-success animate-pulse"></span>
            Real-time Classification
        </h3>
        <div className="flex-grow w-full h-[200px] lg:h-[250px] min-h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="time" stroke="#64748b" tick={{fontSize: 10}} tickMargin={10} minTickGap={30} />
              <YAxis stroke="#64748b" tick={{fontSize: 10}} allowDecimals={false} width={30} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#fff', fontSize: '12px' }}
                itemStyle={{ color: '#fff' }}
              />
              <Area type="monotone" dataKey="twoWheelers" stackId="1" stroke="#60a5fa" fill="#60a5fa" strokeWidth={0} fillOpacity={0.6} name="2-Wheeler"/>
              <Area type="monotone" dataKey="threeWheelers" stackId="1" stroke="#fb923c" fill="#fb923c" strokeWidth={0} fillOpacity={0.6} name="3-Wheeler" />
              <Area type="monotone" dataKey="fourWheelers" stackId="1" stroke="#a855f7" fill="#a855f7" strokeWidth={0} fillOpacity={0.6} name="4-Wheeler" />
              <Area type="monotone" dataKey="heavyVehicles" stackId="1" stroke="#f87171" fill="#f87171" strokeWidth={0} fillOpacity={0.6} name="Heavy" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};