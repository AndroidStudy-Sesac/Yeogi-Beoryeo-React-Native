# 품목 검색·즐겨찾기 React Native Spike

GitHub Issue [#7](https://github.com/AndroidStudy-Sesac/Yeogi-Beoryeo-React-Native/issues/7)의 품목 검색·상세와 Issue [#9](https://github.com/AndroidStudy-Sesac/Yeogi-Beoryeo-React-Native/issues/9)의 품목 즐겨찾기를 Android에서 검증한 결과입니다.

## 결론

Expo와 TypeScript로 기존 품목 검색·상세 흐름을 구현할 수 있습니다. 기존 Android 앱의 품목 730개와 동의어 데이터를 사용하며, 검색 순위와 동의어 대체 규칙도 동일하게 적용했습니다.

품목 즐겨찾기처럼 적은 수의 안정 ID를 기기 안에 보관하는 용도에는 AsyncStorage가 적합했습니다. 앱에서 하나의 즐겨찾기 상태를 공유하고 저장 요청을 순서대로 처리했으며, 저장 성공 뒤에만 화면 상태를 바꿔 실제 저장값과 표시 상태가 어긋나지 않게 했습니다.

Android 실기기에서 즐겨찾기 추가·목록·상세 재진입·앱 재실행 복원·해제를 확인했습니다. 같은 품목을 500ms 안에 반복해서 눌러도 반대 동작이나 중복 저장이 발생하지 않았습니다.

## 구현 범위

- 품목명과 유사 품목명 검색
- 직접 검색 결과가 없을 때만 동의어 검색
- 검색 결과 순위와 중복 제거
- 검색 취소, 중복 요청 방지, 이전 요청 취소, 실패 후 재시도
- 검색 결과와 품목 상세 화면 이동
- Android 뒤로가기와 화면별 검색 상태 처리
- 안정 ID와 저장 시각 기반 품목 즐겨찾기 추가·해제
- 즐겨찾기 목록, 빈 상태, 목록에서 상세 이동
- 앱 재실행 후 즐겨찾기 복원과 최근 저장순 정렬
- 같은 품목의 500ms 내 반복 입력 방지와 품목별 독립 처리
- 읽기·쓰기 실패 안내와 재시도
- 품목 사전에 없는 저장 ID의 안전한 제외

## 기술 구성

- Expo SDK 57
- React Native 0.86
- TypeScript
- React Navigation native stack
- React Native AsyncStorage
- React Native Screens
- React Native Safe Area Context

## 실행

```bash
npm install
npm run android
```

Windows에서는 native C++ codegen 경로가 260자를 넘지 않도록 저장소를 `C:\yb-rn`처럼 짧은 실제 경로에 두고 실행합니다. 가상 드라이브와 junction은 도구가 링크 대상의 원래 경로를 다시 해석하거나 codegen 경로의 기준점을 다르게 판단할 수 있으므로 사용하지 않습니다.

## 검증

```bash
npm test
npm run check
npx expo install --check
npx expo-doctor
npx expo export --platform android
```

- Node 단위 테스트 26개 통과
- TypeScript strict 및 unused 검사 통과
- Expo dependency 검사 통과
- Expo Doctor 20개 검사 통과
- Android JavaScript bundle 생성 통과
- Android debug APK native 빌드 통과
- Samsung SM-A315N, Android 12 실기기에서 검색 결과와 상세 화면 확인
- 같은 품목을 빠르게 두 번 눌렀을 때 한 번만 저장되는 것 확인
- 즐겨찾기 목록 반영, 앱 강제 종료 후 복원, 상세 재진입 후 해제, 빈 상태 확인

## 제약

- 즐겨찾기는 기기 로컬에만 저장하며 계정 동기화와 서버 저장은 지원하지 않습니다.
- 기존 Android Room 데이터는 이전하지 않습니다.
- 지도와 지역별 배출 가이드 즐겨찾기는 포함하지 않습니다.
- iOS 실행 검증은 Issue #9 범위에 포함하지 않습니다.
- `npm audit`이 Expo와 React Native dependency tree에서 moderate 7개, high 11개를 보고합니다. 자동 수정안은 Expo 53과 React Native 0.72로 호환되지 않는 downgrade를 요구하므로 적용하지 않았습니다.

Spike 코드는 개인 기준 브랜치인 `spike/jiyeong`에만 병합하며 `develop`과 `main`에는 병합하지 않습니다.
