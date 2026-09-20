import type { RegionSelection } from './Region';

export type RegionSearchCandidate = Readonly<{
  id: string;
  displayName: string;
  region: RegionSelection;
}>;

export type RegionSearchResult =
  | Readonly<{ status: 'resolved'; candidate: RegionSearchCandidate }>
  | Readonly<{
      status: 'candidates';
      candidates: readonly RegionSearchCandidate[];
    }>
  | Readonly<{ status: 'not-found' }>;

export type RegionSearchInputType = 'empty' | 'address' | 'region-keyword';
