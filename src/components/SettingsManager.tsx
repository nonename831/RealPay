import { useState } from "react";
import { AppSettings, MonthHistory } from "../types";
import { fmt12, toMins } from "../utils/calculations";

interface SettingsManagerProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  history: MonthHistory[];
  onClearHistory: () => void;
}

export default function SettingsManager({
  settings,
  onUpdateSettings,
  history,
  onClearHistory,
}: SettingsManagerProps) {
  // Query state
  const [queryStart, setQueryStart] = useState("09:00");
  const [queryEnd, setQueryEnd] = useState("12:00");
  const [queryResult, setQueryResult] = useState<number | null>(null);
  const [queryActiveMins, setQueryActiveMins] = useState(0);

  const [showSavedIndicator, setShowSavedIndicator] = useState(false);

  const handleSettingChange = (key: keyof AppSettings, value: string | number) => {
    onUpdateSettings({
      ...settings,
      [key]: value,
    });
    // Visual auto-save feedback
    setShowSavedIndicator(true);
    const t = setTimeout(() => setShowSavedIndicator(false), 1200);
    return () => clearTimeout(t);
  };

  const handleQuery = () => {
    const startM = toMins(settings.startTime);
    const endM = toMins(settings.endTime);
    const lunchS = toMins(settings.lunchStart);
    const lunchE = toMins(settings.lunchEnd);

    const qStartM = toMins(queryStart);
    const qEndM = toMins(queryEnd);

    // Intersection
    const effectiveStart = Math.max(qStartM, startM);
    const effectiveEnd = Math.min(qEndM, endM);

    if (effectiveStart >= effectiveEnd) {
      setQueryResult(0);
      setQueryActiveMins(0);
      return;
    }

    let totalMins = effectiveEnd - effectiveStart;

    // Remove lunch break
    const overlapLunchS = Math.max(effectiveStart, lunchS);
    const overlapLunchE = Math.min(effectiveEnd, lunchE);
    if (overlapLunchS < overlapLunchE) {
      totalMins -= (overlapLunchE - overlapLunchS);
    }

    const lunchDuration = Math.max(0, lunchE - lunchS);
    const totalWorkingMins = Math.max(1, endM - startM - lunchDuration);
    const dailySal = settings.monthlySalary / settings.workDays;
    const payPerMin = dailySal / totalWorkingMins;

    const earned = totalMins * payPerMin;
    setQueryResult(earned);
    setQueryActiveMins(totalMins);
  };

  return (
    <div className="space-y-4">
      {/* 1. Payroll / Works configs */}
      <div className="sec-head">薪资设置</div>
      <div className="settings-card">
        <div className="s-grid mb-3">
          <div className="s-field">
            <label htmlFor="monthly-salary">月薪 (RM)</label>
            <input
              type="number"
              id="monthly-salary"
              min="1"
              value={settings.monthlySalary}
              onChange={(e) => handleSettingChange("monthlySalary", parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="s-field">
            <label htmlFor="work-days">每月工作日</label>
            <input
              type="number"
              id="work-days"
              min="1"
              value={settings.workDays}
              onChange={(e) => handleSettingChange("workDays", parseInt(e.target.value) || 22)}
            />
          </div>
        </div>

        <div className="s-grid mb-3">
          <div className="s-field">
            <label htmlFor="start-time">上班时间</label>
            <input
              type="time"
              id="start-time"
              value={settings.startTime}
              onChange={(e) => handleSettingChange("startTime", e.target.value)}
            />
          </div>
          <div className="s-field">
            <label htmlFor="end-time">下班时间</label>
            <input
              type="time"
              id="end-time"
              value={settings.endTime}
              onChange={(e) => handleSettingChange("endTime", e.target.value)}
            />
          </div>
        </div>

        <div className="s-grid">
          <div className="s-field span2">
            <label htmlFor="ot-rate-select">加班付费倍数</label>
            <select
              id="ot-rate-select"
              value={settings.overtimeRate}
              onChange={(e) => handleSettingChange("overtimeRate", parseFloat(e.target.value))}
              style={{
                background: "var(--surface2)",
                border: "1px solid var(--border)",
                borderRadius: "9px",
                color: "var(--text)",
                fontFamily: "var(--mono)",
                fontSize: "15px",
                fontWeight: 500,
                padding: "11px 12px",
                outline: "none",
                width: "100%",
                cursor: "pointer",
              }}
            >
              <option value="1.5">1.5x (日常普通加班)</option>
              <option value="2.0">2.0x (周末特别加班)</option>
              <option value="3.0">3.0x (公假超级加倍)</option>
            </select>
          </div>
        </div>

        {/* Visual saved notifier */}
        <div className={`save-indicator ${showSavedIndicator ? "show" : ""}`}>
          <span className="si-dot" />
          <span>已自动保存</span>
        </div>
      </div>

      {/* Lunch time card inline with original UI structure */}
      <div className="sec-head">午休时间</div>
      <div className="query-card">
        <div className="t-grid">
          <div className="t-field">
            <label htmlFor="lunch-start">开始</label>
            <input
              type="time"
              id="lunch-start"
              value={settings.lunchStart}
              onChange={(e) => handleSettingChange("lunchStart", e.target.value)}
            />
          </div>
          <div className="t-field">
            <label htmlFor="lunch-end">结束</label>
            <input
              type="time"
              id="lunch-end"
              value={settings.lunchEnd}
              onChange={(e) => handleSettingChange("lunchEnd", e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 2. Range query calculator */}
      <div className="sec-head">精细区间收入查询</div>
      <div className="query-card">
        <div className="t-grid">
          <div className="t-field">
            <label>查询起点</label>
            <input
              type="time"
              value={queryStart}
              onChange={(e) => setQueryStart(e.target.value)}
            />
          </div>
          <div className="t-field">
            <label>查询终点</label>
            <input
              type="time"
              value={queryEnd}
              onChange={(e) => setQueryEnd(e.target.value)}
            />
          </div>
        </div>

        <button className="qbtn" onClick={handleQuery}>
          立即查询计算
        </button>

        {queryResult !== null && (
          <div className="qresult" style={{ display: "block" }}>
            <div className="qresult-lbl">
              自 {fmt12(queryStart)} 至 {fmt12(queryEnd)} (有效计薪时长 {queryActiveMins} 分钟)
            </div>
            <div className="qresult-val">
              RM {queryResult.toFixed(2)}
            </div>
          </div>
        )}
      </div>

      {/* 3. Historical records section */}
      <div className="sec-head flex items-center justify-between">
        <span>历史考勤账单汇总</span>
        {history.length > 0 && (
          <button
            onClick={onClearHistory}
            className="text-[10px] lowercase font-mono text-rose-400 hover:text-rose-300 transition focus:outline-none"
          >
            🗑️ 清除存档
          </button>
        )}
      </div>
      <div className="settings-card">
        {history.length === 0 ? (
          <div className="text-center py-6">
            <span className="text-xs font-mono text-neutral-500 block">
              暂无月度结算历史 · 跨月归档时会自动收录
            </span>
          </div>
        ) : (
          <div className="space-y-3.5">
            {history.map((h, idx) => (
              <div
                key={idx}
                className="bg-[#1e1e1e]/60 border border-neutral-850 p-3 rounded-xl space-y-1.5 font-mono text-xs"
              >
                <div className="flex justify-between border-b border-neutral-850 pb-1.5 select-none">
                  <span className="font-bold text-neutral-200">{h.month}</span>
                  <span className="text-green-400 font-bold">
                    薪酬: RM {(h.totalBaseEarned + h.totalOTEarned).toFixed(2)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-neutral-400">
                  <div className="flex justify-between">
                    <span>工作天数</span>
                    <span className="text-neutral-300 font-bold">{h.workDaysPassed} 天</span>
                  </div>
                  <div className="flex justify-between">
                    <span>基础薪水</span>
                    <span className="text-neutral-300">RM {h.totalBaseEarned.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>加班补偿</span>
                    <span className="text-neutral-300">RM {h.totalOTEarned.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>摸鱼漏时</span>
                    <span className="text-neutral-300">{Math.round(h.totalSlackMins)}m</span>
                  </div>
                </div>
                <div className="bg-[#7c3aed]/5 border border-[#7c3aed]/12 rounded-lg p-1.5 flex justify-between text-[9px] text-purple-300 select-none">
                  <span>白拿公款：</span>
                  <span className="font-bold">RM {h.totalSlackEarned.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
