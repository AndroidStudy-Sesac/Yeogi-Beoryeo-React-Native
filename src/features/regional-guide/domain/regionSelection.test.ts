import type { Region } from './Region';
import { selectRegion } from './regionSelection';

const sido: Region = { id: 'sido:11', level: 'sido', name: '서울특별시' };
const sigungu: Region = {
  id: 'sigungu:11680',
  level: 'sigungu',
  name: '강남구',
  parentId: sido.id,
};
const eupmyeondong: Region = {
  id: 'eupmyeondong:1168064000',
  level: 'eupmyeondong',
  name: '역삼1동',
  parentId: sigungu.id,
};

describe('지역 단계 선택', () => {
  it('시도가 바뀌면 시군구와 읍면동을 초기화합니다', () => {
    const nextSido: Region = { id: 'sido:26', level: 'sido', name: '부산광역시' };
    expect(
      selectRegion({ sido, sigungu, eupmyeondong }, 'sido', nextSido),
    ).toEqual({ sido: nextSido });
  });

  it('시군구가 바뀌면 읍면동만 초기화합니다', () => {
    const nextSigungu: Region = {
      id: 'sigungu:11710',
      level: 'sigungu',
      name: '송파구',
      parentId: sido.id,
    };
    expect(
      selectRegion({ sido, sigungu, eupmyeondong }, 'sigungu', nextSigungu),
    ).toEqual({ sido, sigungu: nextSigungu });
  });
});
