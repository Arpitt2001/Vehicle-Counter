export interface TrafficStats {
  twoWheelers: number;
  fourWheelers: number;
  lastUpdated: Date;
}

export interface LogEntry {
  id: string;
  time: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'vehicle';
}

export enum StreamState {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  ACTIVE = 'ACTIVE',
  ERROR = 'ERROR'
}

export interface ChartDataPoint {
  time: string;
  twoWheelers: number;
  fourWheelers: number;
}