export interface AppSettings {
  monthlySalary: number;
  workDays: number;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  lunchStart: string; // "HH:MM"
  lunchEnd: string;   // "HH:MM"
  overtimeRate: number; // 1.5, 2.0, 3.0
  workWeekdays?: number[]; // [0-6] where 0 is Sunday, 1 is Monday, etc.
  currency?: "RM" | "SGD";
}

export interface SlackSession {
  id: string;
  start: string; // ISO string
  end: string;   // ISO string
  mins: number;
  earned: number;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentSaved: number;
  createdAt: string; // Date string
}

export interface WeatherData {
  temp: number;
  code: number;
  feelsLike: number;
  humidity: number;
  timestamp: number; // ms since epoch
  locationName?: string;
}

export interface PunchRecord {
  date: string; // "YYYY-MM-DD"
  inTime: string | null; // "HH:MM:SS" or full date string
  outTime: string | null;
}

export interface MonthHistory {
  month: string; // "YYYY-MM"
  workDaysPassed: number;
  totalBaseEarned: number;
  totalOTEarned: number;
  totalSlackMins: number;
  totalSlackEarned: number;
}
