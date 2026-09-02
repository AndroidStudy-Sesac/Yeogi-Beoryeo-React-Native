import { fireEvent, render, screen } from "@testing-library/react-native";

import type { RegionSearchPerformanceSnapshot } from "../data/regionSearchClient";
import {
  isRegionPerformanceSpikeEnabled,
  RegionPerformancePanel,
} from "./RegionPerformancePanel";

describe("RegionPerformancePanel", () => {
  const originalSpikeFlag =
    process.env.EXPO_PUBLIC_ENABLE_REGION_PERFORMANCE_SPIKE;
  const searchPerformance: RegionSearchPerformanceSnapshot = {
    indexBuildCount: 1,
    indexBuildMilliseconds: 12,
    indexCandidateCount: 3_132,
    indexLookupKeyCount: 3_097,
    firstRequestMilliseconds: 14,
    latestRequestMilliseconds: 1,
    firstSearchMilliseconds: 2,
    latestSearchMilliseconds: 1,
    searchCount: 2,
  };

  afterEach(() => {
    if (originalSpikeFlag === undefined) {
      delete process.env.EXPO_PUBLIC_ENABLE_REGION_PERFORMANCE_SPIKE;
      return;
    }
    process.env.EXPO_PUBLIC_ENABLE_REGION_PERFORMANCE_SPIKE = originalSpikeFlag;
  });

  it("명시적인 Spike 환경 변수로만 측정 패널을 활성화한다", () => {
    delete process.env.EXPO_PUBLIC_ENABLE_REGION_PERFORMANCE_SPIKE;
    expect(isRegionPerformanceSpikeEnabled()).toBe(false);

    process.env.EXPO_PUBLIC_ENABLE_REGION_PERFORMANCE_SPIKE = "1";
    expect(isRegionPerformanceSpikeEnabled()).toBe(true);
  });

  it("기본 상태에서는 측정 상세를 숨기고 검색 화면 높이를 차지하지 않는다", () => {
    render(<RegionPerformancePanel searchPerformance={searchPerformance} />);

    expect(screen.getByLabelText("Spike 성능 측정 열기")).toHaveProp(
      "accessibilityState",
      { expanded: false },
    );
    expect(screen.queryByText(/asset 1\.34MiB/)).toBeNull();
    expect(screen.queryByText(/첫 요청 총/)).toBeNull();
  });

  it("사용자가 열었을 때만 첫 요청과 순수 검색 측정값을 표시한다", () => {
    render(<RegionPerformancePanel searchPerformance={searchPerformance} />);

    fireEvent.press(screen.getByLabelText("Spike 성능 측정 열기"));

    expect(screen.getByText(/asset 1\.34MiB/)).toBeOnTheScreen();
    expect(screen.getByText(/첫 요청 총 14\.00ms/)).toBeOnTheScreen();
    expect(screen.getByText(/순수 검색: 첫 2\.00ms/)).toBeOnTheScreen();
    expect(screen.getByLabelText("Spike 성능 측정 접기")).toHaveProp(
      "accessibilityState",
      { expanded: true },
    );

    fireEvent.press(screen.getByLabelText("Spike 성능 측정 접기"));
    expect(screen.queryByText(/첫 요청 총/)).toBeNull();
  });
});
