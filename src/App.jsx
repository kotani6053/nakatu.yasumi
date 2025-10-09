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
  updateDoc
} from "firebase/firestore";

export default function App() {
  const [vacations, setVacations] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [editingId, setEditingId] = useState(null); // 編集中のID
  const [formData, setFormData] = useState({
    name: "",
    type: "",
    reason: "",
    startTime: "",
    endTime: ""
  });

  // 日付フォーマット関数
  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  // Firestoreからリアルタイム取得＋過去日削除
  useEffect(() => {
    const q = query(collection(db, "vacations"), orderBy("date"));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const today = new Date();
      const validData = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const recordDate = new Date(data.date);
        if (recordDate < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
          await deleteDoc(doc(db, "vacations", docSnap.id));
        } else {
          validData.push({ id: docSnap.id, ...data });
        }
      }

      setVacations(validData);
    });

    return () => unsubscribe();
  }, []);

  const getVacationsForDay = (date) =>
    vacations.filter((v) => v.date === formatDate(date));

  // 追加 or 更新処理
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.type) return;

    try {
      if (editingId) {
        // 更新
        await updateDoc(doc(db, "vacations", editingId), {
          ...formData,
          date: formatDate(selectedDate),
          startTime: formData.type === "時間単位有給" ? formData.startTime : null,
          endTime: formData.type === "時間単位有給" ? formData.endTime : null,
        });
        setEditingId(null);
      } else {
        // 新規登録
        await addDoc(collection(db, "vacations"), {
          ...formData,
          date: formatDate(selectedDate),
          startTime: formData.type === "時間単位有給" ? formData.startTime : null,
          endTime: formData.type === "時間単位有給" ? formData.endTime : null,
          createdAt: new Date(),
        });
      }

      setFormData({ name: "", type: "", reason: "", startTime: "", endTime: "" });
    } catch (err) {
      console.error("Firestoreへの保存に失敗:", err);
    }
  };

  // 編集ボタン押下時
  const handleEdit = (v) => {
    setEditingId(v.id);
    setSelectedDate(new Date(v.date));
    setFormData({
      name: v.name,
      type: v.type,
      reason: v.reason || "",
      startTime: v.startTime || "",
      endTime: v.endTime || ""
    });
  };

  // 削除処理
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

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          gap: "2rem",
          flexWrap: "wrap",
          padding: "1rem"
        }}
      >
        {/* 左側：カレンダー */}
        <div>
          <Calendar
            onChange={setSelectedDate}
            value={selectedDate}
            formatDay={(locale, date) => date.getDate()}
          />

          {/* 入力フォーム */}
          <div style={{ width: "300px", marginTop: "1.5rem" }}>
            <h4>{editingId ? "編集中" : "新規入力"}</h4>
            <form
              onSubmit={handleSubmit}
              style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}
            >
              <input
                placeholder="名前"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                style={{ fontSize: "1.1rem", padding: "0.4rem" }}
              />
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                required
                style={{ fontSize: "1.1rem", padding: "0.4rem" }}
              >
                <option value="">選択してください</option>
                <option value="有給休暇">有給休暇</option>
                <option value="時間単位有給">時間単位有給</option>
                <option value="欠勤">欠勤</option>
                <option value="連絡なし">連絡なし</option>
                <option value="出張">出張</option>
                <option value="外勤務">外勤務</option>
              </select>
              <input
                placeholder="理由"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                style={{ fontSize: "1.1rem", padding: "0.4rem" }}
              />

              {formData.type === "時間単位有給" && (
                <>
                  <select
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    required
                    style={{ fontSize: "1.1rem", padding: "0.4rem" }}
                  >
                    <option value="">開始時間</option>
                    {Array.from({ length: (22 - 6 + 1) * 6 }, (_, i) => {
                      const h = String(Math.floor(i / 6) + 6).padStart(2, "0");
                      const m = String((i % 6) * 10).padStart(2, "0");
                      return (
                        <option key={i} value={`${h}:${m}`}>
                          {h}:{m}
                        </option>
                      );
                    })}
                  </select>

                  <select
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    required
                    style={{ fontSize: "1.1rem", padding: "0.4rem" }}
                  >
                    <option value="">終了時間</option>
                    {Array.from({ length: (22 - 6 + 1) * 6 }, (_, i) => {
                      const h = String(Math.floor(i / 6) + 6).padStart(2, "0");
                      const m = String((i % 6) * 10).padStart(2, "0");
                      return (
                        <option key={i} value={`${h}:${m}`}>
                          {h}:{m}
                        </option>
                      );
                    })}
                  </select>
                </>
              )}

              <button
                type="submit"
                style={{
                  marginTop: "0.5rem",
                  padding: "0.6rem",
                  backgroundColor: "#007bff",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "1rem",
                  cursor: "pointer",
                  fontWeight: "bold"
                }}
              >
                {editingId ? "更新" : "登録"}
              </button>
            </form>
          </div>
        </div>

        {/* 右側：全休暇一覧 */}
        <div style={{ width: "350px", maxHeight: "600px", overflowY: "auto" }}>
          <h3>全休暇一覧（早い日付順）</h3>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {vacations
              .sort((a, b) => new Date(a.date) - new Date(b.date))
              .map((v) => {
                let color = "black";
                if (v.type === "欠勤") color = "red";
                if (v.type === "時間単位有給") color = "blue";
                return (
                  <li key={v.id} style={{ marginBottom: "0.4rem" }}>
                    <span style={{ color }}>
                      {v.date}：{v.name} {v.type}{" "}
                      {v.type === "時間単位有給"
                        ? `${v.startTime}〜${v.endTime}`
                        : ""}
                      {v.reason ? ` (${v.reason})` : ""}
                    </span>
                    <button
                      onClick={() => handleEdit(v)}
                      style={{
                        marginLeft: "0.5rem",
                        color: "green",
                        cursor: "pointer",
                      }}
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(v.id)}
                      style={{
                        marginLeft: "0.3rem",
                        color: "red",
                        cursor: "pointer",
                      }}
                    >
                      削除
                    </button>
                  </li>
                );
              })}
          </ul>
        </div>
      </div>
    </>
  );
}
