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
  const [formData, setFormData] = useState({
    name: "",
    type: "",
    reason: "",
    startTime: "",
    endTime: "",
    startDate: "",
    endDate: ""
  });
  const [filter, setFilter] = useState("当日");
  const [editingId, setEditingId] = useState(null);

  // Firestoreからリアルタイム取得
  useEffect(() => {
    const q = query(collection(db, "vacations"), orderBy("date"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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

  const formatJapaneseDate = (date) => {
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const w = weekdays[date.getDay()];
    return `${m}月${d}日（${w}）`;
  };

  const getVacationsForDay = (date) =>
    vacations.filter((v) => v.date === formatDate(date));

  const filteredVacations = vacations.filter((v) => {
    const today = new Date();
    const vDate = new Date(v.date);
    if (filter === "当日") {
      return vDate.toDateString() === today.toDateString();
    } else if (filter === "当月") {
      return (
        vDate.getFullYear() === today.getFullYear() &&
        vDate.getMonth() === today.getMonth()
      );
    }
    return true;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.type) return;

    const sameDay = vacations.find(
      (v) =>
        v.date === formatDate(selectedDate) &&
        v.name === formData.name &&
        (!editingId || v.id !== editingId)
    );
    if (sameDay) {
      alert("同じ日・同じ名前の記録が既に存在します。");
      return;
    }

    try {
      if (editingId) {
        const docRef = doc(db, "vacations", editingId);
        await updateDoc(docRef, {
          ...formData,
          date: formatDate(selectedDate),
        });
        setEditingId(null);
      } else {
        await addDoc(collection(db, "vacations"), {
          ...formData,
          date: formatDate(selectedDate),
          createdAt: new Date(),
        });
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
      console.error("Firestoreへの保存に失敗:", err);
    }
  };

  const handleEdit = (vacation) => {
    setFormData(vacation);
    setEditingId(vacation.id);
    setSelectedDate(new Date(vacation.date));
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
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: "2rem",
        alignItems: "flex-start",
        padding: "2rem",
        textAlign: "center"
      }}
    >
      <div>
        <h1>中津休暇取得者一覧</h1>
        <Calendar onChange={setSelectedDate} value={selectedDate} />

        {/* 新規入力フォーム */}
        <div
          style={{
            marginTop: "1rem",
            padding: "1rem",
            border: "1px solid #ccc",
            borderRadius: "8px",
            width: "340px",
            background: "#fafafa"
          }}
        >
          <h3>{formatJapaneseDate(selectedDate)}</h3>
          <h3>新規入力</h3>

          <form
            onSubmit={handleSubmit}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              alignItems: "center"
            }}
          >
            <input
              style={{ width: "90%" }}
              placeholder="名前"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
            />
            <select
              style={{ width: "90%" }}
              value={formData.type}
              onChange={(e) =>
                setFormData({ ...formData, type: e.target.value })
              }
              required
            >
              <option value="">選択してください</option>
              <option value="有給休暇">有給休暇</option>
              <option value="時間単位有給">時間単位有給</option>
              <option value="欠勤">欠勤</option>
              <option value="連絡なし">連絡なし</option>
              <option value="出張">出張</option>
              <option value="外勤務">外勤務</option>
            </select>

            <select
              style={{ width: "90%" }}
              value={formData.reason}
              onChange={(e) =>
                setFormData({ ...formData, reason: e.target.value })
              }
            >
              <option value="">理由を選択</option>
              <option value="体調不良の為">体調不良の為</option>
              <option value="私用の為">私用の為</option>
              <option value="通院の為">通院の為</option>
              <option value="子の行事の為">子の行事の為</option>
              <option value="子の看病の為">子の看病の為</option>
            </select>

            {formData.type === "時間単位有給" && (
              <>
                <select
                  style={{ width: "90%" }}
                  value={formData.startTime}
                  onChange={(e) =>
                    setFormData({ ...formData, startTime: e.target.value })
                  }
                >
                  <option value="">開始時間</option>
                  {Array.from({ length: 17 * 6 }, (_, i) => {
                    const hour = Math.floor(i / 6) + 6;
                    const minute = (i % 6) * 10;
                    const label = `${String(hour).padStart(2, "0")}:${String(
                      minute
                    ).padStart(2, "0")}`;
                    return (
                      <option key={label} value={label}>
                        {label}
                      </option>
                    );
                  })}
                </select>

                <select
                  style={{ width: "90%" }}
                  value={formData.endTime}
                  onChange={(e) =>
                    setFormData({ ...formData, endTime: e.target.value })
                  }
                >
                  <option value="">終了時間</option>
                  {Array.from({ length: 17 * 6 }, (_, i) => {
                    const hour = Math.floor(i / 6) + 6;
                    const minute = (i % 6) * 10;
                    const label = `${String(hour).padStart(2, "0")}:${String(
                      minute
                    ).padStart(2, "0")}`;
                    return (
                      <option key={label} value={label}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </>
            )}

            <button
              type="submit"
              style={{
                width: "90%",
                padding: "0.6rem",
                border: "none",
                borderRadius: "6px",
                background: "#1976d2",
                color: "white",
                fontWeight: "bold",
                cursor: "pointer"
              }}
            >
              {editingId ? "更新" : "登録"}
            </button>
          </form>
        </div>
      </div>

      {/* 一覧表示 */}
      <div
        style={{
          flex: 1,
          border: "1px solid #ccc",
          borderRadius: "8px",
          padding: "1rem",
          background: "#fafafa",
          maxHeight: "600px",
          overflowY: "auto",
          minWidth: "400px"
        }}
      >
        <h3>全休暇一覧</h3>
        <div style={{ marginBottom: "1rem" }}>
          <button onClick={() => setFilter("当日")}>当日</button>
          <button onClick={() => setFilter("当月")}>当月</button>
          <button onClick={() => setFilter("全体")}>全体</button>
        </div>

        <ul style={{ listStyle: "none", padding: 0 }}>
          {filteredVacations.map((v) => (
            <li
              key={v.id}
              style={{
                marginBottom: "0.5rem",
                borderBottom: "1px solid #ddd",
                paddingBottom: "0.3rem"
              }}
            >
              <strong>{v.name}</strong>（{v.type}） {v.date}{" "}
              {v.reason && `理由：${v.reason}`}{" "}
              {v.type === "時間単位有給"
                ? `${v.startTime}〜${v.endTime}`
                : ""}
              {v.type === "連絡なし" && (
                <button
                  onClick={() => handleEdit(v)}
                  style={{
                    marginLeft: "0.5rem",
                    padding: "2px 8px",
                    background: "#1976d2",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer"
                  }}
                >
                  編集
                </button>
              )}
              <button
                onClick={() => handleDelete(v.id)}
                style={{
                  marginLeft: "0.5rem",
                  padding: "2px 8px",
                  background: "#d32f2f",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
