# 품목 검색·즐겨찾기·홈 React Native Spike

GitHub Issue [#7](https://github.com/AndroidStudy-Sesac/Yeogi-Beoryeo-React-Native/issues/7), [#9](https://github.com/AndroidStudy-Sesac/Yeogi-Beoryeo-React-Native/issues/9), [#34](https://github.com/AndroidStudy-Sesac/Yeogi-Beoryeo-React-Native/issues/34), [#36](https://github.com/AndroidStudy-Sesac/Yeogi-Beoryeo-React-Native/issues/36), [#37](https://github.com/AndroidStudy-Sesac/Yeogi-Beoryeo-React-Native/issues/37), [#44](https://github.com/AndroidStudy-Sesac/Yeogi-Beoryeo-React-Native/issues/44)와 [#52](https://github.com/AndroidStudy-Sesac/Yeogi-Beoryeo-React-Native/issues/52)의 품목 검색, 상세, 즐겨찾기, 홈, 기존 데이터 이전과 Android 성능을 검증한 결과입니다.

## 결론

Expo와 TypeScript로 기존 품목 검색·상세 흐름을 구현할 수 있습니다. 기존 Android 앱의 품목 730개와 동의어 데이터를 사용하며, 검색 순위와 동의어 대체 규칙도 동일하게 적용했습니다.

품목 즐겨찾기처럼 적은 수의 안정 ID를 기기 안에 보관하는 용도에는 AsyncStorage가 적합했습니다. 앱에서 하나의 즐겨찾기 상태를 공유하고 저장 요청을 순서대로 처리했으며, 저장 성공 뒤에만 화면 상태를 바꿔 실제 저장값과 표시 상태가 어긋나지 않게 했습니다.

Android 실기기에서 즐겨찾기 추가·목록·상세 재진입·앱 재실행 복원·해제를 확인했습니다. 같은 품목을 500ms 안에 반복해서 눌러도 반대 동작이나 중복 저장이 발생하지 않았습니다.

품목 홈에는 대표 분류 19개, 화면 크기에 맞춘 더보기와 접기, 분류별 상세 이동과 유용한 안내를 추가했습니다. Android와 iPhone의 세로와 가로 화면에서 같은 주요 흐름과 네 방향 safe area를 확인했습니다.

홈 표시 카테고리는 안정 ID와 선택 순서를 AsyncStorage에 보관합니다. 선택한 분류를 홈 앞쪽에 배치하고 나머지는 기본 순서로 채웁니다. 화면이 작아지면 현재 표시 한도에 맞춰 앞의 선택만 안전하게 유지합니다.

검색할 때마다 품목명과 유사 품목명을 다시 정규화하면 Samsung SM-A315N에서 반복 측정이 7분 30초 안에 끝나지 않았습니다. 품목 배열별 정규화 index를 한 번만 만들고 한국어에 불필요한 locale 대소문자 변환을 제거한 뒤, `PMP` 첫 검색 p95는 76.106ms, 같은 프로세스의 반복 검색 p95 중앙값은 7.385ms였습니다. 별도 검색 결과 cache는 추가하지 않고 정규화 index만 유지합니다.

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
- 대표 분류 19개, 화면 크기별 더보기와 접기, 분류 상세 이동
- 유용한 안내 상세, 외부 사이트 이동과 실패 안내
- 홈 표시 카테고리 검색, 결과 없음, 검색 취소, 선택과 해제
- 선택 순서 저장과 앱 재실행 복원, 선택 항목 우선 표시
- 화면 크기별 선택 한도, 초과 선택 차단과 저장값 제한
- 같은 분류의 500ms 내 반복 입력 방지와 읽기·쓰기 실패 재시도
- 기존 Android Room 즐겨찾기와 DataStore 홈 표시 설정의 1회 이전
- 품목 배열별 정규화 검색 index 재사용

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

성능 측정 build는 git에서 제외되는 `.env.local`에 아래 값을 설정한 뒤 release APK를 생성합니다. 측정 결과는 `YEOGI_ITEM_SEARCH_BENCHMARK` accessibility label에서 읽습니다.

```dotenv
EXPO_PUBLIC_ITEM_SEARCH_BENCHMARK=1
```

## 검증

```bash
npm test
npm run check
npx expo install --check
npx expo-doctor
npx expo export --platform android
npx expo export --platform ios
```

- Node 단위 테스트 53개 통과
- TypeScript strict 및 unused 검사 통과
- Expo dependency 검사 통과
- Expo Doctor 21개 검사 통과
- Android와 iOS Hermes bundle 생성 통과
- Android debug와 release APK native 빌드 통과
- Samsung SM-A315N, Android 12 실기기에서 검색 결과와 상세 화면 확인
- 같은 품목을 빠르게 두 번 눌렀을 때 한 번만 저장되는 것 확인
- 즐겨찾기 목록 반영, 앱 강제 종료 후 복원, 상세 재진입 후 해제, 빈 상태 확인
- Samsung SM-A315N과 iPhone, iOS 26.6에서 대표 분류 19개, 더보기와 접기, 분류 상세, 유용한 안내와 세로·가로 화면 확인

### Android 검색 성능

2026년 8월 26일 Samsung SM-A315N, Android 12에서 React Native release/Hermes build를 측정했습니다. 품목 730개를 사용했고 앱 process를 종료한 뒤 10회 다시 시작했습니다. 각 process에서 `pmp` 품목명 검색, `뽁뽁이` 별칭 검색과 결과 없음 검색을 처음 한 번 실행하고 같은 검색을 30회 반복했습니다. 시간은 `performance.now()`로 측정했고 p50과 p95는 nearest-rank 방식으로 계산했습니다.

| 구간 | 중앙값 | p95 | 범위 |
| --- | ---: | ---: | ---: |
| 앱 시작 `am start -W TotalTime` | 525ms | 796ms | 477~796ms |
| 품목 JSON runtime validation | 30.992ms | 45.976ms | 29.604~45.976ms |

| 검색어 | 유형 | 결과 | 첫 호출 중앙값 / p95 | 반복 30회 p50 / p95 중앙값 |
| --- | --- | ---: | ---: | ---: |
| `pmp` | 품목명 | 1개 | 66.624 / 76.106ms | 6.871 / 7.385ms |
| `뽁뽁이` | 별칭 | 1개 | 24.175 / 24.641ms | 23.840 / 24.139ms |
| `존재하지않는품목` | 결과 없음 | 0개 | 11.342 / 12.650ms | 11.322 / 11.517ms |

정규화 index가 없던 구현은 90회 검색을 7분 30초 동안 완료하지 못했고 UI가 계속 차단됐습니다. index를 만들면서 `toLocaleLowerCase('ko-KR')`를 사용한 중간 구현도 첫 `PMP` 검색에 32,132.399ms가 걸렸습니다. 품목명과 유사 품목명을 `toLowerCase()`로 한 번만 정규화해 재사용하면서 첫 검색과 반복 검색이 위 범위로 줄었습니다.

기존 Kotlin debug build도 같은 기기와 `PMP`로 10회 확인했습니다. 앱 시작 중앙값은 4,612ms, p95는 4,690ms였고 검색 frame p99는 350~500ms였습니다. Kotlin은 `gfxinfo` frame 시간, React Native는 검색 함수 실행 시간을 사용하며 build 종류도 달라 직접 개선 비율은 계산하지 않습니다. Kotlin 결과는 [기존 Android Issue #349](https://github.com/AndroidStudy-Sesac/Yeogi-Beoryeo/issues/349)와 [PR #350](https://github.com/AndroidStudy-Sesac/Yeogi-Beoryeo/pull/350)의 비교 기준으로만 사용합니다.

## 제약

- 즐겨찾기는 기기 로컬에만 저장하며 계정 동기화와 서버 저장은 지원하지 않습니다.
- 기존 Android Room 즐겨찾기와 DataStore 홈 표시 설정은 Android에서만 1회 이전합니다. iOS 기존 데이터 이전은 포함하지 않습니다.
- 지도와 지역별 배출 가이드 즐겨찾기는 포함하지 않습니다.
- 홈 표시 카테고리는 화면이 줄어들면 현재 한도를 넘는 뒤쪽 선택을 저장값에서도 제거합니다.
- iOS 실기기 검증은 unsigned IPA를 Sideloadly로 설치했으며 App Store와 TestFlight 배포는 포함하지 않습니다.
- `npm audit`이 Expo와 React Native dependency tree에서 moderate 10개, high 4개를 보고합니다. Spike 호환성을 유지하기 위해 자동 수정은 적용하지 않았습니다.

Spike 코드는 개인 기준 브랜치인 `spike/jiyeong`에만 병합하며 `develop`과 `main`에는 병합하지 않습니다.
