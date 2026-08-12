# 여기버려 React Native

기존 Kotlin + Jetpack Compose 기반 Android 앱 `여기버려`의
주요 기능을 React Native로 재구현하여
Android/iOS 크로스플랫폼 전환 가능성을 검증하는 팀 스파이크 프로젝트입니다.

## 프로젝트 목적

기존 Android 앱의 전체 기능을 바로 React Native로 이전하지 않고,
팀원별로 기존에 담당했던 주요 기능을 우선 React Native 환경에서 구현합니다.

각 기능의 구현 가능성과 플랫폼별 차이를 확인한 뒤,
검증 결과를 바탕으로 기능을 통합하고 Android/iOS 환경에 대응하는 것을 목표로 합니다.

## 진행 방식

1. 기존 Android 앱의 주요 기능 선정
2. 팀원별 기존 담당 기능을 React Native로 구현
3. Android / iOS 동작 및 기술 제약 확인
4. 구현 결과와 기술적 차이 문서화
5. 검증 완료 후 기능 통합
6. 크로스플랫폼 앱 구조로 확장

## 기존 프로젝트

- Android Native
  - Kotlin
  - Jetpack Compose
  - Android 전용

## React Native 프로젝트

- React Native
- TypeScript
- Android / iOS
