# 품목 아이콘

`itemIcons.json`은 기존 Android 앱 v1.1.0의 vector drawable에서 viewport와 path를 가져온 파일입니다. 기준 커밋은 `b3b7db10f29c8c4d6dfc70a77f446ed0a3f2bb56`입니다.

품목 아이콘은 `presentation/src/main/res/drawable/ic_disposal_category_*.xml`, 공통 동작 아이콘은 `common/src/main/res/drawable`을 기준으로 합니다. Android vector의 경로와 채우기 규칙을 보존하며, 원본과 같은 테마 색상을 적용합니다.

즐겨찾기 별은 `common/src/main/res/drawable/ic_favorite*.xml`을 기준으로 합니다. 안내 배너의 위치, 정보, 목록과 화살표는 원본 `ItemUsefulGuideBannerRow.kt`에서 사용하는 Material Filled 도형을 적용합니다.

`homeStrings.json`은 같은 커밋의 `presentation/src/main/res/values/strings.xml`에서 홈 안내, 품목 상세 동작과 즐겨찾기 문구를 가져왔습니다. 화면에 표시할 때 프로젝트의 문장 부호 규칙을 적용합니다.

`../../data/assets/representative_guide_details.json`은 원본 `data/src/main/assets/representative_guide_details.json`을 그대로 사용합니다. 19개 대표 분류의 식별자, 표시 순서, 상세 내용, 표와 수거 유형을 보존합니다. 품목 검색 사전과 구분된 식별자로 저장합니다.
