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
  "把老板亏麻，打工人终极胜利！",
  "按时上班是本分，按时摸鱼是利息。",
  "今天摸鱼多流汗，明天老板少个肾。",
  "工作是暂时的，摸鱼快乐是永恒的。",
  "键盘敲得噼里啪啦，其实我在聊天。",
  "月薪三千心比天高，月薪过万更欢！",
  "心中有鱼，万物皆可摸。",
  "摸鱼一时爽，一直摸鱼一直爽！",
  "工位是我的舞台，戏份全靠演技。",
  "打工是副业，收割公款是主业。",
  "只要思想不滑坡，上班摸鱼天天多！",
  "摸鱼有理白拿无罪，今晚加餐！",
  "今天虽没干活，但我配得上这钱！",
  "打工人的命也是命！今天摸两小时！",
  "用实力白拿公款，用智慧化解绩效。",
  "精心呵护每一分对公司的合法索赔。",
  "今日已进入安全滑水防守态势。",
  "带薪喝水与如厕，随时观察动静。",
  "工作虐我千百遍，我待摸鱼如初恋。",
  "每天多喝一杯茶，时薪变项寿十块。",
  "工作就像演戏，我拿劳务费当影帝。",
  "只要胆子大，天天都是带薪假。",
  "每次开会，都是高品质的带薪睡眠。",
  "工资虽少，看老板焦头烂额就值。",
  "高端打工人，往往用最朴素的划水。",
  "精准卡点合理偷闲，我是工位闪电。",
  "老板在台上画饼，我在台下算秒薪。",
  "来到这世上，不是为了帮老板买车。",
  "公司拉屎十分钟，相当于赚两毛钱。",
  "键盘响得快，群里聊得嗨。",
  "每天少干一分钟，公司亏损一整天。",
  "多干活不如多摸鱼，不如早下班。",
  "老板你的梦想很好，但我只要工资。",
  "用心摸鱼用爱省力，白拿公款最爽。",
  "今日对公司唯一贡献，是吸足冷气。",
  "摸鱼不是逃避，是对加班的抵抗。",
  "不要感动深渊，除非深渊按秒计薪。",
  "给多少钱办多少事，这叫职业操守。",
  "只要把水划得好，年底老板换新跑。",
  "在工位上保持最尊贵的优雅姿态。",
  "键盘上光影交错，是与老板的博弈。",
  "今天的工作刚够我喝五杯热茶。",
  "带着骄傲与坚持，在摸鱼路上狂飙。",
  "只要心中有海，工位就是明媚沙滩。",
  "成功避开所有活儿，今天又是满分！",
  "生命如此美好，何必为了工作烦恼。",
  "工资是打发时间的，摸鱼才是真理。",
  "老板在讲情怀，我在看余额翻滚。",
  "今日指标已达成：带薪呼吸八小时。",
  "把公司的卫生纸用出极致性价比。",
  "带薪拉屎，是打工人的最后防线。",
  "上班偷偷看小说，字字都是带薪钱。",
  "今天看了一百个段子，赚了二十块。",
  "别催我，现在的我只值两块钱时薪。",
  "你以为我在工作？不，我在思考人生。",
  "每天多摸一分钟，时薪就比以前多。",
  "打工只是演戏，不用那么认真。",
  "老板画饼我吃饼，能省一顿是一顿。",
  "在开会时发呆，那是高级冥想。",
  "只要我不努力，老板就休想换跑车。",
  "每天在微信群里，发两百个问号。",
  "带薪喝咖啡，品尝资本的泡沫。",
  "工作多做多错，不做必定不错。",
  "摸鱼的意义，在于感受带薪自由。",
  "带薪呼吸，吐出工作的怨气。",
  "老板的指责，全当是免费白噪音。",
  "只要我足够咸鱼，就没人能利用我。",
  "每天最期待的事，就是准点打卡。",
  "我不是在发呆，是在等脑机同步。",
  "不要问我有什么成果，我活下来了。",
  "带薪午睡，梦里都是加薪的快乐。",
  "多用公司一张纸，保护地球一棵树。",
  "上班是折寿，只有摸鱼能养生。",
  "没有梦想，我的梦想就是不工作。",
  "打工只是渡劫，凡人何必认真。",
  "我的效率是弹性制的，取决于心情。",
  "只要能不干活，坐着就是胜利。",
  "每摸鱼一秒钟，就是对我命的尊重。",
  "今天又熬过去一天，明天请继续。",
  "老板谈未来，我只关心当下几点。",
  "给老板一分努力，留九分给自己。",
  "只要心够大，哪里都是马尔代夫。",
  "工位上的雕塑，说的就是我。",
  "带薪摸鱼，是对生命的最高敬意。",
  "今天努力呼吸，明天继续发呆。",
  "少干一件活，就是赚了一笔钱。",
  "把生活还给自己，把工作留给老板。",
  "带薪刷手机，屏幕亮起我的尊严。",
  "摸鱼本无罪，白嫖最心安。",
  "不卷天不卷地，只卷公司的纸巾。",
  "老板看我累了，我也看老板烦了。",
  "工作要留白，才能活得有光彩。",
  "在安静的工位，听钞票落袋的声音。",
  "今天的心情：适合全天带薪放空。",
  "多看风景少看表，不知不觉下班了。",
  "工作是假的，工资和健康是真的。",
  "带薪逛淘宝，购物更有动力。",
  "不要卷，卷到最后都是一身病。",
  "工作一分钟，摸鱼六十秒。",
  "今日功德已满，可以收拾回家了。",
  "只要不努力，生活就充满奇迹。",
  "今天的工作，拖到明天再看吧。",
  "带薪吹冷气，也是一种低碳环保。",
  "我不是懒，是在为世界保存体力。",
  "别问在干嘛，在跟理想做斗争。",
  "今天努力摸鱼，争取明天继续。",
  "在工位上思考，怎么能优雅地下班。",
  "多喝一滴水，多赚老板一分钱。",
  "工作多繁重，我也能一笑而过。",
  "带薪写BUG，让别人去修吧。",
  "用生命在抗拒，每一个突来的会议。",
  "不求大富大贵，只求带薪快乐。",
  "工作是暂时的，白拿是真的。",
  "今天的工作，像流水一样划走。",
  "把键盘打响，假装自己很忙碌。",
  "老板的梦想是豪车，我的梦想是早退。",
  "少说两句话，省下的都是体能。",
  "今天带薪写诗，字字价值连城。",
  "能不动就不动，在工位上假死。",
  "我的工作内容，主要是保持呼吸。",
  "白拿一秒也是爱，带薪划水不要停。",
  "工作只是游戏，输赢都不要在意。",
  "老板让我拼命，我给老板算命。",
  "每天少做一点，公司就亏一点。",
  "今天最开心的事，就是没有开会。",
  "不奋斗不拼搏，平平安安到下班。",
  "工作时聊天，是沟通情感的艺术。",
  "把公司的冷气，打包带回梦里。",
  "在繁忙的工位，寻找内心的平静。",
  "带薪拉屎十分钟，心情愉悦一整天。",
  "别催进度，我脑子还没开机呢。",
  "今天又拯救了自己，没有被卷死。",
  "能拖就拖，拖到最后不用做。",
  "在群里发表情包，也是一种贡献。",
  "用微笑面对老板，用意念开始摸鱼。",
  "只要心不乱，工作就无法伤我。",
  "今天也是完美的，因为没干什么活。",
  "带薪放空，是最高级的精神享受。",
  "我的最高效率，是留给外卖的。",
  "打工不摸鱼，那是不尊重劳动。",
  "键盘噼里啪啦，内心毫无波澜。",
  "用最朴素的努力，混最长的带薪时间。",
  "心里默念三遍：今天也是白拿一天。",
  "把公司的水喝光，让老板无法再画饼。",
  "今天努力过，指脑子转了三圈。",
  "工作只做表面，精髓在于敷衍。",
  "带薪看世界，比环游世界更爽。",
  "用实力证明，不干活也是一种天赋。",
  "不要试图懂工作，懂摸鱼就够了。",
  "今天的心情，适合在厕所常驻。",
  "工作是假的，工资和健康是真的吧。",
  "在工位上摸摸，在电脑前看看。",
  "今天的工作，已经交给了未来的我。",
  "老板的梦想，与我的健康无关。",
  "带薪洗手多洗几次，当做手部护理。",
  "少干一份活，延寿一整天。",
  "上班只是兼职，摸鱼才是主业。",
  "只要我够低调，就没人能让我卷。",
  "键盘是敲给老板听的，心是自己的。",
  "不要跟傻子争辩，也不要跟活死撑。",
  "带薪睡觉，那就是带薪补充能量。",
  "今天的贡献：在椅子上留下了坐痕。",
  "工作只是幻觉，摸鱼才是现实。",
  "给多少钱叹多少气，这叫等价交换。",
  "在工位的角落，寻找世界的真理。",
  "今天又没犯错，因为压根没干活。",
  "能在工位假死，就绝不真出力。",
  "带薪摸鱼，快乐就是这么简单。",
  "键盘上的摩擦，是与资本的拉扯。",
  "不要催我了，我已经在尽力摸了。",
  "公司亏不亏不关我事，我开心就好。",
  "工作只是过客，健康才是归宿。",
  "每天多摸一点，快乐就多一点。",
  "老板在招人，我在招魂。",
  "多看几眼窗外，时间流逝得更快。",
  "在带薪的日子里，慢慢变老。",
  "上班的唯一意义，在于能带薪。",
  "能用表情包解决的，绝不打字。",
  "今天的工作，就当是一场春梦吧。",
  "只要你不急，这事儿就不会发生。",
  "不要追求完美，敷衍才是王道。",
  "在电脑前打瞌睡，也是一种修行。",
  "键盘敲得狠，微信聊得爽。",
  "能不出力就不出力，保护关节。",
  "今天摸得开心，明天才能走得长远。",
  "把公司的冷气，当做自己的福报。",
  "在白嫖的路上一路狂飙，绝不回头。",
  "打工只是谋生，别把命搭进去。",
  "工资不够花，就多在工位上发呆。",
  "不奋斗不流汗，安安静静混一天。",
  "老板放狠话，我装聋作哑。",
  "能今天做完的事，尽量拖到下周。",
  "在嘈杂的项目里，保全自己。",
  "今天也是元气满满的，因为没怎么活。",
  "带薪刷推特，享受全球的快乐。",
  "工作就像演戏，我只想演个群众。",
  "不要在敷衍中迷失，要把敷衍坚持。",
  "今日的摸鱼成果，符合预期标准。",
  "多干无益，不如趁早回家睡觉。",
  "每天多摸一分钟，多带薪一分钟。",
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

  // Request gyroscope/accelerometer permission for device orientation on iOS
  const requestOrientationPermission = async () => {
    const DeviceOrientation = (window as any).DeviceOrientationEvent;
    if (DeviceOrientation && typeof DeviceOrientation.requestPermission === "function") {
      try {
        const permissionState = await DeviceOrientation.requestPermission();
        if (permissionState === "granted") {
          console.log("DeviceOrientation permission granted.");
        }
      } catch (err) {
        console.warn("DeviceOrientation permission failed or declined:", err);
      }
    }
  };

  // Listen to device orientation for physical tilting/swaying card behavior
  useEffect(() => {
    let lastUpdate = 0;
    const handleOrientation = (event: DeviceOrientationEvent) => {
      const now = Date.now();
      if (now - lastUpdate < 30) return; // Throttle to 30ms to maintain performance
      lastUpdate = now;

      if (event.gamma !== null && event.beta !== null) {
        // Safe skip on devices returning static zeros
        if (event.gamma === 0 && event.beta === 0) return;

        const maxTilt = 18;
        const betaVal = Math.abs(event.beta);
        // Smoothly scale down tilt when the phone is placed flat (beta < 40), reaching 0 when fully flat (< 15)
        const flatMultiplier = betaVal >= 40 ? 1 : Math.max(0, (betaVal - 15) / 25);

        // Map gamma [-35, 35] (left/right tilting) to rotateY [-maxTilt, maxTilt] with flat dampening
        const targetRotateY = ((Math.min(Math.max(event.gamma, -35), 35) / 35) * maxTilt) * flatMultiplier;

        // Map beta (centering around natural 60 deg angle) to rotateX [-maxTilt, maxTilt] with flat dampening
        const centeredBeta = event.beta - 60;
        const targetRotateX = (-(Math.min(Math.max(centeredBeta, -30), 30) / 30) * maxTilt) * flatMultiplier;

        setRotateY(targetRotateY);
        setRotateX(targetRotateX);

        // Dynamically shift shiny spot according to actual phone tilt for full physical immersion
        const shineX = 50 + (targetRotateY / maxTilt) * 50;
        const shineY = 50 - (targetRotateX / maxTilt) * 50;
        setShinePos({ x: shineX, y: shineY });
        setIsHovered(true);
      }
    };

    window.addEventListener("deviceorientation", handleOrientation);
    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
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
    requestOrientationPermission();
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
    <div
      onClick={requestOrientationPermission}
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in"
    >
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
