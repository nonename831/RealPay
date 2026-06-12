import { Copy, Download, X, Check, Award, ChevronLeft, ChevronRight } from "lucide-react";
import React, { useState, useEffect } from "react";
import html2canvas from "html2canvas";
import { motion } from "motion/react";
import { SlackSession } from "../types";

// Converts OKLCH stylesheet values to standard RGB/RGBA values to prevent html2canvas parsing crashes
function convertOklchToRgb(oklchStr: string): string {
  try {
    const startIdx = oklchStr.indexOf('(');
    const endIdx = oklchStr.lastIndexOf(')');
    if (startIdx === -1 || endIdx === -1) return oklchStr;
    const inner = oklchStr.slice(startIdx + 1, endIdx).trim();

    const parts = inner.split("/");
    const colorParts = parts[0].trim().split(/\s+/);
    if (colorParts.length < 3) return oklchStr;

    let l = parseFloat(colorParts[0]);
    if (colorParts[0].endsWith("%")) { l = l / 100; }
    let c = parseFloat(colorParts[1]);
    if (colorParts[1].endsWith("%")) { c = c / 100; }
    let hStr = colorParts[2];
    if (hStr.endsWith("deg")) { hStr = hStr.slice(0, -3); }
    else if (hStr.endsWith("rad")) { hStr = (parseFloat(hStr.slice(0, -3)) * 180 / Math.PI).toString(); }
    else if (hStr.endsWith("turn")) { hStr = (parseFloat(hStr.slice(0, -4)) * 360).toString(); }
    const h = parseFloat(hStr);
    if (isNaN(l) || isNaN(c) || isNaN(h)) return oklchStr;

    let alpha = parts[1] ? parts[1].trim() : undefined;
    if (alpha) {
      if (alpha.endsWith("%")) { alpha = (parseFloat(alpha) / 100).toString(); }
      else if (alpha.includes("var(")) { const fallbackMatch = alpha.match(/,\s*([^)]+)\)/); alpha = fallbackMatch ? fallbackMatch[1].trim() : "1"; }
    }

    const hRad = (h * Math.PI) / 180;
    const aVal = c * Math.cos(hRad);
    const bVal = c * Math.sin(hRad);
    const l_ = l + 0.3963377774 * aVal + 0.2158037573 * bVal;
    const m_ = l - 0.1055613458 * aVal - 0.0638541728 * bVal;
    const s_ = l - 0.0894841775 * aVal - 1.2914855480 * bVal;
    const L = Math.pow(Math.max(0, l_), 3);
    const M = Math.pow(Math.max(0, m_), 3);
    const S = Math.pow(Math.max(0, s_), 3);
    const rL = +4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S;
    const gL = -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S;
    const bL = -0.0041960863 * L - 0.7034186147 * M + 1.7076147010 * S;
    const gamma = (val: number) => val <= 0.0031308 ? 12.92 * val : 1.055 * Math.pow(val, 1 / 2.4) - 0.055;
    const r = Math.min(255, Math.max(0, Math.round(gamma(rL) * 255)));
    const g = Math.min(255, Math.max(0, Math.round(gamma(gL) * 255)));
    const b = Math.min(255, Math.max(0, Math.round(gamma(bL) * 255)));
    return alpha ? `rgba(${r}, ${g}, ${b}, ${alpha})` : `rgb(${r}, ${g}, ${b})`;
  } catch (err) {
    console.error("Failed to convert oklch:", oklchStr, err);
    return "rgb(120, 120, 120)";
  }
}

function convertOklabToRgb(oklabStr: string): string {
  try {
    const startIdx = oklabStr.indexOf('(');
    const endIdx = oklabStr.lastIndexOf(')');
    if (startIdx === -1 || endIdx === -1) return oklabStr;
    const inner = oklabStr.slice(startIdx + 1, endIdx).trim();
    const parts = inner.split("/");
    const colorParts = parts[0].trim().split(/\s+/);
    if (colorParts.length < 3) return oklabStr;
    let l = parseFloat(colorParts[0]);
    if (colorParts[0].endsWith("%")) { l = l / 100; }
    let aVal = parseFloat(colorParts[1]);
    if (colorParts[1].endsWith("%")) { aVal = aVal / 100; }
    let bVal = parseFloat(colorParts[2]);
    if (colorParts[2].endsWith("%")) { bVal = bVal / 100; }
    if (isNaN(l) || isNaN(aVal) || isNaN(bVal)) return oklabStr;
    let alpha = parts[1] ? parts[1].trim() : undefined;
    if (alpha) {
      if (alpha.endsWith("%")) { alpha = (parseFloat(alpha) / 100).toString(); }
      else if (alpha.includes("var(")) { const fallbackMatch = alpha.match(/,\s*([^)]+)\)/); alpha = fallbackMatch ? fallbackMatch[1].trim() : "1"; }
    }
    const l_ = l + 0.3963377774 * aVal + 0.2158037573 * bVal;
    const m_ = l - 0.1055613458 * aVal - 0.0638541728 * bVal;
    const s_ = l - 0.0894841775 * aVal - 1.2914855480 * bVal;
    const L = Math.pow(Math.max(0, l_), 3);
    const M = Math.pow(Math.max(0, m_), 3);
    const S = Math.pow(Math.max(0, s_), 3);
    const rL = +4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S;
    const gL = -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S;
    const bL = -0.0041960863 * L - 0.7034186147 * M + 1.7076147010 * S;
    const gamma = (val: number) => val <= 0.0031308 ? 12.92 * val : 1.055 * Math.pow(val, 1 / 2.4) - 0.055;
    const r = Math.min(255, Math.max(0, Math.round(gamma(rL) * 255)));
    const g = Math.min(255, Math.max(0, Math.round(gamma(gL) * 255)));
    const b = Math.min(255, Math.max(0, Math.round(gamma(bL) * 255)));
    return alpha ? `rgba(${r}, ${g}, ${b}, ${alpha})` : `rgb(${r}, ${g}, ${b})`;
  } catch (err) {
    console.error("Failed to convert oklab:", oklabStr, err);
    return "rgb(120, 120, 120)";
  }
}

function sanitizeColorValue(val: string): string {
  if (!val) return val;
  const oklchRegex = /oklch\((?:[^()]+|\([^()]*\))*\)/gi;
  const oklabRegex = /oklab\((?:[^()]+|\([^()]*\))*\)/gi;
  let result = val;
  if (result.toLowerCase().includes("oklch")) result = result.replace(oklchRegex, (match) => convertOklchToRgb(match));
  if (result.toLowerCase().includes("oklab")) result = result.replace(oklabRegex, (match) => convertOklabToRgb(match));
  return result;
}

function wrapGetComputedStyle(win: Window) {
  if (!win || (win as any).__getComputedStyleWrapped) return;
  (win as any).__getComputedStyleWrapped = true;
  const originalGetComputedStyle = win.getComputedStyle;
  win.getComputedStyle = function (elt, pseudoElt) {
    const style = originalGetComputedStyle(elt, pseudoElt);
    return new Proxy(style, {
      get(target, prop, receiver) {
        if (prop === "getPropertyValue") {
          return function (propertyName: string) {
            const val = target.getPropertyValue(propertyName);
            return sanitizeColorValue(val);
          };
        }
        let val;
        try {
          if (typeof prop === "string" && prop in target) {
            const originalVal = (target as any)[prop];
            if (typeof originalVal === "function") return originalVal.bind(target);
            val = originalVal;
          } else {
            val = Reflect.get(target, prop);
          }
        } catch (err) {
          val = Reflect.get(target, prop);
        }
        if (typeof val === "string") return sanitizeColorValue(val);
        return val;
      },
    });
  };
}

const SLOGANS = [
  "把老板亏麻了，打工人终极胜利！",
  "按时上班是本分，按时摸鱼是利息。",
  "今天摸鱼多流汗，明天老板少个肾。",
  "工作是暂时的，摸鱼快乐是永恒的。",
  "键盘敲得噼里啪啦，其实我在聊天。",
  "月薪三千心比天高，月薪过万更欢！",
  "心中有鱼，万物皆可摸。",
  "摸鱼一时爽，一直摸鱼一直爽！",
  "工位是我的舞台，戏份全靠演技。",
  "给老板打工是副业，收割公款是主业。",
  "只要思想不滑坡，上班摸鱼天天多！",
  "摸鱼有理，白拿无罪，今晚加鸡腿！",
  "虽然我今天没干活，但我配得上这钱！",
  "打工人的命也是命！今天摸够两小时！",
  "用实力白拿公款，用智慧化解绩效。",
  "精心呵护每一分对公司的合法索赔。",
  "今日已进入安全滑水防守态势。",
  "带薪喝水，带薪入厕，观察动静。",
  "工作虐我千百遍，我待摸鱼如初恋。",
  "每天多喝一杯茶，时薪变相涨十块。",
  "工作就像演戏，我拿劳务费当影帝。",
  "只要胆子大，天天都是带薪假。",
  "每一次开会，都是高品质的带薪睡眠。",
  "虽然工资少，但看到老板焦头烂额就值。",
  "高端的打工人，往往采用最朴素的划水。",
  "精准卡点，合理偷闲，我是工位闪电。",
  "老板在台上画饼，我在台下计算秒薪。",
  "我来到这世上，不是为了帮老板买豪车。",
  "在公司拉屎十分钟，相当于赚走两毛钱。",
  "键盘响得快，群里聊得嗨。",
  "每天少干一分钟，公司亏损一整天。",
  "多干活不如多摸鱼，多摸鱼不如早下班。",
  "老板，你的梦想很好，但我只要工资。",
  "用心摸鱼，用爱省力，白拿公款最开心。",
  "今天对公司的唯一贡献，是吸足冷气。",
  "摸鱼不是逃避，是对高强度加班的抵抗。",
  "不要试图感动深渊，除非深渊按秒计薪。",
  "给多少钱办多少事，这叫职业操守。",
  "只要把水划得好，年底老板换新跑。",
  "在工位上保持最尊贵的优雅姿态。",
  "键盘上的光影交错，是与老板的博弈。",
  "今天的工作刚够我喝五杯热茶。",
  "带着骄傲与坚持，在摸鱼路上狂飙。",
  "只要心中有海，工位就是明媚沙滩。",
  "成功避开所有活儿，今天又是满分！",
  "生命如此美好，何必为了工作烦恼。",
  "工资是打发时间的，摸鱼才是真理。",
  "老板在讲情怀，我在后台看余额翻滚。",
  "今日指标已达成：带薪呼吸八小时。",
  "把公司的卫生纸用出极致性价比。",
];

interface ShareModalProps {
  earnedAmount: number;
  perHour: number;
  dailySal: number;
  monthlyProgressPct: number;
  workDaysPassed: number;
  totalWorkDays: number;
  onClose: () => void;
  currency?: string;
  slacking?: boolean;
  slackStart: Date | string | null;
  slackSessions: SlackSession[];
  slackGoalMins: number;
  payPerMin: number;
  punchInTime: Date | string | null;
}

export default function ShareModal({
  earnedAmount,
  perHour,
  dailySal,
  monthlyProgressPct,
  workDaysPassed,
  totalWorkDays,
  onClose,
  currency = "RM",
  slacking = false,
  slackStart = null,
  slackSessions = [],
  slackGoalMins = 30,
  payPerMin = 0,
  punchInTime = null,
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [activeCard, setActiveCard] = useState<0 | 1>(0);
  const [flipAxis, setFlipAxis] = useState<"x" | "y">("y");

  // States for 3D premium flip & tilt interaction
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [shinePos, setShinePos] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const normalizedX = x / rect.width - 0.5;
    const normalizedY = y / rect.height - 0.5;

    // Elegant high-fidelity 3D tilt ratio (max 10 degrees)
    const maxTilt = 10;
    setRotateY(normalizedX * maxTilt);
    setRotateX(-normalizedY * maxTilt);

    setShinePos({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
    });
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
    setIsHovered(false);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  // Clock state for real-time live stopwatch tick in preview
  const [nowTime, setNowTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  const [slogan] = useState(() => {
    return SLOGANS[Math.floor(Math.random() * SLOGANS.length)];
  });

  const getDayNameChinese = () => {
    const days = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
    return days[new Date().getDay()];
  };

  const getFormattedDate = () => {
    const d = new Date();
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  };

  // Slacking calculations
  const currentSessionMs = slacking && slackStart
    ? Math.max(0, nowTime.getTime() - new Date(slackStart).getTime())
    : 0;
  const currentSessionMins = currentSessionMs / 60000;
  const completedSessionMins = slackSessions.reduce((sum, s) => sum + s.mins, 0);
  const totalSlackMins = completedSessionMins + currentSessionMins;
  const completedSlackEarned = slackSessions.reduce((sum, s) => sum + s.earned, 0);
  const totalSlackEarned = completedSlackEarned + (currentSessionMins * payPerMin);
  const goalPct = Math.min(100, (totalSlackMins / (slackGoalMins || 1)) * 100);

  const getActiveSlackTimerString = () => {
    if (!slacking || !slackStart) return "00:00:00";
    const totalSecs = Math.floor(currentSessionMs / 1000);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = Math.floor(totalSecs % 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const generateShareText = () => {
    if (activeCard === 1) {
      return `🎣 【RealPay 带薪垂钓摸鱼战报】 🌊
-------------------------------
📅 时间: ${getFormattedDate()} (${getDayNameChinese()})
💵 带薪捕鱼纯利润: ${currency} ${totalSlackEarned.toFixed(2)}
📊 今日潜水摸鱼累计: ${Math.floor(totalSlackMins)} / ${slackGoalMins} 分钟
🎯 摸鱼进度/饱满度: ${goalPct.toFixed(0)}%
-------------------------------
📢 【摸鱼箴言】
${slogan}

RealPay 实时薪资计算`;
    }

    return `💰 【RealPay 战报】 💰
-------------------------------
📅 时间: ${getFormattedDate()} (${getDayNameChinese()})
💵 今日已赚: ${currency} ${earnedAmount.toFixed(2)}
⏱️ 实时薪资: ${currency} ${perHour.toFixed(2)}/小时
📊 日薪总额: ${currency} ${dailySal.toFixed(2)}
默默坚守: 第 ${workDaysPassed} 工作日 / 共 ${totalWorkDays} 天
📈 月度打卡进度: ${monthlyProgressPct.toFixed(0)}%
-------------------------------
📢 【每日箴言】
${slogan}

RealPay 实时薪水`;
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(generateShareText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
      alert("复制失败，请手动选择复制！");
    }
  };

  const handleDownloadImage = () => {
    setDownloading(true);
    const targetId = activeCard === 0 ? "capture-card-work" : "capture-card-slack";
    const node = document.getElementById(targetId);
    if (!node) {
      alert("未找到元素，已自动帮您复制文本战报！");
      handleCopyText();
      setDownloading(false);
      return;
    }

    wrapGetComputedStyle(window);

    html2canvas(node, {
      backgroundColor: activeCard === 0 ? "#0d0d0d" : "#121214",
      scale: 2,
      useCORS: true,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: document.documentElement.clientWidth,
      windowHeight: document.documentElement.clientHeight,
      onclone: (clonedDoc) => {
        const clonedWin = clonedDoc.defaultView;
        if (clonedWin) wrapGetComputedStyle(clonedWin);

        let combinedCss = "";
        try {
          for (let i = 0; i < document.styleSheets.length; i++) {
            const sheet = document.styleSheets[i];
            try {
              const rules = sheet.cssRules || (sheet as any).rules;
              if (rules) {
                for (let j = 0; j < rules.length; j++) {
                  combinedCss += rules[j].cssText + "\n";
                }
              }
            } catch (e) { /* cross-origin */ }
          }
        } catch (e) {
          console.warn("Failed to capture document stylesheets", e);
        }

        const styles = Array.from(clonedDoc.getElementsByTagName("style"));
        styles.forEach((s) => s.parentNode?.removeChild(s));
        const links = Array.from(clonedDoc.getElementsByTagName("link"));
        links.forEach((l) => { if (l.rel === "stylesheet") l.parentNode?.removeChild(l); });

        const oklchRegex = /oklch\((?:[^()]+|\([^()]*\))*\)/g;
        const oklabRegex = /oklab\((?:[^()]+|\([^()]*\))*\)/g;
        let translatedCss = combinedCss.replace(oklchRegex, (match) => convertOklchToRgb(match));
        translatedCss = translatedCss.replace(oklabRegex, (match) => convertOklabToRgb(match));
        const styleNode = clonedDoc.createElement("style");
        styleNode.textContent = translatedCss;
        clonedDoc.head.appendChild(styleNode);

        const allElements = clonedDoc.getElementsByTagName("*");
        for (let i = 0; i < allElements.length; i++) {
          const el = allElements[i] as HTMLElement;
          if (el.style) {
            for (let j = 0; j < el.style.length; j++) {
              const prop = el.style[j];
              const val = el.style.getPropertyValue(prop);
              if (val) {
                let replacedVal = val;
                let changed = false;
                if (val.includes("oklch")) { replacedVal = replacedVal.replace(oklchRegex, (match) => convertOklchToRgb(match)); changed = true; }
                if (val.includes("oklab")) { replacedVal = replacedVal.replace(oklabRegex, (match) => convertOklabToRgb(match)); changed = true; }
                if (changed) el.style.setProperty(prop, replacedVal);
              }
            }
          }
        }

        // ── 替换 slogan 区块为全内联样式版本，解决截图对齐问题 ──
        const clonedTarget = clonedDoc.getElementById(targetId);
        const sloganOuter = clonedTarget
          ? (clonedTarget.querySelector("[data-slogan-outer]") as HTMLElement | null)
          : null;
        if (sloganOuter) {
          sloganOuter.style.cssText = `
            margin-top: 36px;
            background: rgba(168, 85, 247, 0.1);
            border: 1px solid rgba(168, 85, 247, 0.2);
            border-radius: 12px;
            padding: 4px 16px 12px 16px;
            display: block;
            color: #d8b4fe;
            font-family: monospace;
            font-size: 10px;
            text-align: center;
          `;
          sloganOuter.innerHTML = `
            <table style="width:auto;border-collapse:collapse;margin:0 auto;">
              <tr>
                <td style="vertical-align:middle;padding:0 6px 0 0;font-size:12px;">🏅</td>
                <td style="vertical-align:middle;padding:0;font-size:10px;line-height:1.4;">${slogan}</td>
              </tr>
            </table>
          `;
        }
      }
    })
      .then((canvas: HTMLCanvasElement) => {
        const link = document.createElement("a");
        link.download = activeCard === 0
          ? `RealPay_Report_${getFormattedDate().replace(/\//g, "-")}.png`
          : `RealPay_SlackReport_${getFormattedDate().replace(/\//g, "-")}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        setDownloading(false);
      })
      .catch((err: any) => {
        console.error(err);
        alert("图片生成在您的当前设备上存在兼容错误，已自动复制文本战报！");
        handleCopyText();
        setDownloading(false);
      });
  };

  // Swiping mechanism state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const switchCard = (targetCard: 0 | 1) => {
    if (activeCard !== targetCard) {
      if (activeCard === 0) {
        setFlipAxis("y"); // default to horizontal flip for manual tab switches
      }
      setActiveCard(targetCard);
    }
  };

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ratio = rect.height / rect.width;
    const isAboveDiag1 = y < x * ratio;
    const isAboveDiag2 = y < rect.height - x * ratio;

    const nextCard = activeCard === 0 ? 1 : 0;

    if (activeCard === 0) {
      // Only set flipAxis when turning from front to back to avoid instant styling swap glitch
      if (isAboveDiag1 && isAboveDiag2) {
        setFlipAxis("x"); // Top -> Vertical flip
      } else if (!isAboveDiag1 && !isAboveDiag2) {
        setFlipAxis("x"); // Bottom -> Vertical flip
      } else {
        setFlipAxis("y"); // Left/Right -> Horizontal flip
      }
    }

    setActiveCard(nextCard);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const minSwipeDistance = 50;
    if (distance > minSwipeDistance) {
      switchCard(1); // Swipe left
    } else if (distance < -minSwipeDistance) {
      switchCard(0); // Swipe right
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-[360px] overflow-hidden flex flex-col max-h-[90vh] transform -translate-y-8 sm:-translate-y-12 transition-all duration-300 ease-out">
        {/* Modal Header */}
        <div className="px-4 py-3 border-b border-neutral-850 flex items-center justify-between">
          <span className="font-mono text-xs font-bold text-neutral-400">
            📊 REALPAY 战报分享
          </span>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-300 transition p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scroll Content */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4 relative">
          {/* Segmented Pill Selector (New premium switcher pattern) */}
          <div className="flex bg-neutral-950 p-1 rounded-xl border border-neutral-850/85 relative select-none">
            <div
              className="absolute top-1 bottom-1 rounded-lg bg-neutral-900 border border-neutral-800 transition-all duration-300 ease-out"
              style={{
                left: activeCard === 0 ? "4px" : "calc(50% + 2px)",
                width: "calc(50% - 6px)",
              }}
            />
            <button
              onClick={() => switchCard(0)}
              className={`relative flex-1 py-2 text-[11px] font-mono tracking-wide transition-all duration-300 z-10 cursor-pointer font-bold flex items-center justify-center gap-1 ${activeCard === 0 ? "text-purple-400" : "text-neutral-500 hover:text-neutral-400"
                }`}
            >
              <span>💼</span> 奋斗战报
            </button>
            <button
              onClick={() => switchCard(1)}
              className={`relative flex-1 py-2 text-[11px] font-mono tracking-wide transition-all duration-300 z-10 cursor-pointer font-bold flex items-center justify-center gap-1 ${activeCard === 1 ? "text-emerald-400" : "text-neutral-500 hover:text-neutral-400"
                }`}
            >
              <span>☕</span> 摸鱼报告
            </button>
          </div>

          {/* Card Presentation Stage with 1500px Perspective */}
          <div
            className="w-full relative py-2 select-none"
            style={{ perspective: "1500px" }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <motion.div
              onMouseMove={handleMouseMove}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              onClick={handleCardClick}
              animate={{
                rotateX: (activeCard === 0 ? 0 : (flipAxis === "x" ? 180 : 0)) + rotateX,
                rotateY: (activeCard === 0 ? 0 : (flipAxis === "y" ? 180 : 0)) + rotateY,
              }}
              transition={{
                type: "spring",
                stiffness: 100,
                damping: 18,
                mass: 0.8
              }}
              style={{ transformStyle: "preserve-3d" }}
              className="relative w-full h-[455px] cursor-pointer"
            >
              {/* Card 1: 奋斗所得 (Front Side) */}
              <div
                style={{
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  position: "absolute",
                  width: "100%",
                  height: "100%",
                  top: 0,
                  left: 0,
                  transformStyle: "preserve-3d",
                }}
                className="px-1"
              >
                <div
                  id={activeCard === 0 ? "visual-share-card" : "visual-share-card-inactive-1"}
                  className="bg-neutral-950 border border-neutral-850 py-9 px-6 rounded-xl shadow-[0_20px_50px_rgba(168,85,247,0.18)] hover:shadow-[0_25px_60px_rgba(168,85,247,0.25)] relative overflow-hidden text-center h-[455px] flex flex-col justify-between transition-shadow duration-300"
                >
                  {/* Neon Sheen Overlay */}
                  {isHovered && (
                    <div
                      className="absolute inset-0 pointer-events-none opacity-20 transition-opacity duration-300"
                      style={{
                        background: `radial-gradient(circle 180px at ${shinePos.x}% ${shinePos.y}%, rgba(168,85,247,0.35), transparent 70%)`,
                        mixBlendMode: "color-dodge",
                        zIndex: 40,
                      }}
                    />
                  )}

                  <div className="font-mono text-[10px] tracking-widest text-emerald-400 font-bold select-none">
                    REALPAY
                  </div>

                  <div className="my-9">
                    <span className="font-mono text-xs text-neutral-550 block uppercase tracking-wider mb-2">
                      今日累计奋斗所得
                    </span>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="font-mono font-light text-neutral-450 text-xl">{currency}</span>
                      <span className="font-mono font-bold text-neutral-100 text-5xl tracking-tight font-sans">
                        {earnedAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="text-[10px] text-neutral-550 font-mono select-none">
                    📅 {getFormattedDate()} · {getDayNameChinese()}
                  </div>

                  {/* Stats Breakdown */}
                  <div className="mt-6 pt-5 border-t border-dashed border-neutral-800 space-y-3 font-mono text-xs text-neutral-400">
                    <div className="flex justify-between">
                      <span className="text-neutral-605 font-medium">实时薪资:</span>
                      <span className="font-bold text-neutral-200">{currency} {perHour.toFixed(2)} / 小时</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-605 font-medium">日薪基准:</span>
                      <span className="font-bold text-neutral-200">{currency} {dailySal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-650 font-medium">月度进度:</span>
                      <span className="font-bold text-purple-400">
                        {monthlyProgressPct.toFixed(0)}% (第{workDaysPassed}天)
                      </span>
                    </div>
                  </div>

                  {/* Slogan */}
                  <div className="mt-6 bg-purple-500/10 text-purple-300 border border-purple-500/20 py-2.5 px-4 rounded-xl text-[10px] font-mono select-none text-center" data-slogan-outer>
                    <div className="inline-block text-left max-w-full">
                      <span className="inline-block align-middle mr-1.5 select-none font-bold">
                        <Award className="w-5 h-5 text-purple-400 min-w-[16px]" />
                      </span>
                      <span className="inline-block align-middle leading-snug max-w-[calc(100%-22px)] text-[10px]">
                        {slogan}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: 摸鱼模式 / 白拿战报 (Back Side, Rotated 180deg) */}
              <div
                style={{
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  position: "absolute",
                  width: "100%",
                  height: "100%",
                  top: 0,
                  left: 0,
                  transform: flipAxis === "y" ? "rotateY(180deg)" : "rotateX(180deg)",
                  transformStyle: "preserve-3d",
                }}
                className="px-1"
              >
                <div
                  id={activeCard === 1 ? "visual-share-card" : "visual-share-card-inactive-2"}
                  className="bg-neutral-950 border border-neutral-850 py-9 px-6 rounded-xl shadow-[0_20px_50px_rgba(52,211,153,0.18)] hover:shadow-[0_25px_60px_rgba(52,211,153,0.25)] relative overflow-hidden text-center h-[455px] flex flex-col justify-between transition-shadow duration-300"
                >
                  {/* Neon Sheen Overlay */}
                  {isHovered && (
                    <div
                      className="absolute inset-0 pointer-events-none opacity-20 transition-opacity duration-300"
                      style={{
                        background: `radial-gradient(circle 180px at ${shinePos.x}% ${shinePos.y}%, rgba(52,211,153,0.35), transparent 70%)`,
                        mixBlendMode: "color-dodge",
                        zIndex: 40,
                      }}
                    />
                  )}

                  {/* Elegant Postcard Header */}
                  <div className="flex justify-between items-center select-none z-10 border-b border-neutral-800/40 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm select-none">☕</span>
                      <div className="text-left">
                        <span className="text-[9px] font-mono tracking-[0.16em] text-neutral-400 font-extrabold uppercase block leading-none">
                          <span className="text-emerald-400">REALPAY</span> 摸鱼报告
                        </span>
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-[8px] text-emerald-400 font-bold tracking-widest uppercase block leading-none">
                        CLASS A CERTIFIED
                      </span>
                      <span className="text-[7.5px] text-neutral-550 block mt-0.5">
                        {getFormattedDate()}
                      </span>
                    </div>
                  </div>

                  {/* Geometric Designer SVG Fish representation */}
                  <div className="my-2 py-1 z-10 flex flex-col items-center justify-center">
                    <svg viewBox="0 0 100 40" className="w-24 h-8 text-neutral-450 fill-none stroke-current stroke-[1.5] stroke-linecap-round stroke-linejoin-round opacity-80">
                      <path d="M12,20 C32,5 68,5 88,20 C68,35 32,35 12,20 Z" />
                      <path d="M84,20 L92,13 C90,17 90,23 92,27 Z" />
                      <line x1="74" y1="11" x2="82" y2="28" className="opacity-30" />
                      <circle cx="28" cy="18" r="1.5" className="fill-current" />
                    </svg>
                    <span className="text-[7.5px] font-mono text-neutral-500 uppercase tracking-[0.3em] mt-1.5 select-none">
                      ZEN STATE ACTIVE
                    </span>
                  </div>

                  {/* Main Yield Metric */}
                  <div className="space-y-1.5 z-10">
                    <span className="text-[9px] font-mono text-neutral-550 uppercase tracking-[0.16em] block">
                      本日带薪摸鱼所得
                    </span>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="font-mono text-emerald-400 text-lg font-light">{currency}</span>
                      <span className="font-mono font-bold text-neutral-100 text-4xl tracking-tight font-sans">
                        {totalSlackEarned.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Saturation progress bar */}
                  <div className="space-y-1 z-10 px-0.5 my-1.5 select-none text-left">
                    <div className="flex justify-between items-center font-mono text-[8px] text-neutral-550 tracking-wider">
                      <span>摸鱼饱满度</span>
                      <span className="text-emerald-400 font-bold">{goalPct.toFixed(0)}%</span>
                    </div>
                    <div className="h-1 w-full bg-neutral-900 rounded-full overflow-hidden relative">
                      <div
                        className="h-full rounded-full bg-emerald-400 transition-all duration-500 relative"
                        style={{ width: `${Math.min(goalPct, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Swiss Style Mini Grid */}
                  <div className="border border-neutral-850 rounded-xl bg-neutral-900/40 p-3 space-y-2 font-mono text-[10px] text-left z-10">
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-500">休息状态:</span>
                      <span className="font-bold text-neutral-300">
                        {slacking ? "正在摸鱼 ☕" : "待机自愈中 🔋"}
                      </span>
                    </div>
                    <div className="h-[1px] bg-neutral-850/40" />
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-500">累计摸鱼时长:</span>
                      <span className="font-bold text-neutral-200">{Math.floor(totalSlackMins)} 分钟</span>
                    </div>
                    <div className="h-[1px] bg-neutral-850/40" />
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-500">薪资挽回比例:</span>
                      <span className="font-bold text-emerald-400">
                        {dailySal > 0 ? ((totalSlackEarned / dailySal) * 100).toFixed(1) : "0.0"}%
                      </span>
                    </div>
                  </div>

                  {/* Slogan with clean design */}
                  <div className="border-t border-dashed border-neutral-800 pt-3 select-none text-center z-10 flex flex-col items-center">
                    <p className="text-[10px] leading-relaxed font-sans text-neutral-400 italic font-medium px-1">
                      “ {slogan} ”
                    </p>
                    <div className="text-[7.5px] text-neutral-600 font-mono tracking-[0.2em] uppercase mt-2 select-none font-medium">
                      — LIFE FIRST · WORK LATER —
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Minimal Subtle Dot Indicator */}
          <div className="flex justify-center gap-1.5 pt-1.5 select-none">
            <button
              onClick={() => switchCard(0)}
              className={`w-1.5 h-1.5 rounded-full transition-all cursor-pointer ${activeCard === 0 ? "bg-purple-500 w-3.5" : "bg-neutral-800"}`}
              title="今日收益"
            />
            <button
              onClick={() => switchCard(1)}
              className={`w-1.5 h-1.5 rounded-full transition-all cursor-pointer ${activeCard === 1 ? "bg-emerald-400 w-3.5" : "bg-neutral-800"}`}
              title="摸鱼详情"
            />
          </div>
        </div>

        {/* Modal Buttons Footer */}
        <div className="p-3 border-t border-neutral-850 grid grid-cols-2 gap-2.5 bg-neutral-950">
          <button
            onClick={handleCopyText}
            className="bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs py-2.5 px-2 rounded-xl flex items-center justify-center gap-1.5 transition font-semibold cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">已复制</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-neutral-400" />
                <span>复制文字战报</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownloadImage}
            disabled={downloading}
            className="bg-emerald-500 hover:bg-emerald-450 disabled:bg-neutral-850 disabled:text-neutral-600 text-black text-xs py-2.5 px-2 rounded-xl flex items-center justify-center gap-1.5 transition font-bold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>{downloading ? "正在渲染..." : "保存战报图片"}</span>
          </button>
        </div>
      </div>

      {/* Hidden static capture targets for html2canvas to prevent blank/empty cards due to flex translation */}
      <div style={{ position: "absolute", left: "-9999px", top: "0px", pointerEvents: "none" }}>
        <div style={{ padding: "20px", background: "#0d0d0d", display: "inline-block" }}>
          {/* Static Card 0: 奋斗战报 */}
          <div
            id="capture-card-work"
            className="bg-neutral-950 border border-neutral-850 rounded-xl shadow-2xl relative overflow-hidden text-center text-neutral-100"
            style={{ width: "318px", height: "440px", boxSizing: "border-box", padding: "36px 24px 28px 24px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}
          >
            <div className="font-mono text-[10px] tracking-widest text-emerald-400 font-bold select-none text-center">
              REALPAY
            </div>

            <div style={{ display: "block" }}>
              <span className="font-mono text-xs text-neutral-550 block uppercase tracking-wider mb-2 text-center">
                今日累计奋斗所得
              </span>
              <div className="text-center" style={{ display: "block" }}>
                <span
                  className="font-mono font-light text-neutral-450 text-xl inline-block align-baseline mr-1"
                  style={{ transform: "translateY(11px)" }}
                >
                  {currency}
                </span>
                <span className="font-mono font-bold text-neutral-100 text-5xl tracking-tight inline-block align-baseline">
                  {earnedAmount.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="text-[10px] text-neutral-550 font-mono select-none text-center" style={{ display: "block" }}>
              📅 {getFormattedDate()} · {getDayNameChinese()}
            </div>

            {/* Stats Breakdown Table */}
            <div className="border-t border-dashed border-neutral-800 pt-4" style={{ display: "block" }}>
              <table className="w-full font-mono text-xs text-neutral-400" style={{ borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td className="text-left text-neutral-500 font-medium" style={{ padding: "4px 0", fontSize: "12px" }}>实时薪资:</td>
                    <td className="text-right font-bold text-neutral-200" style={{ padding: "4px 0", fontSize: "12px" }}>{currency} {perHour.toFixed(2)} / 小时</td>
                  </tr>
                  <tr>
                    <td className="text-left text-neutral-500 font-medium" style={{ padding: "4px 0", fontSize: "12px" }}>日薪基准:</td>
                    <td className="text-right font-bold text-neutral-200" style={{ padding: "4px 0", fontSize: "12px" }}>{currency} {dailySal.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td className="text-left text-neutral-500 font-medium" style={{ padding: "4px 0", fontSize: "12px" }}>月度进度:</td>
                    <td className="text-right font-bold text-purple-400" style={{ padding: "4px 0", fontSize: "12px" }}>
                      {monthlyProgressPct.toFixed(0)}% (第{workDaysPassed}天)
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Slogan */}
            <div className="bg-purple-500/10 text-purple-300 border border-purple-500/20 py-2.5 px-4 rounded-xl text-[10px] font-mono select-none" style={{ display: "block" }} data-slogan-outer>
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td className="align-middle text-center" style={{ width: "24px", padding: 0 }}>
                      <span style={{ fontSize: "14px" }}>🎖️</span>
                    </td>
                    <td className="align-middle text-left" style={{ padding: "0 0 0 6px", fontSize: "10px", lineHeight: "1.4", fontFamily: "monospace" }}>
                      {slogan}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={{ padding: "20px", background: "#0d0d0d", display: "inline-block" }}>
          {/* Static Card 1: 摸鱼战报 */}
          <div
            id="capture-card-slack"
            className="bg-neutral-950 border border-neutral-850 rounded-xl shadow-2xl relative overflow-hidden text-neutral-100"
            style={{ width: "318px", height: "440px", boxSizing: "border-box", padding: "36px 24px 28px 24px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}
          >
            {/* Subtle premium gradient glow */}
            <div className="absolute -bottom-12 -left-12 w-28 h-28 bg-neutral-800/20 rounded-full blur-2xl pointer-events-none opacity-50" />

            {/* Elegant Postcard Header using perfectly aligned Table */}
            <table className="w-full select-none z-10 border-b border-neutral-800/40 pb-2" style={{ borderCollapse: "collapse", display: "table", width: "100%" }}>
              <tbody>
                <tr>
                  <td className="align-middle text-left" style={{ padding: 0 }}>
                    <table style={{ borderCollapse: "collapse" }}>
                      <tbody>
                        <tr>
                          <td
                            className="align-middle text-sm"
                            style={{
                              padding: "0 6px 0 0",
                              transform: "translateY(-7px)"
                            }}
                          >
                            ☕
                          </td>

                          <td
                            className="align-middle text-left"
                            style={{
                              padding: 0,
                              transform: "translateY(-3px)"
                            }}
                          >
                            <span className="text-[9px] font-mono tracking-[0.16em] text-neutral-400 font-extrabold uppercase block leading-none">
                              <span style={{ color: "#34d399" }}>REALPAY</span> 摸鱼报告
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                  <td
                    className="align-middle text-right font-mono"
                    style={{
                      padding: 0,
                      transform: "translateY(-6px)"
                    }}
                  >
                    <span className="text-[8px] text-emerald-400 font-bold tracking-widest uppercase block leading-none">
                      CLASS A CERTIFIED
                    </span>
                    <span className="text-[7.5px] text-neutral-550 block mt-0.5">
                      {getFormattedDate()}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Geometric Designer SVG Fish representation */}
            <div className="py-0 z-10 text-center w-full" style={{ display: "block" }}>
              <div style={{ margin: "0 auto", width: "80px", display: "block" }}>
                <svg viewBox="0 0 100 40" className="w-20 h-7 text-neutral-450 fill-none stroke-current stroke-[1.5] stroke-linecap-round stroke-linejoin-round opacity-85" style={{ display: "block" }}>
                  <path d="M12,20 C32,5 68,5 88,20 C68,35 32,35 12,20 Z" />
                  <path d="M84,20 L92,13 C90,17 90,23 92,27 Z" />
                  <line x1="74" y1="11" x2="82" y2="28" className="opacity-30" />
                  <circle cx="28" cy="18" r="1.5" className="fill-current" />
                </svg>
              </div>
              <span className="text-[7.5px] font-mono text-neutral-550 uppercase tracking-[0.25em] mt-0.5 select-none block text-center">
                ZEN STATE ACTIVE
              </span>
            </div>

            {/* Main Yield Metric */}
            <div className="z-10 w-full text-center" style={{ display: "block" }}>
              <span
                className="text-[8.5px] font-mono text-neutral-550 uppercase tracking-[0.14em] block text-center"
                style={{ transform: "translateY(5px)" }}
              >
                本日带薪摸鱼所得
              </span>
              <div className="text-center" style={{ display: "block", marginTop: "1px" }}>
                <span
                  className="font-mono text-emerald-400 text-base font-light inline-block align-baseline mr-1"
                  style={{ transform: "translateY(5px)" }}
                >
                  {currency}
                </span>
                <span className="font-mono font-bold text-neutral-100 text-3xl tracking-tight inline-block align-baseline">
                  {totalSlackEarned.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Saturation progress bar */}
            <div className="px-0.5 select-none text-left w-full" style={{ display: "block" }}>
              <table className="w-full font-mono text-[8.5px] select-none" style={{ borderCollapse: "collapse", marginBottom: "3px" }}>
                <tbody>
                  <tr>
                    <td className="text-left text-neutral-500" style={{ padding: 0, transform: "translateY(-3px)" }}>
                      摸鱼饱满度
                    </td>

                    <td className="text-right text-emerald-400 font-bold" style={{ padding: 0, transform: "translateY(-3px)" }}   >
                      {goalPct.toFixed(0)}%
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="h-1 w-full bg-neutral-900 rounded-full overflow-hidden" style={{ position: "relative" }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(goalPct, 100)}%`, backgroundColor: "#34d399", height: "100%" }}
                />
              </div>
            </div>

            {/* Swiss Style Mini Grid Table layout for 100% stability */}
            <div className="border border-neutral-850 rounded-xl bg-neutral-900/40 p-2 z-10 w-full" style={{ display: "block" }}>
              <table className="w-full font-mono text-[10px] text-left" style={{ borderCollapse: "collapse" }}>
                <tbody>
                  <tr style={{ transform: "translateY(-4px)" }}>
                    <td className="text-neutral-500" style={{ padding: "2.5px 0" }}>休息状态:</td>
                    <td className="text-right font-bold text-neutral-300" style={{ padding: "2.5px 0" }}>
                      {slacking ? "正在摸鱼 ☕" : "待机自愈中 🔋"}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={2} style={{ height: "1px", backgroundColor: "rgba(38, 38, 38, 0.4)", padding: 0 }}></td>
                  </tr>
                  <tr style={{ transform: "translateY(-4px)" }}>
                    <td className="text-neutral-500" style={{ padding: "2.5px 0" }}>累计摸鱼时长:</td>
                    <td className="text-right font-bold text-neutral-200" style={{ padding: "2.5px 0" }}>{Math.floor(totalSlackMins)} 分钟</td>
                  </tr>
                  <tr>
                    <td colSpan={2} style={{ height: "1px", backgroundColor: "rgba(38, 38, 38, 0.4)", padding: 0 }}></td>
                  </tr>
                  <tr style={{ transform: "translateY(-4px)" }}>
                    <td className="text-neutral-500" style={{ padding: "2.5px 0" }}>薪资挽回比例:</td>
                    <td className="text-right font-bold text-emerald-400" style={{ padding: "2.5px 0" }}>
                      {dailySal > 0 ? ((totalSlackEarned / dailySal) * 100).toFixed(1) : "0.0"}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Slogan with clean design */}
            <table className="w-full select-none text-center z-10 border-t border-dashed border-neutral-800 pt-2" style={{ borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td className="text-center" style={{ padding: 0 }}>
                    <p className="text-[10px] leading-relaxed font-sans text-neutral-400 italic font-medium px-1" style={{ margin: 0 }}>
                      “ {slogan} ”
                    </p>
                    <p className="text-[7.5px] text-neutral-600 font-mono tracking-[0.2em] uppercase select-none font-medium text-center" style={{ margin: "4px 0 0 0" }}>
                      — LIFE FIRST · WORK LATER —
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
