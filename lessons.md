# Lessons Learned

## Chrome Blob URL 다운로드 문제
- Edge에서 작동하지만 Chrome에서 파일이 저장되지 않는 현상
- **원인**: Cross-origin 환경에서 Blob 신뢰성 검증 실패
- **해결**: `window.location.href`로 직접 네비게이션 + 서버 `Content-Disposition: attachment` 헤더 활용

## exceljs 차트 지원 한계
- exceljs는 데이터/스타일 지원은 우수하나 **차트 기능이 제한적**
- 엑셀 차트가 필요하면 데이터만 내보내고 사용자가 직접 차트 생성하는 방식 권장
- 웹에서 차트를 보여주고, 엑셀은 데이터 저장용으로 분리하는 것이 효율적

## Windows Node.js 프로세스 종료 문제
- `cmd /c "npm run server"` 실행 시 부모 cmd를 종료해도 node.exe가 살아남을 수 있음
- **해결**: `taskkill /F /IM node.exe`로 모든 Node 프로세스 강제 종료 후 재시작
