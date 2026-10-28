# 품목 데이터 기준

원본은 안드로이드 앱 v1.1.0, 커밋 `b3b7db10f29c8c4d6dfc70a77f446ed0a3f2bb56`의 `data/src/main/assets`입니다. `item_disposal_guides.json`의 품목 730개와 배출 안내는 원본 바이트를 유지합니다.

## 동의어 보정

[KAN-19](https://yeogi-beoryeo-rn.atlassian.net/browse/KAN-19), [GitHub #96](https://github.com/AndroidStudy-Sesac/Yeogi-Beoryeo-React-Native/issues/96)에서 직접 검색되지 않는 연결값 5개를 기존 품목명으로 보정했습니다. 원본 저장소의 파일과 나머지 동의어 30개, 검색 알고리즘은 변경하지 않았습니다.

| 검색어 | 원본 연결값 | 보정 연결값 | 예상 품목 ID |
| --- | --- | --- | --- |
| 투명병 | 투명페트병 | 무색페트병 | item-guide-0003 |
| 쓰레기봉투 | 종량제봉투 | 일반종량제폐기물 | item-guide-0014 |
| 음쓰 | 음식물쓰레기 | 음식물류폐기물 | item-guide-0013 |
| 안쓰는옷 | 헌옷 | 의류, 원단 | item-guide-0230 |
| 낡은옷 | 헌옷 | 의류, 원단 | item-guide-0230 |

원본 품목명과 배출 안내를 기준으로 연결했습니다. 의류 검색은 특정 의류 한 종류 대신 일반 안내로 연결합니다. 해당 품목은 깨끗한 의류의 배출 방법과 지역별 배출 조건을 안내합니다. 오염되거나 재사용이 어려운 의류의 배출 방법은 명시되어 있지 않습니다.

`itemCatalog.test.ts`에서 각 검색 결과의 품목 ID와 순서를 검증합니다. 모든 동의어 연결값은 다른 동의어를 거치지 않고 직접 검색되어야 합니다. 원문 검색을 우선하는 규칙은 `itemSearch.test.ts`에서 검증합니다.
