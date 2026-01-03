import React, { useState } from 'react';
import './index.css';

function App() {
    const [receipts, setReceipts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);

    const syncReceipts = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/sync');
            const data = await response.json();
            setReceipts(data);

            // Calculate total from individual items
            const sum = data.reduce((acc, curr) => {
                const val = parseFloat((curr.price || '0').replace(/[₩,]/g, '')) || 0;
                return acc + val;
            }, 0);
            setTotal(sum);
        } catch (error) {
            console.error('Error syncing:', error);
            alert('동기화 중 오류가 발생했습니다. 서버가 실행 중인지 확인해 주세요.');
        } finally {
            setLoading(false);
        }
    };

    const exportCSV = () => {
        window.open('/api/export-csv', '_blank');
    };

    return (
        <div className="container">
            <header className="header">
                <h1 className="fade-in">Apple Receipts <span className="version">v2.0</span></h1>
                <div className="button-group">
                    <button
                        className="sync-button fade-in"
                        onClick={syncReceipts}
                        disabled={loading}
                    >
                        {loading ? '동기화 중...' : '영수증 동기화'}
                    </button>
                    <button
                        className="export-button fade-in"
                        onClick={exportCSV}
                        disabled={receipts.length === 0}
                    >
                        CSV 내보내기
                    </button>
                </div>
            </header>

            <div className="dashboard-grid">
                <div className="card fade-in" style={{ animationDelay: '0.1s' }}>
                    <div className="stats-label">총 지출</div>
                    <div className="stats-value">
                        ₩{total.toLocaleString()}
                    </div>
                </div>
                <div className="card fade-in" style={{ animationDelay: '0.2s' }}>
                    <div className="stats-label">구매 항목</div>
                    <div className="stats-value">{receipts.length} 건</div>
                </div>
            </div>

            <div className="receipt-list fade-in" style={{ animationDelay: '0.3s' }}>
                {receipts.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#86868b' }}>
                        {loading ? 'iCloud에서 영수증을 가져오고 있습니다...' : '동기화 버튼을 눌러 영수증을 가져오세요.'}
                    </div>
                ) : (
                    receipts.map((receipt, index) => (
                        <div key={`${receipt.uid}-${index}`} className="receipt-item">
                            <div className="receipt-info">
                                <h3 className="app-name">{receipt.appName || '알 수 없음'}</h3>
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
        </div>
    );
}

export default App;
