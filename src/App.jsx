import React, { useState, useEffect } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";

export default function App() {
  const [vacations, setVacations] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [editingId, setEditingId] = useState(null);

  const [viewMode, setViewMode] = useState("today"); 
  const [longViewMode, setLongViewMode] = useState("today"); 

  const [formData, setFormData] = useState({
    name: "",
    type: "",
    reason: "",
    startTime: "",
    endTime: "",
    startDate: "",
    endDate: "",
    displayGroup: "long",
  });

  const reasonOptions = ["体調不良の為", "私用の為", "通院の為", "子の行事の為", "子の看病の為", "その他"];
  const typeOptions = ["有給休暇", "時間単位有給", "遅刻", "早退", "外出", "欠勤", "連絡なし", "出張", "外勤務", "連休", "長期休暇", "忌引き"];

  const formatDate = (d) => {
    const date = new Date(d);
    if (isNaN(date)) return d;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  useEffect(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    const vRef = collection(db, "vacations");

    const qSingle = query(
      vRef, 
      where("date", ">=", `${currentMonthPrefix}-01`), 
      where("date", "<=", `${currentMonthPrefix}-31`)
    );
    const qPeriod = query(vRef, where("date", "==", null));

    let unsubSingle = () => {};
    let unsubPeriod = () => {};
    let singleDocs = [];
    let periodDocs = [];

    const updateStates = () => {
      const combined = [...singleDocs, ...periodDocs];
      const uniqueData = Array.from(new Map(combined.map(item => [item.id, item])).values());
      uniqueData.sort((a, b) => {
        if (a.date && b.date) return a.date.localeCompare(b.date);
        return 0;
      });
      setVacations(uniqueData);
    };

    unsubSingle = onSnapshot(qSingle, (snapshot) => {
      singleDocs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      updateStates();
    });

    unsubPeriod = onSnapshot(qPeriod, (snapshot) => {
      periodDocs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      updateStates();
    });

    return () => {
      unsubSingle();
      unsubPeriod();
    };
  }, [selectedDate.getFullYear(), selectedDate.getMonth()]);

  const formatShortJP = (d) => {
    const date = new Date(d);
    if (isNaN(date)) return d;
    const w = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
    return `${date.getMonth() + 1}月${date.getDate()}日（${w}）`;
  };

  const timeOptions = (() => {
    const arr = [];
    const start = 6 * 60;
    const end = 22 * 60 + 50;
    for (let t = start; t <= end; t += 10) {
      const h = String(Math.floor(t / 60)).padStart(2, "0");
      const m = String(t % 60).padStart(2, "0");
      arr.push(`${h}:${m}`);
    }
    return arr;
  })();

  const isDuplicate = (name, date, excludeId = null) => {
    return vacations.some((v) => {
      if (excludeId && v.id === excludeId) return false;
      if ((v.type === "連休" || v.type === "長期休暇" || v.type === "忌引き") && v.displayGroup === "normal") {
        if (v.name !== name) return false;
        const start = new Date(v.startDate);
        const end = new Date(v.endDate);
        const d = new Date(date);
        return d >= start && d <= end;
      }
      return v.name === name && v.date === date;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.type) {
      alert("名前・区分は必須です");
      return;
    }

    try {
      if (formData.type === "連休" || formData.type === "長期休暇" || formData.type === "忌引き") {
        if (!formData.startDate || !formData.endDate) {
          alert("開始日・終了日を入力してください");
          return;
        }
        const s = new Date(formData.startDate);
        const eDate = new Date(formData.endDate);
        if (s > eDate) {
          alert("開始日が終了日より後です");
          return;
        }

        const payload = {
          name: formData.name,
          type: formData.type,
          reason: formData.reason || null,
          startDate: formData.startDate,
          endDate: formData.endDate,
          displayGroup: formData.displayGroup === "normal" ? "normal" : "long",
          date: null,
          startTime: null,
          endTime: null,
          createdAt: new Date(),
        };

        if (editingId) {
          await updateDoc(doc(db, "vacations", editingId), payload);
          setEditingId(null);
        } else {
          await addDoc(collection(db, "vacations"), payload);
        }
      } else {
        const dateStr = formatDate(selectedDate);
        if (isDuplicate(formData.name, dateStr, editingId)) {
          alert("同じ日・同じ名前の記録が既にあります。");
          return;
        }

        const timeRequired = ["時間単位有給", "遅刻", "早退", "外出"].includes(formData.type);

        const payload = {
          ...formData,
          date: dateStr,
          startTime: timeRequired ? formData.startTime : null,
          endTime: timeRequired ? formData.endTime : null,
          startDate: null,
          endDate: null,
          displayGroup: "normal",
          createdAt: new Date(),
        };

        if (editingId) {
          await updateDoc(doc(db, "vacations", editingId), payload);
          setEditingId(null);
        } else {
          await addDoc(collection(db, "vacations"), payload);
        }
      }

      setFormData({
        name: "",
        type: "",
        reason: "",
        startTime: "",
        endTime: "",
        startDate: "",
        endDate: "",
        displayGroup: "long",
      });
    } catch (err) {
      console.error("保存エラー", err);
      alert("保存に失敗しました");
    }
  };

  const handleEdit = (v) => {
    setEditingId(v.id);
    setFormData({
      name: v.name || "",
      type: v.type || "",
      reason: v.reason || "",
      startTime: v.startTime || "",
      endTime: v.endTime || "",
      startDate: v.startDate || "",
      endDate: v.endDate || "",
      displayGroup: v.displayGroup || (v.type === "連休" || v.type === "長期休暇" ? "long" : "normal"),
    });
    if (v.date) setSelectedDate(new Date(v.date));
  };

  const handleDelete = async (id) => {
    if (!window.confirm("この記録を削除しますか？")) return;
    try {
      await deleteDoc(doc(db, "vacations", id));
    } catch (err) {
      console.error("削除失敗", err);
      alert("削除に失敗しました");
    }
  };

  const normalVacations = vacations.filter((v) => v.displayGroup !== "long" && v.date);
  const longVacations = vacations.filter((v) => v.displayGroup === "long" && v.startDate && v.endDate);

  const periodAsNormal = vacations.filter(
    (v) =>
      (v.type === "連休" || v.type === "長期休暇" || v.type === "忌引き") &&
      v.displayGroup === "normal" &&
      v.startDate &&
      v.endDate
  );

  const displayed = (() => {
    const todayStr = formatDate(selectedDate);
    const monthNum = selectedDate.getMonth() + 1;
    let base = normalVacations.slice();
    if (viewMode === "today") {
      base = base.filter((v) => v.date === todayStr);
    } else if (viewMode === "month") {
      base = base.filter((v) => Number(v.date.split("-")[1]) === monthNum);
    }

    const periodIncluded = periodAsNormal.filter((v) => {
      const start = new Date(v.startDate);
      const end = new Date(v.endDate);
      if (viewMode === "today") {
        const d = new Date(todayStr);
        return d >= start && d <= end;
      }
      if (viewMode === "month") {
        return (
          start.getMonth() + 1 === monthNum ||
          end.getMonth() + 1 === monthNum ||
          (start.getMonth() + 1 < monthNum && end.getMonth() + 1 > monthNum)
        );
      }
      return false;
    });

    const merged = [...base, ...periodIncluded];

    merged.sort((a, b) => {
      const da = a.date ? new Date(a.date) : new Date(a.startDate);
      const db = b.date ? new Date(b.date) : new Date(b.startDate);
      if (da - db !== 0) return da - db;
      return (a.name || "").localeCompare(b.name || "");
    });

    return merged;
  })();

  const displayedLongVacations = (() => {
    const arr = longVacations.slice().sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    const monthNum = selectedDate.getMonth() + 1;
    if (longViewMode === "today") {
      const today = formatDate(selectedDate);
      return arr.filter((v) => {
        const start = new Date(v.startDate);
        const end = new Date(v.endDate);
        const d = new Date(today);
        return d >= start && d <= end;
      });
    } else if (longViewMode === "month") {
      return arr.filter((v) => {
        const start = new Date(v.startDate);
        const end = new Date(v.endDate);
        return (
          start.getMonth() + 1 === monthNum ||
          end.getMonth() + 1 === monthNum ||
          (start.getMonth() + 1 < monthNum && end.getMonth() + 1 > monthNum)
        );
      });
    }
    return arr;
  })();

  // 🏷️ モダンで優しい色合いに変更
  const getColor = (type) => {
    switch (type) {
      case "時間単位有給": return "#2563eb"; // 綺麗なブルー
      case "遅刻": return "#7c3aed"; // パープル
      case "早退": return "#ea580c"; // オレンジ
      case "外出": return "#0d9488"; // ティール
      case "欠勤": return "#dc2626"; // レッド
      case "連絡なし": return "#4b5563"; // グレー
      case "出張": return "#16a34a"; // グリーン
      case "外勤務": return "#854d0e"; // ブラウン
      case "忌引き": return "#111827"; // ダークグレー
      default: return "#111827";
    }
  };

  // 📝 入力まわりのスタイル（少し高さを出して角を丸く）
  const controlStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 14px",
    fontSize: "14px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    backgroundColor: "#ffffff",
    color: "#334155",
    outline: "none",
    transition: "border-color 0.2s",
  };

  // 🔘 タブ切り替えボタンのスタイル
  const buttonStyle = (mode, current = viewMode) => ({
    marginRight: 8,
    padding: "8px 16px",
    border: "1px solid",
    borderColor: current === mode ? "#2563eb" : "#e2e8f0",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: "500",
    color: current === mode ? "#ffffff" : "#475569",
    backgroundColor: current === mode ? "#2563eb" : "#ffffff",
    cursor: "pointer",
    boxShadow: current === mode ? "0 2px 4px rgba(37, 99, 235, 0.2)" : "none",
  });

  // 📦 白いカード部分の共通スタイル
  const cardStyle = {
    border: "1px solid #e2e8f0", 
    borderRadius: "16px", 
    padding: "24px", 
    background: "#ffffff",
    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)"
  };

  return (
    // 全体の背景を淡いグレーベージュにして、アプリの質感をアップ
    <div style={{ display: "flex", justifyContent: "center", padding: "40px 20px", background: "#f8fafc", minHeight: "100vh", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", gap: 32, width: "100%", maxWidth: 1400 }}>
        
        {/* 左：カレンダー＋フォーム */}
        <div style={{ width: 500, display: "flex", flexDirection: "column", gap: 24, flexShrink: 0 }}>
          <div style={cardStyle}>
            <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: "18px", color: "#1e293b" }}>カレンダー</h3>
            <Calendar onChange={setSelectedDate} value={selectedDate} formatDay={(locale, date) => date.getDate()} />
          </div>

          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: "20px", color: "#1e293b", fontWeight: "bold" }}>{formatShortJP(selectedDate)}</h3>
              <span style={{ fontSize: "14px", padding: "4px 8px", background: editingId ? "#fef3c7" : "#dbeafe", color: editingId ? "#d97706" : "#2563eb", borderRadius: "6px", fontWeight: "bold" }}>
                {editingId ? "編集中" : "新規入力"}
              </span>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <input
                placeholder="名前"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                style={controlStyle}
              />

              <select
                value={formData.type}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData({
                    ...formData,
                    type: val,
                    startTime: "",
                    endTime: "",
                    startDate: "",
                    endDate: "",
                    displayGroup: val === "連休" || val === "長期休暇" ? "long" : formData.displayGroup,
                  });
                }}
                required
                style={controlStyle}
              >
                <option value="">区分を選択してください</option>
                {typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>

              <select
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                style={controlStyle}
              >
                <option value="">理由（任意）</option>
                {reasonOptions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>

              {(formData.type === "連休" || formData.type === "長期休暇" || formData.type === "忌引き") && (
                <>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} required style={controlStyle} />
                    <input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} required style={controlStyle} />
                  </div>

                  <div style={{ background: "#f1f5f9", padding: 12, borderRadius: 8 }}>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: "bold", color: "#475569" }}>表示先</label>
                    <select value={formData.displayGroup} onChange={(e) => setFormData({ ...formData, displayGroup: e.target.value })} style={controlStyle}>
                      <option value="long">長期休暇・連休枠に表示</option>
                      <option value="normal">当日・当月枠に表示</option>
                    </select>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 6, lineHeight: "1.4" }}>
                      ※「体調不良等で長期間休む場合」は「当日・当月枠に表示」を選ぶと、該当期間が当日/当月の一覧に反映されます。
                    </div>
                  </div>
                </>
              )}

              {["時間単位有給", "遅刻", "早退", "外出"].includes(formData.type) && (
                <div style={{ display: "flex", gap: 8 }}>
                  <select value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} required style={controlStyle}>
                    <option value="">開始</option>
                    {timeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <select value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} required style={controlStyle}>
                    <option value="">終了</option>
                    {timeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}

              {formData.type === "外勤務" && (
                <select value={formData.workTime || ""} onChange={(e) => setFormData({ ...formData, workTime: e.target.value })} required style={controlStyle}>
                  <option value="">勤務時間帯を選択</option>
                  <option value="午前中">午前中</option>
                  <option value="午後中">午後中</option>
                  <option value="終日">終日</option>
                </select>
              )}

              <button
                type="submit"
                style={{
                  padding: "12px",
                  fontSize: "16px",
                  fontWeight: "bold",
                  backgroundColor: editingId ? "#d97706" : "#2563eb",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  boxShadow: "0 4px 6px -1px rgba(37, 99, 235, 0.3)",
                  transition: "opacity 0.2s"
                }}
              >
                {editingId ? "変更を更新する" : "この内容で登録する"}
              </button>
            </form>
          </div>
        </div>

        {/* 右：休暇一覧 */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24 }}>
          
          {/* 日付ベース一覧 */}
          <div style={{ ...cardStyle, flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "16px", fontWeight: "bold", color: "#334155" }}>スケジュール一覧</span>
              <div>
                <button style={buttonStyle("today", viewMode)} onClick={() => setViewMode("today")}>当日</button>
                <button style={buttonStyle("month", viewMode)} onClick={() => setViewMode("month")}>当月</button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {displayed.length === 0 && <li style={{ color: "#64748b", textAlign: "center", padding: "40px 0" }}>該当する休暇はありません。</li>}
                {displayed.map((v) => (
                  <li
                    key={v.id}
                    style={{
                      marginBottom: 10,
                      background: "#f8fafc",
                      borderRadius: "10px",
                      padding: "14px 18px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderLeft: `5px solid ${getColor(v.type)}`, // 左側にアクセントカラーの線を配置
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: "bold", color: "#1e293b", fontSize: "15px", display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: "#64748b", fontSize: "13px" }}>
                          {(v.date && formatShortJP(v.date)) || (v.startDate && `${formatShortJP(v.startDate)}〜`)}
                        </span>
                        <span style={{ color: getColor(v.type) }}>{v.name}</span>
                        <span style={{ fontSize: "12px", background: "#e2e8f0", padding: "2px 6px", borderRadius: "4px", color: "#475569" }}>{v.type}</span>
                        {(v.startTime && v.endTime) && <span style={{ fontSize: 13, color: "#475569" }}>⏰ {v.startTime}〜{v.endTime}</span>}
                        {(v.type === "外勤務" && v.workTime) && <span style={{ fontSize: 13, color: "#475569" }}>💼 {v.workTime}</span>}
                      </div>
                      {v.reason && <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>💬 {v.reason}</div>}
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      {v.type === "連絡なし" && (
                        <button onClick={() => handleEdit(v)} style={{ padding: "6px 12px", backgroundColor: "#ef4444", color: "#fff", border: "none", borderRadius: "6px", fontSize: "13px", cursor: "pointer" }}>対応</button>
                      )}
                      <button onClick={() => handleDelete(v.id)} style={{ padding: "6px 12px", backgroundColor: "#ffffff", color: "#e11d48", border: "1px solid #fda4af", borderRadius: "6px", fontSize: "13px", cursor: "pointer" }}>削除</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 長期休暇・連休枠（右下段） */}
          <div style={{ ...cardStyle, maxHeight: 320, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h4 style={{ margin: 0, fontSize: "16px", color: "#1e293b" }}>🌴 長期休暇・連休</h4>
              <div>
                <button style={buttonStyle("today", longViewMode)} onClick={() => setLongViewMode("today")}>当日</button>
                <button style={buttonStyle("month", longViewMode)} onClick={() => setLongViewMode("month")}>当月</button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {displayedLongVacations.length === 0 && <li style={{ color: "#64748b", textAlign: "center", padding: "20px 0" }}>該当する長期休暇はありません。</li>}
                {displayedLongVacations.map((v) => (
                  <li
                    key={v.id}
                    style={{
                      marginBottom: 10,
                      background: "#f0fdf4", // 長期休暇はちょっと爽やかな薄緑に
                      borderRadius: "10px",
                      padding: "12px 16px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderLeft: "5px solid #16a34a"
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: "bold", color: "#14532d", fontSize: "15px" }}>
                        <span style={{ fontSize: "13px", color: "#15803d", marginRight: 8 }}>{formatShortJP(v.startDate)}～{formatShortJP(v.endDate)}</span>
                        {v.name} <span style={{ fontSize: "12px", fontWeight: "normal", color: "#166534" }}>({v.type})</span>
                      </div>
                      {v.reason && <div style={{ fontSize: 13, color: "#166534", marginTop: 2 }}>💬 {v.reason}</div>}
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      {v.type === "連絡なし" && (
                        <button onClick={() => handleEdit(v)} style={{ padding: "6px 12px", backgroundColor: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", fontSize: "13px", cursor: "pointer" }}>編集</button>
                      )}
                      <button onClick={() => handleDelete(v.id)} style={{ padding: "6px 12px", backgroundColor: "#ffffff", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: "6px", fontSize: "13px", cursor: "pointer" }}>削除</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
