---
description: Chrome 브라우저에서 파일 다운로드가 안 될 때 해결 방법
---

## 배경
Chrome 브라우저는 보안 정책상 Blob URL을 통한 파일 다운로드를 차단하거나 무시하는 경우가 있습니다. 특히 Cross-origin 환경에서 자주 발생합니다.

## 해결 방법
// turbo
1. 서버 응답 헤더에 `Content-Disposition: attachment; filename=filename.ext`를 설정합니다.
2. 클라이언트에서는 Blob 생성 대신 `window.location.href = '/api/download-url'`을 사용하여 직접 링크를 호출합니다.

```javascript
// 서버 (Express 예시)
res.setHeader('Content-Type', 'text/csv');
res.setHeader('Content-Disposition', 'attachment; filename=data.csv');
res.send(csvContent);

// 클라이언트
const downloadFile = (params) => {
    window.location.href = `/api/export?${params}`;
};
```
