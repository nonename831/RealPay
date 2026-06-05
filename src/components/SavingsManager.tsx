import React, { useState } from "react";
import { SavingsGoal } from "../types";

interface SavingsManagerProps {
  goals: SavingsGoal[];
  dailySal: number;
  onAddGoal: (goal: Omit<SavingsGoal, "id" | "createdAt">) => void;
  onUpdateGoal: (goal: SavingsGoal) => void;
  onDeleteGoal: (id: string) => void;
}

export default function SavingsManager({
  goals,
  dailySal,
  onAddGoal,
  onUpdateGoal,
  onDeleteGoal,
}: SavingsManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [saved, setSaved] = useState("");

  const [allocateId, setAllocateId] = useState<string | null>(null);
  const [allocateAmount, setAllocateAmount] = useState("");

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedTarget = parseFloat(target);
    if (!name || isNaN(parsedTarget) || parsedTarget <= 0) return;
    onAddGoal({
      name,
      targetAmount: parsedTarget,
      currentSaved: parseFloat(saved) || 0,
    });
    setName("");
    setTarget("");
    setSaved("");
    setIsAdding(false);
  };

  const startEdit = (g: SavingsGoal) => {
    setEditingId(g.id);
    setName(g.name);
    setTarget(g.targetAmount.toString());
    setSaved(g.currentSaved.toString());
    setIsAdding(false);
    setAllocateId(null);
  };

  const saveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    const parsedTarget = parseFloat(target);
    if (!name || isNaN(parsedTarget) || parsedTarget <= 0) return;
    onUpdateGoal({
      id: editingId,
      name,
      targetAmount: parsedTarget,
      currentSaved: parseFloat(saved) || 0,
      createdAt: new Date().toISOString(),
    });
    setEditingId(null);
  };

  const handleAllocateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const g = goals.find((x) => x.id === allocateId);
    if (!g) return;
    const toAdd = parseFloat(allocateAmount);
    if (isNaN(toAdd)) return;
    onUpdateGoal({
      ...g,
      currentSaved: Math.min(g.targetAmount, Math.max(0, g.currentSaved + toAdd)),
    });
    setAllocateId(null);
    setAllocateAmount("");
  };

  return (
    <div className="space-y-4">
      {/* Set Goals Form Trigger Row */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-mono tracking-widest uppercase text-neutral-500 font-bold">
          🎯 存钱愿望单 ({goals.length})
        </span>
        <button
          onClick={() => {
            setIsAdding(!isAdding);
            setEditingId(null);
            setAllocateId(null);
          }}
          className="sg-edit-btn"
        >
          {isAdding ? "✕ 收起" : "✏️ 设置新目标"}
        </button>
      </div>

      {/* Goal Creation Form */}
      <div className={`sg-form ${isAdding ? "open" : ""}`} style={{ display: isAdding ? "block" : "none" }}>
        <form onSubmit={handleAddSubmit} className="savings-goal">
          <div className="sg-form-grid">
            <div className="sg-field span2">
              <label>目标名称（例：AirPods / 旅行）</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="AirPods Pro"
              />
            </div>
            <div className="sg-field">
              <label>目标金额 (RM)</label>
              <input
                type="number"
                required
                min="1"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="800"
              />
            </div>
            <div className="sg-field">
              <label>已存 (RM)</label>
              <input
                type="number"
                min="0"
                value={saved}
                onChange={(e) => setSaved(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <button type="submit" className="sg-save">
            添加目标物 ✓
          </button>
        </form>
      </div>

      {/* Goal Editing Form */}
      <div className={`sg-form ${editingId ? "open" : ""}`} style={{ display: editingId ? "block" : "none" }}>
        <form onSubmit={saveEdit} className="savings-goal">
          <div className="sg-form-grid">
            <div className="sg-field span2">
              <label>编辑目标名称</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="sg-field">
              <label>目标金额 (RM)</label>
              <input
                type="number"
                required
                min="1"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </div>
            <div className="sg-field">
              <label>已保存金额 (RM)</label>
              <input
                type="number"
                min="0"
                value={saved}
                onChange={(e) => setSaved(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="flex-1 bg-neutral-800 text-neutral-400 font-semibold border border-neutral-700 py-2 rounded-lg text-xs"
            >
              取消
            </button>
            <button type="submit" className="sg-save flex-1">
              保存更改 ✓
            </button>
          </div>
        </form>
      </div>

      {/* Goal Quick Investment allocation form */}
      <div className={`sg-form ${allocateId ? "open" : ""}`} style={{ display: allocateId ? "block" : "none" }}>
        <form onSubmit={handleAllocateSubmit} className="savings-goal">
          <div className="sg-field">
            <label>存入/取出 金额 (正数代表存，负数代表取出。例: 50 或 -20)</label>
            <div className="flex gap-2 mt-1">
              <input
                type="number"
                required
                step="any"
                value={allocateAmount}
                onChange={(e) => setAllocateAmount(e.target.value)}
                placeholder="RM 0.00"
                className="flex-1"
                style={{
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  color: "var(--text)",
                  fontFamily: "var(--mono)",
                  fontSize: "14px",
                  padding: "8px 10px",
                  outline: "none",
                }}
              />
              <button
                type="submit"
                className="bg-purple-400 text-black font-semibold text-xs px-4 rounded-lg outline-none"
              >
                确认
              </button>
              <button
                type="button"
                onClick={() => setAllocateId(null)}
                className="bg-neutral-850 text-neutral-450 text-xs px-3 border border-neutral-800 rounded-lg"
              >
                取消
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* List of Wishlist goals */}
      {goals.length === 0 ? (
        <div className="savings-goal">
          <div className="sg-empty">还没有设置目标 · 点击右上角开始</div>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map((g) => {
            const ratio = g.targetAmount > 0 ? g.currentSaved / g.targetAmount : 0;
            const pct = Math.min(100, Math.max(0, ratio * 100));
            const remaining = Math.max(0, g.targetAmount - g.currentSaved);
            const daysLeft = dailySal > 0 ? Math.ceil(remaining / dailySal) : 0;

            return (
              <div key={g.id} className="savings-goal">
                <div className="sg-head">
                  <span className="sg-label">存钱目标</span>
                  <div className="flex items-center gap-2 select-none">
                    <button
                      type="button"
                      onClick={() => {
                        setAllocateId(g.id);
                        setEditingId(null);
                        setIsAdding(false);
                      }}
                      className="text-[10px] font-mono text-purple-400 border border-purple-500/10 hover:border-purple-400 px-2 py-0.5 rounded-full"
                    >
                      💰 充能
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(g)}
                      className="text-[10px] font-mono text-emerald-400 border border-emerald-500/10 hover:border-emerald-400 px-2 py-0.5 rounded-full"
                    >
                      ✏️ 编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteGoal(g.id)}
                      className="text-[10px] font-mono text-rose-405 border border-red-500/10 hover:border-red-400 px-2 py-0.5 rounded-full"
                    >
                      🗑️ 删除
                    </button>
                  </div>
                </div>

                <div className="sg-item-name">
                  {g.name}
                  {pct >= 100 && (
                    <span className="ml-2 font-mono text-[10px] font-bold text-green-400">
                      (达成! 🎉)
                    </span>
                  )}
                </div>

                <div className="sg-track">
                  <div 
                    className="sg-fill" 
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="sg-meta">
                  <span className="sg-days">
                    {remaining > 0 ? `还需 ${daysLeft} 个工作日` : "目标达成！"}
                  </span>
                  <span className="sg-total">
                    已存 RM {g.currentSaved.toFixed(2)} / RM {g.targetAmount.toFixed(2)} ({pct.toFixed(0)}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
