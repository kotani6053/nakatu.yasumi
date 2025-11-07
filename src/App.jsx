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

  // viewMode for main (日付ベース一覧) and for long-term area.
  const [viewMode, setViewMode] = useState("today"); // "today" | "month"
  const [longViewMode, setLongViewMode] = useState("today"); // for long-term area

  const [formData, setFormData] = useState({
    name: "",
    type: "",
    reason: "",
    startTime: "",
    endTime: "",
    startDate: "",
    endDate: "",
    // when long type selected, choose where to display: "long" (長期枠) or "normal" (当日枠)
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

useEffect(() => {
  const fetchData = async () => {
    const snapshot = await getDocs(collection(db, "vacations"));
    const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    setVacations(data);
  };

  fetchData();
}, []);



  const formatDate = (d) => {
    // d may be "2025-10-10" or Date; ensure Date object
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

  // 6:00 ～ 22:50 (10分刻み)
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
      // if v is long-type but set to displayGroup normal, it's stored with startDate/endDate
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
      // If type is period-based: 連休 / 長期休暇 / 忌引き
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
          // displayGroup: "long" or "normal"
          displayGroup: formData.displayGroup === "normal" ? "normal" : "long",
          // keep date null for period entries
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
        // single-day or time-based entries
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

        if (editingId) await updateDoc(doc(db, "vacations", editingId), payload);
        else await addDoc(collection(db, "vacations"), payload);
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

  // split data
  const normalVacations = vacations.filter((v) => v.displayGroup !== "long" && v.date); // date-based
  const longVacations = vacations.filter((v) => v.displayGroup === "long" && v.startDate && v.endDate); // period-based assigned to long area

  // displayed for main date-based list:
  // includes normalVacations (single-day entries) AND period entries that chose displayGroup: "normal" (their dates cover selected date or month)
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
    // base: single-day entries
    let base = normalVacations.slice();
    if (viewMode === "today") {
      base = base.filter((v) => v.date === todayStr);
    } else if (viewMode === "month") {
      base = base.filter((v) => Number(v.date.split("-")[1]) === monthNum);
    }

    // include periodAsNormal entries if they intersect
    const periodIncluded = periodAsNormal.filter((v) => {
      const start = new Date(v.startDate);
      const end = new Date(v.endDate);
      if (viewMode === "today") {
        const d = new Date(todayStr);
        return d >= start && d <= end;
      }
      if (viewMode === "month") {
        // include if any day in period is in same month
        return (
          start.getMonth() + 1 === monthNum ||
          end.getMonth() + 1 === monthNum ||
          (start.getMonth() + 1 < monthNum && end.getMonth() + 1 > monthNum)
        );
      }
      return false;
    });

    // merge and sort by date (for single-day items) and for period entries sort by startDate then name
    const merged = [...base, ...periodIncluded];

    // normalize for sort: use v.date for single-day, v.startDate for period (if date absent)
    merged.sort((a, b) => {
      const da = a.date ? new Date(a.date) : new Date(a.startDate);
      const db = b.date ? new Date(b.date) : new Date(b.startDate);
      if (da - db !== 0) return da - db;
      // secondary: name
      return (a.name || "").localeCompare(b.name || "");
    });

    return merged;
  })();

  // For longVacations area: filter by longViewMode (today/month), and sort by startDate ascending
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
        // include if period intersects month
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

  // common input style
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

{/* 時間を扱う区分（時間単位有給・遅刻・早退・外出）のとき */}
{["時間単位有給", "遅刻", "早退", "外出"].includes(formData.type) && (
  <>
    <select
      value={formData.startTime}
      onChange={(e) =>
        setFormData({ ...formData, startTime: e.target.value })
      }
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
      onChange={(e) =>
        setFormData({ ...formData, endTime: e.target.value })
      }
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

{/* 外勤務のときだけ 午前／午後／終日 を表示 */}
{formData.type === "外勤務" && (
  <select
    value={formData.workTime || ""}
    onChange={(e) =>
      setFormData({ ...formData, workTime: e.target.value })
    }
    required
    style={controlStyle}
  >
    <option value="">勤務時間帯を選択</option>
    <option value="午前中">午前中</option>
    <option value="午後中">午後中</option>
    <option value="終日">終日</option>
  </select>
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
                     {/* 時間または外勤務の勤務帯を表示 */}
{v.startTime && v.endTime && (
  <span style={{ fontSize: 13, marginLeft: 8 }}>
    {v.startTime}〜{v.endTime}
  </span>
)}
{v.type === "外勤務" && v.workTime && (
  <span style={{ fontSize: 13, marginLeft: 8 }}>
    （{v.workTime}）
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
