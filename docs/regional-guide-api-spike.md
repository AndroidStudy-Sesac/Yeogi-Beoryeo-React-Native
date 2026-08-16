# 지역별 배출 안내 API 스파이크 (#14)

## 확인한 API 계약

- API: 행정안전부 생활쓰레기배출정보 조회서비스
- URL: `GET https://apis.data.go.kr/1741000/household_waste_info/info`
- 지역 조건: `cond[SGG_NM::LIKE]={시군구명}`
- 기본 파라미터: `serviceKey`, `pageNo=1`, `numOfRows=100`, `returnType=json`
- 응답 경로: `response.body.items.item`

기존 Android 구현의 `RegionalGuideApiService`와 DTO를 기준으로 확인했습니다. RN 구현도 같은 시군구 조건과 JSON 응답 구조를 사용합니다.

## 구현 결과

- `AbortSignal`을 요청에 전달하므로 화면 전환이나 새 지역 선택 시 이전 요청을 취소할 수 있습니다. 호출자는 `AbortError`를 정상적인 실패 결과로 처리하지 않고 취소로 구분합니다.
- `totalCount`가 페이지 크기를 초과하면 모든 페이지를 순서대로 조회합니다.
- 응답 DTO의 누락·공백·형식 오류는 안전하게 제외하거나 `undefined`로 변환합니다. 성공 헤더·본문이 없는 응답은 결과 없음이 아닌 API 오류로 처리합니다.
- 일반생활폐기물(`LF_WST`), 음식물(`FOD_WST`), 재활용품(`RCYCL`)의 요일·시간·방법을 공통 `RegionalWasteSchedule` 모델로 변환하고, 공통 배출 장소(`EMSN_PLC`)와 장소 유형(`EMSN_PLC_TYPE`)도 함께 보존합니다.
- 결과는 성공, 결과 없음, 네트워크 오류, API 오류, 구성 오류, 알 수 없는 오류로 구분합니다.

## API 키 관리

로컬 스파이크는 `.env`의 `EXPO_PUBLIC_HOUSEHOLD_WASTE_SERVICE_KEY`를 사용합니다. `createRegionalGuideApiClient()`는 기본적으로 `getRegionalGuideApiConfig()`을 사용해 Expo의 정적 환경 변수 접근 방식으로 값을 읽으며, `.env`만 Git에서 제외됩니다. `.env.example`에는 빈 변수만 둡니다. `.env`를 변경한 뒤에는 Metro를 다시 시작해 값을 새로 주입해야 합니다.

단, Expo의 `EXPO_PUBLIC_` 값은 Android APK와 iOS 번들에 포함되므로 비밀값을 보호하지 못합니다. 이 방식은 호출·매핑 검증에만 허용하고, 정식 개발에서는 BFF 또는 프록시가 키를 보관하고 앱은 자체 API만 호출해야 합니다. 서버에서는 사용자 인증, 요청 제한, 허용된 시군구 파라미터 검증과 응답 캐시를 함께 적용합니다.

## Android / iOS 검증 범위

같은 `fetch` 기반 요청과 표준 `AbortSignal`을 사용하므로 Android와 iOS 모두 동일한 호출 경로를 사용합니다. iOS의 ATS 정책은 HTTPS인 이 API URL에 추가 예외를 요구하지 않습니다.

### Android 실제 API 검증 결과 (2026-08-16)

기존 Android 데이터 모듈의 API 계약 테스트를 로컬 키로 실행하여 `경기도 수원시`를 조회했습니다. 키와 응답 원문은 출력하거나 저장소에 기록하지 않았습니다.

| 항목 | 결과 |
| --- | ---: |
| `/info` API 응답 행 | 1 |
| API 고유 지역 | 1 |
| 지역 가이드 availability 자산 | 1 |
| 자산과 API의 차이 | 0 |

React Native의 실제 기기 네트워크 확인은 유효한 발급 키를 로컬 `.env`에만 주입해 같은 시군구 조건으로 실행하면 됩니다.
