import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

import { AppSettings } from "../types";

interface GoodsListProps {
  currentEarned: number;
  settings?: AppSettings;
}

interface GoodItem {
  id: string;
  emoji: string;
  name: string;
  defaultPrice: number;
}

const GOODS_TEMPLATES: GoodItem[] = [
  { id: "kopi", emoji: "☕", name: "Kopi", defaultPrice: 3.5 },
  { id: "tea", emoji: "🧋", name: "奶茶", defaultPrice: 7.0 },
  { id: "mee", emoji: "🍜", name: "Mee", defaultPrice: 8.5 },
  { id: "teh", emoji: "🥤", name: "Teh Tarik", defaultPrice: 2.5 },
  { id: "nasi", emoji: "🍱", name: "Nasi", defaultPrice: 7.5 },
  { id: "grab", emoji: "🚗", name: "Grab", defaultPrice: 12.0 },
];

export default function GoodsList({ currentEarned, settings }: GoodsListProps) {
  const [prices, setPrices] = useState<{ [id: string]: number }>(() => {
    try {
      const saved = localStorage.getItem("realpay_prices_v2");
      if (saved) return JSON.parse(saved);
    } catch { }
    return {
      kopi: 3.5,
      tea: 7.0,
      mee: 8.5,
      teh: 2.5,
      nasi: 7.5,
      grab: 12.0,
    };
  });

  const [isEditing, setIsEditing] = useState(false);
  const [tempPrices, setTempPrices] = useState({ ...prices });

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (isEditing && containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsEditing(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isEditing]);

  const savePrices = () => {
    try {
      localStorage.setItem("realpay_prices_v2", JSON.stringify(tempPrices));
    } catch { }
    setPrices(tempPrices);
    setIsEditing(false);
  };

  const getMultiplier = (price: number) => {
    if (currentEarned <= 0) return 0;
    return Math.floor(currentEarned / price);
  };

  return (
    <div
      ref={containerRef}
      className="buy-card transition-all duration-300"
      style={{ borderColor: isEditing ? "#ffffff" : "var(--border)" }}
    >
      <div className="buy-header">
        <span className="buy-title">此刻能买什么</span>
        <button
          onClick={() => {
            setTempPrices({ ...prices });
            setIsEditing(!isEditing);
          }}
          className="buy-edit-btn"
        >
          ✏️ {isEditing ? "关闭编辑" : "编辑价格"}
        </button>
      </div>

      {/* Editor Panel */}
      <AnimatePresence initial={false}>
        {isEditing && (
          <motion.div
            initial={{ height: 0, opacity: 0, marginBottom: 0 }}
            animate={{ height: "auto", opacity: 1, marginBottom: 16 }}
            exit={{ height: 0, opacity: 0, marginBottom: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="price-edit-panel open overflow-hidden"
          >
            <div className="pe-head">
              <span className="pe-title">自定义价格（{settings?.currency || "RM"}）</span>
              <button
                type="button"
                className="pe-close"
                onClick={() => setIsEditing(false)}
              >
                ✕ 关闭
              </button>
            </div>
            <div className="pe-grid">
              {GOODS_TEMPLATES.map((item) => (
                <div key={item.id} className="pe-field">
                  <label>{item.emoji} {item.name}</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={tempPrices[item.id] || item.defaultPrice}
                    onChange={(e) =>
                      setTempPrices({
                        ...tempPrices,
                        [item.id]: Math.max(0.5, parseFloat(e.target.value) || 0.5),
                      })
                    }
                  />
                </div>
              ))}
            </div>
            <button className="pe-save" onClick={savePrices}>
              保存价格 ✓
            </button>
            <div className="pe-hint">价格自动保存到本地 · JB 默认价格已预设</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Buy-items grid */}
      <div className="buy-items">
        {GOODS_TEMPLATES.map((item) => {
          const price = prices[item.id] || item.defaultPrice;
          const count = getMultiplier(price);
          const affordable = count >= 1;

          return (
            <div key={item.id} className={`buy-item ${affordable ? "can" : ""}`}>
              <span className="buy-emoji">{item.emoji}</span>
              <span className="buy-name">{item.name}</span>
              <span className="buy-price">{settings?.currency || "RM"} {price.toFixed(2)}</span>
              <span className={`buy-val ${affordable ? "can" : ""}`}>
                {affordable ? `${count}x` : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
