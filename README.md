# 여기버려 React Native

여기버려의 Android/iOS 공통 앱입니다. 기능별 Spike에서 확인한 결과를 근거로 정식 개발에 필요한 최소 실행 환경만 구성합니다. Spike 코드를 합치는 저장소가 아니라, 각 기능을 새 구조에서 다시 구현하는 기준점입니다.

## 현재 공통 환경

* Expo SDK 57, React Native 0.86, React 19, TypeScript 6
* React Navigation native stack
* Android/iOS 개발 앱 식별자 분리
* TypeScript, ESLint, Jest 품질 검사
* GitHub Actions 품질 검사와 Android/iOS native 빌드

## 시작하기

Node.js 24.14.0과 npm 11.9.0을 사용합니다.

```bash
npm ci
npm start
```

Android native 프로젝트를 생성하고 실행하려면 다음 명령을 사용합니다.

```bash
npm run android
```

iOS 실행에는 macOS와 Xcode가 필요합니다.

```bash
npm run ios
```

## 검증

```bash
npm run expo:check
npm run check
npm run lint
npm test
```

구조, 환경 변수, CI 기준은 [공통 개발 환경 문서](docs/common-environment.md)에서 확인할 수 있습니다. 선택 근거와 조사 내용은 [GitHub Issue #64](https://github.com/AndroidStudy-Sesac/Yeogi-Beoryeo-React-Native/issues/64)에 정리되어 있습니다.
