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
});
