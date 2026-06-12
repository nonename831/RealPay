import { useEffect, useState } from "react";
import { AppSettings, WeatherData } from "../types";
import { storage } from "../utils/storage";

interface WeatherWidgetProps {
  settings: AppSettings;
}

const WEATHER_CACHE_KEY = "realpay_weather_v3";
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export default function WeatherWidget({ settings }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCoordinates = (): Promise<{ latitude: number; longitude: number; name: string }> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ latitude: 1.4927, longitude: 103.7414, name: "JB" });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            name: "当前定位"
          });
        },
        (err) => {
          console.warn("[RealPay] Geolocation disabled or failed:", err.message);
          resolve({ latitude: 1.4927, longitude: 103.7414, name: "JB" });
        },
        { timeout: 5000, enableHighAccuracy: false }
      );
    });
  };

  const getCityName = async (lat: number, lon: number): Promise<string> => {
    try {
      const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=zh`);
      if (res.ok) {
        const data = await res.json();
        const city = data.city || data.locality || data.principalSubdivision;
        if (city) {
          return city.replace("市", "");
        }
      }
    } catch (e) {
      console.warn("[RealPay] Failed reverse-geocoding city name:", e);
    }
    return "当前位置";
  };

  const fetchWeather = async (force = false) => {
    // Check cache
    const cached = storage.get<WeatherData | null>(WEATHER_CACHE_KEY, null);
    if (!force && cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
      setWeather(cached);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // 1. Determine local coordinates dynamically
      const coords = await getCoordinates();
      let locationName = coords.name;

      if (coords.latitude !== 1.4927 || coords.longitude !== 103.7414) {
        locationName = await getCityName(coords.latitude, coords.longitude);
      } else {
        locationName = "JB";
      }

      // 2. Query open-meteo using local coordinates & auto timezone detection
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code&timezone=auto`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("API Network error");
      const data = await response.json();

      const current = data.current;
      const newWeather: WeatherData = {
        temp: Math.round(current.temperature_2m),
        code: current.weather_code,
        feelsLike: Math.round(current.apparent_temperature),
        humidity: current.relative_humidity_2m,
        timestamp: Date.now(),
        locationName,
      };

      storage.set(WEATHER_CACHE_KEY, newWeather);
      setWeather(newWeather);
    } catch (err) {
      console.log("[RealPay] Weather fallback to warm Johor Bahru afternoon template:", err);
      const fallbackWeather: WeatherData = {
        temp: 31,
        code: 2, // partly cloudy / 局部多云
        feelsLike: 34,
        humidity: 78,
        timestamp: Date.now(),
        locationName: "JB · 默认",
      };
      setWeather(fallbackWeather);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getEmoji = (code: number) => {
    const h = new Date().getHours();
    const isNight = h >= 19 || h < 6;

    if (isNight) return "🌙";

    if (code === 0) return "☀️";
    if (code <= 2) return "⛅";
    if (code <= 3) return "☁️";
    if (code <= 49) return "🌫";
    if (code <= 59) return "🌦";
    if (code <= 69) return "🌧";
    if (code <= 79) return "❄️";
    if (code <= 82) return "🌧";
    if (code <= 99) return "⛈";
    return "🌤";
  };

  const getDesc = (code: number) => {
    const h = new Date().getHours();
    const isNight = h >= 19 || h < 6;

    if (code === 0) return isNight ? "晴夜" : "晴天";
    if (code <= 2) return isNight ? "多云夜" : "局部多云";
    if (code <= 3) return "多云";
    if (code <= 49) return "有雾";
    if (code <= 59) return "毛毛雨";
    if (code <= 69) return "下雨";
    if (code <= 79) return "下雪";
    if (code <= 82) return "阵雨";
    if (code <= 99) return "雷雨";
    return isNight ? "夜间晴朗" : "晴间多云";
  };

  const getLunchAdvice = () => {
    if (!weather) return { text: "天气加载中", type: "neutral" };

    const code = weather.code;
    const isRaining = code >= 51;
    const isVeryHot = weather.temp >= 34;

    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const currentHour = now.getHours();
    const isNight = currentHour >= 19 || currentHour < 6;

    if (isNight) {
      if (isRaining) {
        return { text: "🌧 夜雨绵绵，出门注意防雨保暖", type: "warn" };
      }
      if (currentHour >= 19 && currentHour < 21) {
        return { text: "🍽 晚饭时间！犒劳一下辛苦的自己", type: "go" };
      }
      return { text: "💤 夜深啦，早点休息不要熬夜哦", type: "go" };
    }

    const [lsH, lsM] = settings.lunchStart.split(":").map(Number);
    const [leH, leM] = settings.lunchEnd.split(":").map(Number);
    const lunchStartMins = (lsH || 13) * 60 + (lsM || 0);
    const lunchEndMins = (leH || 14) * 60 + (leM || 0);

    const [tsH, tsM] = settings.startTime.split(":").map(Number);
    const startMins = (tsH || 9) * 60 + (tsM || 0);

    const [teH, teM] = settings.endTime.split(":").map(Number);
    const endMins = (teH || 18) * 60 + (teM || 0);
    const rainWarningMins = endMins - 60; // One hour before clocking off

    const twoHoursBeforeLunch = lunchStartMins - 120;

    // 1. Before Work Hours (做工前几个小时显示别的：早餐、通勤、打卡准备)
    if (nowMins < startMins) {
      if (isRaining) {
        return { text: "🌧 早上正在下雨，出门记得带好雨伞，路面湿滑，路上驾车骑车特别注意安全哦！", type: "warn" };
      }
      if (nowMins < startMins - 120) {
        return { text: "🌅 新的一天开始啦！吃个香喷喷的早餐，给自己注入能量，晚点开开心心去上班", type: "go" };
      }
      return { text: "🚗 准备去上班啦！提前出门避开早高峰，开开心心去搬砖不迟到", type: "go" };
    }

    // 2. Early Work Time (刚开始做工，距离午饭还早，不显示外卖，显示专注打拼)
    if (nowMins >= startMins && nowMins < twoHoursBeforeLunch) {
      if (isVeryHot) {
        return { text: "💧 努力工作中！早晨天气有些热，记得多喝水、保持清醒专注哦~", type: "go" };
      }
      return { text: "💻 元气开工状态！理清今日的事情清单，打好底子，效率翻倍", type: "go" };
    }

    // 3. 2 Hours Before Lunch (吃饭前两小时，开始显示外卖和吃饭相关的建议)
    if (nowMins >= twoHoursBeforeLunch && nowMins < lunchStartMins) {
      if (isRaining) {
        return { text: "☔ 还有两小时到午休，外面下着雨，中午建议提早叫个外卖避雨吃饭", type: "nah" };
      }
      if (isVeryHot) {
        return { text: "🥵 中午快到了，外面太阳开始毒辣，建议点外卖在空调房舒适进餐", type: "nah" };
      }
      return { text: "✓ 还有不到两小时就午休啦，今天天气挺好，中午跟同事一起出去吃顿好的吧", type: "go" };
    }

    // 4. During Lunch Break
    if (nowMins >= lunchStartMins && nowMins < lunchEndMins) {
      if (isRaining) {
        return { text: "🌧 外面正在下雨，午休安心在室内吃个外卖休息吧", type: "nah" };
      }
      if (isVeryHot) {
        return { text: "🥵 午休时间！外面烈日炎炎，千万注意防暑，多吹吹冷气", type: "nah" };
      }
      return { text: "✓ 吃饱喝足，可以走动放松一下。午休充电完毕，下午更有火力", type: "go" };
    }

    // 5. Afternoon Focus (After Lunch, Before the Final Work Hour)
    if (nowMins >= lunchEndMins && nowMins < rainWarningMins) {
      if (isRaining) {
        return { text: "🌧 外面还下着阵雨，幸好在舒适的室内，安心摸鱼工作吧", type: "nah" };
      }
      if (isVeryHot) {
        return { text: "🥤 下午天气闷热，来杯冰凉饮品或多喝温水，消暑降温提提神", type: "go" };
      }
      return { text: "☕ 下午时段，伸个懒腰，喝杯咖啡清醒一下，把今天的事情漂亮地收个尾", type: "go" };
    }

    // 6. One Hour Before Clocking Off
    if (nowMins >= rainWarningMins && nowMins < endMins) {
      if (isRaining) {
        return { text: "🌂 马上要下班啦！天空在落雨，离家返程路上戴好雨具、注意安全", type: "warn" };
      }
      return { text: "🎒 离下班只剩下不到一个小时啦！稍微收拾下背包，准备带着一天的收获回家", type: "go" };
    }

    // 7. After Work Hours (But before 19:00 night time logic)
    if (isRaining) {
      return { text: "🌧 已经安全下班！外面正下雨，路况有些复杂，路上务必放慢车速注意安全", type: "warn" };
    }
    return { text: "✨ 下班啦！抛开工作的繁重与喧嚣，回家做自己喜欢的事，享受大好时光吧", type: "go" };
  };

  const advice = getLunchAdvice();
  const currentHour = new Date().getHours();
  const isNightTime = currentHour >= 19 || currentHour < 6;
  const defaultPlaceholder = isNightTime ? "🌙" : "🌤";

  return (
    <div
      className={`weather-card ${loading ? "loading" : ""}`}
      onClick={() => fetchWeather(true)}
    >
      <div className="wx-left">
        <div className="wx-icon">
          {loading ? "⌛" : weather ? getEmoji(weather.code) : defaultPlaceholder}
        </div>
        <div className="wx-info">
          <div className="wx-temp">
            {error ? "—" : weather ? `${weather.temp}°C` : "—"}
          </div>
          <div className="wx-desc">
            {error ? "加载失败" : weather ? `${getDesc(weather.code)} · ${weather.locationName || "JB"}` : "点击加载天气"}
          </div>
        </div>
      </div>

      {weather && !error && (
        <div className="wx-right">
          <div className="wx-feels">体感 {weather.feelsLike}°C</div>
          <div className="wx-humidity">湿度 {weather.humidity}%</div>
          <div className={`wx-lunch ${advice.type}`}>
            {advice.text}
          </div>
        </div>
      )}
    </div>
  );
}
