import { fireEvent, render, screen } from "@testing-library/react-native";
import { RegionalGuideScreen } from "./RegionalGuideScreen";

describe("RegionalGuideScreen", () => {
  it("시도·시군구·읍면동을 각각 드롭다운으로 연다", () => {
    render(<RegionalGuideScreen />);

    expect(screen.queryByLabelText("시·도 옵션: 제주특별자치도")).toBeNull();
    expect(screen.getByLabelText("시·군·구 선택 드롭다운")).toBeDisabled();
    expect(screen.getByLabelText("읍면동 선택 드롭다운")).toBeDisabled();

    fireEvent.press(screen.getByLabelText("시·도 선택 드롭다운"));
    fireEvent.press(screen.getByLabelText("시·도 옵션: 제주특별자치도"));
    fireEvent.press(screen.getByLabelText("시·군·구 선택 드롭다운"));

    expect(screen.getByLabelText("시·군·구 옵션: 제주시")).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText("시·군·구 옵션: 제주시"));
    fireEvent.press(screen.getByLabelText("읍면동 선택 드롭다운"));

    expect(screen.getByLabelText("읍면동 옵션: 일도1동")).toBeOnTheScreen();
  });

  it("제주 지역 선택 후 조회 결과를 같은 화면에 반영한다", () => {
    render(<RegionalGuideScreen />);

    selectJejuRegion();
    fireEvent.press(screen.getByText("조회"));

    expect(
      screen.getAllByText("제주특별자치도 > 제주시 > 일도1동"),
    ).toHaveLength(2);
    expect(screen.getByText("선택한 지역")).toBeOnTheScreen();
  });

  it("상위 지역을 변경하면 하위 드롭다운 선택을 초기화한다", () => {
    render(<RegionalGuideScreen />);

    selectJejuRegion();
    fireEvent.press(screen.getByLabelText("시·도 선택 드롭다운"));
    fireEvent.press(screen.getByLabelText("시·도 옵션: 서울특별시"));

    expect(screen.getByText("시·군·구 선택")).toBeOnTheScreen();
    expect(screen.getByLabelText("읍면동 선택 드롭다운")).toBeDisabled();

    fireEvent.press(screen.getByLabelText("시·군·구 선택 드롭다운"));
    fireEvent.press(screen.getByLabelText("시·군·구 옵션: 강남구"));
    fireEvent.press(screen.getByLabelText("읍면동 선택 드롭다운"));

    expect(screen.queryByLabelText("읍면동 옵션: 일도1동")).toBeNull();
    expect(screen.getByLabelText("읍면동 옵션: 역삼1동")).toBeOnTheScreen();
  });
});

function selectJejuRegion() {
  fireEvent.press(screen.getByLabelText("시·도 선택 드롭다운"));
  fireEvent.press(screen.getByLabelText("시·도 옵션: 제주특별자치도"));
  fireEvent.press(screen.getByLabelText("시·군·구 선택 드롭다운"));
  fireEvent.press(screen.getByLabelText("시·군·구 옵션: 제주시"));
  fireEvent.press(screen.getByLabelText("읍면동 선택 드롭다운"));
  fireEvent.press(screen.getByLabelText("읍면동 옵션: 일도1동"));
}
