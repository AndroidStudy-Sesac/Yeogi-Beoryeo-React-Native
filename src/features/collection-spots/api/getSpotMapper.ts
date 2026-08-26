import type { CollectionSpot } from '../model/CollectionSpot';
import type { GetSpotItemDto } from './getSpotTypes';
import { mapCollectionSpotType } from './spotTypeMapper';

const toSafeString = (value?: string | null) => value?.trim() ?? '';

const toNullableText = (value?: string | null) => {
  const normalized = value?.trim();

  return normalized ? normalized : null;
};

const createSpotId = (
  name: string,
  address: string,
  detailLocation: string | null
) => [name, address, detailLocation].filter(Boolean).join('_');

const isMappableGetSpotItem = (item: GetSpotItemDto) =>
  Boolean(toSafeString(item.spotNm)) && Boolean(toSafeString(item.addrBase));

export const mapGetSpotItemToCollectionSpot = (
  item: GetSpotItemDto
): CollectionSpot => {
  const name = toSafeString(item.spotNm);
  const address = toSafeString(item.addrBase);
  const detailLocation = toNullableText(item.addrDtl);

  return {
    id: createSpotId(name, address, detailLocation),
    name,
    type: mapCollectionSpotType(name, detailLocation),
    address,
    detailLocation,
    coordinate: null,
    distanceMeter: null,
    isBookmarked: false,
  };
};

export const mapGetSpotItemsToCollectionSpots = (
  items: GetSpotItemDto[]
): CollectionSpot[] =>
  items.filter(isMappableGetSpotItem).map(mapGetSpotItemToCollectionSpot);
