import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CommissionEntry, AppSettings } from "../types";
import { Plus, Trash2, Percent, DollarSign, ListPlus, Edit2, Check } from "lucide-react";

interface CommissionManagerProps {
    settings: AppSettings;
    commissions: CommissionEntry[];
    todayStr: string;
    onAddCommission: (label: string, amount: number, salesAmount?: number, rate?: number) => void;
    onUpdateCommission: (id: string, label: string, amount: number, salesAmount?: number, rate?: number) => void;
    onDeleteCommission: (id: string) => void;
}

export default function CommissionManager({
    settings,
    commissions,
    todayStr,
    onAddCommission,
    onUpdateCommission,
    onDeleteCommission,
}: CommissionManagerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [calcMode, setCalcMode] = useState<"rate" | "fixed">("rate");

    // Form states
    const [label, setLabel] = useState("");
    const [salesAmount, setSalesAmount] = useState("");
    const [rate, setRate] = useState("");
    const [fixedAmount, setFixedAmount] = useState("");

    const currency = settings.currency || "RM";

    // Filter commissions
    const todayCommissions = commissions.filter((c) => c.date === todayStr);
    const todayTotal = todayCommissions.reduce((sum, c) => sum + c.amount, 0);

    // Auto-calculate rate commission
    const calculatedCommission = React.useMemo(() => {
        if (calcMode !== "rate") return null;
        const s = parseFloat(salesAmount);
        const r = parseFloat(rate);
        if (!isNaN(s) && !isNaN(r)) {
            return (s * r) / 100;
        }
        return 0;
    }, [salesAmount, rate, calcMode]);

    // Handle setting edit state
    const handleStartEdit = (entry: CommissionEntry) => {
        setEditingId(entry.id);
        setLabel(entry.label);
        if (entry.salesAmount !== undefined && entry.rate !== undefined) {
            setCalcMode("rate");
            setSalesAmount(String(entry.salesAmount));
            setRate(String(entry.rate));
            setFixedAmount("");
        } else {
            setCalcMode("fixed");
            setSalesAmount("");
            setRate("");
            setFixedAmount(String(entry.amount));
        }
        setIsOpen(true);
    };

    const handleToggleOpen = () => {
        if (isOpen) {
            setIsOpen(false);
            setEditingId(null);
            setLabel("");
            setSalesAmount("");
            setRate("");
            setFixedAmount("");
        } else {
            setIsOpen(true);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!label.trim()) return;

        let finalAmount = 0;
        let sAmt: number | undefined = undefined;
        let rPct: number | undefined = undefined;

        if (calcMode === "rate") {
            const s = parseFloat(salesAmount);
            const r = parseFloat(rate);
            if (isNaN(s) || isNaN(r) || s < 0 || r < 0) return;
            finalAmount = (s * r) / 100;
            sAmt = s;
            rPct = r;
        } else {
            const f = parseFloat(fixedAmount);
            if (isNaN(f) || f < 0) return;
            finalAmount = f;
        }

        if (finalAmount <= 0) return;

        if (editingId) {
            onUpdateCommission(editingId, label, finalAmount, sAmt, rPct);
        } else {
            onAddCommission(label, finalAmount, sAmt, rPct);
        }

        // Reset fields
        setLabel("");
        setSalesAmount("");
        setRate("");
        setFixedAmount("");
        setEditingId(null);
        setIsOpen(false);
    };

    return (
        <div className="w-full bg-[#141414] border border-neutral-800 rounded-2xl p-4.5 select-none animate-fade-in" id="commission-manager">
            <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <span>💰</span>
                    </div>
                    <div>
                        <h3 className="text-xs font-bold text-neutral-200">佣金 & 提成助手</h3>
                        <p className="text-[10px] text-neutral-500">记入每次成交，与今日奋斗所得同步</p>
                    </div>
                </div>
                <button
                    onClick={handleToggleOpen}
                    className={`px-2.5 py-1.5 rounded-lg border active:scale-95 transition text-[11px] font-bold flex items-center gap-1 cursor-pointer ${editingId
                            ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30"
                            : "bg-[#1a1a1a] hover:bg-neutral-800 text-neutral-300 border-neutral-800 hover:text-white"
                        }`}
                >
                    {editingId ? <Edit2 size={12} /> : <Plus size={12} />}
                    <span>{editingId ? "取消编辑" : isOpen ? "收起" : "记一笔"}</span>
                </button>
            </div>

            {/* Primary summary row */}
            <div className="flex items-center justify-between bg-neutral-900/60 border border-neutral-800/50 rounded-xl px-3.5 py-2.5 mb-3.5">
                <span className="text-[10px] text-neutral-450 font-medium">今日提成总计</span>
                <span className="font-mono text-sm font-bold text-indigo-400 animate-pulse">
                    {currency} {todayTotal.toFixed(2)}
                </span>
            </div>

            {/* Expandable logging form */}
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.form
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onSubmit={handleSubmit}
                        className="overflow-hidden border-b border-neutral-800/30 pb-4 mb-4 space-y-3"
                    >
                        {/* Header info */}
                        {editingId && (
                            <div className="text-[10px] text-amber-400 font-semibold bg-amber-500/5 border border-amber-500/10 rounded-xl px-3 py-1.5 flex items-center gap-1.5">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                正在编辑选中的提成记录
                            </div>
                        )}

                        {/* Memo/Label input */}
                        <div>
                            <label className="block text-[10px] text-neutral-500 font-semibold mb-1">
                                项目 / 客户名称 / 开单物品
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="例如: 销售电脑、理财保单成交、10% 佣金抽成"
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                maxLength={40}
                                className="w-full bg-[#1c1c1c] border border-neutral-850 focus:border-indigo-500/30 rounded-xl px-3 py-2 text-xs text-neutral-200 outline-none transition placeholder-neutral-605"
                            />
                        </div>

                        {/* Toggle calculation types */}
                        <div className="grid grid-cols-2 gap-2 text-center">
                            <button
                                type="button"
                                onClick={() => setCalcMode("rate")}
                                className={`py-2 rounded-xl text-[10px] font-bold border flex items-center justify-center gap-1 cursor-pointer transition ${calcMode === "rate"
                                        ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-400"
                                        : "bg-[#161616] border-neutral-850 hover:bg-[#1a1a1a] text-neutral-400"
                                    }`}
                            >
                                <Percent size={11} />
                                <span>按比例抽成</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setCalcMode("fixed")}
                                className={`py-2 rounded-xl text-[10px] font-bold border flex items-center justify-center gap-1 cursor-pointer transition ${calcMode === "fixed"
                                        ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-400"
                                        : "bg-[#161616] border-neutral-850 hover:bg-[#1a1a1a] text-neutral-400"
                                    }`}
                            >
                                <DollarSign size={11} />
                                <span>记固定金额</span>
                            </button>
                        </div>

                        {/* Fields according to mode */}
                        {calcMode === "rate" ? (
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[10px] text-neutral-500 font-semibold mb-1">
                                        销售金额 ({currency})
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        min="0"
                                        placeholder="0.00"
                                        value={salesAmount}
                                        onChange={(e) => setSalesAmount(e.target.value)}
                                        className="w-full bg-[#1c1c1c] border border-neutral-850 focus:border-indigo-500/30 rounded-xl px-3 py-2 text-xs text-neutral-250 font-mono outline-none transition placeholder-neutral-605"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-neutral-500 font-semibold mb-1">
                                        提成比例 (%)
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        min="0"
                                        max="100"
                                        placeholder="5.0"
                                        value={rate}
                                        onChange={(e) => setRate(e.target.value)}
                                        className="w-full bg-[#1c1c1c] border border-neutral-850 focus:border-indigo-500/30 rounded-xl px-3 py-2 text-xs text-neutral-250 font-mono outline-none transition placeholder-neutral-605"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-[10px] text-neutral-500 font-semibold mb-1">
                                    提成额度 ({currency})
                                </label>
                                <input
                                    type="number"
                                    step="any"
                                    required
                                    min="0"
                                    placeholder="0.00"
                                    value={fixedAmount}
                                    onChange={(e) => setFixedAmount(e.target.value)}
                                    className="w-full bg-[#1c1c1c] border border-neutral-850 focus:border-indigo-500/30 rounded-xl px-3 py-2 text-xs text-neutral-250 font-mono outline-none transition placeholder-neutral-605"
                                />
                            </div>
                        )}

                        {/* Dynamic display helper */}
                        {calcMode === "rate" && calculatedCommission !== null && calculatedCommission > 0 && (
                            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-2.5 text-center text-[10px] text-emerald-400 font-medium">
                                ⚡️ 自动算得：
                                <span className="font-mono text-xs font-bold text-emerald-300">
                                    {currency} {calculatedCommission.toFixed(2)}
                                </span>
                            </div>
                        )}

                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={handleToggleOpen}
                                className="w-1/3 py-2 bg-neutral-900 border border-neutral-850 rounded-xl text-[11px] font-bold text-neutral-400 hover:text-white transition active:scale-[0.98] cursor-pointer"
                            >
                                取消
                            </button>
                            <button
                                type="submit"
                                className={`w-2/3 py-2 text-white rounded-xl text-[11px] font-bold transition active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1 ${editingId ? "bg-amber-600 hover:bg-amber-500" : "bg-indigo-600 hover:bg-indigo-500"
                                    }`}
                            >
                                {editingId ? <Check size={12} /> : <ListPlus size={12} />}
                                <span>{editingId ? "保存修改" : "确认入账"}</span>
                            </button>
                        </div>
                    </motion.form>
                )}
            </AnimatePresence>

            {/* Deals list of Today */}
            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                {todayCommissions.length === 0 ? (
                    <div className="text-center py-4 text-[10px] text-neutral-500">
                        今天还没记录过提成呢。快去成交你的第一笔订单吧！🚀
                    </div>
                ) : (
                    todayCommissions.map((c) => (
                        <div
                            key={c.id}
                            className={`flex items-center justify-between border rounded-xl px-3 py-2 transition group ${editingId === c.id
                                    ? "bg-amber-500/5 border-amber-500/30"
                                    : "bg-neutral-900/40 hover:bg-neutral-900/60 border-neutral-850/40"
                                }`}
                        >
                            <div className="flex-1 min-w-0 pr-2">
                                <div className="text-[11px] font-bold text-neutral-200 truncate" title={c.label}>
                                    {c.label}
                                </div>
                                <div className="text-[9px] text-neutral-500 flex items-center gap-1 mt-0.5 font-mono">
                                    {c.salesAmount && c.rate ? (
                                        <span>
                                            额 {currency} {c.salesAmount.toFixed(0)} @ {c.rate}% 抽成
                                        </span>
                                    ) : (
                                        <span>固定抽成</span>
                                    )}
                                    <span>·</span>
                                    <span>{new Date(c.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <span className="font-mono text-xs font-bold text-indigo-400 mr-1.5">
                                    +{currency} {c.amount.toFixed(2)}
                                </span>

                                {/* Edit Button */}
                                <button
                                    onClick={() => handleStartEdit(c)}
                                    className="p-1 hover:bg-neutral-800 text-neutral-550 hover:text-amber-400 rounded-lg opacity-0 group-hover:opacity-100 transition duration-150 cursor-pointer"
                                    title="编辑提成"
                                >
                                    <Edit2 size={12} />
                                </button>

                                {/* Delete Button */}
                                <button
                                    onClick={() => onDeleteCommission(c.id)}
                                    className="p-1 hover:bg-red-500/10 text-neutral-550 hover:text-red-400 rounded-lg opacity-0 group-hover:opacity-100 transition duration-150 cursor-pointer"
                                    title="删除此笔提成"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
