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

  // ✅ 「遅刻」「早退」「外出」を追加
  const typeOptions = [
    "有給休暇",
    "時間単位有給",
    "欠勤",
    "連絡なし",
    "出張",
    "外勤務",
    "連休",
    "長期休暇",
    "忌引き",
    "遅刻",
    "早退",
    "外出",
  ];

  // ✅ 時間入力が必要なタイプをまとめて管理
  const timeBasedTypes = ["時間単位有給", "遅刻", "早退", "外出"];

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
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const formatShortJP = (d) => {
    const date = new Date(d);
    if (isNaN(date)) return d;
    const w = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
    return `${date.getMonth() + 1}月${date.getDate()}日（${w}）`;
  };

  // 時間リスト（6:00～22:50・10分刻み）
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

        const isTimeBased = timeBasedTypes.includes(formData.type);

        const payload = {
          name: formData.name,
          type: formData.type,
          reason: formData.reason || null,
          date: dateStr,
          startTime: isTimeBased ? formData.startTime : null,
          endTime: isTimeBased ? formData.endTime : null,
          displayGroup: "normal",
          startDate: null,
          endDate: null,
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

  const getColor = (type) => {
    switch (type) {
      case "時間単位有給":
        return "blue";
      case "遅刻":
        return "purple";
      case "早退":
        return "brown";
      case "外出":
        return "teal";
      case "欠勤":
        return "red";
      case "連絡なし":
        return "gray";
      case "出張":
        return "green";
      case "外勤務":
        return "orange";
      case "忌引き":
        return "black";
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

  const buttonStyle = (mode, current = viewMode) => ({
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
                <option value="">選択してください</option>
                {typeOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

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

              {/* ✅ 時間単位有給／遅刻／早退／外出：時間入力 */}
              {timeBasedTypes.includes(formData.type) && (
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
          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, background: "#fff", flex: 1, overflowY: "auto" }}>
            <div style={{ marginBottom: 12 }}>
              <button style={buttonStyle("today", viewMode)} onClick={() => setViewMode("today")}>
                当日
              </button>
              <button style={buttonStyle("month", viewMode)} onClick={() => setViewMode("month")}>
                当月
              </button>
            </div>

            {displayed.length === 0 ? (
              <p style={{ color: "#777" }}>該当データがありません</p>
            ) : (
              displayed.map((v) => (
                <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div>
                    <span style={{ color: getColor(v.type), fontWeight: 600 }}>{v.name}</span>：
                    {v.type}
                    {v.startTime && v.endTime && (
                      <span>
                        {" "}
                        （{v.startTime}〜{v.endTime}）
                      </span>
                    )}
                    {v.reason && (
                      <span style={{ color: "#555" }}>（{v.reason}）</span>
                    )}
                    {v.startDate && v.endDate && (
                      <span>
                        {" "}
                        [{formatShortJP(v.startDate)}〜{formatShortJP(v.endDate)}]
                      </span>
                    )}
                  </div>
                  <div>
                    <button onClick={() => handleEdit(v)} style={{ marginRight: 6 }}>
                      編集
                    </button>
                    <button onClick={() => handleDelete(v.id)}>削除</button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, background: "#fff", flex: 1, overflowY: "auto" }}>
            <div style={{ marginBottom: 12 }}>
              <button style={buttonStyle("today", longViewMode)} onClick={() => setLongViewMode("today")}>
                当日
              </button>
              <button style={buttonStyle("month", longViewMode)} onClick={() => setLongViewMode("month")}>
                当月
              </button>
            </div>

            {displayedLongVacations.length === 0 ? (
              <p style={{ color: "#777" }}>該当データがありません</p>
            ) : (
              displayedLongVacations.map((v) => (
                <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div>
                    <span style={{ color: getColor(v.type), fontWeight: 600 }}>{v.name}</span>：
                    {v.type} [{formatShortJP(v.startDate)}〜{formatShortJP(v.endDate)}]
                    {v.reason && (
                      <span style={{ color: "#555" }}>（{v.reason}）</span>
                    )}
                  </div>
                  <div>
                    <button onClick={() => handleEdit(v)} style={{ marginRight: 6 }}>
                      編集
                    </button>
                    <button onClick={() => handleDelete(v.id)}>削除</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
