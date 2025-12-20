import React from "react";
import { useLocation } from "react-router-dom";
import Header from "../../components/PageHeader";
import { PieChart, Pie, Cell, Legend, Tooltip } from "recharts";

export default function ResultPage() {
    const location = useLocation();
    const resultData = location.state?.resultData || {
        summary: "Chưa có dữ liệu",
        risk_score: 0,
        warnings: [],
    };

    const pieData = [
        { name: "Rủi ro", value: resultData.risk_score },
        { name: "An toàn", value: 100 - resultData.risk_score },
    ];
    const COLORS = ["#FF4D4F", "#52C41A"];

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <Header />
            <h1 className="text-2xl font-bold mb-6">Kết quả phân tích hợp đồng</h1>
            <div className="mb-6 p-6 bg-white rounded-xl shadow">
                <h2 className="font-semibold text-lg mb-2">Tóm tắt</h2>
                <p>{resultData.summary}</p>
            </div>
            <div className="mb-6 p-6 bg-white rounded-xl shadow flex justify-center">
                <PieChart width={300} height={300}>
                    <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                    >
                        {pieData.map((entry, index) => (
                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                </PieChart>
            </div>
            <div className="p-6 bg-white rounded-xl shadow">
                <h2 className="font-semibold text-lg mb-2">Cảnh báo</h2>
                <ul className="list-disc pl-6 space-y-1">
                    {resultData.warnings.map((warning, index) => (
                        <li key={index} className="text-red-600">{warning}</li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
