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

  const reasonOptions = [
    "体調不良の為",
    "私用の為",
    "通院の為",
    "子の行事の為",
    "子の看病の為",
    "その他",
  ];

  const typeOptions = [
    "有給休暇",
    "時間単位有給",
    "遅刻",
    "早退",
    "外出",
    "欠勤",
    "連絡なし",
    "出張",
    "外勤務",
    "連休",
    "長期休暇",
    "忌引き",
  ];

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

  const getBadgeStyle = (type) => {
    let base = {
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: "4px",
      fontSize: "12px",
      fontWeight: "bold",
    };
    switch (type) {
      case "有給休暇": 
        return { ...base, backgroundColor: "#e0f2fe", color: "#0369a1" };
      case "時間単位有給": 
        return { ...base, backgroundColor: "#e0f2fe", color: "#0369a1" };
      case "遅刻": case "早退": case "外出": 
        return { ...base, backgroundColor: "#fef3c7", color: "#b45309" };
      case "欠勤": case "連絡なし": 
        return { ...base, backgroundColor: "#fee2e2", color: "#b91c1c" };
      case "出張": case "外勤務": 
        return { ...base, backgroundColor: "#dcfce7", color: "#15803d" };
      default: 
        return { ...base, backgroundColor: "#f1f5f9", color: "#475569" };
    }
  };

  const controlStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    fontSize: "14px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    backgroundColor: "#fff",
    color: "#0f172a",
    outline: "none",
  };

  const buttonStyle = (mode, current) => ({
    padding: "6px 16px",
    border: "none",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: "600",
    color: current === mode ? "#fff" : "#475569",
    backgroundColor: current === mode ? "#1e40af" : "#f1f5f9",
    cursor: "pointer",
  });

  const cardStyle = {
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    padding: "24px",
    background: "#fff",
    boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
    boxSizing: "border-box",
  };

  const sectionTitleStyle = {
    marginTop: 0,
    marginBottom: "16px",
    fontSize: "16px",
    fontWeight: "700",
    color: "#0f172a",
  };

  return (
    <div style={{ backgroundColor: "#f8fafc", minHeight: "100vh", padding: "40px 20px", fontFamily: "'Noto Sans JP', sans-serif", boxSizing: "border-box" }}>
      {/* 全体の高さを完全に揃えるコンテナ設定 */}
      <div style={{ display: "flex", gap: "24px", width: "100%", maxWidth: "1440px", margin: "0 auto", alignItems: "stretch", height: "740px" }}>
        
        {/* 1. 左カラム：休暇入力フォーム */}
        <div style={{ width: "320px", ...cardStyle, height: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }}>
            <span style={{ fontSize: "14px", color: "#64748b", fontWeight: "500" }}>選択中の日付</span>
            <span style={{ fontSize: "14px", color: "#475569", fontWeight: "700" }}>{editingId ? "状態: 編集中" : "状態: 新規"}</span>
          </div>
          <h2 style={{ marginTop: 0, marginBottom: "20px", fontSize: "18px", color: "#0f172a", fontWeight: "700", borderBottom: "2px solid #e2e8f0", paddingBottom: "10px" }}>
            {formatShortJP(selectedDate)}
          </h2>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: "600", color: "#334155" }}>お名前</label>
              <input
                placeholder="例: 山田 太郎"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                style={controlStyle}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: "600", color: "#334155" }}>休暇区分</label>
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
                <option value="">選択してください</option>
                {typeOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: "600", color: "#334155" }}>理由（任意）</label>
              <select
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                style={controlStyle}
              >
                <option value="">理由を選択</option>
                {reasonOptions.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {(formData.type === "連休" || formData.type === "長期休暇" || formData.type === "忌引き") && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", backgroundColor: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "4px", fontSize: "12px", color: "#475569" }}>開始日 〜 終了日</label>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      required
                      style={{ ...controlStyle, padding: "6px" }}
                    />
                    <span style={{ color: "#64748b" }}>〜</span>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      required
                      style={{ ...controlStyle, padding: "6px" }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "4px", fontSize: "12px", color: "#475569" }}>表示先</label>
                  <select
                    value={formData.displayGroup}
                    onChange={(e) => setFormData({ ...formData, displayGroup: e.target.value })}
                    style={{ ...controlStyle, padding: "6px" }}
                  >
                    <option value="long">長期休暇・連休枠に表示</option>
                    <option value="normal">当日・当月枠に表示</option>
                  </select>
                </div>
              </div>
            )}

            {["時間単位有給", "遅刻", "早退", "外出"].includes(formData.type) && (
              <div style={{ display: "flex", gap: "8px", backgroundColor: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", marginBottom: "4px", fontSize: "12px", color: "#475569" }}>開始</label>
                  <select
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    required
                    style={{ ...controlStyle, padding: "6px" }}
                  >
                    <option value="">時間</option>
                    {timeOptions.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", marginBottom: "4px", fontSize: "12px", color: "#475569" }}>終了</label>
                  <select
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    required
                    style={{ ...controlStyle, padding: "6px" }}
                  >
                    <option value="">時間</option>
                    {timeOptions.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {formData.type === "外勤務" && (
              <div style={{ backgroundColor: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "12px", color: "#475569" }}>勤務時間帯</label>
                <select
                  value={formData.workTime || ""}
                  onChange={(e) => setFormData({ ...formData, workTime: e.target.value })}
                  required
                  style={{ ...controlStyle, padding: "6px" }}
                >
                  <option value="">選択してください</option>
                  <option value="午前中">午前中</option>
                  <option value="午後中">午後中</option>
                  <option value="終日">終日</option>
                </select>
              </div>
            )}

            <button
              type="submit"
              style={{
                marginTop: "10px",
                padding: "12px",
                fontSize: "15px",
                fontWeight: "700",
                backgroundColor: "#1e40af",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                boxShadow: "0 2px 4px 0 rgba(30, 64, 175, 0.2)",
              }}
            >
              {editingId ? "変更を更新する" : "この内容で登録する"}
            </button>
          </form>
        </div>

        {/* 2. 中央カラム：休暇者一覧 */}
        <div style={{ flex: 1, ...cardStyle, height: "100%", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "1px solid #e2e8f0", paddingBottom: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#0f172a" }}>休暇者一覧</h3>
            <div style={{ display: "flex", gap: "4px", backgroundColor: "#f1f5f9", padding: "4px", borderRadius: "8px" }}>
              <button style={buttonStyle("today", viewMode)} onClick={() => setViewMode("today")}>当日</button>
              <button style={buttonStyle("month", viewMode)} onClick={() => setViewMode("month")}>当月</button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", paddingRight: "4px" }}>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {displayed.length === 0 && (
                <li style={{ color: "#64748b", textAlign: "center", padding: "40px 0", fontSize: "14px" }}>
                  該当する休暇情報はありません。
                </li>
              )}
              {displayed.map((v) => (
                <li
                  key={v.id}
                  style={{
                    padding: "14px 16px",
                    marginBottom: "10px",
                    borderRadius: "10px",
                    backgroundColor: "#fff",
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    boxShadow: "0 1px 2px 0 rgba(0,0,0,0.02)"
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "13px", fontWeight: "600", color: "#64748b" }}>
                        {(v.date && formatShortJP(v.date)) || (v.startDate && `${formatShortJP(v.startDate)} 〜 ${formatShortJP(v.endDate)}`)}
                      </span>
                      <span style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a" }}>{v.name}</span>
                      <span style={getBadgeStyle(v.type)}>{v.type}</span>

                      {v.startTime && v.endTime && (
                        <span style={{ fontSize: "13px", color: "#475569", backgroundColor: "#f1f5f9", padding: "2px 6px", borderRadius: "4px" }}>
                          {v.startTime} 〜 {v.endTime}
                        </span>
                      )}
                      {v.type === "外勤務" && v.workTime && (
                        <span style={{ fontSize: "13px", color: "#475569", backgroundColor: "#f1f5f9", padding: "2px 6px", borderRadius: "4px" }}>
                          {v.workTime}
                        </span>
                      )}
                    </div>
                    {v.reason && <div style={{ fontSize: "13px", color: "#64748b" }}>理由: {v.reason}</div>}
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    {v.type === "連絡なし" && (
                      <button
                        onClick={() => handleEdit(v)}
                        style={{
                          padding: "6px 12px",
                          fontSize: "13px",
                          backgroundColor: "#fff",
                          color: "#1e40af",
                          border: "1px solid #1e40af",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontWeight: "600"
                        }}
                      >
                        編集
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(v.id)}
                      style={{
                        padding: "6px 12px",
                        fontSize: "13px",
                        backgroundColor: "#fff",
                        color: "#b91c1c",
                        border: "1px solid #fca5a5",
                        borderRadius: "6px",
                        cursor: "pointer"
                      }}
                    >
                      削除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 3. 右カラム：カレンダー(上段) ＋ 長期休暇・連休一覧(下段) */}
        <div style={{ width: "360px", display: "flex", flexDirection: "column", gap: "24px", height: "100%" }}>
          
          {/* 右上：カレンダー */}
          <div style={{ ...cardStyle, flex: "0 0 auto" }}>
            <h3 style={sectionTitleStyle}>カレンダー表示</h3>
            <div className="modern-calendar-wrapper">
              <Calendar 
                onChange={setSelectedDate} 
                value={selectedDate} 
                formatDay={(locale, date) => date.getDate()} 
              />
            </div>
          </div>

          {/* 右下：長期休暇・連休枠 (残りの高さをすべて埋めてスクロール化) */}
          <div style={{ ...cardStyle, flex: "1 1 0%", display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "#0f172a" }}>長期休暇・連休</h3>
              <div style={{ display: "flex", gap: "2px", backgroundColor: "#f1f5f9", padding: "2px", borderRadius: "6px" }}>
                <button style={{ ...buttonStyle("today", longViewMode), padding: "4px 10px", fontSize: "12px" }} onClick={() => setLongViewMode("today")}>当日</button>
                <button style={{ ...buttonStyle("month", longViewMode), padding: "4px 10px", fontSize: "12px" }} onClick={() => setLongViewMode("month")}>当月</button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", paddingRight: "2px" }}>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {displayedLongVacations.length === 0 && (
                  <li style={{ color: "#64748b", fontSize: "13px", textAlign: "center", padding: "20px 0" }}>
                    該当する長期休暇はありません。
                  </li>
                )}
                {displayedLongVacations.map((v) => (
                  <li
                    key={v.id}
                    style={{
                      padding: "10px 12px",
                      marginBottom: "8px",
                      borderRadius: "8px",
                      backgroundColor: "#f8fafc",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                      <span style={{ fontSize: "14px", fontWeight: "700", color: "#0f172a" }}>{v.name}</span>
                      <span style={{ ...getBadgeStyle(v.type), fontSize: "11px" }}>{v.type}</span>
                    </div>
                    <div style={{ fontSize: "12px", color: "#475569", fontWeight: "500" }}>
                      {formatShortJP(v.startDate)} 〜 {formatShortJP(v.endDate)}
                    </div>
                    {v.reason && <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>理由: {v.reason}</div>}
                    
                    <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", marginTop: "6px" }}>
                      {v.type === "連絡なし" && (
                        <button
                          onClick={() => handleEdit(v)}
                          style={{ padding: "2px 8px", fontSize: "11px", backgroundColor: "transparent", color: "#1e40af", border: "1px solid #1e40af", borderRadius: "4px", cursor: "pointer" }}
                        >
                          編集
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(v.id)}
                        style={{ padding: "2px 8px", fontSize: "11px", backgroundColor: "transparent", color: "#b91c1c", border: "1px solid #fca5a5", borderRadius: "4px", cursor: "pointer" }}
                      >
                        削除
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

        </div>

      </div>

      {/* 💅 土日のカラー（赤・青）設定を追記したスタイルシート */}
      <style>{`
        .react-calendar {
          width: 100% !important;
          border: none !important;
          font-family: inherit !important;
          background: transparent !important;
        }
        .react-calendar__navigation button {
          color: #0f172a !important;
          font-weight: 700 !important;
          font-size: 15px !important;
        }
        .react-calendar__navigation button:enabled:hover, .react-calendar__navigation button:enabled:focus {
          background-color: #f1f5f9 !important;
          border-radius: 8px;
        }
        .react-calendar__month-view__weekdays__weekday abbr {
          text-decoration: none !important;
          font-weight: 700 !important;
          font-size: 13px;
        }
        
/* 曜日見出し */
.react-calendar__month-view__weekdays__weekday--sun abbr {
  color: #dc2626 !important; /* 日曜：赤 */
}

.react-calendar__month-view__weekdays__weekday--sat abbr {
  color: #2563eb !important; /* 土曜：青 */
}

/* 日付部分 */
.react-calendar__month-view__days__day--weekend:not(.react-calendar__tile--active) {
  color: inherit !important;
}

/* 日曜日（左端） */
.react-calendar__month-view__days__day:nth-child(7n + 1):not(.react-calendar__tile--active) {
  color: #dc2626 !important;
}

/* 土曜日（右端） */
.react-calendar__month-view__days__day:nth-child(7n):not(.react-calendar__tile--active) {
  color: #2563eb !important;
}

        .react-calendar__tile {
          padding: 12px 8px !important;
          font-size: 14px !important;
          font-weight: 500 !important;
        }
        .react-calendar__tile:enabled:hover, .react-calendar__tile:enabled:focus {
          background-color: #f1f5f9 !important;
          border-radius: 8px !important;
        }
        .react-calendar__tile--now {
          background: #e2e8f0 !important;
          border-radius: 8px !important;
          font-weight: 700 !important;
          color: #0f172a !important;
        }
        .react-calendar__tile--active {
          background: #1e40af !important;
          border-radius: 8px !important;
          color: white !important;
          font-weight: 700 !important;
          box-shadow: 0 2px 4px 0 rgba(30, 64, 175, 0.3);
        }
      `}</style>
    </div>
  );
}
