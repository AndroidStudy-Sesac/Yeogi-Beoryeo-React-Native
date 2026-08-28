import type { SelectedRegion } from "./Region";

export type RegionSearchInputType = "empty" | "address" | "region-keyword";

export interface RegionSearchCandidate {
  id: string;
  region: SelectedRegion;
  displayName: string;
}

export type RegionSearchResult =
  | { status: "resolved"; candidate: RegionSearchCandidate }
  | { status: "candidates"; candidates: RegionSearchCandidate[] }
  | { status: "not-found" };
