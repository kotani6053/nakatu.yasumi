import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  onSnapshot,
} from "firebase/firestore";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

const App = () => {
  const [date, setDate] = useState(new Date());
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [reason, setReason] = useState("");
  const [timeOffStart, setTimeOffStart] = useState("6:00");
  const [timeOffEnd, setTimeOffEnd] = useState("22:50");
  const [records, setRecords] = useState([]);
  const [filter, setFilter] = useState("today");

  useEffect(() => {
    const q = collection(db, "holidays");
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setRecords(data);
    });
    return () => unsub();
  }, []);

  const handleAdd = async () => {
    if (!name || !type) return alert("氏名と区分は必須です");
    const selectedStart = startDate || date.toISOString().split("T")[0];
    const selectedEnd = endDate || selectedStart;

    const start = new Date(selectedStart);
    const end = new Date(selectedEnd);
    const newRecords = [];

    for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
      const currentDate = new Date(d).toISOString().split("T")[0];
      newRecords.push({
        name,
        type,
        reason,
        date: currentDate,
        timeOffStart,
        timeOffEnd,
        createdAt: new Date(),
      });
    }

    for (const record of newRecords) {
      const exists = records.some(
        (r) => r.name === record.name && r.date === record.date
      );
      if (exists) continue;

      await addDoc(collection(db, "holidays"), record);
    }

    resetForm();
  };

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, "holidays", id));
  };

  const handleUpdate = async (id) => {
    const newType = prompt("新しい区分を選択してください", "欠勤");
    if (!newType) return;
    await updateDoc(doc(db, "holidays", id), { type: newType });
  };

  const resetForm = () => {
    setName("");
    setType("");
    setReason("");
    setStartDate("");
    setEndDate("");
  };

  const filteredRecords = records.filter((r) => {
    const today = new Date().toISOString().split("T")[0];
    const month = new Date().getMonth();
    const recordMonth = new Date(r.date).getMonth();

    if (filter === "today") return r.date === today;
    if (filter === "month") return recordMonth === month;
    return true;
  });

  const formatDateJP = (date) => {
    const d = new Date(date);
    const options = { month: "numeric", day: "numeric", weekday: "short" };
    return d.toLocaleDateString("ja-JP", options);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
      <div className="bg-white shadow-xl rounded-2xl p-6 w-full max-w-7xl flex flex-col md:flex-row gap-6">
        {/* 左：カレンダー＆入力 */}
        <div className="flex flex-col flex-1 space-y-4">
          {/* カレンダー */}
          <div className="bg-gray-50 rounded-xl shadow p-4 flex-1">
            <h2 className="text-xl font-bold mb-2 text-center text-gray-700">
              休暇カレンダー
            </h2>
            <Calendar
              onChange={setDate}
              value={date}
              className="mx-auto text-sm"
              tileContent={({ date }) => {
                const day = records.filter((r) => r.date === date.toISOString().split("T")[0]);
                return day.length > 0 ? (
                  <div className="text-xs mt-1 text-blue-600 font-bold">
                    {day.length}
                  </div>
                ) : null;
              }}
              formatDay={(_, date) => date.getDate()} // ← 「日」を削除
            />
          </div>

          {/* 入力フォーム */}
          <div className="bg-gray-50 rounded-xl shadow p-4 flex-1 overflow-hidden">
            <h2 className="text-lg font-bold mb-2 text-gray-700">
              新規入力（{formatDateJP(date)}）
            </h2>

            <div className="grid grid-cols-2 gap-2">
              <input
                className="border p-2 rounded"
                placeholder="氏名"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <select
                className="border p-2 rounded"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="">区分を選択</option>
                <option value="有給">有給</option>
                <option value="午前休">午前休</option>
                <option value="午後休">午後休</option>
                <option value="欠勤">欠勤</option>
                <option value="連絡なし">連絡なし</option>
                <option value="出張">出張</option>
                <option value="外勤務">外勤務</option>
              </select>
              <select
                className="border p-2 rounded col-span-2"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                <option value="">理由を選択</option>
                <option value="体調不良の為">体調不良の為</option>
                <option value="私用の為">私用の為</option>
                <option value="通院の為">通院の為</option>
                <option value="子の行事の為">子の行事の為</option>
                <option value="子の看病の為">子の看病の為</option>
              </select>
              <label>開始日</label>
              <input
                type="date"
                className="border p-2 rounded"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <label>終了日</label>
              <input
                type="date"
                className="border p-2 rounded"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <button
              onClick={handleAdd}
              className="w-full bg-blue-500 text-white py-2 mt-4 rounded-lg font-semibold shadow hover:bg-blue-600 transition"
            >
              登録する
            </button>
          </div>
        </div>

        {/* 右：一覧 */}
        <div className="bg-gray-50 rounded-xl shadow p-4 flex-1 overflow-auto">
          <h2 className="text-xl font-bold mb-2 text-gray-700 text-center">
            休暇一覧
          </h2>
          <div className="flex justify-center mb-3 space-x-2">
            <button
              onClick={() => setFilter("today")}
              className={`px-3 py-1 rounded ${
                filter === "today" ? "bg-blue-500 text-white" : "bg-gray-200"
              }`}
            >
              当日
            </button>
            <button
              onClick={() => setFilter("month")}
              className={`px-3 py-1 rounded ${
                filter === "month" ? "bg-blue-500 text-white" : "bg-gray-200"
              }`}
            >
              当月
            </button>
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1 rounded ${
                filter === "all" ? "bg-blue-500 text-white" : "bg-gray-200"
              }`}
            >
              一覧
            </button>
          </div>
          <ul className="space-y-2 max-h-[600px] overflow-y-auto">
            {filteredRecords
              .sort((a, b) => new Date(a.date) - new Date(b.date))
              .map((r) => (
                <li
                  key={r.id}
                  className="flex justify-between items-center bg-white p-2 rounded shadow-sm"
                >
                  <div>
                    <span className="font-semibold text-gray-800">{r.name}</span>　
                    <span className="text-gray-600">{formatDateJP(r.date)}</span>　
                    <span className="text-blue-600 font-semibold">{r.type}</span>　
                    <span className="text-gray-500 text-sm">{r.reason}</span>
                  </div>
                  <div className="space-x-2">
                    {r.type === "連絡なし" && (
                      <button
                        onClick={() => handleUpdate(r.id)}
                        className="px-2 py-1 bg-green-500 text-white rounded shadow hover:bg-green-600 text-sm"
                      >
                        編集
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="px-2 py-1 bg-red-500 text-white rounded shadow hover:bg-red-600 text-sm"
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
  );
};

export default App;
