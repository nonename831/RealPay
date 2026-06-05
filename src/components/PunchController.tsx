import { useState } from "react";

interface PunchControllerProps {
  punchInTime: Date | null;
  punchOutTime: Date | null;
  onPunchIn: (time: Date) => void;
  onPunchOut: (time: Date) => void;
  onClearPunch: () => void;
  onModifyPunch: (inTimeStr: string | null, outTimeStr: string | null) => void;
}

export default function PunchController({
  punchInTime,
  punchOutTime,
  onPunchIn,
  onPunchOut,
  onClearPunch,
  onModifyPunch,
}: PunchControllerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editInTime, setEditInTime] = useState("");
  const [editOutTime, setEditOutTime] = useState("");

  const formatTimeStr = (date: Date | null): string => {
    if (!date) return "";
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  };

  const getAmPmString = (date: Date | null): string => {
    if (!date) return "";
    const h = date.getHours();
    const m = String(date.getMinutes()).padStart(2, "0");
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${String(h12).padStart(2, "0")}:${m} ${period}`;
  };

  const handleStartEdit = () => {
    setEditInTime(formatTimeStr(punchInTime || new Date()));
    setEditOutTime(formatTimeStr(punchOutTime));
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    onModifyPunch(
      editInTime ? editInTime : null,
      editOutTime ? editOutTime : null
    );
    setIsEditing(false);
  };

  return (
    <div className="mb-4">
      {/* SIMPLE PUNCH-IN / PUNCH-OUT UI */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        
        {/* PUNCH IN BUTTON */}
        {!punchInTime ? (
          <button
            onClick={() => onPunchIn(new Date())}
            className="w-full bg-[#141414] border border-neutral-800 hover:border-emerald-500/40 text-neutral-200 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer text-xs"
          >
            <span>🌞</span>
            <span>上班打卡</span>
          </button>
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
          <button
            onClick={() => onPunchOut(new Date())}
            className="w-full bg-[#141414] border border-neutral-800 hover:border-amber-500/40 text-neutral-200 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer text-xs"
          >
            <span>🏁</span>
            <span>下班打卡</span>
          </button>
        ) : (
          <div className="w-full bg-[#141414]/55 border border-amber-500/15 text-amber-500 py-2.5 rounded-2xl text-xs font-semibold flex flex-col items-center justify-center leading-normal select-none">
            <span className="text-[10px] text-neutral-550 font-normal">已下班</span>
            <span className="font-mono text-xs font-bold mt-0.5">{getAmPmString(punchOutTime)}</span>
          </div>
        )}

      </div>

      {/* Supplement / Cleans block for high versatility */}
      <div className="flex justify-end mb-2 px-1">
        <button
          onClick={() => {
            if (isEditing) {
              setIsEditing(false);
            } else {
              handleStartEdit();
            }
          }}
          className="text-[11px] font-mono text-neutral-500 hover:text-green-400 focus:outline-none transition select-none flex items-center gap-1 cursor-pointer"
        >
          {isEditing ? "✕ 关闭补录面板" : "✏️ 补录/修正打卡时间"}
        </button>
      </div>

      {/* Manual补录 Panel */}
      {isEditing && (
        <div className="mb-4 bg-neutral-900 border border-neutral-800 p-3.5 rounded-2xl animate-fade-in space-y-3">
          <div className="text-[10px] text-neutral-500 font-mono font-bold uppercase tracking-wider">
            ⏰ 修正打卡记录
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] text-neutral-400 font-mono block">
                上班时间
              </label>
              <input
                type="time"
                value={editInTime}
                onChange={(e) => setEditInTime(e.target.value)}
                className="w-full bg-[#222222] border border-neutral-850 text-neutral-200 font-mono text-xs p-2 rounded-lg outline-none focus:border-green-400"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-neutral-400 font-mono block">
                下班时间
              </label>
              <input
                type="time"
                value={editOutTime}
                onChange={(e) => setEditOutTime(e.target.value)}
                className="w-full bg-[#222222] border border-neutral-850 text-neutral-200 font-mono text-xs p-2 rounded-lg outline-none focus:border-green-400"
                placeholder="未打卡"
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t border-neutral-850/60">
            <button
              onClick={() => {
                onClearPunch();
                setIsEditing(false);
              }}
              type="button"
              className="text-[10px] font-mono text-red-400 hover:text-red-300 cursor-pointer"
            >
              🗑️ 清除今日打卡
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setIsEditing(false)}
                type="button"
                className="text-[10px] font-mono text-neutral-500 hover:text-neutral-400 cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                type="button"
                className="bg-green-400 text-black font-semibold text-[10px] px-3 py-1 rounded-md hover:bg-opacity-90 cursor-pointer"
              >
                保存 ✓
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
