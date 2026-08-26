export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type CollectionSpotType =
  | 'SMALL_E_WASTE_BIN'
  | 'BATTERY_BIN'
  | 'PHONE_DROP_OFF'
  | 'RECYCLING_CENTER'
  | 'STANDARD_BAG_STORE'
  | 'MEDICINE_DROP_BOX'
  | 'FLUORESCENT_LAMP_BIN'
  | 'CLOTHING_BIN'
  | 'ICE_PACK_BIN'
  | 'WASTE_COOKING_OIL_BIN'
  | 'HAZARDOUS_WASTE_BIN'
  | 'OTHER';

export type CollectionSpot = {
  id: string;
  name: string;
  type: CollectionSpotType;
  address: string;
  detailLocation: string | null;
  coordinate: Coordinate | null;
  distanceMeter: number | null;
  isBookmarked: boolean;
};
