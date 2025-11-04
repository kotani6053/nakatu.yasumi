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

  // ✅ 遅刻・早退・外出を追加
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
    if (isNaN(date)) return d;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate()
    ).padStart(2, "0")}`;
  };

  const formatShortJP = (d) => {
    const date = new Date(d);
    if (isNaN(date)) return d;
    const w = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
    return `${date.getMonth() + 1}月${date.getDate()}日（${w}）`;
  };

  // 6:00～22:50（10分刻み）
  const timeOptions = (() => {
    const arr = [];
    for (let t = 360; t <= 1370; t += 10) {
      const h = String(Math.floor(t / 60)).padStart(2, "0");
      const m = String(t % 60).padStart(2, "0");
      arr.push(`${h}:${m}`);
    }
    return arr;
  })();

  const isDuplicate = (name, date, excludeId = null) =>
    vacations.some((v) => {
      if (excludeId && v.id === excludeId) return false;
      if ((v.type === "連休" || v.type === "長期休暇" || v.type === "忌引き") && v.displayGroup === "normal") {
        if (v.name !== name) return false;
        const d = new Date(date);
        return d >= new Date(v.startDate) && d <= new Date(v.endDate);
      }
      return v.name === name && v.date === date;
    });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.type) {
      alert("名前・区分は必須です");
      return;
    }

    try {
      if (["連休", "長期休暇", "忌引き"].includes(formData.type)) {
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
          ...formData,
          date: null,
          startTime: null,
          endTime: null,
          createdAt: new Date(),
        };
        if (editingId) await updateDoc(doc(db, "vacations", editingId), payload);
        else await addDoc(collection(db, "vacations"), payload);
      } else {
        const dateStr = formatDate(selectedDate);
        if (isDuplicate(formData.name, dateStr, editingId)) {
          alert("同じ日・同じ名前の記録が既にあります。");
          return;
        }

        // ✅ 時間指定が必要なタイプ
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
        if (editingId) await updateDoc(doc(db, "vacations", editingId), payload);
        else await addDoc(collection(db, "vacations"), payload);
      }

      setEditingId(null);
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
      console.error(err);
      alert("保存に失敗しました");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("削除しますか？")) return;
    await deleteDoc(doc(db, "vacations", id));
  };

  const getColor = (type) => {
    switch (type) {
      case "時間単位有給":
        return "blue";
      case "遅刻":
        return "purple";
      case "早退":
        return "orange";
      case "外出":
        return "teal";
      case "欠勤":
        return "red";
      case "連絡なし":
        return "gray";
      case "出張":
        return "green";
      case "外勤務":
        return "#795548";
      case "忌引き":
        return "black";
      default:
        return "black";
    }
  };

  const controlStyle = { width: "100%", boxSizing: "border-box", padding: 8, fontSize: 15 };
  const buttonStyle = (mode, current) => ({
    marginRight: 6,
    padding: "6px 10px",
    border: "none",
    borderRadius: 4,
    color: current === mode ? "#fff" : "#000",
    backgroundColor: current === mode ? "#2196F3" : "#eee",
    cursor: "pointer",
  });

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 40, fontSize: "1.1rem" }}>
      <div style={{ display: "flex", gap: 32, width: "100%", maxWidth: 1400 }}>
        {/* 左：カレンダー＋フォーム */}
        <div style={{ width: 600, display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, background: "#fff" }}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>カレンダー</h3>
            <Calendar onChange={setSelectedDate} value={selectedDate} formatDay={(locale, date) => date.getDate()} />
          </div>

          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, background: "#fff" }}>
            <h3 style={{ marginTop: 0 }}>{formatShortJP(selectedDate)}</h3>
            <h3 style={{ marginTop: 4 }}>{editingId ? "編集中" : "新規入力"}</h3>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* 名前 */}
              <input
                placeholder="名前"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                style={controlStyle}
              />

              {/* type */}
              <select
                value={formData.type}
                onChange={(e) => {
                  const val = e.target.value;
                  // default displayGroup: long for long types, normal for others
                  setFormData({
                    ...formData,
                    type: val,
                    // reset times/dates properly
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
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              {/* reason */}
              <select
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                style={controlStyle}
              >
                <option value="">理由</option>
                {reasonOptions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              {/* If type is long/period (連休/長期休暇/忌引き) show start/end and displayGroup selector.
                  For 忌引き we default displayGroup to "normal" but allow changing if you want. */}
              {(formData.type === "連休" || formData.type === "長期休暇" || formData.type === "忌引き") && (
                <>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      required
                      style={{ ...controlStyle }}
                    />
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      required
                      style={{ ...controlStyle }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>表示先</label>
                    <select
                      value={formData.displayGroup}
                      onChange={(e) => setFormData({ ...formData, displayGroup: e.target.value })}
                      style={controlStyle}
                    >
                      <option value="long">長期休暇・連休枠に表示</option>
                      <option value="normal">当日・当月枠に表示</option>
                    </select>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
                      ※「体調不良等で長期間休む場合」は「当日・当月枠に表示」を選ぶと、該当期間が当日/当月の一覧に反映されます。
                    </div>
                  </div>
                </>
              )}

              {/* 時間単位有給 */}
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
                      <option key={t} value={t}>
                        {t}
                      </option>
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
                      <option key={t} value={t}>
                        {t}
                      </option>
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

        {/* 右：休暇一覧 */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24 }}>
          {/* 日付ベース一覧（当日/当月） */}
          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, background: "#fff", flex: 1, overflowY: "auto" }}>
            <div style={{ marginBottom: 12 }}>
              <button style={buttonStyle("today", viewMode)} onClick={() => setViewMode("today")}>
                当日
              </button>
              <button style={buttonStyle("month", viewMode)} onClick={() => setViewMode("month")}>
                当月
              </button>
            </div>

            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {displayed.length === 0 && <li style={{ color: "#666" }}>該当する休暇はありません。</li>}
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
                      {/* show date or startDate if period */}
                      {(v.date && formatShortJP(v.date)) ||
                        (v.startDate && `${formatShortJP(v.startDate)}〜${formatShortJP(v.endDate)}`)}
                      {"　"}
                      {v.name} ({v.type})
                      {/* show time if exists */}
                      {v.startTime && v.endTime && (
                        <span style={{ fontSize: 13, marginLeft: 8 }}>
                          {v.startTime}〜{v.endTime}
                        </span>
                      )}
                    </div>
                    {v.reason && <div style={{ fontSize: 13, color: "#555" }}>{v.reason}</div>}
                  </div>

                  <div style={{ display: "flex", gap: 6 }}>
                    {/* 編集は「連絡なし」のみ */}
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

          {/* 長期休暇・連休枠（右下段） */}
          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, background: "#fff", maxHeight: 300, overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h4 style={{ margin: 0 }}>長期休暇・連休</h4>
              <div>
                <button style={buttonStyle("today", longViewMode)} onClick={() => setLongViewMode("today")}>
                  当日
                </button>
                <button style={buttonStyle("month", longViewMode)} onClick={() => setLongViewMode("month")}>
                  当月
                </button>
              </div>
            </div>

            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {displayedLongVacations.length === 0 && <li style={{ color: "#666" }}>該当する長期休暇はありません。</li>}
              {displayedLongVacations.map((v) => (
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
                    {/* 編集 only if連絡なし (but long entries rarely are連絡なし) */}
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
