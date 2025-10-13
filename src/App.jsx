import React, { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

const App = () => {
  const [vacations, setVacations] = useState([]);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [reason, setReason] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filter, setFilter] = useState("today");
  const [editId, setEditId] = useState(null);

  // Firestoreデータ取得
  useEffect(() => {
    const q = collection(db, "vacations");
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setVacations(data);
    });
    return () => unsub();
  }, []);

  // データ登録・編集
  const handleAdd = async () => {
    if (!name || !status) return alert("名前と区分を入力してください。");

    // 連休・長期休暇（複数日処理）
    if (status === "連休" || status === "長期休暇") {
      if (!startDate || !endDate)
        return alert("開始日と終了日を入力してください。");
      const s = new Date(startDate);
      const e = new Date(endDate);
      if (s > e) return alert("終了日は開始日以降にしてください。");

      const days = [];
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        days.push(new Date(d));
      }

      for (const day of days) {
        const data = {
          name,
          status,
          reason,
          date: day.toISOString().split("T")[0],
        };
        await addDoc(collection(db, "vacations"), data);
      }
    } else {
      const data = {
        name,
        status,
        reason,
        date: selectedDate.toISOString().split("T")[0],
      };
      if (editId) {
        await updateDoc(doc(db, "vacations", editId), data);
        setEditId(null);
      } else {
        await addDoc(collection(db, "vacations"), data);
      }
    }

    setName("");
    setStatus("");
    setReason("");
    setStartDate("");
    setEndDate("");
  };

  const handleDelete = async (id) => {
    if (window.confirm("削除してよろしいですか？")) {
      await deleteDoc(doc(db, "vacations", id));
    }
  };

  const handleEdit = (v) => {
    setEditId(v.id);
    setName(v.name);
    setStatus(v.status);
    setReason(v.reason);
    setSelectedDate(new Date(v.date));
  };

  // 表示切替フィルター
  const filteredVacations = vacations.filter((v) => {
    const today = new Date().toISOString().split("T")[0];
    const month = new Date().getMonth() + 1;
    const vMonth = new Date(v.date).getMonth() + 1;

    if (filter === "today") return v.date === today;
    if (filter === "month") return vMonth === month;
    return true;
  });

  // ステータス別カラー
  const getStatusColor = (status) => {
    switch (status) {
      case "有給":
        return "bg-green-100 border-green-400";
      case "欠勤":
        return "bg-red-100 border-red-400";
      case "遅刻":
      case "早退":
        return "bg-yellow-100 border-yellow-400";
      case "出張":
      case "外勤務":
        return "bg-blue-100 border-blue-400";
      case "連絡なし":
        return "bg-gray-200 border-gray-400";
      default:
        return "bg-white border-gray-200";
    }
  };

  return (
    <div className="flex justify-center items-start gap-4 p-6 bg-gray-50 min-h-screen">
      {/* 左カラム：カレンダー＋入力 */}
      <div className="flex flex-col w-[45%] space-y-4">
        {/* カレンダー */}
        <div className="bg-white p-4 rounded-xl shadow text-center">
          <h2 className="text-lg font-bold mb-2">カレンダー</h2>
          <input
            type="date"
            value={selectedDate.toISOString().split("T")[0]}
            onChange={(e) => setSelectedDate(new Date(e.target.value))}
            className="border rounded-md p-2 w-full"
          />
        </div>

        {/* 入力フォーム */}
        <div className="bg-white p-4 rounded-xl shadow">
          <h2 className="text-lg font-bold mb-3 text-center">新規入力</h2>

          {/* 選択中日付表示 */}
          <div className="text-center text-gray-600 font-medium mb-3">
            {selectedDate &&
              `${selectedDate.toLocaleDateString("ja-JP", {
                month: "long",
                day: "numeric",
                weekday: "short",
              })}`}
          </div>

          {/* 名前 */}
          <div className="mb-2">
            <label className="block text-sm font-semibold mb-1">名前</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border rounded-md p-2 w-full"
              placeholder="氏名を入力"
            />
          </div>

          {/* 区分 */}
          <div className="mb-2">
            <label className="block text-sm font-semibold mb-1">区分</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="border rounded-md p-2 w-full"
            >
              <option value="">選択してください</option>
              <option value="有給">有給</option>
              <option value="欠勤">欠勤</option>
              <option value="遅刻">遅刻</option>
              <option value="早退">早退</option>
              <option value="連休">連休</option>
              <option value="長期休暇">長期休暇</option>
              <option value="出張">出張</option>
              <option value="外勤務">外勤務</option>
              <option value="連絡なし">連絡なし</option>
            </select>
          </div>

          {/* 理由 */}
          <div className="mb-2">
            <label className="block text-sm font-semibold mb-1">理由</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="border rounded-md p-2 w-full"
            >
              <option value="">選択してください</option>
              <option value="体調不良の為">体調不良の為</option>
              <option value="私用の為">私用の為</option>
              <option value="通院の為">通院の為</option>
              <option value="子の行事の為">子の行事の為</option>
              <option value="子の看病の為">子の看病の為</option>
              <option value="その他">その他</option>
            </select>
          </div>

          {/* 期間選択 */}
          {(status === "連休" || status === "長期休暇") && (
            <div className="flex flex-col space-y-2 mb-2">
              <div>
                <label className="block text-sm font-semibold mb-1">
                  開始日
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="border rounded-md p-2 w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">
                  終了日
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="border rounded-md p-2 w-full"
                />
              </div>
            </div>
          )}

          {/* 登録ボタン */}
          <button
            onClick={handleAdd}
            className="bg-blue-500 text-white rounded-md py-2 font-semibold hover:bg-blue-600 transition w-full"
          >
            {editId ? "更新" : "登録"}
          </button>
        </div>
      </div>

      {/* 右カラム：一覧 */}
      <div className="w-[50%] bg-white p-4 rounded-xl shadow">
        <h2 className="text-lg font-bold mb-3 text-center">休暇一覧</h2>

        {/* 表示切替 */}
        <div className="flex justify-center gap-2 mb-3">
          <button
            onClick={() => setFilter("today")}
            className={`px-3 py-1 rounded-md ${
              filter === "today"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 hover:bg-gray-300"
            }`}
          >
            当日
          </button>
          <button
            onClick={() => setFilter("month")}
            className={`px-3 py-1 rounded-md ${
              filter === "month"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 hover:bg-gray-300"
            }`}
          >
            当月
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1 rounded-md ${
              filter === "all"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 hover:bg-gray-300"
            }`}
          >
            全体
          </button>
        </div>

        {/* 一覧表示 */}
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {filteredVacations.map((v) => (
            <div
              key={v.id}
              className={`border rounded-md p-2 flex justify-between items-center ${getStatusColor(
                v.status
              )}`}
            >
              <div>
                <p className="font-semibold">
                  {v.date}　{v.name}（{v.status}）
                </p>
                <p className="text-sm text-gray-600">{v.reason}</p>
              </div>
              <div className="flex gap-2">
                {v.status === "連絡なし" && (
                  <button
                    onClick={() => handleEdit(v)}
                    className="px-2 py-1 bg-yellow-400 text-white rounded hover:bg-yellow-500"
                  >
                    編集
                  </button>
                )}
                <button
                  onClick={() => handleDelete(v.id)}
                  className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;
