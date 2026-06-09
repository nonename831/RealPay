import { useState } from "react";
import { SlackSession, AppSettings } from "../types";
import { fmtMinsChinese, toMins } from "../utils/calculations";

interface SlackingManagerProps {
  slacking: boolean;
  slackStart: Date | null;
  slackSessions: SlackSession[];
  slackGoalMins: number;
  perMin: number;
  onToggleSlack: () => void;
  onSaveSlackGoal: (mins: number) => void;
  onDeleteSession: (id: string) => void;
  weeklyData: { [date: string]: number };
  settings: AppSettings;
  now: Date;
  isHoliday: boolean;
  punchInTime: Date | null;
  punchOutTime: Date | null;
}

interface Achievement {
  id: string;
  icon: string;
  name: string;
  desc: string;
}

const ACHIEVEMENTS: Achievement[] = [
  { id: "first_slack", icon: "🐟", name: "初次开溜", desc: "第一次开启摸鱼模式，恭喜起锚！" },
  { id: "slack_30", icon: "😴", name: "忙里偷闲", desc: "单日摸鱼累计满 30 分钟" },
  { id: "slack_60", icon: "🛋️", name: "薪水小偷", desc: "单日摸鱼累计满 1 小时" },
  { id: "slack_120", icon: "🏆", name: "终极摸鱼王", desc: "单日摸鱼累计满 2 小时" },
  { id: "slack_180", icon: "👑", name: "公司合伙人", desc: "单日摸鱼累计满 3 小时，老板都要礼让三分" },
  { id: "early_bird", icon: "🌅", name: "晨曦捕手", desc: "在工作前半小时进行首轮偷闲" },
  { id: "night_owl", icon: "🦉", name: "守护月亮", desc: "在设定的下班时间之后仍处于出溜状态" },
  { id: "multi_session", icon: "🎭", name: "百变大卡", desc: "单日至少触发 3 次及以上摸鱼时段" },
];

export default function SlackingManager({
  slacking,
  slackStart,
  slackSessions,
  slackGoalMins,
  perMin,
  onToggleSlack,
  onSaveSlackGoal,
  onDeleteSession,
  weeklyData,
  settings,
  now,
  isHoliday,
  punchInTime,
  punchOutTime,
}: SlackingManagerProps) {
  const [selectedAch, setSelectedAch] = useState<Achievement | null>(null);

  const formatSecs = (totalSecs: number): string => {
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = Math.floor(totalSecs % 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const formatMinsToHoursAndMins = (totalMins: number): string => {
    if (totalMins > 0 && totalMins < 1) {
      const secs = Math.round(totalMins * 60);
      return `${secs}秒`;
    }
    const mins = Math.round(totalMins);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0) {
      return `${h}小时${m}分钟`;
    }
    return `${m}分钟`;
  };

  // Live Calculations
  let currentSessionMins = 0;
  if (slacking && slackStart) {
    currentSessionMins = (Date.now() - slackStart.getTime()) / 60000;
  }

  const completedSessionMins = slackSessions.reduce((sum, s) => sum + s.mins, 0);
  const totalSlackMins = completedSessionMins + currentSessionMins;
  const totalSlackEarned = slackSessions.reduce((sum, s) => sum + s.earned, 0) + (currentSessionMins * perMin);

  const overGoal = totalSlackMins > slackGoalMins;
  const goalPct = Math.min(100, (totalSlackMins / (slackGoalMins || 1)) * 100);

  // Today dynamic efficiency calculation based on elapsed work minutes today
  const startM = toMins(settings.startTime);
  const endM = toMins(settings.endTime);
  const lunchS = toMins(settings.lunchStart);
  const lunchE = toMins(settings.lunchEnd);

  const hVal = now.getHours();
  const mVal = now.getMinutes();
  const sVal = now.getSeconds();
  const nowM = hVal * 60 + mVal + sVal / 60;

  // Effective start/end (considering manual punch)
  const hasPunchedIn = !!punchInTime;
  const effStart = punchInTime
    ? Math.max(punchInTime.getHours() * 60 + punchInTime.getMinutes() + punchInTime.getSeconds() / 60, startM)
    : startM;

  const effEnd = punchOutTime
    ? punchOutTime.getHours() * 60 + punchOutTime.getMinutes() + punchOutTime.getSeconds() / 60
    : endM;

  const cappedNow = Math.min(nowM, effEnd);
  const rawElapsed = hasPunchedIn ? Math.max(0, cappedNow - effStart) : 0;
  const lunchPassed = hasPunchedIn ? Math.max(0, Math.min(cappedNow, lunchE) - Math.max(effStart, lunchS)) : 0;
  const totalElapsed = hasPunchedIn ? Math.max(0, rawElapsed - lunchPassed) : 0;

  const cappedSlackMins = Math.min(totalSlackMins, totalElapsed);
  const playWorkMins = Math.max(0, totalElapsed - cappedSlackMins);
  const efficiencyPct = totalElapsed > 0 ? (playWorkMins / totalElapsed) * 100 : (totalSlackMins > 0 ? 0 : 100);

  const getEffColorClass = (pct: number) => {
    if (pct >= 80) return "";
    if (pct >= 40) return "mid";
    return "low";
  };

  // Achievement Checkers
  const isUnlocked = (achId: string) => {
    switch (achId) {
      case "first_slack":
        return slackSessions.length > 0 || slacking;
      case "slack_30":
        return totalSlackMins >= 30;
      case "slack_60":
        return totalSlackMins >= 60;
      case "slack_120":
        return totalSlackMins >= 120;
      case "slack_180":
        return totalSlackMins >= 180;
      case "early_bird":
        return slackSessions.some(s => new Date(s.start).getHours() < 9) || (slacking && slackStart && slackStart.getHours() < 9);
      case "night_owl":
        return slackSessions.some(s => new Date(s.start).getHours() >= 18) || (slacking && slackStart && slackStart.getHours() >= 18);
      case "multi_session":
        return slackSessions.length >= 3;
      default:
        return false;
    }
  };

  // Week Chart
  const days = ["一", "二", "三", "四", "五", "六", "日"];
  const today = new Date();
  const dayOfWeekIndex = (today.getDay() + 6) % 7; // Sunday = 6, Monday = 0

  const getWeekDates = (): string[] => {
    const dates: string[] = [];
    const current = new Date();
    const distanceToMonday = (current.getDay() + 6) % 7;
    current.setDate(current.getDate() - distanceToMonday);

    for (let i = 0; i < 7; i++) {
      const d = new Date(current);
      d.setDate(current.getDate() + i);
      const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      dates.push(str);
    }
    return dates;
  };

  const weekDates = getWeekDates();
  const weekValues = weekDates.map((dateStr, i) => {
    if (i === dayOfWeekIndex) {
      return totalSlackMins;
    }
    return weeklyData[dateStr] || 0;
  });

  const maxVal = Math.max(...weekValues, slackGoalMins, 10);

  const isPunchInOk = !!punchInTime;
  const isPunchOutOk = !!punchOutTime;
  const cannotSlack = !isPunchInOk || isPunchOutOk;

  return (
    <div className="space-y-4">
      {/* Topbar matching original HTML */}
      <div className="topbar select-none">
        <div className="logo">🐟 摸鱼</div>
        <div className="badge">
          <span
            className={`dot ${slacking ? "working" : "off"}`}
            style={slacking ? { backgroundColor: "#a78bfa" } : undefined}
          />
          <span>{slacking ? "摸鱼中" : (slackSessions.length > 0 ? "已结束" : "未开始")}</span>
        </div>
      </div>

      {/* Slack Hero */}
      <div className="slack-hero">
        <div className={`slack-glow ${overGoal ? "over" : ""}`} />
        <div className="slack-toggle-row">
          <div>
            <div className="slack-label-main">摸鱼模式</div>
            <div className="slack-label-sub">
              {cannotSlack
                ? (!isPunchInOk ? "⚠️ 请先在主页完成「上班打卡」再摸鱼哦" : "🕒 今日已打卡下班，安心回家休息吧，不营业摸鱼了")
                : (slacking ? "正在摸鱼中，每一秒都是纯利润..." : "安全防护已就绪，随时一键开始滑水 🌊")}
            </div>
          </div>
          <div className="toggle-wrap" style={cannotSlack ? { opacity: 0.4, cursor: "not-allowed" } : undefined}>
            <input
              type="checkbox"
              id="slack-toggle"
              checked={slacking}
              disabled={cannotSlack}
              onChange={onToggleSlack}
              className={cannotSlack ? "cursor-not-allowed" : "cursor-pointer"}
            />
            <label className="toggle-track" htmlFor="slack-toggle" />
          </div>
        </div>

        <div className={`slack-timer ${overGoal ? "over" : ""}`}>
          {slacking && slackStart ? formatSecs(Math.floor((Date.now() - slackStart.getTime()) / 1000)) : "00:00:00"}
        </div>
        <div className="slack-timer-label">本次摸鱼时长</div>

        <div className="slack-earned">
          白拿了: <span>{settings.currency || "RM"} {((slacking && slackStart) ? (currentSessionMins * perMin) : 0).toFixed(2)}</span>
        </div>

        {/* Goal row */}
        <div className="slack-goal-row">
          <div className="sg-goal-meta">
            <span className="sg-goal-lbl">今日摸鱼饱满度</span>
            <span className={`sg-goal-val ${overGoal ? "over" : ""}`}>
              {Math.round(totalSlackMins)} / {slackGoalMins} 分钟 {overGoal && "⚠️"}
            </span>
          </div>
          <div className="sg-goal-track">
            <div
              className={`sg-goal-fill ${overGoal ? "over" : ""}`}
              style={{ width: `${goalPct}%` }}
            />
          </div>
          <div className="slack-goal-set select-none">
            <label htmlFor="slack-goal-input">设定上限</label>
            <input
              type="number"
              id="slack-goal-input"
              min="1"
              max="480"
              value={slackGoalMins}
              onChange={(e) => onSaveSlackGoal(parseInt(e.target.value) || 30)}
            />
            <span>分钟 / 日</span>
          </div>
        </div>
      </div>

      {/* Efficiency Card */}
      <div className="efficiency-card">
        <div className="eff-head">
          <span className="eff-label">今日工作效率</span>
          <span className={`eff-pct ${getEffColorClass(efficiencyPct)}`}>
            {efficiencyPct.toFixed(1)}%
          </span>
        </div>
        <div className="eff-track">
          <div
            className={`eff-fill ${getEffColorClass(efficiencyPct)}`}
            style={{ width: `${efficiencyPct}%` }}
          />
        </div>
        <div className="eff-row">
          <div className="eff-stat">
            <div className="eff-stat-v">{formatMinsToHoursAndMins(playWorkMins)}</div>
            <div className="eff-stat-l">实际工作</div>
          </div>
          <div className="eff-stat">
            <div className="eff-stat-v text-purple-400" style={{ color: "var(--purple)" }}>
              {formatMinsToHoursAndMins(totalSlackMins)}
            </div>
            <div className="eff-stat-l">摸鱼时间</div>
          </div>
          <div className="eff-stat">
            <div className="eff-stat-v text-emerald-400" style={{ color: "var(--green)" }}>
              {settings.currency || "RM"} {totalSlackEarned.toFixed(2)}
            </div>
            <div className="eff-stat-l">摸鱼总收益</div>
          </div>
        </div>
      </div>

      {/* Achievements Card */}
      <div className="achievements-card">
        <div className="ach-head">🏆 滑水荣誉成就墙</div>
        <div className="ach-grid select-none">
          {ACHIEVEMENTS.map((a) => {
            const unlocked = isUnlocked(a.id);
            return (
              <div
                key={a.id}
                onClick={() => setSelectedAch(selectedAch?.id === a.id ? null : a)}
                className={`ach-item cursor-pointer hover:scale-105 transition-transform ${unlocked ? "unlocked" : ""}`}
              >
                <span className="ach-icon">{a.icon}</span>
                <span className="ach-name">{a.name}</span>
              </div>
            );
          })}
        </div>

        {/* Dynamic Achievement info details */}
        {selectedAch && (
          <div className="mt-3.5 p-3 bg-neutral-900 border border-purple-500/20 rounded-xl flex items-start gap-3 select-text">
            <span className="text-2xl">{selectedAch.icon}</span>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-300">{selectedAch.name}</span>
                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full ${isUnlocked(selectedAch.id) ? "bg-purple-500/10 text-purple-400" : "bg-neutral-800 text-neutral-500"
                  }`}>
                  {isUnlocked(selectedAch.id) ? "已解锁" : "未解锁"}
                </span>
              </div>
              <p className="text-[10px] text-neutral-400 mt-1">{selectedAch.desc}</p>
            </div>
          </div>
        )}
      </div>

      {/* Week slacking Bar Chart */}
      <div className="slack-chart-card">
        <div className="chart-head">📈 本周摸鱼曲线统计</div>
        <div className="week-chart">
          {days.map((day, i) => {
            const val = weekValues[i];
            const isToday = i === dayOfWeekIndex;
            const isOver = val > slackGoalMins;
            const barHeightPct = ((val / maxVal) * 100).toFixed(1);

            return (
              <div key={i} className="wc-col">
                <span className="wc-mins">{val > 0 ? Math.round(val) : ""}</span>
                <div className="wc-bar-wrap">
                  <div
                    className={`wc-bar ${isToday ? "today" : ""} ${isOver ? "over" : ""}`}
                    style={{ height: `${barHeightPct}%` }}
                  />
                </div>
                <span className={`wc-day ${isToday ? "text-[#7c3aed] font-bold" : ""}`}>{day}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Log sessions with single-deletion capability */}
      <div className="slack-log-card">
        <div className="log-head">📝 开溜明细记录</div>
        {slackSessions.length === 0 ? (
          <div className="slack-empty">水面异常平静，未发现捕鱼尾迹 🐠</div>
        ) : (
          <div className="slack-log">
            {slackSessions.slice().reverse().map((s) => {
              const startDt = new Date(s.start);
              const endDt = new Date(s.end);
              const startStr = `${String(startDt.getHours()).padStart(2, "0")}:${String(startDt.getMinutes()).padStart(2, "0")}`;
              const endStr = `${String(endDt.getHours()).padStart(2, "0")}:${String(endDt.getMinutes()).padStart(2, "0")}`;

              return (
                <div key={s.id} className="slack-log-item flex items-center justify-between">
                  <div className="sli-left">
                    <span>{startStr} — {endStr}</span>
                    <span className="mx-2 text-neutral-600">·</span>
                    <span>时长: {s.mins < 1 ? `${Math.round(s.mins * 60)}秒` : `${Math.round(s.mins)}分钟`}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="sli-right">{settings.currency || "RM"} {s.earned.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
