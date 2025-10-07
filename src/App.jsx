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

  // Firestoreからリアルタイム取得
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

  return (
    <>
      <h1 style={{ textAlign: "center" }}>中津休暇取得者一覧</h1>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2rem", padding: "1rem" }}>
        <Calendar
          onChange={setSelectedDate}
          value={selectedDate}
        />

        <div style={{ flex: 1, width: "100%", maxWidth: "600px" }}>
          <h3>
            {selectedDate.getFullYear()}年{selectedDate.getMonth() + 1}月{selectedDate.getDate()}日 の予定
          </h3>

          <ul>
            {getVacationsForDay(selectedDate).map(v => (
              <li key={v.id}>
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

          <h4>新規入力</h4>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <input
              placeholder="名前"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <select
              value={formData.type}
              onChange={e => setFormData({ ...formData, type: e.target.value })}
              required
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
            />

            {formData.type === "時間単位有給" && (
              <>
                <input
                  type="time"
                  value={formData.startTime}
                  onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                  required
                />
                <input
                  type="time"
                  value={formData.endTime}
                  onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                  required
                />
              </>
            )}

            <button type="submit">登録</button>
          </form>
        </div>
      </div>
    </>
  );
}
