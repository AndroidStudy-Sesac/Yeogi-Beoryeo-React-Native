import { fireEvent, render, screen } from "@testing-library/react-native";
import { RegionalGuideScreen } from "./RegionalGuideScreen";

describe("RegionalGuideScreen", () => {
  it("시도부터 읍면동까지 순서대로 선택한다", () => {
    render(<RegionalGuideScreen />);

    fireEvent.press(screen.getByText("서울특별시"));
    fireEvent.press(screen.getByText("강남구"));
    fireEvent.press(screen.getByText("역삼1동"));

    expect(screen.getByText("서울특별시 > 강남구 > 역삼1동")).toBeOnTheScreen();
  });

  it("제주특별자치도부터 일도1동까지 순서대로 선택한다", () => {
    render(<RegionalGuideScreen />);

    fireEvent.press(screen.getByText("제주특별자치도"));
    fireEvent.press(screen.getByText("제주시"));
    fireEvent.press(screen.getByText("일도1동"));

    expect(
      screen.getByText("제주특별자치도 > 제주시 > 일도1동"),
    ).toBeOnTheScreen();
  });

  it("상위 지역을 변경하면 기존 하위 선택을 초기화한다", () => {
    render(<RegionalGuideScreen />);

    fireEvent.press(screen.getByText("서울특별시"));
    fireEvent.press(screen.getByText("강남구"));
    fireEvent.press(screen.getByText("역삼1동"));
    fireEvent.press(screen.getByText("제주특별자치도"));

    expect(
      screen.queryByText("서울특별시 > 강남구 > 역삼1동"),
    ).toBeNull();
    expect(screen.queryByText("강남구")).toBeNull();
    expect(screen.queryByText("역삼1동")).toBeNull();

    fireEvent.press(screen.getByText("제주시"));
    fireEvent.press(screen.getByText("일도1동"));
    fireEvent.press(screen.getByText("서귀포시"));

    expect(
      screen.queryByText("제주특별자치도 > 제주시 > 일도1동"),
    ).toBeNull();
    expect(screen.queryByText("일도1동")).toBeNull();
  });
});
