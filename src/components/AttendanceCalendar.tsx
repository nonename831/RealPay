import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AppSettings, PunchRecord } from "../types";

interface AttendanceCalendarProps {
  settings: AppSettings;
  allPunches: PunchRecord[];
  onUpdatePunch: (dateStr: string, inTimeStr: string | null, outTimeStr: string | null) => void;
  now: Date;
}

export default function AttendanceCalendar({
  settings,
  allPunches,
  onUpdatePunch,
  now,
}: AttendanceCalendarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [editInTime, setEditInTime] = useState("09:00");
  const [editOutTime, setEditOutTime] = useState("18:00");

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (isOpen && containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSelectedDateStr(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  // Get total days in this month
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Get total days in the previous month
  const prevMonthLastDay = new Date(year, month, 0).getDate();

  // Get weekday of the 1st of the month (0 = Sun, 1 = Mon, ..., 6 = Sat)
  const firstDayDate = new Date(year, month, 1);
  const paddingDaysCount = firstDayDate.getDay(); // Sunday-start: Sun (0) gets 0 padding cells, Mon (1) gets 1, etc.

  const monthNames = [
    "一月", "二月", "三月", "四月", "五月", "六月",
    "七月", "八月", "九月", "十月", "十一月", "十二月"
  ];

  const weekdayLabels = ["日", "一", "二", "三", "四", "五", "六"];

  const getTodayStr = () => {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  };

  const todayStr = getTodayStr();

  // Helper to test if date is in the future
  const isFutureDate = (dStr: string) => {
    return dStr > todayStr;
  };

  // Helper to test if a date is weekend
  const isWeekend = (dStr: string) => {
    const d = new Date(dStr);
    const day = d.getDay();
    const workWeekdays = settings.workWeekdays || [1, 2, 3, 4, 5];
    return !workWeekdays.includes(day);
  };

  // Find a specific date's record
  const getRecordForDate = (dStr: string) => {
    return allPunches.find((p) => p.date === dStr);
  };

  const handleCellClick = (dStr: string) => {
    if (isFutureDate(dStr)) return; // No editing future dates

    if (selectedDateStr === dStr) {
      setSelectedDateStr(null);
      return;
    }

    setSelectedDateStr(dStr);
    const record = getRecordForDate(dStr);
    if (record && record.inTime) {
      const inD = new Date(record.inTime);
      const inH = String(inD.getHours()).padStart(2, "0");
      const inM = String(inD.getMinutes()).padStart(2, "0");
      setEditInTime(`${inH}:${inM}`);

      if (record.outTime) {
        const outD = new Date(record.outTime);
        const outH = String(outD.getHours()).padStart(2, "0");
        const outM = String(outD.getMinutes()).padStart(2, "0");
        setEditOutTime(`${outH}:${outM}`);
      } else {
        setEditOutTime("");
      }
    } else {
      setEditInTime("09:00");
      setEditOutTime("18:00");
    }
  };

  const handleQuickWorked = () => {
    if (!selectedDateStr) return;
    onUpdatePunch(selectedDateStr, settings.startTime, settings.endTime);
    setSelectedDateStr(null);
  };

  const handleMarkAbsent = () => {
    if (!selectedDateStr) return;
    onUpdatePunch(selectedDateStr, null, null);
    setSelectedDateStr(null);
  };

  const handleCustomSave = () => {
    if (!selectedDateStr) return;
    if (!editInTime) {
      onUpdatePunch(selectedDateStr, null, null);
    } else {
      onUpdatePunch(selectedDateStr, editInTime, editOutTime || null);
    }
    setSelectedDateStr(null);
  };

  return (
    <div
      ref={containerRef}
      id="attendance-calendar-card"
      className="bg-[#141414] border rounded-2xl p-4 mb-4 select-none transition-all duration-300"
      style={{ borderColor: isOpen ? "#ffffff" : "var(--border)" }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">📅</span>
          <span className="text-xs font-mono font-bold tracking-wider text-neutral-500 uppercase">
            打卡日历
          </span>
        </div>
        <button
          onClick={() => {
            setIsOpen(!isOpen);
            setSelectedDateStr(null);
          }}
          className="text-xs font-mono text-neutral-500 hover:text-green-400 focus:outline-none transition cursor-pointer select-none"
        >
          {isOpen ? "收起日历 ▲" : "查看/补打卡 ▼"}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0, marginTop: 0 }}
            animate={{ height: "auto", opacity: 1, marginTop: 16 }}
            exit={{ height: 0, opacity: 0, marginTop: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="space-y-4 overflow-hidden"
          >
            {/* Calendar Header with Month/Year */}
            <div className="flex items-center justify-between border-b border-neutral-850 pb-2">
              <span className="text-xs font-bold font-mono tracking-wide text-neutral-200">
                {year}年 {monthNames[month]} ({month + 1}月)
              </span>
              <span className="text-[10px] text-neutral-500 font-mono">
                点击过去日期可“补打卡”/“记请假”
              </span>
            </div>

            {/* Weekday Grid labels */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {weekdayLabels.map((lbl, idx) => (
                <div
                  key={idx}
                  className={`text-[10px] font-mono leading-none py-1 text-neutral-500 ${lbl === "六" || lbl === "日" ? "text-amber-500/60" : ""
                    }`}
                >
                  {lbl}
                </div>
              ))}
            </div>

            {/* Calendar Days Matrix */}
            <div className="grid grid-cols-7 gap-1">
              {/* Preceding month's dates as padding */}
              {Array.from({ length: paddingDaysCount }).map((_, idx) => {
                const dayNum = prevMonthLastDay - paddingDaysCount + 1 + idx;
                return (
                  <div
                    key={`prev-pad-${idx}`}
                    className="h-9 flex flex-col items-center justify-between p-1 rounded-lg bg-neutral-900/30 border border-dashed border-neutral-800/40 opacity-50 select-none cursor-not-allowed"
                  >
                    <span className="text-[10px] leading-none font-mono text-neutral-500">
                      {dayNum}
                    </span>
                    <div className="flex gap-0.5 justify-center items-center w-full">
                      <span className="h-0.5 w-0.5 rounded-full bg-transparent" />
                    </div>
                  </div>
                );
              })}

              {/* actual day cells */}
              {Array.from({ length: totalDays }).map((_, idx) => {
                const dayNum = idx + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                const isToday = dateStr === todayStr;
                const isFuture = isFutureDate(dateStr);
                const isWkEnd = isWeekend(dateStr);
                const record = getRecordForDate(dateStr);
                const isWorked = !!(record && record.inTime);

                let bgClass = "bg-neutral-900/40 hover:bg-neutral-850/60 border border-neutral-850/50";
                let titleColor = "text-neutral-400 font-medium";

                if (isFuture) {
                  bgClass = "bg-neutral-950/20 opacity-20 border border-transparent";
                  titleColor = "text-neutral-600";
                } else if (isWorked) {
                  bgClass = "bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/15 text-emerald-400";
                  titleColor = "text-emerald-300 font-bold";
                } else if (!isFuture && !isWkEnd) {
                  // Past workday with no records = Absent/Holiday/Unpunched
                  bgClass = "bg-red-500/5 border border-red-500/15 hover:bg-red-500/10";
                  titleColor = "text-red-400/80 font-normal";
                } else if (isWkEnd) {
                  bgClass = "bg-neutral-950/60 border border-dashed border-neutral-850/65 hover:bg-neutral-850/40";
                  titleColor = "text-neutral-500";
                }

                if (isToday) {
                  bgClass += " ring-1 ring-amber-500/50 ring-offset-1 ring-offset-neutral-950";
                }

                return (
                  <button
                    key={`day-${dayNum}`}
                    disabled={isFuture}
                    onClick={() => handleCellClick(dateStr)}
                    className={`relative h-9 flex flex-col items-center justify-between p-1 rounded-lg transition-all text-left ${bgClass} ${isFuture ? "cursor-not-allowed" : "cursor-pointer"
                      }`}
                  >
                    <span className={`text-[10px] leading-none font-mono ${titleColor}`}>
                      {dayNum}
                    </span>

                    {/* Tiny icons or dots representing state */}
                    <div className="flex gap-0.5 justify-center items-center w-full">
                      {isWorked ? (
                        <span className="text-[7px] text-emerald-400">✓</span>
                      ) : !isFuture && !isWkEnd ? (
                        <span className="text-[7px] text-red-500">✗</span>
                      ) : isWkEnd ? (
                        <span className="text-[7px] text-neutral-600">🏖️</span>
                      ) : (
                        <span className="h-0.5 w-0.5 rounded-full bg-transparent" />
                      )}
                    </div>
                  </button>
                );
              })}

              {/* Succeeding month's dates to complete 42-day calendar block */}
              {Array.from({ length: 42 - paddingDaysCount - totalDays }).map((_, idx) => {
                const dayNum = idx + 1;
                return (
                  <div
                    key={`next-pad-${idx}`}
                    className="h-9 flex flex-col items-center justify-between p-1 rounded-lg bg-neutral-900/30 border border-dashed border-neutral-800/40 opacity-50 select-none cursor-not-allowed"
                  >
                    <span className="text-[10px] leading-none font-mono text-neutral-500">
                      {dayNum}
                    </span>
                    <div className="flex gap-0.5 justify-center items-center w-full">
                      <span className="h-0.5 w-0.5 rounded-full bg-transparent" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Inline Edit Panel for selected day */}
            {selectedDateStr && (
              <div className="bg-neutral-950 border border-neutral-850/80 rounded-xl p-3.5 space-y-3.5 animate-slide-up">
                <div className="flex items-center justify-between border-b border-neutral-850 pb-1.5">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-neutral-500 font-mono font-bold uppercase tracking-wider">
                      📝 修改考勤状态
                    </span>
                    <span className="text-[11px] font-medium font-mono text-neutral-300 mt-0.5">
                      {selectedDateStr.substring(5).replace("-", "月")}日
                      {isWeekend(selectedDateStr) ? " (非工作日)" : " (工作日)"}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedDateStr(null)}
                    className="text-[10px] font-mono text-neutral-500 hover:text-neutral-400"
                  >
                    取消
                  </button>
                </div>

                {/* Attendance quick actions */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleQuickWorked}
                    className="bg-emerald-500/12 border border-emerald-500/25 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-bold py-2 rounded-lg transition active:scale-[0.98] cursor-pointer"
                  >
                    一键快速补全打卡
                  </button>
                  <button
                    type="button"
                    onClick={handleMarkAbsent}
                    className="bg-neutral-900 border border-red-500/20 hover:bg-red-500/10 text-red-400 text-[10px] font-bold py-2 rounded-lg transition active:scale-[0.98] cursor-pointer"
                  >
                    标记请假/未出勤
                  </button>
                </div>

                {/* Custom manual patch */}
                <div className="space-y-2 border-t border-neutral-850/60 pt-2.5">
                  <span className="text-[9px] text-neutral-500 font-mono block">
                    ⚙️ 细化修改具体时间
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <label className="text-[9px] text-neutral-550 font-mono block">
                        上班时间
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          readOnly
                          value={editInTime}
                          placeholder="未打卡"
                          className="w-full bg-[#1b1b1b] border border-neutral-850 text-neutral-200 font-mono text-xs pl-2.5 pr-6 py-1.5 rounded-lg outline-none"
                        />
                        <span className="absolute right-2 pointer-events-none text-neutral-500 text-[9px]">▼</span>
                        <input
                          type="time"
                          value={editInTime}
                          onChange={(e) => setEditInTime(e.target.value)}
                          onClick={(e) => {
                            try {
                              if ("showPicker" in e.currentTarget) {
                                (e.currentTarget as any).showPicker();
                              }
                            } catch (_) { }
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          style={{ fontSize: "16px" }}
                        />
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[9px] text-neutral-550 font-mono block">
                        下班时间
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          readOnly
                          value={editOutTime}
                          placeholder="未打卡"
                          className="w-full bg-[#1b1b1b] border border-neutral-850 text-neutral-200 font-mono text-xs pl-2.5 pr-6 py-1.5 rounded-lg outline-none"
                        />
                        <span className="absolute right-2 pointer-events-none text-neutral-500 text-[9px]">▼</span>
                        <input
                          type="time"
                          value={editOutTime || ""}
                          onChange={(e) => setEditOutTime(e.target.value)}
                          onClick={(e) => {
                            try {
                              if ("showPicker" in e.currentTarget) {
                                (e.currentTarget as any).showPicker();
                              }
                            } catch (_) { }
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          style={{ fontSize: "16px" }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={handleCustomSave}
                      className="bg-green-400 text-black font-semibold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-opacity-95 transition cursor-pointer"
                    >
                      保存自定义考勤 ✓
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
