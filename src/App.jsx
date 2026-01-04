import React, { useState, useMemo } from 'react';
import './index.css';

const CATEGORY_COLORS = {
    '게임': { bg: '#f3e8ff', text: '#7c3aed', border: '#ddd6fe' },
    '생산성': { bg: '#dcfce7', text: '#16a34a', border: '#bbf7d0' },
    '엔터': { bg: '#dbeafe', text: '#2563eb', border: '#bfdbfe' },
    '건강': { bg: '#fef3c7', text: '#d97706', border: '#fde68a' },
    '기타': { bg: '#f3f4f6', text: '#6b7280', border: '#e5e7eb' },
};

function App() {
    const [receipts, setReceipts] = useState([]);
    const [loading, setLoading] = useState(false);
    // total is now calculated from filteredReceipts
    const [viewMode, setViewMode] = useState('detail'); // 'detail' | 'monthly'
    const [expandedMonth, setExpandedMonth] = useState(null);
    const [categoryFilter, setCategoryFilter] = useState('전체');

    // Budget state with localStorage persistence
    const [monthlyBudget, setMonthlyBudget] = useState(() => {
        const saved = localStorage.getItem('monthlyBudget');
        return saved ? parseInt(saved) : 50000;
    });
    const [showBudgetInput, setShowBudgetInput] = useState(false);

    // Default to 3 months ago
    const getDefaultDate = () => {
        const date = new Date();
        date.setMonth(date.getMonth() - 3);
        return date.toISOString().split('T')[0];
    };

    const [startDate, setStartDate] = useState(getDefaultDate());

    // 1. First, filter receipts based on category
    const filteredReceipts = useMemo(() => {
        if (categoryFilter === '전체') return receipts;
        return receipts.filter(r => r.category === categoryFilter);
    }, [receipts, categoryFilter]);

    // 2. Calculate Total Spend based on filtered data
    const total = useMemo(() => {
        return filteredReceipts.reduce((acc, r) => {
            const val = parseFloat((r.price || '0').replace(/[₩,]/g, '')) || 0;
            return acc + val;
        }, 0);
    }, [filteredReceipts]);

    // 3. Group filtered receipts by month
    const monthlyData = useMemo(() => {
        const grouped = {};
        filteredReceipts.forEach(r => {
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
    }, [filteredReceipts]);

    // Max value for chart scaling
    const maxMonthlyTotal = useMemo(() => {
        return Math.max(...monthlyData.map(m => m.total), 1);
    }, [monthlyData]);

    // 4. Category statistics (Global) - Should show distribution of CURRENT filter?
    // If we want to allow clicking categories to filter, the stats should probably show
    // the receipts' categories. But if we filter to 'Game', showing 100% Game is correct.
    // However, if we want to change filter by clicking, we usually want to see all categories initially.
    // Let's assume stats reflect the CURRENT VIEW.
    const categoryStats = useMemo(() => {
        const stats = {};
        filteredReceipts.forEach(r => {
            const cat = r.category || '기타';
            const val = parseFloat((r.price || '0').replace(/[₩,]/g, '')) || 0;
            if (!stats[cat]) {
                stats[cat] = { total: 0, count: 0 };
            }
            stats[cat].total += val;
            stats[cat].count += 1;
        });
        return stats;
    }, [filteredReceipts]);

    // Current month spending for budget comparison (Should budget ignore filter? Usually yes.)
    // Budget is usually "Total Budget", so comparing against "Filtered Spend" might be misleading.
    // BUT, if I filter to "Game", I want to know "How much of my budget did I spend on Games?".
    // So using filtered data is flexible.
    const currentMonthSpending = useMemo(() => {
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const currentMonthData = monthlyData.find(m => m.month === currentMonthKey);
        return currentMonthData ? currentMonthData.total : 0;
    }, [monthlyData]);

    const budgetPercentage = useMemo(() => {
        return monthlyBudget > 0 ? Math.round((currentMonthSpending / monthlyBudget) * 100) : 0;
    }, [currentMonthSpending, monthlyBudget]);

    const handleBudgetChange = (newBudget) => {
        const value = parseInt(newBudget) || 0;
        setMonthlyBudget(value);
        localStorage.setItem('monthlyBudget', value.toString());
        setShowBudgetInput(false);
    };

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
            // Total is now derived from filteredReceipts, no need to set state
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

    // Monthly category statistics
    const monthlyCategoryStats = useMemo(() => {
        const targetMonth = expandedMonth || (monthlyData.length > 0 ? monthlyData[0].month : null);
        if (!targetMonth) return {};

        const targetData = monthlyData.find(m => m.month === targetMonth);
        if (!targetData) return {};

        const stats = {};
        targetData.items.forEach(r => {
            const cat = r.category || '기타';
            const val = parseFloat((r.price || '0').replace(/[₩,]/g, '')) || 0;
            if (!stats[cat]) {
                stats[cat] = { total: 0, count: 0 };
            }
            stats[cat].total += val;
            stats[cat].count += 1;
        });
        return stats;
    }, [monthlyData, expandedMonth]);

    return (
        <div className="container">
            <header className="header">
                <h1 className="fade-in">Mobile App Receipt Manager <span className="version">v3.4</span></h1>

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

                    <div className="category-filter">
                        <label htmlFor="categoryFilter">카테고리:</label>
                        <select
                            id="categoryFilter"
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                        >
                            <option value="전체">전체</option>
                            <option value="게임">🎮 게임</option>
                            <option value="생산성">📱 생산성</option>
                            <option value="엔터">🎵 엔터</option>
                            <option value="건강">💪 건강</option>
                            <option value="기타">📦 기타</option>
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

            {/* DETAIL VIEW DASHBOARD */}
            {viewMode === 'detail' && (
                <div className="detail-dashboard fade-in">
                    <div className="left-column">
                        <div className="card">
                            <div className="stats-label">총 통합 지출</div>
                            <div className="stats-value">
                                ₩{total.toLocaleString()}
                            </div>
                        </div>
                        <div className="card">
                            <div className="stats-label">통합 구매 항목</div>
                            <div className="stats-value">{filteredReceipts.length} 건</div>
                        </div>
                    </div>
                    <div className="right-column">
                        <div className="card category-card">
                            <div className="stats-label">카테고리별 지출 (전체)</div>
                            <div className="category-stats">
                                {Object.entries(categoryStats).map(([cat, data]) => (
                                    <div
                                        key={cat}
                                        className="category-stat-item"
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => setCategoryFilter(cat === categoryFilter ? '전체' : cat)}
                                        title="클릭하여 필터링"
                                    >
                                        <span
                                            className="category-tag-inline"
                                            style={{
                                                backgroundColor: CATEGORY_COLORS[cat]?.bg,
                                                color: CATEGORY_COLORS[cat]?.text,
                                                borderColor: CATEGORY_COLORS[cat]?.border
                                            }}
                                        >
                                            {cat} {cat === categoryFilter && '✓'}
                                        </span>
                                        <span className="category-amount">₩{data.total.toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MONTHLY VIEW DASHBOARD */}
            {viewMode === 'monthly' && (
                <div className="monthly-dashboard fade-in">
                    <div className="left-column">
                        <div className="chart-container" style={{ height: '100%', marginBottom: 0 }}>
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
                    </div>
                    <div className="right-column">
                        <div className="budget-section" style={{ marginBottom: 0 }}>
                            <div className="budget-header">
                                <span className="budget-label">이번 달 예산 <span style={{ fontWeight: 400, color: '#86868b' }}>({new Date().getMonth() + 1}월)</span></span>
                                {showBudgetInput ? (
                                    <div className="budget-input-group">
                                        <input
                                            type="number"
                                            defaultValue={monthlyBudget}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleBudgetChange(e.target.value);
                                                if (e.key === 'Escape') setShowBudgetInput(false);
                                            }}
                                            autoFocus
                                        />
                                        <button onClick={() => setShowBudgetInput(false)}>취소</button>
                                    </div>
                                ) : (
                                    <button className="budget-edit-btn" onClick={() => setShowBudgetInput(true)}>
                                        ₩{monthlyBudget.toLocaleString()} 변경
                                    </button>
                                )}
                            </div>
                            <div className="budget-bar-container">
                                <div
                                    className={`budget-bar ${budgetPercentage >= 100 ? 'danger' : budgetPercentage >= 80 ? 'warning' : ''}`}
                                    style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
                                />
                            </div>
                            <div className="budget-info">
                                <span>₩{currentMonthSpending.toLocaleString()} / ₩{monthlyBudget.toLocaleString()}</span>
                                <span className={`budget-percentage ${budgetPercentage >= 100 ? 'danger' : budgetPercentage >= 80 ? 'warning' : ''}`}>
                                    {budgetPercentage}%
                                </span>
                            </div>
                        </div>

                        <div className="card category-card">
                            <div className="stats-label">
                                {expandedMonth ? `${formatMonthLabel(expandedMonth)} 지출` : '이번 달 지출'}
                            </div>
                            {Object.keys(monthlyCategoryStats).length > 0 ? (
                                <div className="category-stats">
                                    {Object.entries(monthlyCategoryStats).map(([cat, data]) => (
                                        <div key={cat} className="category-stat-item">
                                            <span
                                                className="category-tag-inline"
                                                style={{
                                                    backgroundColor: CATEGORY_COLORS[cat]?.bg,
                                                    color: CATEGORY_COLORS[cat]?.text,
                                                    borderColor: CATEGORY_COLORS[cat]?.border
                                                }}
                                            >
                                                {cat}
                                            </span>
                                            <span className="category-amount">₩{data.total.toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ color: '#86868b', fontSize: '14px', textAlign: 'center', marginTop: '20px' }}>
                                    데이터가 없습니다.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Detail View (current mode) */}
            {viewMode === 'detail' && (
                <div className="receipt-list fade-in" style={{ animationDelay: '0.3s' }}>
                    {filteredReceipts.length === 0 ? (
                        <div style={{ padding: '60px', textAlign: 'center', color: '#86868b' }}>
                            {loading ? 'iCloud 및 Gmail에서 영수증을 가져오고 있습니다...' :
                                receipts.length === 0 ? '동기화 버튼을 눌러 Apple & Samsung 영수증을 통합 관리하세요.' :
                                    '선택한 카테고리에 해당하는 영수증이 없습니다.'}
                        </div>
                    ) : (
                        filteredReceipts.map((receipt, index) => (
                            <div key={`${receipt.uid}-${index}`} className="receipt-item">
                                <div className="receipt-info">
                                    <div className="brand-tag-container">
                                        <span className={`brand-tag ${receipt.platform.toLowerCase()}`}>
                                            {receipt.platform}
                                        </span>
                                        <span
                                            className="category-tag"
                                            style={{
                                                backgroundColor: CATEGORY_COLORS[receipt.category]?.bg,
                                                color: CATEGORY_COLORS[receipt.category]?.text,
                                                borderColor: CATEGORY_COLORS[receipt.category]?.border
                                            }}
                                        >
                                            {receipt.category}
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
