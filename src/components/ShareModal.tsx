import { Copy, Download, X, Check, Award } from "lucide-react";
import { useState, useEffect } from "react";
import html2canvas from "html2canvas";

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
  "只要我摸得快，绩效的皮鞭就抽不到我。",
  "给公司的设备降降温，最好的办法是不工作。",
  "用摸鱼治愈打工的创伤，静候下班钟声。",
  "只要坚持摸鱼，胜利的旗帜属于我们。",
  "老板今天不在，本工位纯利润瞬间翻倍。",
  "今天不努力，明天老板就少一辆法拉利。",
  "把假装忙碌的演技，磨砺到炉火纯青。",
  "没有困难的工作，只有勇敢的摸鱼人。",
  "一顿饱和一顿饱，我选择带薪茶歇。",
  "每一个不带薪写诗的日子都是辜负。",
  "人类最伟大的发明，就是切屏快捷键。",
  "把老板亏麻了，是我对社会最真挚的奉献。",
  "做自己的导演，从按秒计算利润开始。",
  "打工不摸鱼，等于出卖灵魂不计利息。",
  "资本家捏紧钱包，我则抓紧了钓鱼竿。",
  "上班如同看电影，我是带薪看戏的观众。",
  "对抗周一综合症，唯有周二加倍划水。",
  "老板以为我在加班，其实我在双屏斗地主。",
  "给老板买一卷卫生纸，我能用出一个季度。",
  "工作虽然累人，但看到余额上涨真解压。",
  "我的主业是带薪摸鱼，副业是敷衍KPI。",
  "工位再小，翻个身也能抓到几条大鱼。",
  "今天的老板依旧一无所知，太棒了！",
  "老板在画大饼，我却在盘算中午吃大餐。",
  "工资是对抗衰老的良药，摸鱼是抗氧化的蜜糖。",
  "假装在写复杂代码，其实在玩扫雷游戏。",
  "带薪刷新闻，随时知晓地球每个角落。",
  "只要能偷个闲，工位也是世外桃源。",
  "只要把呼吸调匀，就能静静看老板着急。",
  "我用辛勤的汗水，帮老板买下海景房。",
  "不要问我今天做了啥，问就是战略隐蔽。",
  "高端的打工人，连喝茶都充满仪式感。",
  "只要我切屏够快，老板的眼睛就跟不上。",
  "老板盯着我打卡，我盯着银行卡的余额。",
  "给公司的冷气机增加一点点人性温暖。",
  "用实力白拿一整天，快乐根本停不下来。",
  "在公司的阴影里，我找到了生命的节奏。",
  "白拿一分是一分，今日纯利润已达峰值。",
  "按秒计薪，高频收割，打工人的大胜利！",
  "上班是给自己的未来积蓄摸鱼的勇力。",
  "用摸鱼的态度生活，生活也会变得轻松。",
  "键盘噼里啪啦，我的灵魂在太空滑滑梯。",
  "把假装忙碌当成日薪的一部分，最敬业。",
  "摸鱼人，摸鱼魂，摸鱼才能成上人！",
  "键盘一响，黄金万两；工位一坐，全是收获。",
  "虽然我是一颗螺丝钉，但今天已经生锈了。",
  "用最端正的姿势，偷睡最安详的带薪觉。",
  "看着进度条前行，成就感扑面而来。",
  "只要我把姿态放低，天塌下来有高个顶上。",
  "带着骄傲，我们在带薪奋斗的路上狂飙。",
  "今天避开了三次开会，纯利润显著提升。",
  "把最好的精力留给自己，剩下的给工作。"
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
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

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

  const generateShareText = () => {
    return `💰 【RealPay 战报】 💰
-------------------------------
📅 时间: ${getFormattedDate()} (${getDayNameChinese()})
💵 今日已赚: ${currency} ${earnedAmount.toFixed(2)}
⏱️ 实时薪资: ${currency} ${perHour.toFixed(2)}/小时
📊 日薪总额: ${currency} ${dailySal.toFixed(2)}
📆 本月打卡日: 第 ${workDaysPassed} 工作日 / 共 ${totalWorkDays} 天
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
    const node = document.getElementById("visual-share-card");
    if (!node) {
      alert("未找到元素，已自动帮您复制文本战报！");
      handleCopyText();
      setDownloading(false);
      return;
    }

    wrapGetComputedStyle(window);

    html2canvas(node, {
      backgroundColor: "#0d0d0d",
      scale: 2,
      useCORS: true,
      logging: false,
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
        const sloganOuter = clonedDoc.querySelector("[data-slogan-outer]") as HTMLElement | null;
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
        link.download = `RealPay_Report_${getFormattedDate().replace(/\//g, "-")}.png`;
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

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-[360px] overflow-hidden flex flex-col max-h-[90vh] transform -translate-y-8 sm:-translate-y-12">
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
        <div className="p-4 flex-1 overflow-y-auto space-y-4">

          {/* Visual Share Card */}
          <div
            id="visual-share-card"
            className="bg-neutral-950 border border-neutral-800 py-9 px-6 rounded-xl shadow-2xl relative overflow-hidden text-center min-h-[360px] flex flex-col justify-between"
          >

            <div className="font-mono text-[10px] tracking-widest text-emerald-400 font-bold select-none">
              REALPAY
            </div>

            <div className="my-9">
              <span className="font-mono text-xs text-neutral-500 block uppercase tracking-wider mb-2">
                今日累计奋斗所得
              </span>
              <div className="flex items-baseline justify-center gap-1">
                <span className="font-mono font-light text-neutral-405 text-xl">{currency}</span>
                <span className="font-mono font-bold text-neutral-100 text-5xl tracking-tight">
                  {earnedAmount.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="text-[10px] text-neutral-550 font-mono select-none">
              📅 {getFormattedDate()} · {getDayNameChinese()}
            </div>

            {/* Stats Breakdown */}
            <div className="mt-8 pt-6 border-t border-dashed border-neutral-800 space-y-3 font-mono text-xs text-neutral-400">
              <div className="flex justify-between">
                <span className="text-neutral-600 font-medium">实时薪资:</span>
                <span className="font-bold text-neutral-200">{currency} {perHour.toFixed(2)} / 小时</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600 font-medium">日薪基准:</span>
                <span className="font-bold text-neutral-200">{currency} {dailySal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600 font-medium">月度进度:</span>
                <span className="font-bold text-purple-400">
                  {monthlyProgressPct.toFixed(0)}% (第{workDaysPassed}天)
                </span>
              </div>
            </div>

            {/* Slogan — unchanged from original */}
            <div className="mt-9 bg-purple-500/10 text-purple-300 border border-purple-500/20 py-2.5 px-4 rounded-xl text-[10px] font-mono select-none text-center" data-slogan-outer>
              <div className="inline-block text-left max-w-full">
                <span className="inline-block align-middle mr-1.5 select-none">
                  <Award className="w-5 h-5 text-purple-400 min-w-[16px]" />
                </span>
                <span className="inline-block align-middle leading-snug max-w-[calc(100%-22px)] text-[10px]">
                  {slogan}
                </span>
              </div>
            </div>
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
                <span className="text-emerald-400">已复制 text</span>
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
    </div>
  );
}
