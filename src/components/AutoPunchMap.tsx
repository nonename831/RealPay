import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { APIProvider, Map, AdvancedMarker, useMap, useMapsLibrary, MapMouseEvent } from "@vis.gl/react-google-maps";
import {
    Search,
    ShieldAlert,
    Navigation,
    Car,
    Building2,
    ChevronDown,
    Trash2,
    Satellite,
    AlertTriangle,
    Info,
    CheckCircle2,
    Bot,
    LocateFixed,
    Layers,
    Copy,
    Check,
} from "lucide-react";
import { AppSettings } from "../types";
import { getDistanceKm, toMins } from "../utils/calculations";

interface AutoPunchMapProps {
    settings: AppSettings;
    onUpdateSettings: (newSettings: AppSettings) => void;
    onTriggerAutoPunch: (type: "in" | "out", reason: string) => void;
}

// ---- Tunable constants (pulled out of the JSX/logic so they're easy to find) ----
const GEOFENCE_RADIUS_KM = 1.0;
const DISTANCE_MATRIX_MIN_INTERVAL_MS = 30_000; // throttle billed Distance Matrix calls
const DISTANCE_MATRIX_MIN_MOVE_KM = 0.05; // also skip re-calling if user barely moved
const MAX_LOG_ENTRIES = 50;
// How far out the proximity bar's scale stretches before it reads as "empty".
// (distance / PROXIMITY_SCALE_FACTOR*radius) -> 0% filled
const PROXIMITY_SCALE_FACTOR = 4;

type LogType = "success" | "info" | "system" | "warn";
type SearchFeedback = { type: "success" | "error" | "info"; msg: string } | null;
interface PunchLog {
    id: string;
    time: string;
    msg: string;
    type: LogType;
}

function nowTime() {
    return new Date().toLocaleTimeString("zh-CN", { hour12: false });
}

// Maps each log type to a consistent icon + color treatment, so the log
// list reads as one visual language instead of ad-hoc emoji.
const LOG_TYPE_STYLES: Record<LogType, { icon: typeof Info; text: string; rail: string }> = {
    success: { icon: CheckCircle2, text: "text-emerald-300", rail: "border-emerald-500/50" },
    info: { icon: Info, text: "text-sky-300", rail: "border-sky-500/50" },
    warn: { icon: AlertTriangle, text: "text-amber-300", rail: "border-amber-500/50" },
    system: { icon: Satellite, text: "text-neutral-400", rail: "border-neutral-700" },
};

export default function AutoPunchMap({
    settings,
    onUpdateSettings,
    onTriggerAutoPunch,
}: AutoPunchMapProps) {
    const API_KEY =
        settings.googleMapsApiKey ||
        (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
        (import.meta as any).env?.GOOGLE_MAPS_PLATFORM_KEY ||
        "";

    const hasValidKey = Boolean(API_KEY) && API_KEY !== "YOUR_API_KEY" && API_KEY.trim() !== "";

    // GPS and status states
    const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [geoError, setGeoError] = useState<string | null>(null);
    const [searchFeedback, setSearchFeedback] = useState<SearchFeedback>(null);
    const [distance, setDistance] = useState<number | null>(null);
    const [roadDistance, setRoadDistance] = useState<string | null>(null);
    const [copiedAddress, setCopiedAddress] = useState(false);

    const [punchLogs, setPunchLogs] = useState<PunchLog[]>([
        {
            id: "init",
            time: nowTime(),
            msg: "通勤提醒监控中（仅本机提醒，非正式考勤），进入 1.0 km 范围时会提示",
            type: "system",
        },
    ]);

    const pushLog = useCallback((msg: string, type: LogType) => {
        setPunchLogs((prev) => [{ id: crypto.randomUUID(), time: nowTime(), msg, type }, ...prev].slice(0, MAX_LOG_ENTRIES));
    }, []);

    // ---- Watch real navigator location ----
    useEffect(() => {
        if (!("geolocation" in navigator)) {
            setGeoError("当前浏览器不支持 HTML5 Geolocation API 定位。");
            return;
        }

        const handleSuccess = (position: GeolocationPosition) => {
            setGeoError(null);
            setUserCoords({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
            });
        };

        const handleError = (error: GeolocationPositionError) => {
            console.warn("Geolocation permission error/blocked:", error.message);
            const msg = "无法获取实时 GPS 位置，请在浏览器或系统中允许获取定位权限。";
            setGeoError(msg);
            pushLog(`获取设备 GPS 定位受阻：${error.message || "权限未授予"}`, "warn");
        };

        navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
            enableHighAccuracy: true,
        });
        const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
            enableHighAccuracy: true,
            // a long maximumAge would be ignored for watchPosition anyway; throttling
            // happens below on the distance-matrix call, not on the geolocation watch itself
        });

        return () => navigator.geolocation.clearWatch(watchId);
        // pushLog is stable (useCallback with empty deps), safe to omit
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const currentLat = userCoords?.lat ?? settings.companyLat ?? 3.14085;
    const currentLng = userCoords?.lng ?? settings.companyLng ?? 101.6932;

    // ---- Straight-line distance (cheap, no API call) ----
    useEffect(() => {
        if (settings.companyLat !== undefined && settings.companyLng !== undefined) {
            setDistance(getDistanceKm(currentLat, currentLng, settings.companyLat, settings.companyLng));
        } else {
            setDistance(null);
        }
    }, [currentLat, currentLng, settings.companyLat, settings.companyLng]);

    // ---- Road distance via DistanceMatrixService (billed — throttled) ----
    const lastMatrixCallRef = useRef<{ time: number; lat: number; lng: number } | null>(null);

    useEffect(() => {
        if (
            settings.companyLat === undefined ||
            settings.companyLng === undefined ||
            !userCoords ||
            typeof google === "undefined" ||
            !google.maps?.DistanceMatrixService
        ) {
            setRoadDistance(null);
            return;
        }

        const last = lastMatrixCallRef.current;
        if (last) {
            const elapsed = Date.now() - last.time;
            const moved = getDistanceKm(currentLat, currentLng, last.lat, last.lng);
            if (elapsed < DISTANCE_MATRIX_MIN_INTERVAL_MS && moved < DISTANCE_MATRIX_MIN_MOVE_KM) {
                return; // skip — too soon and hasn't moved meaningfully
            }
        }

        let cancelled = false;
        const service = new google.maps.DistanceMatrixService();
        lastMatrixCallRef.current = { time: Date.now(), lat: currentLat, lng: currentLng };

        service.getDistanceMatrix(
            {
                origins: [{ lat: currentLat, lng: currentLng }],
                destinations: [{ lat: settings.companyLat, lng: settings.companyLng }],
                travelMode: google.maps.TravelMode.DRIVING,
            },
            (response, status) => {
                if (cancelled) return;
                const element = response?.rows[0]?.elements[0];
                if (status === "OK" && element?.status === "OK" && element.distance) {
                    const text = element.distance.text.replace("km", "公里").replace("m", "米");
                    setRoadDistance(text);
                } else {
                    setRoadDistance(null);
                }
            }
        );

        return () => {
            cancelled = true;
        };
    }, [currentLat, currentLng, settings.companyLat, settings.companyLng, userCoords]);

    // ---- Auto-trigger punch in/out reminder ----
    const lastStateRef = useRef<"inside" | "outside" | null>(null);

    const triggerAutoPunchWithLog = useCallback(
        (type: "in" | "out", reason: string) => {
            onTriggerAutoPunch(type, reason);
            pushLog(
                type === "in" ? `触发提醒：到达 (${reason})` : `触发提醒：离开 (${reason})`,
                type === "in" ? "success" : "info"
            );
        },
        [onTriggerAutoPunch, pushLog]
    );

    useEffect(() => {
        if (!settings.autoPunchEnabled || distance === null) return;

        const isInside = distance <= GEOFENCE_RADIUS_KM;
        const currentState = isInside ? "inside" : "outside";
        if (lastStateRef.current === currentState) return;

        const now = new Date();
        const currentMins = now.getHours() * 60 + now.getMinutes();
        const startMins = toMins(settings.startTime || "09:00");
        const endMins = toMins(settings.endTime || "18:00");
        const timeStr = now.toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit" });

        if (currentState === "inside") {
            const minAllowedInMins = startMins - 60;
            if (currentMins >= minAllowedInMins && currentMins < endMins) {
                triggerAutoPunchWithLog("in", `进入范围 ${distance.toFixed(3)}km`);
            } else if (currentMins < minAllowedInMins) {
                pushLog(`已到附近，但未提醒。当前 ${timeStr} 距离上班 (${settings.startTime || "09:00"}) 还超过 1 小时`, "warn");
            } else {
                pushLog(`已到附近：当前 ${timeStr} 已超下班时间 (${settings.endTime || "18:00"})，不提醒到达`, "warn");
            }
        } else if (lastStateRef.current === "inside") {
            if (currentMins >= endMins) {
                triggerAutoPunchWithLog("out", `离开范围至 ${distance.toFixed(3)}km`);
            } else {
                pushLog(`离开范围：当前 ${timeStr} 未到下班时间 (${settings.endTime || "18:00"})，视为临时外出，未提醒`, "warn");
            }
        }

        lastStateRef.current = currentState;
    }, [settings.autoPunchEnabled, distance, settings.startTime, settings.endTime, triggerAutoPunchWithLog, pushLog]);

    const saveKey = useCallback(
        (val: string) => {
            onUpdateSettings({ ...settings, googleMapsApiKey: val });
        },
        [settings, onUpdateSettings]
    );

    const handleSetCompanyPosition = useCallback(
        (lat: number, lng: number, address?: string) => {
            onUpdateSettings({
                ...settings,
                companyLat: lat,
                companyLng: lng,
                companyAddress: address || `坐标 (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
            });
        },
        [settings, onUpdateSettings]
    );

    const handleCopyAddress = useCallback(() => {
        if (!settings.companyAddress || !navigator.clipboard) return;
        navigator.clipboard
            .writeText(settings.companyAddress)
            .then(() => {
                setCopiedAddress(true);
                window.setTimeout(() => setCopiedAddress(false), 1500);
            })
            .catch(() => {
                /* clipboard permission denied or unavailable — silently ignore */
            });
    }, [settings.companyAddress]);

    if (!hasValidKey) {
        return (
            <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-2xl space-y-4">
                <div className="flex items-start gap-3">
                    <div className="shrink-0 w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                        <ShieldAlert className="w-4.5 h-4.5 text-amber-400" />
                    </div>
                    <div className="space-y-1 min-w-0">
                        <h3 className="text-sm font-semibold text-neutral-100">通勤提醒地图</h3>
                        <p className="text-xs text-neutral-400 leading-relaxed font-sans">
                            需要 <strong className="text-neutral-300 font-medium">Google Maps API Key</strong> 才能显示地图。建议用环境变量
                            / Secrets 配置；下方输入框仅供本机临时调试，不要在生产环境长期使用。
                        </p>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[11px] text-neutral-500 font-medium block">本地临时 API Key（仅调试用）</label>
                    <input
                        type="password"
                        autoComplete="off"
                        placeholder="AIzaSy..."
                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 font-mono"
                        onChange={(e) => saveKey(e.target.value)}
                        value={settings.googleMapsApiKey || ""}
                    />
                </div>

                <div className="bg-neutral-800/50 p-3 rounded-xl text-xs text-neutral-400 leading-relaxed space-y-1.5 font-sans">
                    <p className="font-medium text-neutral-300">推荐配置步骤</p>
                    <p>
                        1. 在{" "}
                        <a
                            href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais"
                            target="_blank"
                            rel="noopener"
                            className="text-amber-400 hover:text-amber-300 hover:underline"
                        >
                            Google Cloud Console
                        </a>{" "}
                        创建 Maps 密钥，并设置 HTTP referrer / API 限制
                    </p>
                    <p>
                        2. 在部署环境的 Settings → Secrets 中新增 <code className="text-neutral-300">GOOGLE_MAPS_PLATFORM_KEY</code>
                    </p>
                    <p>3. 避免把密钥提交进代码仓库或长期存放在 localStorage 中</p>
                </div>
            </div>
        );
    }

    const isInsideRange = distance !== null && distance <= GEOFENCE_RADIUS_KM;

    return (
        // 强制英文：地址建议、地图标签统一显示英文，避免混入中文地名
        // （language 必须设在 APIProvider 这一层，新版 PlaceAutocompleteElement 不支持单独传 language）
        <APIProvider apiKey={API_KEY} version="weekly" language="en">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
                {/* ---- Header: live status only — enable/disable lives in the parent's
             own toggle, so this component must not duplicate that control. ---- */}
                <div className="p-4 sm:p-5 space-y-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div
                            className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${settings.autoPunchEnabled ? "bg-emerald-500/10" : "bg-neutral-800"
                                }`}
                        >
                            <Navigation
                                className={`w-4.5 h-4.5 transition-colors ${settings.autoPunchEnabled ? "text-emerald-400" : "text-neutral-500"
                                    }`}
                            />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-neutral-100 truncate">通勤提醒</h3>
                            <p className="text-[11px] text-neutral-500">
                                {settings.autoPunchEnabled ? `已启用 · ${GEOFENCE_RADIUS_KM.toFixed(1)} km 范围` : "已关闭"}
                            </p>
                        </div>
                    </div>

                    {/* ---- Status grid: GPS + place ---- */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="bg-neutral-800/60 hover:bg-neutral-800 border border-transparent hover:border-neutral-700 transition-colors p-3 rounded-xl space-y-1 min-w-0 font-sans">
                            <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 font-medium">
                                <Satellite className="w-3 h-3" />
                                GPS 状态
                            </div>
                            {userCoords ? (
                                <div className="flex items-center gap-1.5 text-[12px] text-emerald-400 font-medium font-sans">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    定位已获取
                                </div>
                            ) : geoError ? (
                                <div className="text-[12px] text-rose-400 truncate" title={geoError}>
                                    {geoError}
                                </div>
                            ) : (
                                <div className="text-[12px] text-amber-400">正在获取设备定位…</div>
                            )}
                        </div>

                        <div className="bg-neutral-800/60 hover:bg-neutral-800 border border-transparent hover:border-neutral-700 transition-colors p-3 rounded-xl space-y-1 min-w-0 font-sans">
                            <div className="flex items-center justify-between gap-1.5">
                                <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 font-medium">
                                    <Building2 className="w-3 h-3" />
                                    已设置地点
                                </div>
                                {settings.companyAddress && (
                                    <button
                                        type="button"
                                        onClick={handleCopyAddress}
                                        title="复制地址"
                                        className="shrink-0 text-neutral-500 hover:text-emerald-400 transition-colors cursor-pointer"
                                    >
                                        {copiedAddress ? (
                                            <Check className="w-3 h-3 text-emerald-400" />
                                        ) : (
                                            <Copy className="w-3 h-3" />
                                        )}
                                    </button>
                                )}
                            </div>
                            <div className="text-[12px] text-neutral-200 truncate" title={settings.companyAddress || ""}>
                                {settings.companyAddress || <span className="text-neutral-500">未选择，请在下方搜索或点击地图</span>}
                            </div>
                        </div>
                    </div>

                    {/* ---- Distance / geofence status ---- */}
                    {distance !== null ? (
                        <div
                            className={`p-3 rounded-xl border transition-colors space-y-2 font-sans ${isInsideRange ? "bg-emerald-500/10 border-emerald-500/25" : "bg-neutral-800/60 border-neutral-800"
                                }`}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 min-w-0">
                                    <Car className={`w-4 h-4 shrink-0 ${isInsideRange ? "text-emerald-400" : "text-neutral-500"}`} />
                                    <span className="text-[12px] text-neutral-400 truncate">
                                        车程{" "}
                                        <strong
                                            className={`font-mono font-semibold text-sm ml-1 ${isInsideRange ? "text-emerald-300" : "text-neutral-100"
                                                }`}
                                        >
                                            {roadDistance ? roadDistance : "计算中…"}
                                        </strong>
                                    </span>
                                </div>
                                <span
                                    className={`shrink-0 inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${isInsideRange
                                        ? "bg-emerald-500/20 text-emerald-300 font-semibold"
                                        : "bg-neutral-800 text-neutral-500 border border-neutral-700"
                                        }`}
                                >
                                    <span
                                        className={`w-1.5 h-1.5 rounded-full ${isInsideRange ? "bg-emerald-400 animate-pulse" : "bg-neutral-600"
                                            }`}
                                    />
                                    {isInsideRange ? "范围内" : "范围外"}
                                </span>
                            </div>
                            <ProximityBar distance={distance} radius={GEOFENCE_RADIUS_KM} />
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/5 border border-rose-500/15 text-rose-400 text-xs">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            暂未设置地点，请在下方搜索或在地图上点击定位
                        </div>
                    )}
                </div>

                <div className="border-t border-neutral-800" />

                {/* ---- Action area: search + map ---- */}
                <div className="p-4 sm:p-5 space-y-3">
                    <SearchForm onSelectPlace={handleSetCompanyPosition} setSearchFeedback={setSearchFeedback} />

                    {searchFeedback && (
                        <p
                            className={`flex items-center gap-1.5 text-[11px] ${searchFeedback.type === "success"
                                ? "text-emerald-400"
                                : searchFeedback.type === "error"
                                    ? "text-rose-400"
                                    : "text-amber-400/90"
                                }`}
                        >
                            {searchFeedback.type === "success" ? (
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            ) : searchFeedback.type === "error" ? (
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                                <Info className="w-3.5 h-3.5 shrink-0" />
                            )}
                            {searchFeedback.msg}
                        </p>
                    )}

                    <div
                        className={`relative rounded-xl overflow-hidden border bg-neutral-950 h-[230px] sm:h-[270px] transition-colors duration-500 ${isInsideRange ? "border-emerald-500/30" : "border-neutral-800"
                            }`}
                    >
                        <MapController
                            userLat={currentLat}
                            userLng={currentLng}
                            companyLat={settings.companyLat}
                            companyLng={settings.companyLng}
                            effectiveRadius={GEOFENCE_RADIUS_KM}
                            isInside={isInsideRange}
                            onSetCompany={handleSetCompanyPosition}
                        />

                        <MapOverlayControls
                            userLat={currentLat}
                            userLng={currentLng}
                            companyLat={settings.companyLat}
                            companyLng={settings.companyLng}
                        />

                        <MapLegend visible={settings.companyLat !== undefined} />

                        {settings.companyLat === undefined && (
                            <div className="absolute top-2 left-2 right-12 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-900/95 border border-neutral-700 text-[11px] text-neutral-400 pointer-events-none shadow-lg">
                                <Building2 className="w-3.5 h-3.5 shrink-0 text-emerald-405" />
                                点击地图任意位置，选择公司/考勤驻地开始打卡监控
                            </div>
                        )}
                    </div>
                </div>

                <div className="border-t border-neutral-800" />

                {/* ---- Activity log: collapsed by default, secondary information ---- */}
                <details className="group">
                    <summary className="list-none cursor-pointer select-none px-4 sm:px-5 py-3 flex items-center justify-between hover:bg-neutral-800/40 transition-colors">
                        <span className="text-[12px] text-neutral-400 font-medium">
                            活动日志 {punchLogs.length > 0 && <span className="text-neutral-600">· {punchLogs.length}</span>}
                        </span>
                        <ChevronDown className="w-3.5 h-3.5 text-neutral-500 transition-transform duration-200 group-open:rotate-180" />
                    </summary>

                    <div className="px-4 sm:px-5 pb-4 space-y-2">
                        <div className="flex justify-end">
                            <button
                                onClick={() =>
                                    setPunchLogs([{ id: "clear", time: nowTime(), msg: "日志已清空，提醒功能仍在监听中", type: "system" }])
                                }
                                className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-rose-400 transition-colors cursor-pointer"
                            >
                                <Trash2 className="w-3 h-3" />
                                清空
                            </button>
                        </div>
                        <div className="max-h-[160px] overflow-y-auto space-y-1 pr-1">
                            {punchLogs.map((log) => {
                                const style = LOG_TYPE_STYLES[log.type];
                                const Icon = style.icon;
                                return (
                                    <div
                                        key={log.id}
                                        className={`py-1.5 px-2.5 rounded-lg flex items-start gap-2 bg-neutral-800/40 border-l-2 ${style.rail}`}
                                    >
                                        <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${style.text}`} />
                                        <span className="text-[10px] text-neutral-500 font-mono shrink-0 mt-px">{log.time}</span>
                                        <span className={`text-[11px] flex-1 leading-relaxed ${style.text}`}>{log.msg}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </details>

                {/* ---- Footer note ---- */}
                <div className="px-4 sm:px-5 py-3 bg-neutral-800/30 border-t border-neutral-800 font-sans">
                    <p className="text-[11px] text-neutral-500 leading-relaxed flex items-start gap-1.5">
                        <Bot className="w-3.5 h-3.5 mt-0.5 shrink-0 text-neutral-500" />
                        <span>{`仅供个人通勤监控记录，非考勤硬性凭证。定位读取浏览器 GPS定位，进出公司 ${GEOFENCE_RADIUS_KM.toFixed(1)} km 范围内时静默触发打卡。`}</span>
                    </p>
                </div>
            </div>
        </APIProvider>
    );
}

// ---- Proximity bar: visualizes how close the user is to the geofence ----
function ProximityBar({ distance, radius }: { distance: number; radius: number }) {
    const scaleMax = radius * PROXIMITY_SCALE_FACTOR;
    const percent = Math.max(0, Math.min(100, (1 - Math.min(distance, scaleMax) / scaleMax) * 100));
    const isInside = distance <= radius;

    return (
        <div className="h-1.5 w-full rounded-full bg-neutral-900/70 overflow-hidden">
            <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${isInside ? "bg-emerald-400" : "bg-neutral-500"
                    }`}
                style={{ width: `${percent}%` }}
            />
        </div>
    );
}

// ---- Floating map controls: locate me / jump to company / satellite toggle ----
function MapOverlayControls({
    userLat,
    userLng,
    companyLat,
    companyLng,
}: {
    userLat: number;
    userLng: number;
    companyLat?: number;
    companyLng?: number;
}) {
    const map = useMap();
    const [isSatellite, setIsSatellite] = useState(false);

    const goToUser = useCallback(() => {
        if (!map) return;
        map.panTo({ lat: userLat, lng: userLng });
        map.setZoom(16);
    }, [map, userLat, userLng]);

    const goToCompany = useCallback(() => {
        if (!map || companyLat === undefined || companyLng === undefined) return;
        map.panTo({ lat: companyLat, lng: companyLng });
        map.setZoom(16);
    }, [map, companyLat, companyLng]);

    const toggleSatellite = useCallback(() => {
        if (!map) return;
        const next = !isSatellite;
        map.setMapTypeId(next ? "hybrid" : "roadmap");
        setIsSatellite(next);
    }, [map, isSatellite]);

    const btnClass =
        "w-8 h-8 flex items-center justify-center rounded-lg bg-neutral-900/90 border border-neutral-700 text-neutral-300 backdrop-blur-sm shadow-lg transition-all hover:bg-neutral-800 hover:text-emerald-300 hover:border-neutral-600 active:scale-95 disabled:opacity-40 disabled:hover:bg-neutral-900/90 disabled:hover:text-neutral-300 disabled:cursor-not-allowed cursor-pointer";

    return (
        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1.5-overlay">
            <button type="button" title="定位到我" onClick={goToUser} disabled={!map} className={btnClass}>
                <LocateFixed className="w-3.5 h-3.5" />
            </button>

            {companyLat !== undefined && companyLng !== undefined && (
                <button type="button" title="查看公司地点" onClick={goToCompany} disabled={!map} className={btnClass}>
                    <Building2 className="w-3.5 h-3.5" />
                </button>
            )}

            <button
                type="button"
                title={isSatellite ? "切换为地图视图" : "切换为卫星视图"}
                onClick={toggleSatellite}
                disabled={!map}
                className={`${btnClass} ${isSatellite ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/10" : ""}`}
            >
                <Layers className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}

// ---- Map legend: explains the marker colors and the radius circle ----
function MapLegend({ visible }: { visible: boolean }) {
    if (!visible) return null;

    return (
        <div className="absolute bottom-2 left-2 z-10 space-y-1 rounded-lg border border-neutral-700 bg-neutral-900/90 px-2.5 py-1.5 shadow-lg backdrop-blur-sm">
            <div className="flex items-center gap-1.5 text-[10px] text-neutral-400">
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 animate-pulse" />
                我的位置
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-neutral-400">
                <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                公司地点 · 范围线
            </div>
        </div>
    );
}

// ---- Address search ----
function SearchForm({
    onSelectPlace,
    setSearchFeedback,
}: {
    onSelectPlace: (lat: number, lng: number, address: string) => void;
    setSearchFeedback: (feedback: SearchFeedback) => void;
}) {
    const [addressSearch, setAddressSearch] = useState("");
    const placesLib = useMapsLibrary("places");
    const map = useMap();
    const inputRef = useRef<HTMLInputElement>(null);

    // Keep latest callbacks in refs so the DOM-creation effect below doesn't
    // need them in its dependency array. If they were dependencies, any
    // parent re-render that produced a new function reference would tear down
    // and recreate the PlaceAutocompleteElement mid-typing, wiping out
    // whatever the user had already typed into it.
    const onSelectPlaceRef = useRef(onSelectPlace);
    const setSearchFeedbackRef = useRef(setSearchFeedback);
    useEffect(() => {
        onSelectPlaceRef.current = onSelectPlace;
        setSearchFeedbackRef.current = setSearchFeedback;
    }, [onSelectPlace, setSearchFeedback]);

    // Modern Places API element, with a safe fallback to the legacy Autocomplete
    // class for environments where PlaceAutocompleteElement isn't yet available.
    // IMPORTANT: this effect must only depend on [placesLib, map]. It creates a
    // native DOM/web-component input; re-running it removes and recreates that
    // input, which is what was causing typed text to disappear.
    useEffect(() => {
        if (!placesLib || !inputRef.current || !map) return;

        // Direct binding of Google Maps Autocomplete onto our custom dark-styled input field
        const autocomplete = new placesLib.Autocomplete(inputRef.current, {
            fields: ["geometry", "formatted_address", "name"],
        });
        autocomplete.bindTo("bounds", map);

        const listener = autocomplete.addListener("place_changed", () => {
            const place = autocomplete.getPlace();
            if (place.geometry && place.geometry.location) {
                const lat = place.geometry.location.lat();
                const lng = place.geometry.location.lng();
                const addr = place.formatted_address || place.name || "解析地点";
                onSelectPlaceRef.current(lat, lng, addr);
                map.panTo({ lat, lng });
                map.setZoom(16);
                setAddressSearch(addr);
                setSearchFeedbackRef.current({ type: "success", msg: `已定位：${place.name || "所选位置"}` });
            } else {
                setSearchFeedbackRef.current({ type: "error", msg: "未能获取该地点坐标，请点击地图手动标注" });
            }
        });

        return () => {
            google.maps.event.removeListener(listener);
        };
    }, [placesLib, map]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!placesLib || !addressSearch.trim() || !map) {
            if (!placesLib) setSearchFeedback({ type: "info", msg: "Places SDK 正在加载，请稍后再试" });
            return;
        }

        try {
            setSearchFeedback({ type: "info", msg: "正在检索地址…" });

            // Prefer the modern AutocompleteSuggestion + Place API when available
            const AutocompleteSuggestionCtor = (placesLib as any).AutocompleteSuggestion;
            if (AutocompleteSuggestionCtor?.fetchAutocompleteSuggestions) {
                const { suggestions } = await AutocompleteSuggestionCtor.fetchAutocompleteSuggestions({
                    input: addressSearch,
                });
                const first = suggestions?.[0]?.placePrediction;
                if (first) {
                    const place = first.toPlace();
                    await place.fetchFields({ fields: ["displayName", "formattedAddress", "location"] });
                    const loc = place.location;
                    if (loc) {
                        const lat = typeof loc.lat === "function" ? loc.lat() : loc.lat;
                        const lng = typeof loc.lng === "function" ? loc.lng() : loc.lng;
                        onSelectPlace(lat, lng, place.formattedAddress || place.displayName || "解析地点");
                        map.panTo({ lat, lng });
                        map.setZoom(16);
                        setSearchFeedback({ type: "success", msg: `已定位至：${place.displayName || "地点"}` });
                        return;
                    }
                }
                setSearchFeedback({ type: "error", msg: "未能检索到结果" });
                return;
            }

            // Fallback: legacy PlacesService (deprecated by Google, kept for compatibility)
            const service = new google.maps.places.PlacesService(map);
            service.findPlaceFromQuery(
                { query: addressSearch, fields: ["name", "geometry", "formatted_address"] },
                (results, status) => {
                    if (status === google.maps.places.PlacesServiceStatus.OK && results?.[0]) {
                        const matched = results[0];
                        const loc = matched.geometry?.location;
                        if (loc) {
                            onSelectPlace(loc.lat(), loc.lng(), matched.formatted_address || matched.name || "解析地点");
                            map.panTo({ lat: loc.lat(), lng: loc.lng() });
                            map.setZoom(16);
                            setSearchFeedback({ type: "success", msg: `已定位至：${matched.name || "地点"}` });
                        } else {
                            setSearchFeedback({ type: "error", msg: "搜索成功但未返回精确坐标" });
                        }
                    } else {
                        setSearchFeedback({ type: "error", msg: `未能检索到结果 (${status})` });
                    }
                }
            );
        } catch (err: any) {
            console.error(err);
            setSearchFeedback({ type: "error", msg: `检索失败：${err.message || err}` });
        }
    };

    return (
        <form
            onSubmit={handleSearch}
            className="flex items-center rounded-xl border border-neutral-700 bg-neutral-800 overflow-hidden transition-colors focus-within:border-emerald-500/70 focus-within:ring-1 focus-within:ring-emerald-500/30"
        >
            <div className="pl-3.5 pr-1 shrink-0 flex items-center justify-center">
                <Search className="w-3.5 h-3.5 text-neutral-500 pointer-events-none" />
            </div>
            <div className="flex-1 min-w-0">
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="搜索公司地点…"
                    className="w-full pr-3 py-2.5 bg-transparent border-0 text-neutral-200 text-[12px] placeholder:text-neutral-600 focus:outline-none font-sans"
                    value={addressSearch}
                    onChange={(e) => setAddressSearch(e.target.value)}
                />
            </div>
            <button
                type="submit"
                className="shrink-0 self-stretch px-4 border-l border-neutral-700 bg-emerald-500/10 hover:bg-emerald-500/20 active:bg-emerald-500/25 text-emerald-400 text-[12px] font-medium transition-colors cursor-pointer select-none font-sans"
            >
                搜索
            </button>
        </form>
    );
}

// ---- Map controller ----
function MapController({
    userLat,
    userLng,
    companyLat,
    companyLng,
    effectiveRadius,
    isInside,
    onSetCompany,
}: {
    userLat: number;
    userLng: number;
    companyLat?: number;
    companyLng?: number;
    effectiveRadius: number;
    isInside: boolean;
    onSetCompany: (lat: number, lng: number, address?: string) => void;
}) {
    const map = useMap();

    useEffect(() => {
        if (map) map.setCenter({ lat: userLat, lng: userLng });
    }, [map, userLat, userLng]);

    // Geocoder calls are billed and can fire in quick succession (rapid map
    // clicks, fast marker drags). Track an in-flight request token so only the
    // most recent call's result is applied — stale responses are discarded.
    const geocodeRequestIdRef = useRef(0);

    const updateCompanyWithReverseGeocode = useCallback(
        (lat: number, lng: number) => {
            const requestId = ++geocodeRequestIdRef.current;
            try {
                const geocoder = new google.maps.Geocoder();
                geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                    if (geocodeRequestIdRef.current !== requestId) return; // a newer request superseded this one
                    if (status === "OK" && results?.[0]) {
                        onSetCompany(lat, lng, results[0].formatted_address);
                    } else {
                        onSetCompany(lat, lng);
                    }
                });
            } catch (e) {
                console.warn("Reverse geocode failed:", e);
                if (geocodeRequestIdRef.current === requestId) onSetCompany(lat, lng);
            }
        },
        [onSetCompany]
    );

    const handleMapClick = useCallback(
        (ev: MapMouseEvent) => {
            const coords = ev.detail.latLng;
            if (!coords) return;
            updateCompanyWithReverseGeocode(coords.lat, coords.lng);
        },
        [updateCompanyWithReverseGeocode]
    );

    // Stable object reference: only changes when isInside actually flips,
    // instead of on every parent render (an inline object literal would
    // otherwise trigger GeofenceCircle's setOptions effect on every render).
    const circleOptions = useMemo<google.maps.CircleOptions>(
        () => ({
            fillColor: isInside ? "#10b981" : "#f59e0b",
            fillOpacity: 0.12,
            strokeColor: isInside ? "#10b981" : "#f59e0b",
            strokeOpacity: 0.45,
            strokeWeight: 2,
            clickable: false,
        }),
        [isInside]
    );

    return (
        <Map
            defaultCenter={{ lat: userLat, lng: userLng }}
            defaultZoom={14}
            mapId="DEMO_MAP_ID"
            onClick={handleMapClick}
            internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
            style={{ width: "100%", height: "100%" }}
            gestureHandling="greedy"
            disableDoubleClickZoom={true}
            disableDefaultUI={true}
            zoomControl={true}
            clickableIcons={false}
        >
            <AdvancedMarker position={{ lat: userLat, lng: userLng }} title="我的实时 GPS 位置" draggable={false}>
                <div className="relative flex items-center justify-center w-7 h-7">
                    <span className="absolute inset-0 rounded-full bg-emerald-400/50 animate-ping" />
                    <div className="relative flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500 border-2 border-emerald-200 shadow-lg shadow-emerald-900/40">
                        <Navigation className="w-3.5 h-3.5 text-white" fill="currentColor" />
                    </div>
                </div>
            </AdvancedMarker>

            {companyLat !== undefined && companyLng !== undefined && (
                <AdvancedMarker
                    position={{ lat: companyLat, lng: companyLng }}
                    title="公司地点"
                    draggable={true}
                    onDragEnd={(e) => {
                        const next = e.latLng;
                        if (next) updateCompanyWithReverseGeocode(next.lat(), next.lng());
                    }}
                >
                    <div className="relative flex flex-col items-center">
                        <span className="mb-1 whitespace-nowrap rounded border border-neutral-700 bg-neutral-900/90 px-1.5 py-0.5 text-[10px] text-neutral-300 shadow font-sans">
                            公司地点
                        </span>
                        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-rose-500 border-2 border-rose-200 shadow-lg shadow-rose-900/40 cursor-grab active:cursor-grabbing font-sans">
                            <Building2 className="w-3.5 h-3.5 text-white" />
                        </div>
                    </div>
                </AdvancedMarker>
            )}

            {companyLat !== undefined && companyLng !== undefined && (
                <GeofenceCircle
                    center={{ lat: companyLat, lng: companyLng }}
                    radius={effectiveRadius * 1000}
                    options={circleOptions}
                />
            )}
        </Map>
    );
}

// ---- google.maps.Circle React wrapper ----
function GeofenceCircle({
    center,
    radius,
    options,
}: {
    center: google.maps.LatLngLiteral;
    radius: number;
    options?: google.maps.CircleOptions;
}) {
    const map = useMap();
    const circleRef = useRef<google.maps.Circle | null>(null);

    useEffect(() => {
        if (!map) return;
        // Uses center/radius/options from this render's closure for the initial
        // value — correct, since this is precisely "create the circle with
        // whatever props are current right now." Subsequent prop changes are
        // synced by the three effects below, not by re-running this one.
        const circle = new google.maps.Circle({ map, center, radius, ...options });
        circleRef.current = circle;
        return () => {
            circle.setMap(null);
            circleRef.current = null;
        };
        // center/radius/options are intentionally excluded: re-running this
        // effect would destroy and recreate the Circle instance instead of
        // updating it in place.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map]);

    useEffect(() => {
        circleRef.current?.setCenter(center);
    }, [center]);

    useEffect(() => {
        circleRef.current?.setRadius(radius);
    }, [radius]);

    useEffect(() => {
        if (options) circleRef.current?.setOptions(options);
    }, [options]);

    return null;
}
