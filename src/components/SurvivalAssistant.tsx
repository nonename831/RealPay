import React, { useState, useEffect } from "react";
import { Soup, Sparkles, RefreshCw, Plus, CalendarRange, Heart, Trash2, Settings2 } from "lucide-react";

interface FoodOption {
    name: string;
}

const DEFAULT_LUNCH_OPTIONS: FoodOption[] = [
    { name: "Mamak档 / 椰浆饭 Nasi Lemak" },
    { name: "杂饭 / 经济饭 Economy Rice" },
    { name: "点外卖麦当劳 McDonald's" },
    { name: "减肥便利店沙拉" },
    { name: "老板请客 / 团队聚餐" },
    { name: "自己带的爱心便当" },
    { name: "海南鸡饭 Chicken Rice" },
    { name: "不吃了！直接绝食省钱" },
    { name: "砂煲老鼠粉 Claypot Noodles" },
    { name: "萨莉亚 / 意面 Saizeriya" },
    { name: "麻辣香锅 Spicy Stir-fry" }
];

export default function SurvivalAssistant() {
    // ---- Lunch Decider States ----
    const [foodPool, setFoodPool] = useState<FoodOption[]>([]);
    const [spinning, setSpinning] = useState(false);
    const [selectedFood, setSelectedFood] = useState<FoodOption | null>(null);
    const [currentTickName, setCurrentTickName] = useState("");

    // Custom Addition Manager Toggle State
    const [showManager, setShowManager] = useState(false);
    const [newFoodName, setNewFoodName] = useState("");

    useEffect(() => {
        try {
            // Load custom food pool
            const storedFood = localStorage.getItem("realpay_food_pool_v4");
            if (storedFood) {
                setFoodPool(JSON.parse(storedFood));
            } else {
                setFoodPool(DEFAULT_LUNCH_OPTIONS);
                localStorage.setItem("realpay_food_pool_v4", JSON.stringify(DEFAULT_LUNCH_OPTIONS));
            }
        } catch { }
    }, []);

    const handleSpinLunch = () => {
        if (spinning) return;

        // Check if food pool contains any items
        if (foodPool.length === 0) {
            alert("候选卡池为空！请先在下方添加美食。");
            return;
        }

        setSpinning(true);
        setSelectedFood(null);

        let counter = 0;
        const totalTicks = 20;

        const interval = setInterval(() => {
            const randomIndex = Math.floor(Math.random() * foodPool.length);
            setCurrentTickName(foodPool[randomIndex].name);

            counter++;
            if (counter >= totalTicks) {
                clearInterval(interval);

                // Directly find a random choice from our pool without repetition check
                const finalChoice = foodPool[Math.floor(Math.random() * foodPool.length)];
                setSelectedFood(finalChoice);
                setSpinning(false);
            }
        }, 70);
    };

    // Add customized dish
    const handleAddCustomFood = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newFoodName.trim()) return;

        const newObj: FoodOption = {
            name: newFoodName.trim()
        };

        const updatedPool = [newObj, ...foodPool];
        setFoodPool(updatedPool);
        localStorage.setItem("realpay_food_pool_v4", JSON.stringify(updatedPool));

        setNewFoodName("");
        // Focus selected item
        setSelectedFood(newObj);
    };

    // Delete a food item
    const handleDeleteFood = (nameToDelete: string) => {
        const updatedPool = foodPool.filter(f => f.name !== nameToDelete);
        setFoodPool(updatedPool);
        localStorage.setItem("realpay_food_pool_v4", JSON.stringify(updatedPool));
        if (selectedFood?.name === nameToDelete) {
            setSelectedFood(null);
        }
    };



    return (
        <div className="p-4 sm:p-5 rounded-2xl bg-neutral-900 border border-neutral-800/80 shadow-xl relative overflow-hidden select-none font-sans flex flex-col gap-3.5">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
                <div className="flex items-center gap-1.5">
                    <CalendarRange className="w-4 h-4 text-emerald-400" />
                    <span className="text-[11px] font-bold tracking-wider text-neutral-300 uppercase">
                        午餐决定器 🍜
                    </span>
                </div>
                <span className="text-[10px] text-neutral-500">
                    决策无忧 · 放空大脑
                </span>
            </div>

            {/* ---- Tab Content: Lunch Roulette ---- */}
            <div className="flex flex-col gap-3">
                <div className="bg-neutral-950 border border-neutral-800/50 rounded-xl p-4 flex flex-col items-center justify-center min-h-[96px] relative overflow-hidden text-center">
                    {spinning ? (
                        <div className="flex flex-col items-center gap-1.5 py-1">
                            <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
                            <span className="text-sm font-black text-neutral-300 animate-pulse font-sans tracking-tight">
                                {currentTickName}
                            </span>
                            <span className="text-[9px] text-neutral-500">正在为你挑选今日惊喜中...</span>
                        </div>
                    ) : selectedFood ? (
                        <div className="flex flex-col items-center gap-2 animate-fade-in py-1">
                            <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full text-[9px] text-emerald-400">
                                <Soup className="w-3 h-3" />
                                <span>精选美食</span>
                            </div>
                            <span className="text-base font-black text-emerald-300 font-sans tracking-tight">
                                {selectedFood.name}
                            </span>
                        </div>
                    ) : foodPool.length === 0 ? (
                        <div className="flex flex-col items-center gap-1.5 py-1 text-center animate-fade-in">
                            <Soup className="w-5 h-5 text-red-500/45 animate-pulse" />
                            <span className="text-xs text-red-400 font-semibold">没有美食选项 🏜️</span>
                            <span className="text-[9px] text-neutral-500">
                                专属卡池已被淘空，请点击右下角齿轮 ⚙️ 添加食物
                            </span>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-1.5 py-1 text-center">
                            <Soup className="w-5 h-5 text-neutral-600" />
                            <span className="text-xs text-neutral-400 font-medium">每天中午吃什么是本世纪最大难题</span>
                            <span className="text-[9px] text-neutral-500">
                                点击下方绿色按钮，由命运决定！🌟
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={handleSpinLunch}
                        disabled={spinning || foodPool.length === 0}
                        className="flex-1 py-2.5 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-lg active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ backgroundColor: foodPool.length === 0 ? "rgb(38, 38, 38)" : "rgb(16, 185, 129)" }}
                    >
                        <Sparkles className="w-4 h-4" />
                        <span>{foodPool.length === 0 ? "暂无选项可选" : "听天由命 (随机抽取午餐)"}</span>
                    </button>

                    {/* Manage Toggle button */}
                    <button
                        onClick={() => setShowManager(!showManager)}
                        className={`p-2 rounded-xl border transition ${showManager
                                ? "bg-neutral-800 border-neutral-700 text-neutral-100"
                                : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200"
                            }`}
                        title="配置专属美食库"
                    >
                        <Settings2 className="w-4 h-4" />
                    </button>
                </div>

                {/* ---- Expansive Card Options Database Manager ---- */}
                {showManager && (
                    <div className="p-3 bg-neutral-950 border border-neutral-800/80 rounded-xl flex flex-col gap-3 animate-fade-in">
                        <div className="flex items-center justify-between border-b border-neutral-850 pb-1.5">
                            <span className="text-[10px] font-bold text-neutral-400">
                                我的饭谱池库 ({foodPool.length})
                            </span>
                        </div>

                        {/* Grid of existing food database */}
                        <div className="max-h-28 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                            {foodPool.length > 0 ? (
                                foodPool.map((food, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-1 px-2 rounded bg-neutral-900 border border-neutral-800 text-[10px] transition group hover:border-neutral-750">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="text-neutral-300 font-medium truncate">{food.name}</span>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteFood(food.name)}
                                            className="text-neutral-600 hover:text-red-400 p-0.5 transition"
                                            title="废除该候选"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-3 text-[10px] text-neutral-500 italic bg-neutral-900/50 border border-dashed border-neutral-800/80 rounded">
                                    暂无美食选项，快在下方输入并添加一个吧！🍟
                                </div>
                            )}
                        </div>

                        {/* Form to submit customized element */}
                        <form onSubmit={handleAddCustomFood} className="space-y-1.5 border-t border-neutral-850 pt-2 text-[10px]">
                            <div className="text-[9px] font-bold text-neutral-500">添加我经常去吃的外卖或食堂饭：</div>

                            <div className="flex gap-1.5">
                                <input
                                    type="text"
                                    value={newFoodName}
                                    onChange={(e) => setNewFoodName(e.target.value)}
                                    placeholder="美食名称 (例: 猪脚饭, 瓦煲鸡饭)"
                                    className="flex-1 px-2 py-1.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-emerald-500/60"
                                    maxLength={30}
                                    required
                                />
                                <button
                                    type="submit"
                                    className="px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded flex items-center justify-center cursor-pointer select-none"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>

            {/* Footer message */}
            <div className="flex items-center justify-between text-[9px] text-neutral-500 border-t border-neutral-800/60 pt-2.5">
                <span className="flex items-center gap-1">
                    <Heart className="w-2.5 h-2.5 text-neutral-600" />
                    <span>摸鱼最重要的是放空大脑、轻松愉快</span>
                </span>
                <span>拒绝选择困难症 🪐</span>
            </div>
        </div>
    );
}
