export interface TrafficStats {
  twoWheelers: number;
  threeWheelers: number;
  fourWheelers: number;
  heavyVehicles: number;
  density: 'LOW' | 'MEDIUM' | 'HIGH';
  lastUpdated: Date;
}

export interface LogEntry {
  id: string;
  time: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'vehicle' | 'transcript';
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
  threeWheelers: number;
  fourWheelers: number;
  heavyVehicles: number;
}