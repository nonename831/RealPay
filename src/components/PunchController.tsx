import { useState, useEffect } from "react";
import { PunchRecord } from "../types";
import { isSystem12Hour } from "../utils/calculations";

interface PunchControllerProps {
  punchInTime: Date | null;
  punchOutTime: Date | null;
  onPunchIn: (time: Date) => void;
  onPunchOut: (time: Date) => void;
  onClearPunch: () => void;
  onModifyPunch: (inTimeStr: string | null, outTimeStr: string | null) => void;
  isWorkdayToday?: boolean;
  startTime?: string;
}

export default function PunchController({
  punchInTime,
  punchOutTime,
  onPunchIn,
  onPunchOut,
  onClearPunch,
  onModifyPunch,
  isWorkdayToday = true,
  startTime = "09:00",
}: PunchControllerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const [editIn, setEditIn] = useState("");
  const [editOut, setEditOut] = useState("");

  const [canPunchIn, setCanPunchIn] = useState(true);
  const [punchRestrictionMsg, setPunchRestrictionMsg] = useState("");

  useEffect(() => {
    if (!isWorkdayToday || !startTime) {
      setCanPunchIn(true);
      setPunchRestrictionMsg("");
      return;
    }

    const checkTime = () => {
      const now = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();

      const [startH, startM] = startTime.split(":").map(Number);
      const startMins = startH * 60 + startM;

      const earliestMins = startMins - 60; // 1 hour before

      if (nowMins < earliestMins) {
        setCanPunchIn(false);
        const earliestH = (Math.floor(earliestMins / 60) + 24) % 24;
        const earliestM = (earliestMins % 60 + 60) % 60;
        const timeStr = `${String(earliestH).padStart(2, "0")}:${String(earliestM).padStart(2, "0")}`;
        setPunchRestrictionMsg(`${timeStr} 开放`);
      } else {
        setCanPunchIn(true);
        setPunchRestrictionMsg("");
      }
    };

    checkTime();
    const interval = setInterval(checkTime, 10000);
    return () => clearInterval(interval);
  }, [isWorkdayToday, startTime]);

  // Sync edits when properties change
  useEffect(() => {
    if (punchInTime) {
      const h = String(punchInTime.getHours()).padStart(2, "0");
      const m = String(punchInTime.getMinutes()).padStart(2, "0");
      setEditIn(`${h}:${m}`);
    } else {
      setEditIn("09:00");
    }

    if (punchOutTime) {
      const h = String(punchOutTime.getHours()).padStart(2, "0");
      const m = String(punchOutTime.getMinutes()).padStart(2, "0");
      setEditOut(`${h}:${m}`);
    } else {
      setEditOut("");
    }
  }, [punchInTime, punchOutTime]);

  const getAmPmString = (date: Date | null): string => {
    if (!date) return "";
    const h = date.getHours();
    const m = String(date.getMinutes()).padStart(2, "0");
    if (!isSystem12Hour()) {
      return `${String(h).padStart(2, "0")}:${m}`;
    }
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${String(h12).padStart(2, "0")}:${m} ${period}`;
  };

  const handleSaveEdit = () => {
    onModifyPunch(editIn || null, editOut || null);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    if (punchInTime) {
      const h = String(punchInTime.getHours()).padStart(2, "0");
      const m = String(punchInTime.getMinutes()).padStart(2, "0");
      setEditIn(`${h}:${m}`);
    }
    if (punchOutTime) {
      const h = String(punchOutTime.getHours()).padStart(2, "0");
      const m = String(punchOutTime.getMinutes()).padStart(2, "0");
      setEditOut(`${h}:${m}`);
    } else {
      setEditOut("");
    }
    setIsEditing(false);
  };

  return (
    <div className="mb-4">
      {/* SIMPLE PUNCH-IN / PUNCH-OUT UI */}
      <div className="grid grid-cols-2 gap-3">

        {/* PUNCH IN BUTTON */}
        {!punchInTime ? (
          !isWorkdayToday ? (
            <button
              disabled
              className="w-full bg-[#141414]/40 border border-neutral-900 text-neutral-500 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-1.5 opacity-50 cursor-not-allowed text-xs select-none"
            >
              <span>🔒</span>
              <span>非工作日</span>
            </button>
          ) : !canPunchIn ? (
            <button
              disabled
              title={`上班一小时前才开放打卡。最早可在 ${punchRestrictionMsg}`}
              className="w-full bg-[#141414]/40 border border-amber-500/10 text-amber-500/70 py-2.5 rounded-2xl font-semibold flex flex-col items-center justify-center leading-tight opacity-75 cursor-not-allowed text-xs select-none"
            >
              <span className="text-[10px] text-amber-500/50 font-medium">未开放</span>
              <span className="font-mono text-xs font-bold mt-0.5">{punchRestrictionMsg}</span>
            </button>
          ) : (
            <button
              onClick={() => onPunchIn(new Date())}
              className="w-full bg-[#141414] border border-neutral-800 hover:border-emerald-500/40 text-neutral-200 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer text-xs animate-fade-in"
            >
              <span>🌞</span>
              <span>上班打卡</span>
            </button>
          )
        ) : (
          <div className="w-full bg-[#141414]/55 border border-emerald-500/15 text-emerald-400 py-2.5 rounded-2xl text-xs font-semibold flex flex-col items-center justify-center leading-normal select-none">
            <span className="text-[10px] text-neutral-550 font-normal">已上班</span>
            <span className="font-mono text-xs font-bold mt-0.5">{getAmPmString(punchInTime)}</span>
          </div>
        )}

        {/* PUNCH OUT BUTTON */}
        {!punchInTime ? (
          <div className="w-full bg-[#141414]/25 border border-neutral-900 text-neutral-600 py-3.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 opacity-50 select-none">
            <span>🔒</span>
            <span>下班打卡</span>
          </div>
        ) : !punchOutTime ? (
          !isWorkdayToday ? (
            <button
              disabled
              className="w-full bg-[#141414]/40 border border-neutral-900 text-neutral-500 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-1.5 opacity-50 cursor-not-allowed text-xs select-none"
            >
              <span>🔒</span>
              <span>非工作日</span>
            </button>
          ) : (
            <button
              onClick={() => onPunchOut(new Date())}
              className="w-full bg-[#141414] border border-neutral-800 hover:border-amber-500/40 text-neutral-200 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer text-xs animate-fade-in"
            >
              <span>🏁</span>
              <span>下班打卡</span>
            </button>
          )
        ) : (
          <div className="w-full bg-[#141414]/55 border border-amber-500/15 text-amber-500 py-2.5 rounded-2xl text-xs font-semibold flex flex-col items-center justify-center leading-normal select-none">
            <span className="text-[10px] text-neutral-550 font-normal">已下班</span>
            <span className="font-mono text-xs font-bold mt-0.5">{getAmPmString(punchOutTime)}</span>
          </div>
        )}

      </div>

      {/* QUICK ACTIONS ROW FOR CORRECTING DATA */}
      {punchInTime && !isEditing && (
        <div className="flex items-center justify-between text-[11px] text-neutral-500 font-mono mt-2.5 px-1 select-none">
          <button
            onClick={() => setIsEditing(true)}
            className="hover:text-purple-400 transition cursor-pointer flex items-center gap-1 py-1"
          >
            ✏️ 手动修正打卡
          </button>

          {!showClearConfirm ? (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="hover:text-rose-400 transition cursor-pointer flex items-center gap-1 py-1"
            >
              🗑️ 消除今日记录
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-rose-500 text-[10px]">确定消除今日打卡？</span>
              <button
                onClick={() => {
                  onClearPunch();
                  setShowClearConfirm(false);
                }}
                className="text-rose-400 hover:text-rose-300 font-bold px-1.5 py-0.5 bg-rose-950/40 border border-rose-900/40 rounded cursor-pointer"
              >
                确定
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="text-neutral-400 hover:text-neutral-300 px-1.5 py-0.5 bg-neutral-900/40 border border-neutral-800 rounded cursor-pointer"
              >
                取消
              </button>
            </div>
          )}
        </div>
      )}

      {/* INLINE EDIT PANEL */}
      {isEditing && (
        <div className="bg-[#141414]/90 border border-neutral-800 rounded-2xl p-4 mt-3 space-y-3 shadow-xl animate-fade-in font-sans">
          <div className="flex items-center justify-between select-none border-b border-neutral-800 pb-2">
            <span className="text-xs font-bold text-neutral-300">✏️ 修正今日打卡时间</span>
            <button
              onClick={handleCancelEdit}
              className="text-neutral-500 hover:text-neutral-300 text-[11px] cursor-pointer"
            >
              取消
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-neutral-500 uppercase tracking-wider font-mono">上班打卡</label>
              <div className="relative flex items-center w-full">
                <input
                  type="text"
                  readOnly
                  value={editIn}
                  placeholder="未打卡"
                  className="bg-neutral-900 border border-neutral-800 rounded-xl pl-2.5 pr-7 py-2 text-xs font-mono text-neutral-200 focus:outline-none w-full"
                />
                <span className="absolute right-2.5 pointer-events-none text-neutral-500 text-[10px]">▼</span>
                <input
                  type="time"
                  value={editIn}
                  onChange={(e) => setEditIn(e.target.value)}
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

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-neutral-500 uppercase tracking-wider font-mono">下班打卡</label>
              <div className="relative flex items-center w-full">
                <input
                  type="text"
                  readOnly
                  value={editOut}
                  placeholder="未打卡"
                  className="bg-neutral-900 border border-neutral-800 rounded-xl pl-2.5 pr-7 py-2 text-xs font-mono text-neutral-200 focus:outline-none w-full"
                />
                <span className="absolute right-2.5 pointer-events-none text-neutral-500 text-[10px]">▼</span>
                <input
                  type="time"
                  value={editOut}
                  onChange={(e) => setEditOut(e.target.value)}
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

          <div className="flex gap-2 pt-1 border-t border-neutral-850/50">
            <button
              onClick={handleSaveEdit}
              className="flex-1 bg-purple-600 hover:bg-purple-500 active:scale-[0.99] text-white text-xs font-semibold py-2 rounded-xl transition cursor-pointer"
            >
              保存修改 ✓
            </button>
            <button
              onClick={handleCancelEdit}
              className="px-3 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 text-xs py-2 rounded-xl border border-neutral-800 transition cursor-pointer"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
