import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

const App = () => {
  const [date, setDate] = useState(new Date());
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [reason, setReason] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [vacations, setVacations] = useState([]);
  const [longVacations, setLongVacations] = useState([]);
  const [filter, setFilter] = useState("today");
  const [editId, setEditId] = useState(null);

  const vacationCollection = collection(db, "vacations");

  useEffect(() => {
    const unsubscribe = onSnapshot(vacationCollection, (snapshot) => {
      const vacationData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      const normal = vacationData.filter(
        (v) => v.category !== "長期休暇" && v.category !== "連休"
      );
      const long = vacationData.filter(
        (v) => v.category === "長期休暇" || v.category === "連休"
      );
      setVacations(normal);
      setLongVacations(long);
    });
    return () => unsubscribe();
  }, []);

  const handleAddVacation = async () => {
    if (!name || !category) return alert("名前と区分は必須です");

    const newVacation = {
      name,
      category,
      reason,
      date:
        category === "長期休暇" || category === "連休"
          ? `${startDate} ～ ${endDate}`
          : date.toISOString().split("T")[0],
      timestamp: new Date(),
    };

    await addDoc(vacationCollection, newVacation);
    setName("");
    setCategory("");
    setReason("");
    setStartDate("");
    setEndDate("");
  };

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, "vacations", id));
  };

  const handleEdit = async (id) => {
    const newCategory = prompt("区分を変更", "欠勤");
    if (newCategory) {
      await updateDoc(doc(db, "vacations", id), { category: newCategory });
    }
  };

  const filteredVacations = vacations.filter((v) => {
    const today = new Date();
    const vDate = new Date(v.date);
    if (filter === "today")
      return vDate.toDateString() === today.toDateString();
    if (filter === "month")
      return (
        vDate.getMonth() === today.getMonth() &&
        vDate.getFullYear() === today.getFullYear()
      );
    return true;
  });

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 p-8">
      <div className="flex flex-row w-full max-w-7xl bg-white rounded-xl shadow-lg overflow-hidden">
        {/* 左側：カレンダー＋フォーム */}
        <div className="flex flex-col w-1/2 p-6 border-r border-gray-200">
          <div className="flex flex-col items-center mb-6">
            <h2 className="text-xl font-semibold mb-2">カレンダー</h2>
            <Calendar onChange={setDate} value={date} />
          </div>

          <div className="bg-gray-50 p-5 rounded-lg shadow-inner">
            <h3 className="text-lg font-semibold mb-4 text-center">
              新規入力（{date.toLocaleDateString("ja-JP", { 
                year: "numeric", month: "long", day: "numeric", weekday: "short" 
              })}）
            </h3>
            <div className="flex flex-col space-y-3">
              <input
                className="p-2 border rounded w-full"
                placeholder="名前"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <select
                className="p-2 border rounded w-full"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">区分を選択</option>
                <option>有給</option>
                <option>欠勤</option>
                <option>連休</option>
                <option>長期休暇</option>
                <option>外勤務</option>
                <option>出張</option>
                <option>連絡なし</option>
              </select>

              {(category === "連休" || category === "長期休暇") && (
                <div className="flex space-x-2">
                  <input
                    type="date"
                    className="p-2 border rounded w-1/2"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <input
                    type="date"
                    className="p-2 border rounded w-1/2"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              )}

              <select
                className="p-2 border rounded w-full"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                <option value="">理由を選択</option>
                <option>体調不良の為</option>
                <option>私用の為</option>
                <option>通院の為</option>
                <option>子の行事の為</option>
                <option>子の看病の為</option>
                <option>その他</option>
              </select>

              <button
                onClick={handleAddVacation}
                className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 rounded transition"
              >
                登録
              </button>
            </div>
          </div>
        </div>

        {/* 右側：休暇一覧 */}
        <div className="flex flex-col w-1/2 p-6">
          <h2 className="text-xl font-semibold mb-3">休暇一覧</h2>

          <div className="flex space-x-2 mb-4">
            <button
              className={`px-3 py-1 rounded ${
                filter === "today" ? "bg-blue-500 text-white" : "bg-gray-200"
              }`}
              onClick={() => setFilter("today")}
            >
              当日
            </button>
            <button
              className={`px-3 py-1 rounded ${
                filter === "month" ? "bg-blue-500 text-white" : "bg-gray-200"
              }`}
              onClick={() => setFilter("month")}
            >
              当月
            </button>
            <button
              className={`px-3 py-1 rounded ${
                filter === "all" ? "bg-blue-500 text-white" : "bg-gray-200"
              }`}
              onClick={() => setFilter("all")}
            >
              一覧
            </button>
          </div>

          <div className="overflow-y-auto flex-1 space-y-3">
            {filteredVacations.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-gray-50 rounded-lg shadow flex justify-between items-center"
              >
                <div>
                  <p className="font-semibold text-gray-800">{item.date}</p>
                  <p className="text-gray-700">{item.name}</p>
                  <p className="text-gray-500 text-sm">{item.category}</p>
                  <p className="text-gray-400 text-sm">{item.reason}</p>
                </div>
                <div className="flex space-x-2">
                  {item.category === "連絡なし" && (
                    <button
                      onClick={() => handleEdit(item.id)}
                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                    >
                      編集
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 長期休暇・連休一覧（右下段） */}
          <h3 className="text-lg font-semibold mt-6 mb-3">
            長期休暇・連休一覧
          </h3>
          <div className="overflow-y-auto h-32 space-y-2">
            {longVacations.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-white border rounded-lg shadow-sm flex justify-between items-center"
              >
                <div>
                  <p className="font-semibold text-gray-800">{item.date}</p>
                  <p className="text-gray-700">{item.name}</p>
                  <p className="text-gray-500 text-sm">{item.reason}</p>
                </div>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition"
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
