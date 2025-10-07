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
  doc
} from "firebase/firestore";

export default function App() {
  const [vacations, setVacations] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [formData, setFormData] = useState({
    name: "",
    type: "",
    reason: "",
    startTime: "",
    endTime: ""
  });

  useEffect(() => {
    const q = query(collection(db, "vacations"), orderBy("date"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVacations(data);
    });
    return () => unsubscribe();
  }, []);

  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const getVacationsForDay = (date) =>
    vacations.filter(v => v.date === formatDate(date));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.type) return;

    const duplicate = vacations.some(v =>
      v.date === formatDate(selectedDate) && v.name === formData.name
    );
    if (duplicate) {
      alert("同日の同名の入力はできません。");
      return;
    }

    try {
      await addDoc(collection(db, "vacations"), {
        ...formData,
        date: formatDate(selectedDate),
        startTime: formData.type === "時間単位有給" ? formData.startTime : null,
        endTime: formData.type === "時間単位有給" ? formData.endTime : null,
        createdAt: new Date()
      });
      setFormData({ name: "", type: "", reason: "", startTime: "", endTime: "" });
    } catch (err) {
      console.error("Firestoreへの保存に失敗:", err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("この記録を削除しますか？")) return;
    try {
      await deleteDoc(doc(db, "vacations", id));
    } catch (err) {
      console.error("削除に失敗:", err);
    }
  };

  // 6:00～22:50の10分刻み時間オプション
  const timeOptions = Array.from({ length: (22 - 6 + 1) * 6 }, (_, i) => {
    const totalMinutes = 6 * 60 + i * 10;
    const h = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const m = String(totalMinutes % 60).padStart(2, '0');
    return `${h}:${m}`;
  });

  const typeColor = (type) => {
    if (type === "時間単位有給") return "blue";
    if (type === "欠勤") return "red";
    return "black";
  };

  return (
    <>
      <h1 style={{ textAlign: "center" }}>中津休暇取得者一覧</h1>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2rem", padding: "1rem" }}>
        
        {/* 上段：カレンダー + 全休暇一覧 */}
        <div style={{ display: "flex", gap: "2rem", width: "100%", maxWidth: "900px", alignItems: "flex-start" }}>
          
          {/* カレンダー */}
          <div style={{ flex: 1, minWidth: "300px" }}>
            <Calendar
              onChange={setSelectedDate}
              value={selectedDate}
              formatDay={(locale, date) => date.getDate()}
            />

            <h3 style={{ marginTop: "1rem" }}>
              {selectedDate.getFullYear()}年{selectedDate.getMonth() + 1}月
              {selectedDate.getDate()}日 の予定
            </h3>
            <ul>
              {getVacationsForDay(selectedDate).map(v => (
                <li key={v.id} style={{ color: typeColor(v.type) }}>
                  {v.name} {v.type}{" "}
                  {v.type === "時間単位有給" ? `${v.startTime}〜${v.endTime}` : ""} ({v.reason})
                  <button
                    onClick={() => handleDelete(v.id)}
                    style={{ marginLeft: "0.5rem", color: "red" }}
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* 全休暇一覧 */}
          <div style={{ flex: 1, minWidth: "300px", maxHeight: "500px", overflowY: "auto" }}>
            <h3>全休暇一覧（早い日付順）</h3>
            <ul>
              {[...vacations]
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .map(v => (
                  <li key={v.id} style={{ color: typeColor(v.type) }}>
                    {v.date}：{v.name} {v.type}
                    {v.type === "時間単位有給" ? ` ${v.startTime}〜${v.endTime}` : ""} ({v.reason})
                  </li>
                ))}
            </ul>
          </div>

        </div>

        {/* 下段：入力フォーム */}
        <div style={{ width: "100%", maxWidth: "600px" }}>
          <h4>新規入力</h4>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
            <input
              placeholder="名前"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              required
              style={{ fontSize: "1.1rem", padding: "0.4rem", width: "100%" }}
            />
            <select
              value={formData.type}
              onChange={e => setFormData({ ...formData, type: e.target.value })}
              required
              style={{ fontSize: "1.1rem", padding: "0.4rem", width: "100%" }}
            >
              <option value="">選択してください</option>
              <option value="有給休暇">有給休暇</option>
              <option value="時間単位有給">時間単位有給</option>
              <option value="欠勤">欠勤</option>
            </select>
            <input
              placeholder="理由"
              value={formData.reason}
              onChange={e => setFormData({ ...formData, reason: e.target.value })}
              style={{ fontSize: "1.1rem", padding: "0.4rem", width: "100%" }}
            />

            {formData.type === "時間単位有給" && (
              <>
                <select
                  value={formData.startTime}
                  onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                  required
                  style={{ fontSize: "1.1rem", padding: "0.4rem", width: "100%" }}
                >
                  <option value="">開始時間</option>
                  {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                </select>

                <select
                  value={formData.endTime}
                  onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                  required
                  style={{ fontSize: "1.1rem", padding: "0.4rem", width: "100%" }}
                >
                  <option value="">終了時間</option>
                  {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </>
            )}

            {/* 登録ボタンをボタン感に */}
            <button
              type="submit"
              style={{
                fontSize: "1.1rem",
                padding: "0.6rem",
                width: "100%",
                backgroundColor: "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
                transition: "background-color 0.2s"
              }}
              onMouseOver={e => e.currentTarget.style.backgroundColor = "#45a049"}
              onMouseOut={e => e.currentTarget.style.backgroundColor = "#4CAF50"}
            >
              登録
            </button>
          </form>
        </div>

      </div>
    </>
  );
}
