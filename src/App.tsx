import { useEffect, useState, useRef } from "react";
import { AppSettings, SlackSession, SavingsGoal, MonthHistory, PunchRecord } from "./types";
import { storage } from "./utils/storage";
import { computeCurrentEarnings, toMins, fmt12, fmt12Full } from "./utils/calculations";

// Component imports
import WeatherWidget from "./components/WeatherWidget";
import PunchController from "./components/PunchController";
import SavingsManager from "./components/SavingsManager";
import SlackingManager from "./components/SlackingManager";
import GoodsList from "./components/GoodsList";
import ShareModal from "./components/ShareModal";
import SettingsManager from "./components/SettingsManager";

// Icons
import { Compass, User, Settings, Sparkles, Share2, Award, ArrowUpRight, ChevronRight, HelpCircle } from "lucide-react";

// LocalStorage Keys
const SETTINGS_KEY = "realpay_settings_v3";
const SLACK_KEY = "realpay_slack_v3";
const SAVINGS_KEY = "realpay_savings_v3";
const PUNCH_KEY = "realpay_punch_v3";
const HISTORY_KEY = "realpay_history_v3";
const WEEK_KEY = "realpay_week_v3";
const HOLIDAY_KEY = "realpay_holiday_v3";
const LAST_DATE_KEY = "realpay_last_date_v3";

const DEFAULT_SETTINGS: AppSettings = {
  monthlySalary: 4500,
  workDays: 22,
  startTime: "09:00",
  endTime: "18:00",
  lunchStart: "13:00",
  lunchEnd: "14:00",
  overtimeRate: 1.5,
};

const formatAmPm = (date: Date | null, defaultStr: string): string => {
  if (!date) {
    if (!defaultStr) return "--:--";
    const [hStr, mStr] = defaultStr.split(":");
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (isNaN(h) || isNaN(m)) return defaultStr;
    const period = h >= 12 ? "PM" : "AM";
    const displayH = h % 12 || 12;
    return `${String(displayH).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
  }
  const h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, "0");
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 || 12;
  return `${String(displayH).padStart(2, "0")}:${m} ${period}`;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<"home" | "slack" | "settings">("home");

  // Core App States
  const [settings, setSettings] = useState<AppSettings>(() => 
    storage.get<AppSettings>(SETTINGS_KEY, DEFAULT_SETTINGS)
  );

  const [slackSessions, setSlackSessions] = useState<SlackSession[]>(() => 
    storage.get<SlackSession[]>(SLACK_KEY, [])
  );

  const [slacking, setSlacking] = useState(false);
  const [slackStart, setSlackStart] = useState<Date | null>(null);
  const [slackGoalMins, setSlackGoalMins] = useState<number>(30);

  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>(() => 
    storage.get<SavingsGoal[]>(SAVINGS_KEY, [])
  );

  const [punchRecord, setPunchRecord] = useState<PunchRecord | null>(() => 
    storage.get<PunchRecord | null>(PUNCH_KEY, null)
  );

  const [history, setHistory] = useState<MonthHistory[]>(() => 
    storage.get<MonthHistory[]>(HISTORY_KEY, [])
  );

  const [weeklyData, setWeeklyData] = useState<{ [date: string]: number }>(() => 
    storage.get<{ [date: string]: number }>(WEEK_KEY, {})
  );

  const [isHoliday, setIsHoliday] = useState<boolean>(false);

  // Live calculated state updated by tick
  const [now, setNow] = useState(new Date());
  const [punchInTime, setPunchInTime] = useState<Date | null>(null);
  const [punchOutTime, setPunchOutTime] = useState<Date | null>(null);

  // Web Share or Share Dialog trigger
  const [showShareModal, setShowShareModal] = useState(false);

  // Formatted date string helpers
  const getTodayStr = (d = new Date()) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const getMonthStr = (d = new Date()) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  // Synchronize state with incoming local storage for holiday today
  useEffect(() => {
    try {
      const isH = localStorage.getItem(HOLIDAY_KEY);
      if (isH === getTodayStr()) {
        setIsHoliday(true);
      }
    } catch {}
  }, []);

  // Sync punch timestamps
  useEffect(() => {
    if (punchRecord) {
      if (punchRecord.inTime) setPunchInTime(new Date(punchRecord.inTime));
      else setPunchInTime(null);

      if (punchRecord.outTime) setPunchOutTime(new Date(punchRecord.outTime));
      else setPunchOutTime(null);
    } else {
      setPunchInTime(null);
      setPunchOutTime(null);
    }
  }, [punchRecord]);

  // Date Rollover Check & Historical Archiving system
  useEffect(() => {
    const checkRolloverAndLoad = () => {
      const todayString = getTodayStr();
      const lastLoadedDate = localStorage.getItem(LAST_DATE_KEY);

      if (lastLoadedDate && lastLoadedDate !== todayString) {
        // 1. Roll over slacking statistics of the previous days
        const prevSlackTotal = slackSessions.reduce((sum, s) => sum + s.mins, 0);
        if (prevSlackTotal > 0) {
          const newWeekData = { ...weeklyData, [lastLoadedDate]: prevSlackTotal };
          setWeeklyData(newWeekData);
          storage.set(WEEK_KEY, newWeekData);
        }

        // 2. Check if the rollover happened over month boundaries
        const lastMonth = lastLoadedDate.substring(0, 7); // YYYY-MM
        const thisMonth = todayString.substring(0, 7);

        if (lastMonth !== thisMonth) {
          // Compile and Archiving previous month details
          const completedWorkDays = settings.workDays; // average work days
          const baseSalary = settings.monthlySalary;
          
          // Calculate historical month aggregates
          const totalSlackMins = slackSessions.reduce((sum, s) => sum + s.mins, 0);
          const totalSlackEarned = slackSessions.reduce((sum, s) => sum + s.earned, 0);
          
          // Estimate base earned
          const archivedBase = baseSalary;
          const archivedOT = 0; // simple estimate at transition

          const newArchiveRecord: MonthHistory = {
            month: lastMonth,
            workDaysPassed: completedWorkDays,
            totalBaseEarned: archivedBase,
            totalOTEarned: archivedOT,
            totalSlackMins,
            totalSlackEarned,
          };

          const newHistory = [newArchiveRecord, ...history];
          setHistory(newHistory);
          storage.set(HISTORY_KEY, newHistory);
        }

        // 3. Purge today's punch controller / session logs as it is a brand new day!
        setSlackSessions([]);
        storage.set(SLACK_KEY, []);
        setPunchRecord(null);
        storage.set(PUNCH_KEY, null);

        setIsHoliday(false);
        try {
          localStorage.removeItem(HOLIDAY_KEY);
        } catch {}
      }

      localStorage.setItem(LAST_DATE_KEY, todayString);
    };

    checkRolloverAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Standard live clock tick
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Update Settings
  const handleUpdateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    storage.set(SETTINGS_KEY, newSettings);
  };

  // Clock operations
  const handlePunchIn = (time: Date) => {
    const rec: PunchRecord = {
      date: getTodayStr(),
      inTime: time.toISOString(),
      outTime: punchOutTime ? punchOutTime.toISOString() : null,
    };
    setPunchRecord(rec);
    storage.set(PUNCH_KEY, rec);
  };

  const handlePunchOut = (time: Date) => {
    if (!punchInTime) return;
    const rec: PunchRecord = {
      date: getTodayStr(),
      inTime: punchInTime.toISOString(),
      outTime: time.toISOString(),
    };
    setPunchRecord(rec);
    storage.set(PUNCH_KEY, rec);
  };

  const handleClearPunch = () => {
    setPunchRecord(null);
    storage.remove(PUNCH_KEY);
  };

  const handleModifyPunch = (inStr: string | null, outStr: string | null) => {
    const todayStrFull = getTodayStr();
    let computedInTime: Date | null = null;
    let computedOutTime: Date | null = null;

    if (inStr) {
      computedInTime = new Date();
      const [h, m] = inStr.split(":").map(Number);
      computedInTime.setHours(h || 9, m || 0, 0, 0);
    }

    if (outStr) {
      computedOutTime = new Date();
      const [h, m] = outStr.split(":").map(Number);
      computedOutTime.setHours(h || 18, m || 0, 0, 0);
    }

    const rec: PunchRecord = {
      date: todayStrFull,
      inTime: computedInTime ? computedInTime.toISOString() : null,
      outTime: computedOutTime ? computedOutTime.toISOString() : null,
    };

    setPunchRecord(rec);
    storage.set(PUNCH_KEY, rec);
  };

  // Slacking operations
  const handleToggleSlack = () => {
    if (!slacking) {
      const sStart = new Date();
      setSlackStart(sStart);
      setSlacking(true);
    } else {
      if (slackStart) {
        const sEnd = new Date();
        const mins = (sEnd.getTime() - slackStart.getTime()) / 60000;
        
        // Compute precise earned amount
        const activeWorkMinutes = Math.max(1, toMins(settings.endTime) - toMins(settings.startTime) - (toMins(settings.lunchEnd) - toMins(settings.lunchStart)));
        const dailySal = settings.monthlySalary / settings.workDays;
        const perMin = dailySal / activeWorkMinutes;
        const earned = mins * perMin;

        const newSession: SlackSession = {
          id: Math.random().toString(36).substring(2, 9),
          start: slackStart.toISOString(),
          end: sEnd.toISOString(),
          mins,
          earned,
        };

        const updatedSessions = [...slackSessions, newSession];
        setSlackSessions(updatedSessions);
        storage.set(SLACK_KEY, updatedSessions);

        // Update weekly Data cumulative minutes
        const activeCumulative = updatedSessions.reduce((sum, s) => sum + s.mins, 0);
        const newWeekData = { ...weeklyData, [getTodayStr()]: activeCumulative };
        setWeeklyData(newWeekData);
        storage.set(WEEK_KEY, newWeekData);
      }
      setSlacking(false);
      setSlackStart(null);
    }
  };

  const handleSaveSlackGoal = (mins: number) => {
    setSlackGoalMins(mins);
  };

  const handleDeleteSession = (id: string) => {
    const updated = slackSessions.filter((s) => s.id !== id);
    setSlackSessions(updated);
    storage.set(SLACK_KEY, updated);

    const activeCumulative = updated.reduce((sum, s) => sum + s.mins, 0);
    const newWeekData = { ...weeklyData, [getTodayStr()]: activeCumulative };
    setWeeklyData(newWeekData);
    storage.set(WEEK_KEY, newWeekData);
  };

  // Multiple Savings Goals operations
  const handleAddGoal = (g: Omit<SavingsGoal, "id" | "createdAt">) => {
    const newGoal: SavingsGoal = {
      id: Math.random().toString(36).substring(2, 9),
      name: g.name,
      targetAmount: g.targetAmount,
      currentSaved: g.currentSaved,
      createdAt: new Date().toISOString(),
    };
    const updated = [...savingsGoals, newGoal];
    setSavingsGoals(updated);
    storage.set(SAVINGS_KEY, updated);
  };

  const handleUpdateGoal = (g: SavingsGoal) => {
    const updated = savingsGoals.map((val) => (val.id === g.id ? g : val));
    setSavingsGoals(updated);
    storage.set(SAVINGS_KEY, updated);
  };

  const handleDeleteGoal = (id: string) => {
    const updated = savingsGoals.filter((g) => g.id !== id);
    setSavingsGoals(updated);
    storage.set(SAVINGS_KEY, updated);
  };

  const handleClearHistory = () => {
    setHistory([]);
    storage.remove(HISTORY_KEY);
  };

  const handleToggleHoliday = () => {
    const nextH = !isHoliday;
    setIsHoliday(nextH);
    if (nextH) {
      try {
        localStorage.setItem(HOLIDAY_KEY, getTodayStr());
      } catch {}
    } else {
      try {
        localStorage.removeItem(HOLIDAY_KEY);
      } catch {}
    }
  };

  // Calculate live core numbers for the ticker cards
  const metrics = computeCurrentEarnings(
    settings,
    now,
    isHoliday,
    punchInTime,
    punchOutTime
  );

  // Income constants for micro widgets
  const dailySal = settings.monthlySalary / settings.workDays;
  const activeWorkMinutes = Math.max(1, toMins(settings.endTime) - toMins(settings.startTime) - (toMins(settings.lunchEnd) - toMins(settings.lunchStart)));
  const payPerMin = dailySal / activeWorkMinutes;
  const payPerSec = payPerMin / 60;
  const payPerHour = payPerMin * 65; // average estimation

  // Month progress passed calculation
  const getMonthProgressDetails = () => {
    const today = now.getDate();
    const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const workDaysPassed = Math.round((today / totalDays) * settings.workDays);
    const progressPct = (workDaysPassed / settings.workDays) * 100;
    const estimatedBaseEarned = workDaysPassed * dailySal;

    return {
      workDaysPassed,
      progressPct,
      estimatedBaseEarned,
    };
  };

  const mProgress = getMonthProgressDetails();

  const getStatusMsg = () => {
    const h = now.getHours();
    const m = now.getMinutes();
    const s = now.getSeconds();
    const nowMins = h * 60 + m + s / 60;

    const startM = toMins(settings.startTime);
    const endM = toMins(settings.endTime);

    // Get effective start/end based on punchRecords
    const effectiveStart = punchInTime 
      ? punchInTime.getHours() * 60 + punchInTime.getMinutes() + punchInTime.getSeconds() / 60
      : startM;

    const effectiveEnd = punchOutTime
      ? punchOutTime.getHours() * 60 + punchOutTime.getMinutes() + punchOutTime.getSeconds() / 60
      : endM;

    if (isHoliday) {
      return "今天公假，好好休息！";
    }

    if (punchOutTime && nowMins >= effectiveEnd) {
      return "下班了！今天辛苦啦 🎉";
    }

    if (!punchInTime && nowMins < effectiveStart) {
      const preRemSecs = Math.max(0, Math.round((effectiveStart - nowMins) * 60));
      const preH = Math.floor(preRemSecs / 3600);
      const preM = Math.floor((preRemSecs % 3600) / 60);
      const preS = preRemSecs % 60;
      const preStr = (preH > 0 ? `${preH}小时` : "") + (preM > 0 || preH > 0 ? `${preM}分` : "") + `${preS}秒`;
      return `距上班还有 ${preStr}`;
    }

    if (nowMins >= endM && !punchOutTime) {
      // Overtime
      const otStartTime = new Date(now);
      otStartTime.setHours(Math.floor(endM / 60), Math.floor(endM % 60), 0);
      const otMins = Math.max(0, (now.getTime() - otStartTime.getTime()) / 60000);
      return `加班 ${Math.ceil(otMins)} 分钟，记得打卡下班！`;
    }

    // Normal working or active hours
    const remSecs = Math.max(0, Math.round((effectiveEnd - nowMins) * 60));
    const remH = Math.floor(remSecs / 3600);
    const remM = Math.floor((remSecs % 3600) / 60);
    const remS = remSecs % 60;
    const remStr = (remH > 0 ? `${remH}小时` : "") + (remM > 0 || remH > 0 ? `${remM}分` : "") + `${remS}秒`;
    return `距下班还有 ${remStr}`;
  };

  return (
    <div className="w-full max-w-[520px] mx-auto min-h-screen flex flex-col relative bg-[#0f0f0f] text-[#f0ede8] font-sans pb-24">
      
      {/* ── Main content pages ── */}
      <div className="flex-1 w-full px-5 py-6 z-10">

        {/* ── Tab: HOME ── */}
        {activeTab === "home" && (
          <div className="page space-y-4">
            
            {/* Header / Logo bar */}
            <div className="topbar select-none">
              <div className="logo">
                REAL<span>PAY</span>
              </div>
              <div className="badge">
                <span className={`dot ${
                  metrics.isWorking ? "working" :
                  metrics.isOT ? "ot" : 
                  isHoliday ? "done" : "off"
                }`} />
                <span>{metrics.statusLabel}</span>
              </div>
            </div>

            {/* Public Holiday Banner */}
            {isHoliday && (
              <div className="holiday-banner" id="holiday-banner">
                <span className="hb-msg">🎉 今天公假，好好休息！</span>
                <button className="hb-clear" onClick={handleToggleHoliday}>取消</button>
              </div>
            )}

            {/* Attendance Punch component */}
            <PunchController
              punchInTime={punchInTime}
              punchOutTime={punchOutTime}
              onPunchIn={handlePunchIn}
              onPunchOut={handlePunchOut}
              onClearPunch={handleClearPunch}
              onModifyPunch={handleModifyPunch}
            />

            {/* Dynamic Earnings Hero Card - Restored perfectly to original design */}
            <div 
              className={`hero ${slacking ? "slacking" : ""} ${isHoliday ? "holiday" : ""} ${metrics.isOT ? "overtime" : ""}`}
              onClick={() => {
                navigator.clipboard.writeText(`RM ${metrics.totalEarned.toFixed(2)}`);
                const toast = document.getElementById("copy-toast");
                if (toast) {
                  toast.classList.add("show");
                  setTimeout(() => toast.classList.remove("show"), 1500);
                }
              }}
            >
              <div className="hero-glow" />
              <div className="copy-toast" id="copy-toast">已复制 ✓</div>
              <div className="hero-label">今日已赚 · 点击复制</div>
              <div className="hero-amount">
                <span className="hero-rm">RM</span>
                <span className={`hero-num ${
                  slacking ? "slacking" :
                  metrics.isOT ? "overtime" :
                  isHoliday ? "holiday" : "live"
                }`}>
                  {metrics.totalEarned.toFixed(2)}
                </span>
              </div>
              <div className="hero-date">
                {now.getMonth() + 1}月{now.getDate()}日 · {["星期日","星期一","星期二","星期三","星期四","星期五","星期六"][now.getDay()]}
              </div>

              {/* Progress bar info for office hours */}
              <div className="prog-wrap">
                <div className="prog-meta">
                  <span>{punchInTime ? formatAmPm(punchInTime, settings.startTime) : formatAmPm(null, settings.startTime)}</span>
                  <span className="prog-pct">
                    {metrics.isOT ? "加班中" : `${metrics.progressPct.toFixed(0)}%`}
                  </span>
                  <span>{punchOutTime ? formatAmPm(punchOutTime, settings.endTime) : formatAmPm(null, settings.endTime)}</span>
                </div>
                <div className="prog-track">
                  <div 
                    className="prog-fill" 
                    style={{ width: `${metrics.progressWidth}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Overtime Banner Details showing when OT is active */}
            {metrics.isOT && (
              <div className="ot-banner" id="ot-banner">
                <div className="ot-left">
                  <span className="ot-tag">⏰ 加班中</span>
                  <span className="ot-val">RM {metrics.earnedOT.toFixed(2)}</span>
                </div>
                <div className="ot-right">
                  <div className="ot-time">
                    {String(Math.floor(metrics.otSecs / 3600)).padStart(2, "0")}:
                    {String(Math.floor((metrics.otSecs % 3600) / 60)).padStart(2, "0")}:
                    {String(metrics.otSecs % 60).padStart(2, "0")}
                  </div>
                  <div className="ot-rate">
                    {settings.overtimeRate}x · RM {payPerHour.toFixed(2)}/hr
                  </div>
                </div>
              </div>
            )}

            {/* Overtime subtotals even after lower clock-out! Satisfies: "加班结束后的小计" */}
            {punchOutTime && metrics.earnedOT > 0 && (
              <div className="today-full select-none">
                <span className="tf-lbl">今日奋斗所得 (底薪 + 加班)</span>
                <span className="tf-val">RM {metrics.totalEarned.toFixed(2)}</span>
              </div>
            )}

            {/* Local cached weather module */}
            <WeatherWidget settings={settings} />

            {/* Monthly Progress tracking */}
            <div className="monthly-prog select-none">
              <div className="mp-head">
                <span className="mp-label">本月进度</span>
                <span className="mp-pct">{mProgress.progressPct.toFixed(0)}%</span>
              </div>
              <div className="mp-track">
                <div 
                  className="mp-fill" 
                  style={{ width: `${mProgress.progressPct}%` }}
                />
              </div>
              <div className="mp-sub">
                <span>第 {mProgress.workDaysPassed} / {settings.workDays} 工作日</span>
                <span>本月预计提现: <span className="mp-earned">RM {mProgress.estimatedBaseEarned.toFixed(2)}</span></span>
              </div>
            </div>

            {/* Mini rates indicator */}
            <div className="rates select-none">
              <div className="rate">
                <div className="rate-v">{payPerSec.toFixed(3)}</div>
                <div className="rate-l">每秒 RM</div>
              </div>
              <div className="rate">
                <div className="rate-v">{payPerMin.toFixed(2)}</div>
                <div className="rate-l">每分钟</div>
              </div>
              <div className="rate">
                <div className="rate-v">{payPerHour.toFixed(2)}</div>
                <div className="rate-l">每小时</div>
              </div>
            </div>

            {/* General daily earned overview and status clocks */}
            <div className="today-full select-none">
              <span className="tf-lbl">今日应得总计</span>
              <span className="tf-val">RM {dailySal.toFixed(2)}</span>
            </div>

            <div className="status-bar select-none">
              <span className="status-msg">{getStatusMsg()}</span>
              <span className="status-clock">{fmt12Full(now)}</span>
            </div>

            {/* Customizable pricing consumer grids */}
            <GoodsList currentEarned={metrics.totalEarned} />

            {/* Floating multiple Savings goals */}
            <SavingsManager
              goals={savingsGoals}
              dailySal={dailySal}
              onAddGoal={handleAddGoal}
              onUpdateGoal={handleUpdateGoal}
              onDeleteGoal={handleDeleteGoal}
            />

            {/* Quick status timeline and share triggers */}
            <div className="share-row">
              <button
                onClick={() => setShowShareModal(true)}
                className="share-btn"
              >
                <span>📊 生成分账战报</span>
              </button>

              <button
                onClick={handleToggleHoliday}
                className={`holiday-btn ${isHoliday ? "active" : ""}`}
              >
                <span>🎉 设定今天公假</span>
              </button>
            </div>

          </div>
        )}


        {/* ── Tab: SLACKING ── */}
        {activeTab === "slack" && (
          <div className="page active">
            <SlackingManager
              slacking={slacking}
              slackStart={slackStart}
              slackSessions={slackSessions}
              slackGoalMins={slackGoalMins}
              perMin={payPerMin}
              onToggleSlack={handleToggleSlack}
              onSaveSlackGoal={handleSaveSlackGoal}
              onDeleteSession={handleDeleteSession}
              weeklyData={weeklyData}
            />
          </div>
        )}


        {/* ── Tab: SETTINGS ── */}
        {activeTab === "settings" && (
          <div className="page active">
            <SettingsManager
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              history={history}
              onClearHistory={handleClearHistory}
            />
          </div>
        )}

      </div>

      {/* Elegant floating modal share card dialog */}
      {showShareModal && (
        <ShareModal
          earnedAmount={metrics.totalEarned}
          perHour={payPerHour}
          dailySal={dailySal}
          monthlyProgressPct={mProgress.progressPct}
          workDaysPassed={mProgress.workDaysPassed}
          totalWorkDays={settings.workDays}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {/* Footer System Credits lines */}
      <footer className="footer">
        设置自动保存到本地 · 跨天摸鱼记录自动清零
      </footer>

      {/* TAB NAV */}
      <nav className="tab-nav select-none">
        <div className="tab-inner">
          <button 
            className={`tab-btn ${activeTab === "home" ? "active" : ""}`}
            onClick={() => setActiveTab("home")}
          >
            <span className="tab-icon">💰</span><span>主页</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === "slack" ? "active" : ""}`}
            onClick={() => setActiveTab("slack")}
          >
            <span className="tab-icon">🐟</span><span>摸鱼</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => setActiveTab("settings")}
          >
            <span className="tab-icon">⚙️</span><span>设置</span>
          </button>
        </div>
      </nav>

    </div>
  );
}
