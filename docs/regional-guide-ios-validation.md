# 지역 가이드 iOS 검증 기록

## 검증 환경

- 검증일: 2026-08-26
- 로컬 환경: Windows
- iOS 네이티브 도구: Xcode, iOS Simulator, CocoaPods 사용 불가
- Node.js: 24.14.0
- npm: 11.9.0
- Expo SDK: 57.0.16 (`expo` 선언 범위 `~57.0.14`)
- React Native: 0.86.2
- React: 19.2.3

## 확인한 항목

- iOS bundle identifier를 `com.team.yeogibeoryeo.rn`으로 설정
- Expo 공개 설정에서 iOS 플랫폼과 `expo-asset` 플러그인 인식 확인
- iOS Hermes bundle 생성 성공
- iOS JavaScript bundle에 공통 지역 repository와 JSON 모듈 포함 확인
- Android Hermes bundle 생성 성공
- 지역 데이터 로딩·필터링 로직에 플랫폼 분기가 없음을 확인
- `제주특별자치도 → 제주시 → 일도1동` 선택 화면 테스트 통과
- 시도 변경 시 시군구·읍면동 초기화 테스트 통과
- 시군구 변경 시 읍면동 초기화 테스트 통과
- TypeScript 검사와 전체 Jest 테스트 통과

## 확인하지 못한 항목

Windows에서는 Apple 네이티브 도구를 실행할 수 없어 다음 항목을 직접 검증하지 못했다.

- iOS native build와 앱 실행
- iOS Simulator 또는 실기기에서 지역 JSON 로딩
- 긴 지역 목록 스크롤과 항목 터치
- 빠른 항목 변경
- 선택 상태 표시와 화면 잘림
- Safe Area 및 시스템 UI 충돌
- iOS runtime warning과 error
- Android 실기기와 iOS 실기기의 화면 결과 직접 비교

## iPhone 실기기 후속 검증

`.github/workflows/build-ios-sideload.yml`은 GitHub-hosted macOS runner에서
`iphoneos`와 generic iOS device를 대상으로 코드 서명 없이 앱을 빌드한다.
생성한 `.app`은 `Payload` 폴더에 넣어
`yeogi-beoryeo-regional-guide-ios-sideload.ipa` artifact로 제공한다.

1. GitHub Actions 실행 결과에서 IPA artifact를 내려받아 압축을 푼다.
2. Windows PC에 iPhone을 USB로 연결하고 iPhone에서 컴퓨터를 신뢰한다.
3. iPhone에서 Developer Mode를 활성화한다.
4. Sideloadly에서 IPA와 연결된 iPhone을 선택한다.
5. Apple ID와 2FA 정보는 Sideloadly에 사용자가 직접 입력해 로컬에서 서명·설치한다.
6. `제주특별자치도 → 제주시 → 일도1동`을 선택한다.
7. 시도를 변경해 기존 시군구와 읍면동 선택이 초기화되는지 확인한다.
8. 시군구를 변경해 기존 읍면동 선택이 초기화되는지 확인한다.
9. 제공 가능 지역만 노출되는지 확인한다.
10. 긴 목록 스크롤, 빠른 선택, Safe Area와 화면 잘림을 확인한다.
11. 동일 입력의 Android 결과와 비교한다.

무료 Apple ID 서명은 7일 뒤 만료되므로 만료 전에 자동 갱신하거나 IPA를
다시 서명해 설치해야 한다. Apple ID, 2FA, 인증서와 UDID는 Codex, EAS 또는
GitHub Actions에 전달하거나 저장하지 않는다.

## 플랫폼 차이

- 번들 생성과 공통 TypeScript 테스트 범위에서는 Android/iOS 결과 차이가 없다.
- iOS native UI와 runtime 차이는 macOS 직접 검증 후 확정해야 한다.
