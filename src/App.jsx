// src/App.jsx
import React, { useState, useEffect, useRef } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  deleteDoc,
  doc,
  updateDoc
} from "firebase/firestore";

export default function App() {
  const [vacations, setVacations] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [editingId, setEditingId] = useState(null);
  const [panelHeight, setPanelHeight] = useState(400); // 一覧の高さを基準に
  const listRef = useRef(null);

  const [formData, setFormData] = useState({
    name: "",
    type: "",
    reason: "",
    startTime: "",
    endTime: "",
    startDate: "",
    endDate: ""
  });

  const reasonOptions = [
    "体調不良の為",
    "私用の為",
    "通院の為",
    "子の行事の為",
    "子の看病の為"
  ];

  const typeOptions = [
    "有給休暇",
    "時間単位有給",
    "欠勤",
    "連絡なし",
    "出張",
    "外勤務",
    "連休",
    "長期休暇"
  ];

  useEffect(() => {
    const q = query(collection(db, "vacations"), orderBy("date"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setVacations(data);
    });
    return () => unsubscribe();
  }, []);

  // 一覧の高さを取得してカレンダー・フォームに反映
  useEffect(() => {
    if (listRef.current) {
      setPanelHeight(listRef.current.offsetHeight);
    }
  }, [listRef, vacations]);

  const formatDate = (d) => {
    const date = new Date(d);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const formatShortJP = (d) => {
    const date = new Date(d);
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

  const isDuplicate = (dateStr, name, excludeId = null) => {
    return vacations.some((v) => {
      if (excludeId && v.id === excludeId) return false;
      return v.date === dateStr && v.name === name;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.type) {
      alert("名前・区分は必須です");
      return;
    }

    try {
      if (formData.type === "連休" || formData.type === "長期休暇") {
        if (!formData.startDate || !formData.endDate) {
          alert("開始日・終了日を正しく入力してください");
          return;
        }
        const s = new Date(formData.startDate);
        const eDate = new Date(formData.endDate);
        if (s > eDate) {
          alert("開始日が終了日より後です");
          return;
        }

        for (let d = new Date(s); d <= eDate; d.setDate(d.getDate() + 1)) {
          const dateStr = formatDate(d);
          if (isDuplicate(dateStr, formData.name, editingId)) continue;

          await addDoc(collection(db, "vacations"), {
            name: formData.name,
            type: formData.type,
            reason: formData.reason || null,
            date: dateStr,
            startTime: null,
            endTime: null,
            startDate: formData.startDate,
            endDate: formData.endDate,
            createdAt: new Date()
          });
        }
      } else {
        const dateStr = formatDate(selectedDate);
        if (isDuplicate(dateStr, formData.name, editingId)) {
          alert("同じ日・同じ名前の記録が既にあります。");
          return;
        }

        if (editingId) {
          const ref = doc(db, "vacations", editingId);
          await updateDoc(ref, {
            name: formData.name,
            type: formData.type,
            reason: formData.reason || null,
            date: dateStr,
            startTime: formData.type === "時間単位有給" ? formData.startTime : null,
            endTime: formData.type === "時間単位有給" ? formData.endTime : null,
            startDate: null,
            endDate: null
          });
          setEditingId(null);
        } else {
          await addDoc(collection(db, "vacations"), {
            name: formData.name,
            type: formData.type,
            reason: formData.reason || null,
            date: dateStr,
            startTime: formData.type === "時間単位有給" ? formData.startTime : null,
            endTime: formData.type === "時間単位有給" ? formData.endTime : null,
            startDate: null,
            endDate: null,
            createdAt: new Date()
          });
        }
      }

      setFormData({
        name: "",
        type: "",
        reason: "",
        startTime: "",
        endTime: "",
        startDate: "",
        endDate: ""
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
      endDate: v.endDate || ""
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

  const [viewMode, setViewMode] = useState("today");
  const displayed = vacations.filter((v) => {
    if (!v.date) return false;
    if (viewMode === "today") return v.date === formatDate(selectedDate);
    if (viewMode === "month") return Number(v.date.split("-")[1]) === selectedDate.getMonth() + 1;
    return true;
  });

  const getColor = (type) => {
    switch (type) {
      case "時間単位有給":
        return "blue";
      case "欠勤":
        return "red";
      case "連絡なし":
        return "gray";
      default:
        return "black";
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 20 }}>
      <div style={{ display: "flex", gap: 24, width: "100%", maxWidth: 1100 }}>
        {/* 左カラム */}
        <div style={{ width: 520, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* カレンダー */}
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: 12,
              height: panelHeight,
              overflow: "visible",
              background: "#fff",
              boxSizing: "border-box"
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>カレンダー</h3>
            <Calendar
              onChange={setSelectedDate}
              value={selectedDate}
              formatDay={(locale, date) => date.getDate()}
            />
          </div>

          {/* 入力フォーム */}
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: 12,
              height: panelHeight,
              background: "#fff",
              boxSizing: "border-box",
              overflow: "auto"
            }}
          >
            <h3 style={{ marginTop: 0 }}>{formatShortJP(selectedDate)}</h3>
            <h3 style={{ marginTop: 4 }}>{editingId ? "編集中" : "新規入力"}</h3>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                placeholder="名前"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={{ padding: "8px", fontSize: 14 }}
                required
              />

              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                style={{ padding: "8px", fontSize: 14 }}
                required
              >
                <option value="">区分を選択</option>
                {typeOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              <select
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                style={{ padding: "8px", fontSize: 14 }}
              >
                <option value="">理由を選択</option>
                {reasonOptions.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              {formData.type === "時間単位有給" && (
                <>
                  <select
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    required
                  >
                    <option value="">開始時間</option>
                    {timeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <select
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    required
                  >
                    <option value="">終了時間</option>
                    {timeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </>
              )}

              {(formData.type === "連休" || formData.type === "長期休暇") && (
                <>
                  <label>開始日</label>
                  <input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} required />
                  <label>終了日</label>
                  <input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} required />
                </>
              )}

              <button
                type="submit"
                style={{
                  marginTop: 6,
                  padding: "10px",
                  background: editingId ? "#28a745" : "#007bff",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontWeight: "600"
                }}
              >
                {editingId ? "更新" : "登録"}
              </button>
            </form>
          </div>
        </div>

        {/* 右カラム：一覧 */}
        <div
          ref={listRef}
          style={{
            flex: 1,
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 12,
            background: "#fff",
            maxHeight: 820,
            overflowY: "auto",
            boxSizing: "border-box"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>全休暇一覧</h3>
            <div>
              <button onClick={() => setViewMode("today")}>当日</button>
              <button onClick={() => setViewMode("month")}>当月</button>
              <button onClick={() => setViewMode("all")}>全体</button>
            </div>
          </div>

          <ul style={{ listStyle: "none", padding: 0, marginTop: 12 }}>
            {displayed
              .sort((a, b) => new Date(a.date) - new Date(b.date))
              .map((v) => (
                <li key={v.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f0f0f0" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{v.name} <span style={{ color: getColor(v.type) }}>{v.type}</span></div>
                    <div style={{ fontSize: 13, color: "#555" }}>
                      {v.date}{v.startDate && v.endDate ? `（${v.startDate}〜${v.endDate}）` : ""}
                      {v.startTime && v.endTime ? ` ${v.startTime}〜${v.endTime}` : ""}
                      {v.reason ? ` 理由：${v.reason}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {v.type === "連絡なし" && (
                      <button onClick={() => handleEdit(v)} style={{ background: "#ffc107", color: "#fff", border: "none", borderRadius: 4, padding: "4px 6px", cursor: "pointer" }}>編集</button>
                    )}
                    <button onClick={() => handleDelete(v.id)} style={{ background: "#dc3545", color: "#fff", border: "none", borderRadius: 4, padding: "4px 6px", cursor: "pointer" }}>削除</button>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
