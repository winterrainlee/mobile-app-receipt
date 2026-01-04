import React, { useState, useMemo } from 'react';
import './index.css';

function App() {
    const [receipts, setReceipts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);
    const [viewMode, setViewMode] = useState('detail'); // 'detail' | 'monthly'
    const [expandedMonth, setExpandedMonth] = useState(null);

    // Default to 3 months ago
    const getDefaultDate = () => {
        const date = new Date();
        date.setMonth(date.getMonth() - 3);
        return date.toISOString().split('T')[0];
    };

    const [startDate, setStartDate] = useState(getDefaultDate());

    // Group receipts by month
    const monthlyData = useMemo(() => {
        const grouped = {};
        receipts.forEach(r => {
            const d = new Date(r.date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!grouped[key]) {
                grouped[key] = { month: key, total: 0, count: 0, items: [] };
            }
            const val = parseFloat((r.price || '0').replace(/[₩,]/g, '')) || 0;
            grouped[key].total += val;
            grouped[key].count += 1;
            grouped[key].items.push(r);
        });
        return Object.values(grouped).sort((a, b) => a.month.localeCompare(b.month));
    }, [receipts]);

    // Max value for chart scaling
    const maxMonthlyTotal = useMemo(() => {
        return Math.max(...monthlyData.map(m => m.total), 1);
    }, [monthlyData]);

    const syncReceipts = async () => {
        setLoading(true);
        try {
            // Check for demo mode via URL parameter
            const urlParams = new URLSearchParams(window.location.search);
            const isDemo = urlParams.get('demo') === 'true';

            const endpoint = isDemo ? '/api/demo' : `/api/sync?startDate=${startDate}`;
            const response = await fetch(endpoint);
            const data = await response.json();
            setReceipts(data);

            const sum = data.reduce((acc, curr) => {
                const val = parseFloat((curr.price || '0').replace(/[₩,]/g, '')) || 0;
                return acc + val;
            }, 0);
            setTotal(sum);
        } catch (error) {
            console.error('Error syncing:', error);
            alert('동기화 중 오류가 발생했습니다. 환경변수(iCloud/Gmail 앱 비밀번호)를 확인해 주세요.');
        } finally {
            setLoading(false);
        }
    };

    const exportXLSX = () => {
        window.location.href = `/api/export-xlsx?startDate=${startDate}`;
    };

    const formatMonthLabel = (monthKey) => {
        const [year, month] = monthKey.split('-');
        return `${year}년 ${parseInt(month)}월`;
    };

    const toggleMonth = (monthKey) => {
        setExpandedMonth(expandedMonth === monthKey ? null : monthKey);
    };

    return (
        <div className="container">
            <header className="header">
                <h1 className="fade-in">Mobile App Receipt Manager <span className="version">v3.3</span></h1>

                <div className="controls-row fade-in">
                    <div className="date-filter">
                        <label htmlFor="startDate">시작 날짜:</label>
                        <input
                            type="date"
                            id="startDate"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            max={new Date().toISOString().split('T')[0]}
                        />
                        <span className="date-hint">~ 오늘까지</span>
                    </div>

                    <div className="view-mode-selector">
                        <label htmlFor="viewMode">보기 모드:</label>
                        <select
                            id="viewMode"
                            value={viewMode}
                            onChange={(e) => setViewMode(e.target.value)}
                        >
                            <option value="detail">전체 기록 보기</option>
                            <option value="monthly">월별 총액 보기</option>
                        </select>
                    </div>
                </div>

                <div className="button-group">
                    <button
                        className="sync-button fade-in"
                        onClick={syncReceipts}
                        disabled={loading}
                    >
                        {loading ? '가져오는 중...' : '영수증 가져오기'}
                    </button>
                    <button
                        className="export-button fade-in"
                        onClick={exportXLSX}
                        disabled={receipts.length === 0}
                    >
                        Excel 내보내기
                    </button>
                </div>
            </header>

            <div className="dashboard-grid">
                <div className="card fade-in" style={{ animationDelay: '0.1s' }}>
                    <div className="stats-label">총 통합 지출</div>
                    <div className="stats-value">
                        ₩{total.toLocaleString()}
                    </div>
                </div>
                <div className="card fade-in" style={{ animationDelay: '0.2s' }}>
                    <div className="stats-label">통합 구매 항목</div>
                    <div className="stats-value">{receipts.length} 건</div>
                </div>
            </div>

            {/* Monthly Bar Chart */}
            {viewMode === 'monthly' && monthlyData.length > 0 && (
                <div className="chart-container fade-in" style={{ animationDelay: '0.25s' }}>
                    <h3 className="chart-title">월별 지출 추세</h3>
                    <div className="bar-chart">
                        {monthlyData.map((m) => (
                            <div
                                key={m.month}
                                className={`bar-wrapper ${expandedMonth === m.month ? 'active' : ''}`}
                                onClick={() => toggleMonth(m.month)}
                            >
                                <div className="bar-label">₩{m.total.toLocaleString()}</div>
                                <div
                                    className="bar"
                                    style={{ height: `${(m.total / maxMonthlyTotal) * 180}px` }}
                                />
                                <div className="bar-month">{m.month.split('-')[1]}월</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Detail View (current mode) */}
            {viewMode === 'detail' && (
                <div className="receipt-list fade-in" style={{ animationDelay: '0.3s' }}>
                    {receipts.length === 0 ? (
                        <div style={{ padding: '60px', textAlign: 'center', color: '#86868b' }}>
                            {loading ? 'iCloud 및 Gmail에서 영수증을 가져오고 있습니다...' : '동기화 버튼을 눌러 Apple & Samsung 영수증을 통합 관리하세요.'}
                        </div>
                    ) : (
                        receipts.map((receipt, index) => (
                            <div key={`${receipt.uid}-${index}`} className="receipt-item">
                                <div className="receipt-info">
                                    <div className="brand-tag-container">
                                        <span className={`brand-tag ${receipt.platform.toLowerCase()}`}>
                                            {receipt.platform}
                                        </span>
                                        <h3 className="app-name">{receipt.appName || '알 수 없음'}</h3>
                                    </div>
                                    <p className="product-name">{receipt.productName}</p>
                                    <p className="date-info">
                                        {new Date(receipt.date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                                        {receipt.orderId && <span className="order-id"> · {receipt.orderId}</span>}
                                    </p>
                                </div>
                                <div className="receipt-price">{receipt.price || '금액 미확인'}</div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Monthly View with Drill-down */}
            {viewMode === 'monthly' && (
                <div className="receipt-list fade-in" style={{ animationDelay: '0.3s' }}>
                    {monthlyData.length === 0 ? (
                        <div style={{ padding: '60px', textAlign: 'center', color: '#86868b' }}>
                            {loading ? 'iCloud 및 Gmail에서 영수증을 가져오고 있습니다...' : '동기화 버튼을 눌러 Apple & Samsung 영수증을 통합 관리하세요.'}
                        </div>
                    ) : (
                        monthlyData.map((m) => (
                            <div key={m.month} className="monthly-group">
                                <div
                                    className={`monthly-header ${expandedMonth === m.month ? 'expanded' : ''}`}
                                    onClick={() => toggleMonth(m.month)}
                                >
                                    <div className="monthly-info">
                                        <h3>{formatMonthLabel(m.month)}</h3>
                                        <span className="monthly-count">{m.count}건</span>
                                    </div>
                                    <div className="monthly-total">
                                        ₩{m.total.toLocaleString()}
                                        <span className="expand-icon">{expandedMonth === m.month ? '▲' : '▼'}</span>
                                    </div>
                                </div>
                                {expandedMonth === m.month && (
                                    <div className="monthly-details">
                                        {m.items.map((receipt, index) => (
                                            <div key={`${receipt.uid}-${index}`} className="receipt-item sub-item">
                                                <div className="receipt-info">
                                                    <div className="brand-tag-container">
                                                        <span className={`brand-tag ${receipt.platform.toLowerCase()}`}>
                                                            {receipt.platform}
                                                        </span>
                                                        <h3 className="app-name">{receipt.appName || '알 수 없음'}</h3>
                                                    </div>
                                                    <p className="product-name">{receipt.productName}</p>
                                                    <p className="date-info">
                                                        {new Date(receipt.date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                                                        {receipt.orderId && <span className="order-id"> · {receipt.orderId}</span>}
                                                    </p>
                                                </div>
                                                <div className="receipt-price">{receipt.price || '금액 미확인'}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

export default App;
