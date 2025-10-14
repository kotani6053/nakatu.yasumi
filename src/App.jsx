// src/App.jsx
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
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";

export default function App() {
  const [vacations, setVacations] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [editingId, setEditingId] = useState(null);
  const [viewMode, setViewMode] = useState("today");

  const [formData, setFormData] = useState({
    name: "",
    type: "",
    reason: "",
    startTime: "",
    endTime: "",
    startDate: "",
    endDate: "",
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
    "欠勤",
    "連絡なし",
    "出張",
    "外勤務",
    "連休",
    "長期休暇",
  ];

  useEffect(() => {
    const q = query(collection(db, "vacations"), orderBy("date"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setVacations(data);
    });
    return () => unsubscribe();
  }, []);

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

  const isDuplicate = (name, date, excludeId = null) => {
    return vacations.some((v) => {
      if (excludeId && v.id === excludeId) return false;
      if (v.type === "連休" || v.type === "長期休暇") {
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

        if (editingId) {
          const ref = doc(db, "vacations", editingId);
          await updateDoc(ref, {
            name: formData.name,
            type: formData.type,
            reason: formData.reason || null,
            startDate: formData.startDate,
            endDate: formData.endDate,
          });
          setEditingId(null);
        } else {
          await addDoc(collection(db, "vacations"), {
            name: formData.name,
            type: formData.type,
            reason: formData.reason || null,
            startDate: formData.startDate,
            endDate: formData.endDate,
            date: null,
            startTime: null,
            endTime: null,
            createdAt: new Date(),
          });
        }
      } else {
        const dateStr = formatDate(selectedDate);
        if (isDuplicate(formData.name, dateStr, editingId)) {
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
            endDate: null,
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
            createdAt: new Date(),
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
        endDate: "",
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

  const normalVacations = vacations.filter(
    (v) => v.date && v.type !== "連休" && v.type !== "長期休暇"
  );
  const longVacations = vacations.filter(
    (v) => v.type === "連休" || v.type === "長期休暇"
  );

  const displayed = normalVacations.filter((v) => {
    if (viewMode === "today") return v.date === formatDate(selectedDate);
    if (viewMode === "month")
      return Number(v.date.split("-")[1]) === selectedDate.getMonth() + 1;
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
      case "出張":
        return "green";
      case "外勤務":
        return "orange";
      default:
        return "black";
    }
  };

  const controlStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: 8,
    fontSize: 15,
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 40, fontSize: "1.1rem" }}>
      <div style={{ display: "flex", gap: 32, width: "100%", maxWidth: 1400 }}>
        {/* 左カラム */}
        <div style={{ width: 600, display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, background: "#fff" }}>
            <h3>カレンダー</h3>
            <Calendar onChange={setSelectedDate} value={selectedDate} formatDay={(l, d) => d.getDate()} />
          </div>

          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, background: "#fff" }}>
            <h3>{formatShortJP(selectedDate)}</h3>
            <h3>{editingId ? "編集中" : "新規入力"}</h3>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input
                placeholder="名前"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                style={controlStyle}
              />
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                required
                style={controlStyle}
              >
                <option value="">選択してください</option>
                {typeOptions.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <select
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                style={controlStyle}
              >
                <option value="">理由</option>
                {reasonOptions.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>

              {(formData.type === "連休" || formData.type === "長期休暇") && (
                <>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                    style={controlStyle}
                  />
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    required
                    style={controlStyle}
                  />
                </>
              )}

              {formData.type === "時間単位有給" && (
                <>
                  <select
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    required
                    style={controlStyle}
                  >
                    <option value="">開始時間</option>
                    {timeOptions.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                  <select
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    required
                    style={controlStyle}
                  >
                    <option value="">終了時間</option>
                    {timeOptions.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </>
              )}

              <button
                type="submit"
                style={{
                  padding: 10,
                  fontSize: 16,
                  backgroundColor: "#2196F3",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                }}
              >
                {editingId ? "更新" : "登録"}
              </button>
            </form>
          </div>
        </div>

        {/* 右カラム */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24 }}>
          {/* 休暇一覧 */}
          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, background: "#fff", flex: 1, overflowY: "auto" }}>
            <div style={{ marginBottom: 12 }}>
              <button onClick={() => setViewMode("today")} style={{ marginRight: 6, padding: 6 }}>当日</button>
              <button onClick={() => setViewMode("month")} style={{ padding: 6 }}>当月</button>
            </div>

            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {displayed.map((v) => (
                <li
                  key={v.id}
                  style={{
                    marginBottom: 12,
                    borderBottom: "1px solid #eee",
                    paddingBottom: 6,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: "bold", color: getColor(v.type) }}>
                      {v.date && formatShortJP(v.date)} {v.name} ({v.type})
                    </div>
                    {v.reason && <div style={{ fontSize: 13, color: "#555" }}>{v.reason}</div>}
                  </div>

                  <div style={{ display: "flex", gap: 6 }}>
                    {/* 👇 編集ボタンは「連絡なし」のときのみ表示 */}
                    {v.type === "連絡なし" && (
                      <button
                        onClick={() => handleEdit(v)}
                        style={{
                          padding: "4px 8px",
                          backgroundColor: "#2196F3",
                          color: "#fff",
                          border: "none",
                          borderRadius: 4,
                        }}
                      >
                        編集
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(v.id)}
                      style={{
                        padding: "4px 8px",
                        backgroundColor: "#f44336",
                        color: "#fff",
                        border: "none",
                        borderRadius: 4,
                      }}
                    >
                      削除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* 長期休暇・連休 */}
          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, background: "#fff", maxHeight: 200, overflowY: "auto" }}>
            <h4 style={{ marginTop: 0 }}>長期休暇・連休</h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {longVacations.map((v) => (
                <li
                  key={v.id}
                  style={{
                    marginBottom: 12,
                    borderBottom: "1px solid #eee",
                    paddingBottom: 6,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: "bold" }}>
                      {formatShortJP(v.startDate)}～{formatShortJP(v.endDate)} {v.name} ({v.type})
                    </div>
                    {v.reason && <div style={{ fontSize: 13, color: "#555" }}>{v.reason}</div>}
                  </div>

                  <div style={{ display: "flex", gap: 6 }}>
                    {/* 👇 ここも同じく「連絡なし」なら編集可（ただし長期には普通不要） */}
                    {v.type === "連絡なし" && (
                      <button
                        onClick={() => handleEdit(v)}
                        style={{
                          padding: "4px 8px",
                          backgroundColor: "#2196F3",
                          color: "#fff",
                          border: "none",
                          borderRadius: 4,
                        }}
                      >
                        編集
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(v.id)}
                      style={{
                        padding: "4px 8px",
                        backgroundColor: "#f44336",
                        color: "#fff",
                        border: "none",
                        borderRadius: 4,
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
      </div>
    </div>
  );
}
