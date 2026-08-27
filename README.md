# 여기버려 React Native

기존 Kotlin + Jetpack Compose 기반 Android 앱 `여기버려`의
주요 기능을 React Native로 재구현하여
Android/iOS 크로스플랫폼 전환 가능성을 검증하는 팀 스파이크 프로젝트입니다.

## 프로젝트 목적

기존 Android 앱의 전체 기능을 바로 React Native로 이전하지 않고,
팀원별로 기존에 담당했던 주요 기능을 우선 React Native 환경에서 구현합니다.

각 기능의 구현 가능성과 플랫폼별 차이를 확인한 뒤,
검증 결과를 바탕으로 공통 기술과 구조를 결정하고
Android/iOS 크로스플랫폼 앱으로 확장하는 것을 목표로 합니다.


## 진행 방식

1. 기존 Android 앱의 주요 기능 선정
2. 팀원별 기존 담당 기능을 React Native로 구현
3. Android / iOS 동작 및 기술 제약 확인
4. 구현 결과와 기술적 차이 문서화
5. Spike 결과를 바탕으로 공통 기술 및 구조 결정
6. 공통 환경 구축 후 주요 기능 정식 구현
7. Android / iOS 크로스플랫폼 앱으로 확장

## Spike Git 운영

Spike 단계에서는 각 팀원이 본인의 `spike/{이름}` 브랜치를 기준으로
기능 구현 가능성을 자유롭게 검증합니다.

Spike 단계의 브랜치 운영, PR 규칙, Git Tag를 이용한 최종 결과 보관 방법은
아래 문서에서 확인할 수 있습니다.

- [📌 React Native Spike Git 운영 안내](https://app.notion.com/p/React-Native-Spike-Git-3ba1f5902b508050be0fe73ab3e05603?source=copy_link)

> Spike에서 작성한 코드는 실제 앱에 바로 병합하지 않습니다.  
> 기능 검증이 완료되면 결과를 정리한 뒤, 공통 구조를 새로 구성하여 정식 개발을 진행합니다.

## 기존 프로젝트

### Android Native

- Kotlin
- Jetpack Compose
- Android 전용

## React Native 프로젝트

- React Native
- TypeScript
- Android / iOS

## Spike 결과

- [품목 검색, 즐겨찾기와 홈 React Native Spike](./spikes/item-search/README.md)
