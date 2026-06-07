import { AppSettings } from "../types";

export function toMins(timeStr: string): number {
  if (!timeStr) return 0;
  const cleaned = timeStr.trim().toLowerCase();
  const isPM = cleaned.includes("pm");
  const isAM = cleaned.includes("am");

  // Remove "am" or "pm" and parse the numbers
  const timeOnly = cleaned.replace("am", "").replace("pm", "").trim();
  const parts = timeOnly.split(":");
  let h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;

  if (isPM && h < 12) {
    h += 12;
  } else if (isAM && h === 12) {
    h = 0;
  }

  return h * 60 + m;
}

export function isSystem12Hour(): boolean {
  return false;
}

export function fromMins(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = Math.floor(mins % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function fmt12(timeStr: string): string {
  if (!timeStr) return "--:--";
  if (!isSystem12Hour()) {
    return timeStr;
  }
  const [hStr, mStr] = timeStr.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return timeStr;
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 || 12;
  return `${String(displayH).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
}

export function fmt12Full(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const s = date.getSeconds();
  if (!isSystem12Hour()) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 || 12;
  return `${String(displayH).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} ${period}`;
}

export function fmtDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function fmtMinsChinese(totalMins: number): string {
  const m = Math.round(totalMins);
  const h = Math.floor(m / 60);
  const remMin = m % 60;
  if (h > 0 && remMin > 0) return `${h}小时${remMin}分`;
  if (h > 0) return `${h}小时`;
  return `${remMin}分钟`;
}

// Perform primary calculation of today's progress, base earnings, and OT earnings
export function computeCurrentEarnings(
  settings: AppSettings,
  now: Date,
  isHoliday: boolean,
  punchIn: Date | null,
  punchOut: Date | null
) {
  const h = now.getHours();
  const m = now.getMinutes();
  const s = now.getSeconds();
  const nowMins = h * 60 + m + s / 60;

  const startM = toMins(settings.startTime);
  const endM = toMins(settings.endTime);
  const lunchS = toMins(settings.lunchStart);
  const lunchE = toMins(settings.lunchEnd);

  const lunchDuration = Math.max(0, lunchE - lunchS);
  const totalWorkMin = Math.max(1, endM - startM - lunchDuration);

  const dailySal = settings.monthlySalary / settings.workDays;
  const payPerMin = dailySal / totalWorkMin;

  if (isHoliday) {
    return {
      statusLabel: "公假",
      earnedBase: dailySal,
      earnedOT: 0,
      totalEarned: dailySal,
      progressPct: 100,
      progressWidth: 100,
      isWorking: false,
      isOT: false,
      otSecs: 0,
      workingMinsElapsed: totalWorkMin,
    };
  }

  // If they have not punched in today, do not automatically calculate or accumulate any earnings!
  if (!punchIn) {
    return {
      statusLabel: "未打卡",
      earnedBase: 0,
      earnedOT: 0,
      totalEarned: 0,
      progressPct: 0,
      progressWidth: 0,
      isWorking: false,
      isOT: false,
      otSecs: 0,
      workingMinsElapsed: 0,
    };
  }

  // Calculate effective start and end times in minutes
  const effectiveStart = punchIn.getHours() * 60 + punchIn.getMinutes() + punchIn.getSeconds() / 60;
  const effectiveEnd = punchOut
    ? punchOut.getHours() * 60 + punchOut.getMinutes() + punchOut.getSeconds() / 60
    : nowMins;

  // ① Intersection with regular working hours [startM, endM]
  const overlapStart = Math.max(effectiveStart, startM);
  const overlapEnd = Math.min(effectiveEnd, endM);

  let activeWorkMins = 0;
  if (overlapStart < overlapEnd) {
    // Subtract lunch intersection with the overlap interval
    const overlapLunchStart = Math.max(overlapStart, lunchS);
    const overlapLunchEnd = Math.min(overlapEnd, lunchE);
    const overlapLunchMins = Math.max(0, overlapLunchEnd - overlapLunchStart);
    activeWorkMins = (overlapEnd - overlapStart) - overlapLunchMins;
  }

  // Base earnings (naturally capped at dailySal because regular active minutes cannot exceed totalWorkMin)
  const earnedBase = activeWorkMins * payPerMin;
  const progressPct = Math.min(100, (activeWorkMins / totalWorkMin) * 100);

  // ③ Overtime calculation
  // otMins = max(0, effectiveEnd - max(effectiveStart, endM))
  const otStartMins = Math.max(effectiveStart, endM);
  const otMins = Math.max(0, effectiveEnd - otStartMins);

  // Real-time precise OT seconds
  let otSecs = 0;
  if (otMins > 0) {
    if (punchOut) {
      otSecs = Math.floor(otMins * 60);
    } else {
      // Calculate precise diff using unix timestamps to preserve seconds accuracy
      const msInDay = now.getHours() * 3600000 + now.getMinutes() * 60000 + now.getSeconds() * 1000;
      const dayStartMs = now.getTime() - msInDay;
      const otStartMs = dayStartMs + otStartMins * 60 * 1000;
      otSecs = Math.max(0, Math.floor((now.getTime() - otStartMs) / 1000));
    }
  }
  const earnedOT = (otSecs / 60) * payPerMin * settings.overtimeRate;

  // Status labels and active toggles
  if (punchOut) {
    return {
      statusLabel: "已下班",
      earnedBase,
      earnedOT,
      totalEarned: earnedBase + earnedOT,
      progressPct,
      progressWidth: progressPct,
      isWorking: false,
      isOT: false,
      otSecs,
      workingMinsElapsed: activeWorkMins,
    };
  }

  const isOT = nowMins >= endM;
  const isLunch = nowMins >= lunchS && nowMins < lunchE;
  const statusLabel = isOT ? "加班中" : (isLunch ? "午休中" : "赚钱中");

  return {
    statusLabel,
    earnedBase,
    earnedOT,
    totalEarned: earnedBase + earnedOT,
    progressPct,
    progressWidth: progressPct,
    isWorking: !isOT && !isLunch,
    isOT,
    otSecs,
    workingMinsElapsed: activeWorkMins,
  };
}
