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
  const [editingId, setEditingId] = useState(null);
  const [viewMode, setViewMode] = useState("month"); // "month" or "all"
  const [formData, setFormData] = useState({
    name: "",
    type: "",
    reason: "",
    startTime: "",
    endTime: "",
    startDate: "",
    endDate: ""
  });

  // Firestoreリアルタイム取得
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

  const currentMonth = new Date().getMonth() + 1;
  const currentMonthVacations = vacations.filter(
    (v) => Number(v.date?.split("-")[1]) === currentMonth
  );
  const allVacations = vacations;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.type) return;

    const baseData = {
      ...formData,
      date: formatDate(selectedDate),
      createdAt: new Date()
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, "vacations", editingId), baseData);
        setEditingId(null);
      } else {
        await addDoc(collection(db, "vacations"), baseData);
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
      console.error("Firestoreエラー:", err);
    }
  };

  const handleEdit = (v) => {
    setFormData(v);
    setEditingId(v.id);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("この記録を削除しますか？")) return;
    try {
      await deleteDoc(doc(db, "vacations", id));
    } catch (err) {
      console.error("削除エラー:", err);
    }
  };

  const getColor = (type) => {
    switch (type) {
      case "時間単位有給":
        return "blue";
      case "欠勤":
        return "red";
      case "出張":
      case "外勤務":
        return "green";
      case "連絡なし":
        return "orange";
      default:
        return "black";
    }
  };

  return (
    <>
      <h1 style={{ textAlign: "center" }}>中津休暇取得者一覧</h1>
      <div style={{ display: "flex", gap: "2rem", padding: "1rem" }}>
        {/* 左カラム：カレンダー上、フォーム下 */}
        <div style={{ display: "flex", flexDirection: "column", width: "400px" }}>
          {/* カレンダー */}
          <div style={{ marginBottom: "1rem" }}>
            <Calendar onChange={setSelectedDate} value={selectedDate} />
          </div>

          {/* 入力フォーム */}
          <div
            style={{
              border: "1px solid #ccc",
              padding: "10px",
              borderRadius: "5px"
            }}
          >
            <h4>{editingId ? "編集中" : "新規入力"}</h4>
            <form
              onSubmit={handleSubmit}
              style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
            >
              <input
                placeholder="名前"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
                style={{ width: "100%", padding: "8px" }}
              />

              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value })
                }
                required
                style={{ width: "100%", padding: "8px" }}
              >
                <option value="">選択してください</option>
                <option value="有給休暇">有給休暇</option>
                <option value="時間単位有給">時間単位有給</option>
                <option value="欠勤">欠勤</option>
                <option value="連絡なし">連絡なし</option>
                <option value="出張">出張</option>
                <option value="外勤務">外勤務</option>
                <option value="連休">連休</option>
                <option value="長期休暇">長期休暇</option>
              </select>

              <input
                placeholder="理由"
                value={formData.reason}
                onChange={(e) =>
                  setFormData({ ...formData, reason: e.target.value })
                }
                style={{ width: "100%", padding: "8px" }}
              />

              {/* 時間単位有給 */}
              {formData.type === "時間単位有給" && (
                <>
                  <label>開始時間：</label>
                  <select
                    value={formData.startTime}
                    onChange={(e) =>
                      setFormData({ ...formData, startTime: e.target.value })
                    }
                    required
                    style={{ width: "100%", padding: "8px" }}
                  >
                    {Array.from({ length: (22 - 6) * 6 + 1 }, (_, i) => {
                      const h = Math.floor(i / 6) + 6;
                      const m = (i % 6) * 10;
                      const time = `${String(h).padStart(2, "0")}:${String(
                        m
                      ).padStart(2, "0")}`;
                      return (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      );
                    })}
                  </select>

                  <label>終了時間：</label>
                  <select
                    value={formData.endTime}
                    onChange={(e) =>
                      setFormData({ ...formData, endTime: e.target.value })
                    }
                    required
                    style={{ width: "100%", padding: "8px" }}
                  >
                    {Array.from({ length: (22 - 6) * 6 + 1 }, (_, i) => {
                      const h = Math.floor(i / 6) + 6;
                      const m = (i % 6) * 10;
                      const time = `${String(h).padStart(2, "0")}:${String(
                        m
                      ).padStart(2, "0")}`;
                      return (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      );
                    })}
                  </select>
                </>
              )}

              {/* 連休・長期休暇 */}
              {(formData.type === "連休" || formData.type === "長期休暇") && (
                <>
                  <label>開始日：</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({ ...formData, startDate: e.target.value })
                    }
                    required
                    style={{ width: "100%", padding: "8px" }}
                  />
                  <label>終了日：</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData({ ...formData, endDate: e.target.value })
                    }
                    required
                    style={{ width: "100%", padding: "8px" }}
                  />
                </>
              )}

              <button
                type="submit"
                style={{
                  backgroundColor: "#007bff",
                  color: "white",
                  padding: "10px",
                  width: "100%",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                  marginTop: "10px",
                  fontSize: "1rem",
                  fontWeight: "bold"
                }}
              >
                {editingId ? "更新" : "登録"}
              </button>
            </form>
          </div>
        </div>

        {/* 右カラム：全休暇一覧 */}
        <div
          style={{
            width: "400px",
            maxHeight: "600px",
            overflowY: "auto",
            border: "1px solid #ccc",
            padding: "5px",
            borderRadius: "5px"
          }}
        >
          {/* 当月／全体切替 */}
          <div style={{ marginBottom: "10px", textAlign: "center" }}>
            <button
              onClick={() => setViewMode("month")}
              style={{
                backgroundColor: viewMode === "month" ? "#007bff" : "#eee",
                color: viewMode === "month" ? "white" : "black",
                padding: "5px 10px",
                borderRadius: "5px",
                marginRight: "10px",
                border: "none"
              }}
            >
              当月
            </button>
            <button
              onClick={() => setViewMode("all")}
              style={{
                backgroundColor: viewMode === "all" ? "#007bff" : "#eee",
                color: viewMode === "all" ? "white" : "black",
                padding: "5px 10px",
                borderRadius: "5px",
                border: "none"
              }}
            >
              全体
            </button>
          </div>

          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {(viewMode === "month" ? currentMonthVacations : allVacations).map(
              (v) => (
                <li
                  key={v.id}
                  style={{
                    color: getColor(v.type),
                    marginBottom: "0.4rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <span>
                    {v.date}：{v.name} {v.type}{" "}
                    {v.startTime && v.endTime ? `${v.startTime}〜${v.endTime}` : ""}
                    {v.startDate && v.endDate ? ` (${v.startDate}〜${v.endDate})` : ""}{" "}
                    {v.reason && `（${v.reason}）`}
                  </span>
                  <span>
                    <button
                      onClick={() => handleEdit(v)}
                      style={{
                        marginRight: "5px",
                        color: "green",
                        border: "none",
                        background: "none",
                        cursor: "pointer"
                      }}
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(v.id)}
                      style={{
                        color: "red",
                        border: "none",
                        background: "none",
                        cursor: "pointer"
                      }}
                    >
                      削除
                    </button>
                  </span>
                </li>
              )
            )}
          </ul>
        </div>
      </div>
    </>
  );
}
