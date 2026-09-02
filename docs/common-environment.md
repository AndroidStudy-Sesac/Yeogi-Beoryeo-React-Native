# React Native 공통 개발 환경

## 목적

이 문서는 여기버려 React Native 정식 개발의 공통 시작점을 설명합니다. 기능별 Spike에서 확인한 구현 가능성과 제약은 구조를 선택하는 근거로만 사용합니다. Spike 브랜치의 코드를 모아서 정식 앱으로 만들지는 않습니다.

공통 뼈대에는 모든 기능이 함께 사용하는 실행 환경과 품질 기준만 둡니다. 품목 검색, 지역 가이드, 지도, 즐겨찾기처럼 기능별로 달라지는 API 요청, 응답 변환, 상태와 정책은 각 feature가 소유합니다.

## 기준 버전

| 항목 | 버전 |
| --- | --- |
| Node.js | 24.14.0 |
| npm | 11.9.0 |
| Expo SDK | 57.0.19 |
| React Native | 0.86.3 |
| React | 19.2.3 |
| TypeScript | 6.0.3 |

`package-lock.json`을 기준으로 설치 결과를 고정합니다. 로컬과 CI 모두 `npm ci`를 사용하며, 의존성 갱신이 필요한 작업에서만 `npm install`을 사용합니다.

## 앱 식별자

| 환경 | 앱 이름 | Android application ID | iOS bundle identifier |
| --- | --- | --- | --- |
| 개발 | 여기버려 Debug | `com.team.yeogibeoryeo.debug` | `com.team.yeogibeoryeo.debug` |
| 운영 | 여기버려 | `com.team.yeogibeoryeo` | `com.team.yeogibeoryeo` |

기본값은 개발 환경입니다. 운영 식별자가 필요한 빌드에서는 `APP_VARIANT=production`을 지정합니다. 개발 앱과 운영 앱을 같은 기기에 함께 설치할 수 있으며, 실수로 운영 앱을 덮어쓰는 일을 막을 수 있습니다.

한글 표시 이름과 native 프로젝트 내부 이름을 분리합니다. Android launcher와 iOS `CFBundleDisplayName`에는 위 표의 한글 이름을 사용하고, Gradle/Xcode 프로젝트 이름에는 `YeogiBeoryeo` 또는 `YeogiBeoryeoDebug`를 사용합니다. 한글만으로 된 이름을 Xcode target 이름으로 변환할 때 빈 문자열이 되는 문제를 피하기 위한 설정입니다.

## 소스 구조

현재 공통 뼈대는 앱 조립을 담당하는 `src/app`과 기능별 작업 경계를 보여주는 `src/features`를 둡니다. 기능 내부 layer와 사용하지 않는 추상화는 미리 만들지 않습니다.

```text
src/
  app/
    navigation/   앱 전체 route와 navigator
    providers/    앱 전체 provider 조합
    App.tsx       앱 조립 지점
  features/
    item-search/     품목 검색
    map/             지도
    regional-guide/  지역 가이드
```

각 기능 폴더에는 Git이 디렉터리를 추적할 수 있도록 빈 `.gitkeep`만 둡니다. 기능 구현을 시작하면 담당 feature 안에 아래 기준으로 layer를 추가합니다.

```text
src/
  features/
    item-search/
      data/
      domain/
      presentation/
```

feature는 독립된 책임 단위지만, 처음부터 별도 npm package로 만들지는 않습니다. Android Gradle 멀티 모듈과 달리 React Native의 폴더 분리는 native build 경계나 독립 artifact를 자동으로 만들지 않습니다. 한 앱 안에서는 feature 폴더와 import 규칙만으로도 소유권과 의존 방향을 충분히 표현할 수 있습니다.

다음 조건이 생기면 workspace package 분리를 검토합니다.

* 둘 이상의 앱이 같은 코드를 실제로 사용합니다.
* package별 독립 배포나 version 관리가 필요합니다.
* package 경계별 build, test, cache가 개발 시간을 줄인다는 측정 근거가 있습니다.
* 팀 소유권을 폴더 규칙만으로 유지하기 어렵습니다.

단순히 팀원별 작업 영역을 나누기 위해 workspace를 먼저 만들지는 않습니다. 각 팀원은 담당 feature 안에서 data, domain, presentation을 함께 구현하고, 공통 계약이 확인될 때만 `shared`로 옮깁니다.

## 의존 방향

각 feature 안에서 의존 방향은 다음 기준을 사용합니다.

```text
presentation -> domain <- data
```

* `domain`은 화면, Expo SDK, 저장소 구현과 독립된 규칙을 둡니다.
* `data`는 API와 저장소 구현을 담당하고 `domain` 계약을 구현합니다.
* `presentation`은 화면 상태와 사용자 상호작용을 담당하고 `domain`을 사용합니다.
* feature 사이에서 다른 feature의 내부 파일을 직접 import하지 않습니다.
* 공통화는 두 곳 이상에서 같은 계약이 확인된 뒤 진행합니다.

이 구조는 Clean Architecture의 의존성 원칙을 적용할 수 있는 기반입니다. 폴더 이름만으로 Clean Architecture가 보장되지는 않으므로, feature를 추가할 때 import 방향과 business logic 위치를 테스트와 리뷰로 지켜야 합니다.

## 공통 뼈대 포함 범위

공통으로 확정한 항목만 설치합니다.

* Expo와 TypeScript 실행 환경
* React Navigation과 root navigator
* Safe Area와 앱 전체 provider 조립 지점
* 개발/운영 앱 식별자
* TypeScript, ESLint, Jest 설정
* GitHub Actions 품질 검사와 Android debug 빌드

다음 항목은 기능 구현에서 필요성과 호환성을 다시 확인한 뒤 추가합니다.

* AsyncStorage와 저장 schema
* 지도, 위치, geocoding
* BottomSheet와 gesture/reanimated 조합
* API별 request 취소와 오류 변환
* 기능별 환경 변수와 API key

## native 프로젝트 관리

`android`와 `ios` 디렉터리는 Expo config에서 생성하는 산출물로 취급합니다. 앱 설정과 config plugin을 원본으로 관리하고, native 설정을 직접 수정해야 할 때만 생성 파일을 저장소에 포함할지 별도로 결정합니다.

```bash
npx expo prebuild --platform android
```

CI도 같은 방식으로 Android 프로젝트를 생성한 뒤 debug APK를 빌드합니다. 설정이 코드와 CI에서 다르게 동작하는 것을 조기에 확인하기 위한 기준입니다.

## 환경 변수와 비밀값

로컬에서 필요한 공개 설정 이름은 `.env.example`에 추가하고 실제 값은 커밋하지 않습니다. GitHub Actions에서는 값의 성격에 따라 다음처럼 구분합니다.

* 외부에 노출되면 안 되는 값은 GitHub Actions Secret에 등록합니다.
* 공개해도 되는 build 설정은 GitHub Actions Variable에 등록합니다.
* `EXPO_PUBLIC_*` 값은 JavaScript bundle에 포함되므로 비밀값으로 취급할 수 없습니다.

저장소에는 `NAVER_MAP_CLIENT_ID`, `EXPO_PUBLIC_GETSPOT_SERVICE_KEY` 이름의 Actions Secret이 등록되어 있습니다. 공통 뼈대는 해당 기능을 포함하지 않으므로 현재 CI에서는 이 값을 주입하지 않습니다. 이후 기능 코드가 필요로 하면 해당 job에 필요한 값만 명시적으로 전달하고, key 없이 실행할 수 있는 unit test 경로도 유지합니다.

새 key가 필요하면 다음 순서로 처리합니다.

1. 코드에 값이 아닌 환경 변수 이름을 추가합니다.
2. `.env.example`에 안전한 placeholder와 용도를 기록합니다.
3. GitHub Actions Secret 또는 Variable에 값을 등록합니다.
4. 필요한 workflow step에만 값을 전달합니다.
5. 로그와 build artifact에 값이 노출되지 않는지 확인합니다.

## CI 통과 조건

`develop`을 대상으로 하는 pull request와 `develop` push에서 CI를 실행합니다.

품질 검사 job은 다음 항목을 확인합니다.

1. `npm ci`
2. 직접 dependency tree의 누락과 충돌
3. Expo 권장 의존성 버전
4. TypeScript type check
5. ESLint warning과 error
6. Jest test

Android build job은 품질 검사 통과 뒤 다음 항목을 확인합니다.

1. Expo config 기반 Android 프로젝트 생성
2. Gradle x86_64 debug/release APK 빌드
3. release APK의 JavaScript bundle 포함 여부

iOS build job은 macOS 26과 Xcode 26.6 환경에서 다음 항목을 확인합니다.

1. Expo config 기반 iOS 프로젝트 생성
2. CocoaPods dependency 설치
3. code signing이 필요 없는 iOS device용 Release build

공통 뼈대 CI는 기능별 API key 없이 통과해야 합니다. 기능 구현으로 key가 필요해질 때는 해당 feature의 test와 build 범위를 기준으로 필요한 값만 등록합니다.

## 현재 확인된 upstream 경고

현재 lockfile의 `npm audit`은 Expo CLI와 React Navigation의 transitive dependency에서 moderate 항목 16개를 보고합니다. 자동 수정안은 Expo SDK 46과 React Navigation 3 또는 5로 내리는 방식이므로 적용하지 않습니다. 현재 SDK 57 조합과 맞지 않고, 공통 뼈대의 native build 계약도 깨집니다.

* `query-string`이 사용하는 `decode-uri-component`에는 잘못된 percent encoding 입력으로 인한 denial of service advisory가 있습니다.
* Expo의 Xcode 프로젝트 도구가 사용하는 `uuid`에는 특정 API 사용 방식의 buffer bounds advisory가 있습니다.
* 현재 직접 dependency는 Expo SDK 57 권장 버전과 React Navigation 최신 설치 결과입니다.

새 호환 버전이 배포되면 `expo install --check`, test, Android/iOS native build를 함께 통과시킨 뒤 lockfile을 갱신합니다. `npm audit fix --force`로 major version을 자동 변경하지 않습니다.

Android native build에서는 Expo SDK 57, React Native, `react-native-screens`, `react-native-safe-area-context` 내부의 deprecated API 경고가 확인됩니다. 현재 작성한 TypeScript와 app config의 warning은 아닙니다. 생성된 native 파일이나 `node_modules`를 직접 수정하지 않고 upstream 호환 버전에서 해결합니다.

## 브랜치 기준

정식 개발 작업은 최신 `develop`에서 `feat/{이슈번호}-{작업명}` 브랜치를 만듭니다. 검증과 리뷰를 거쳐 `develop`에 반영하며, Spike 브랜치나 이전 기능 브랜치에서 다음 작업을 분기하지 않습니다.

현재 공통 뼈대 브랜치는 `feat/64-common-skeleton`입니다.
