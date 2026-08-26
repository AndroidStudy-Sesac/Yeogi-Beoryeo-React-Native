export type GetSpotItemDto = {
  spotNm?: string | null;
  addrBase?: string | null;
  addrDtl?: string | null;
};

export type GetSpotResponseDto = {
  response: {
    header: {
      resultCode: string;
      resultMsg: string;
    };
    body: {
      items?: {
        item?: GetSpotItemDto[] | GetSpotItemDto | null;
      } | null;
      numOfRows?: number | string | null;
      pageNo?: number | string | null;
      totalCount?: number | string | null;
    };
  };
};

export type GetSpotPageResult = {
  items: GetSpotItemDto[];
  pageNo: number | null;
  numOfRows: number | null;
  totalCount: number | null;
};
