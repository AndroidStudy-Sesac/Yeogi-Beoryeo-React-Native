# 품목 검색 React Native Spike

GitHub Issue [#7](https://github.com/AndroidStudy-Sesac/Yeogi-Beoryeo-React-Native/issues/7)의 Android 우선 검증 결과입니다.

## 결론

Expo와 TypeScript로 기존 품목 검색 흐름을 구현할 수 있습니다. 기존 Android 앱의 품목 730개와 동의어 데이터를 그대로 사용하며, 검색 순위와 동의어 대체 규칙도 동일하게 적용했습니다.

Android에서는 검색어 입력, 검색 결과, 빈 결과, 취소, 상세 이동, 상세 정보 표시를 확인했습니다. 검색 결과 화면의 뒤로가기도 실기기에서 확인했고, 상세 화면은 native stack에 맞춰 별도 BackHandler를 적용했습니다. iOS는 macOS 환경에서 추가 검증이 필요합니다.

## 구현 범위

- 품목명과 유사 품목명 검색
- 직접 검색 결과가 없을 때만 동의어 검색
- 검색 결과 순위와 중복 제거
- 검색 취소, 중복 요청 방지, 이전 요청 취소, 실패 후 재시도
- 검색 결과와 품목 상세 화면 이동
- Android 뒤로가기와 화면별 검색 상태 처리
- 화면 상태와 일회성 이동 이벤트 분리

## 기술 구성

- Expo SDK 57
- React Native 0.86
- TypeScript
- React Navigation native stack
- React Native Screens
- React Native Safe Area Context

## 실행

```bash
npm install
npm run android
```

Windows에서 저장소 경로가 길어 native C++ 빌드가 260자 제한에 걸리면 저장소를 짧은 드라이브에 임시 연결한 뒤 실행합니다.

```powershell
subst R: C:\AndroidProject\JiYoung\Yeogi-Beoryeo-React-Native
Set-Location R:\spikes\item-search
npm run android
```

사용이 끝나면 `subst R: /d`로 임시 연결만 제거합니다.

## 검증

```bash
npm test
npm run check
npx expo-doctor
npx expo export --platform android
```

- Node 단위 테스트 15개 통과
- TypeScript strict 및 unused 검사 통과
- Expo Doctor 20개 검사 통과
- Android JavaScript bundle 생성 통과
- Android debug APK native 빌드 통과
- Samsung SM-A315N, Android 12 실기기에서 검색 결과·상세 화면 렌더링과 검색 결과 화면 뒤로가기 확인

## 남은 검증

- macOS에서 iOS build와 Simulator 동작 확인
- 팀 공통 구조가 정해진 뒤 데이터 공급 방식과 상태 관리 도구 재선정
- `npm audit`이 Expo와 React Native dependency tree에서 moderate 7개, high 11개를 보고합니다. 자동 수정안은 Expo 53과 React Native 0.72로 호환되지 않는 downgrade를 요구하므로 적용하지 않았습니다.

Spike 코드는 개인 기준 브랜치인 `spike/jiyeong`에만 병합하며 `develop`과 `main`에는 병합하지 않습니다.
