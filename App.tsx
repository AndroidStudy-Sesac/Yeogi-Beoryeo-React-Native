import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';
import {
  Alert,
  Animated,
  Keyboard,
  Linking,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  NaverMapMarkerOverlay,
  NaverMapView,
  type MarkerSymbol,
  type NaverMapViewRef,
} from '@mj-studio/react-native-naver-map';
import { StatusBar } from 'expo-status-bar';
import {
  createGetSpotClient,
  type CollectionSpot,
  type GetSpotSearchResult,
} from './src/features/collection-spots';

const SEOUL_CITY_HALL = {
  label: '서울시청',
  latitude: 37.5666103,
  longitude: 126.9783882,
  zoom: 15,
};

const GANGNAM_STATION = {
  label: '강남역',
  latitude: 37.497952,
  longitude: 127.027619,
  zoom: 16,
};

const NEARBY_SEARCH_RADIUS_METER = 1000;

type LocationPermissionStatus =
  | 'unknown'
  | 'checking'
  | 'requestable'
  | 'granted'
  | 'denied'
  | 'blocked'
  | 'unavailable';

type LocationLookupStatus =
  | 'idle'
  | 'locating'
  | 'success'
  | 'permission-undetermined'
  | 'permission-denied'
  | 'permission-blocked'
  | 'location-service-disabled'
  | 'unavailable'
  | 'unknown-error';

type CurrentCoordinate = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
};

type DistrictSearchStatus =
  | 'idle'
  | 'loading'
  | 'validation-error'
  | GetSpotSearchResult['status'];

type NearbySearchStatus =
  | 'idle'
  | 'loading'
  | 'location-unavailable'
  | GetSpotSearchResult['status'];

type ActiveSpotResultSource = 'district' | 'nearby' | 'sample';

type MappableCollectionSpot = CollectionSpot & {
  coordinate: NonNullable<CollectionSpot['coordinate']>;
};

type BottomSheetSnapPoint = 'collapsed' | 'half' | 'expanded';

const permissionLabels: Record<LocationPermissionStatus, string> = {
  unknown: '권한 미확인',
  checking: '권한 확인 중',
  requestable: '권한 요청 가능',
  granted: '권한 허용됨',
  denied: '권한 거부됨',
  blocked: '설정에서 권한 필요',
  unavailable: '위치 사용 불가',
};

const lookupLabels: Record<LocationLookupStatus, string> = {
  idle: '현재 위치 미조회',
  locating: '현재 위치 조회 중',
  success: '현재 위치 조회 완료',
  'permission-undetermined': '권한 요청 미완료',
  'permission-denied': '권한 요청 후 다시 시도 필요',
  'permission-blocked': '설정에서 위치 권한 허용 필요',
  'location-service-disabled': '기기 위치 서비스가 꺼져 있음',
  unavailable: '현재 위치를 사용할 수 없음',
  'unknown-error': '위치 조회 실패',
};

const districtSearchLabels: Record<DistrictSearchStatus, string> = {
  idle: '동/읍/면 검색 대기',
  loading: '검색 중',
  'validation-error': '동/읍/면 이름을 입력해 주세요',
  success: '검색 완료',
  empty: '검색 결과 없음',
  'configuration-error': 'API 키 설정 필요',
  'network-error': '네트워크 오류',
  'api-error': '공공데이터 API 오류',
  'parse-error': '응답 해석 실패',
  cancelled: '이전 검색 취소됨',
};

const nearbySearchLabels: Record<NearbySearchStatus, string> = {
  idle: '현재 위치 주변 검색 대기',
  loading: '현재 위치 주변 검색 중',
  'location-unavailable': '현재 위치 없음',
  success: '주변 검색 완료',
  empty: '주변 검색 결과 없음',
  'configuration-error': 'API 키 설정 필요',
  'network-error': '네트워크 오류',
  'api-error': '공공데이터 API 오류',
  'parse-error': '응답 해석 실패',
  cancelled: '이전 주변 검색 취소됨',
};

const spotTypeLabels: Record<CollectionSpot['type'], string> = {
  SMALL_E_WASTE_BIN: '소형 폐가전',
  BATTERY_BIN: '폐건전지',
  PHONE_DROP_OFF: '폐휴대폰',
  RECYCLING_CENTER: '재활용 거점',
  STANDARD_BAG_STORE: '종량제 봉투',
  MEDICINE_DROP_BOX: '폐의약품',
  FLUORESCENT_LAMP_BIN: '폐형광등',
  CLOTHING_BIN: '의류',
  ICE_PACK_BIN: '아이스팩',
  WASTE_COOKING_OIL_BIN: '폐식용유',
  HAZARDOUS_WASTE_BIN: '유해폐기물',
  OTHER: '기타',
};

const spotMarkerSymbols: Record<CollectionSpot['type'], MarkerSymbol> = {
  SMALL_E_WASTE_BIN: 'green',
  BATTERY_BIN: 'yellow',
  PHONE_DROP_OFF: 'lightblue',
  RECYCLING_CENTER: 'blue',
  STANDARD_BAG_STORE: 'gray',
  MEDICINE_DROP_BOX: 'pink',
  FLUORESCENT_LAMP_BIN: 'yellow',
  CLOTHING_BIN: 'green',
  ICE_PACK_BIN: 'lightblue',
  WASTE_COOKING_OIL_BIN: 'blue',
  HAZARDOUS_WASTE_BIN: 'red',
  OTHER: 'gray',
};

const bottomSheetSnapLabels: Record<BottomSheetSnapPoint, string> = {
  collapsed: '요약',
  half: '중간',
  expanded: '확장',
};

const bottomSheetSnapOrder: BottomSheetSnapPoint[] = [
  'collapsed',
  'half',
  'expanded',
];

const SPIKE_MARKER_SAMPLE_SPOTS: CollectionSpot[] = [
  {
    id: 'spike-sample-clothing-city-hall',
    name: '시청역 의류 수거함',
    type: 'CLOTHING_BIN',
    address: '서울특별시 중구 세종대로 110',
    detailLocation: '시청역 5번 출구 인근',
    coordinate: {
      latitude: 37.5668,
      longitude: 126.9786,
    },
    distanceMeter: null,
    isBookmarked: false,
  },
  {
    id: 'spike-sample-battery-mugyo',
    name: '무교동 폐건전지 수거함',
    type: 'BATTERY_BIN',
    address: '서울특별시 중구 무교로 21',
    detailLocation: '주민센터 입구',
    coordinate: {
      latitude: 37.5685,
      longitude: 126.9781,
    },
    distanceMeter: null,
    isBookmarked: false,
  },
  {
    id: 'spike-sample-bag-gangnam',
    name: '강남역 종량제 봉투 판매소',
    type: 'STANDARD_BAG_STORE',
    address: '서울특별시 강남구 강남대로 396',
    detailLocation: '강남역 11번 출구 편의점',
    coordinate: {
      latitude: 37.4984,
      longitude: 127.0278,
    },
    distanceMeter: null,
    isBookmarked: false,
  },
  {
    id: 'spike-sample-medicine-gangnam',
    name: '역삼동 폐의약품 수거함',
    type: 'MEDICINE_DROP_BOX',
    address: '서울특별시 강남구 테헤란로 152',
    detailLocation: '약국 내부',
    coordinate: {
      latitude: 37.5003,
      longitude: 127.0362,
    },
    distanceMeter: null,
    isBookmarked: false,
  },
  {
    id: 'spike-sample-list-only',
    name: '좌표 없는 수거 장소 샘플',
    type: 'OTHER',
    address: '서울특별시 중구 좌표없는길 1',
    detailLocation: 'list-only fallback 검증용',
    coordinate: null,
    distanceMeter: null,
    isBookmarked: false,
  },
];

const isValidCoordinate = (
  coordinate: CollectionSpot['coordinate']
): coordinate is MappableCollectionSpot['coordinate'] =>
  coordinate !== null &&
  Number.isFinite(coordinate.latitude) &&
  Number.isFinite(coordinate.longitude) &&
  coordinate.latitude >= -90 &&
  coordinate.latitude <= 90 &&
  coordinate.longitude >= -180 &&
  coordinate.longitude <= 180;

const getMappableSpots = (
  spots: CollectionSpot[]
): MappableCollectionSpot[] =>
  spots.filter(
    (spot): spot is MappableCollectionSpot => isValidCoordinate(spot.coordinate)
  );

const mapPermission = (
  response: Location.LocationPermissionResponse
): LocationPermissionStatus => {
  if (response.granted) {
    return 'granted';
  }

  if (response.status === Location.PermissionStatus.UNDETERMINED) {
    return 'requestable';
  }

  return response.canAskAgain ? 'denied' : 'blocked';
};

const describePermissionDetails = (
  response: Location.LocationPermissionResponse
) => {
  const statusLabels: Record<Location.PermissionStatus, string> = {
    [Location.PermissionStatus.DENIED]: '거부됨',
    [Location.PermissionStatus.GRANTED]: '허용됨',
    [Location.PermissionStatus.UNDETERMINED]: '미결정',
  };
  const requestLabel = response.canAskAgain ? '재요청 가능' : '설정 필요';

  if (Platform.OS === 'ios') {
    const scopeLabels: Record<
      NonNullable<Location.LocationPermissionResponse['ios']>['scope'],
      string
    > = {
      always: '항상 허용',
      none: '권한 없음',
      whenInUse: '앱 사용 중',
    };
    const accuracyLabels: Record<
      NonNullable<Location.LocationPermissionResponse['ios']>['accuracy'],
      string
    > = {
      full: '정확한 위치',
      reduced: '대략적인 위치',
    };

    const iosDetail = response.ios
      ? `iOS: ${scopeLabels[response.ios.scope]} / ${accuracyLabels[response.ios.accuracy]}`
      : 'iOS 권한 세부정보 미확인';

    return `${iosDetail} / ${statusLabels[response.status]} / ${requestLabel}`;
  }

  if (Platform.OS === 'android') {
    const accuracyLabels: Record<
      NonNullable<Location.LocationPermissionResponse['android']>['accuracy'],
      string
    > = {
      coarse: '대략적인 위치',
      fine: '정확한 위치',
      none: '권한 없음',
    };

    const androidDetail = response.android
      ? `Android: ${accuracyLabels[response.android.accuracy]}`
      : 'Android 권한 세부정보 미확인';

    return `${androidDetail} / ${statusLabels[response.status]} / ${requestLabel}`;
  }

  return `${Platform.OS}: 권한 세부정보 미확인 / ${statusLabels[response.status]} / ${requestLabel}`;
};

export default function App() {
  const { height: windowHeight } = useWindowDimensions();
  const mapRef = useRef<NaverMapViewRef>(null);
  const getSpotClient = useMemo(() => createGetSpotClient(), []);
  const searchAbortControllerRef = useRef<AbortController | null>(null);
  const searchRequestIdRef = useRef(0);
  const [bottomSheetDragY] = useState(() => new Animated.Value(0));
  const [cameraLabel, setCameraLabel] = useState('37.5666, 126.9784 / z15.0');
  const [permissionStatus, setPermissionStatus] =
    useState<LocationPermissionStatus>('unknown');
  const [lookupStatus, setLookupStatus] =
    useState<LocationLookupStatus>('idle');
  const [permissionDetail, setPermissionDetail] = useState<string | null>(null);
  const [currentCoordinate, setCurrentCoordinate] =
    useState<CurrentCoordinate | null>(null);
  const [districtKeyword, setDistrictKeyword] = useState('');
  const [lastSearchedDistrict, setLastSearchedDistrict] = useState<
    string | null
  >(null);
  const [districtSearchStatus, setDistrictSearchStatus] =
    useState<DistrictSearchStatus>('idle');
  const [districtSearchMessage, setDistrictSearchMessage] =
    useState<string | null>(null);
  const [nearbySearchStatus, setNearbySearchStatus] =
    useState<NearbySearchStatus>('idle');
  const [nearbySearchMessage, setNearbySearchMessage] =
    useState<string | null>(null);
  const [spotSearchResultCount, setSpotSearchResultCount] = useState(0);
  const [spotSearchResults, setSpotSearchResults] = useState<CollectionSpot[]>(
    []
  );
  const [activeSpotResultSource, setActiveSpotResultSource] =
    useState<ActiveSpotResultSource | null>(null);
  const [isSpotSearchPartial, setIsSpotSearchPartial] = useState(false);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [bottomSheetSnapPoint, setBottomSheetSnapPoint] =
    useState<BottomSheetSnapPoint>('half');

  const bottomSheetHeights = useMemo(
    () => ({
      collapsed: 148,
      half: Math.min(Math.max(windowHeight * 0.42, 300), 420),
      expanded: Math.min(Math.max(windowHeight * 0.72, 520), windowHeight - 118),
    }),
    [windowHeight]
  );
  const mappableSpotResults = useMemo(
    () => getMappableSpots(spotSearchResults),
    [spotSearchResults]
  );
  const selectedSpot = useMemo(
    () => spotSearchResults.find((spot) => spot.id === selectedSpotId) ?? null,
    [selectedSpotId, spotSearchResults]
  );

  useEffect(() => {
    let isMounted = true;

    const checkInitialPermission = async () => {
      try {
        setPermissionStatus('checking');

        const permission = await Location.getForegroundPermissionsAsync();

        if (!isMounted) {
          return;
        }

        setPermissionStatus(mapPermission(permission));
        setPermissionDetail(describePermissionDetails(permission));
      } catch {
        if (!isMounted) {
          return;
        }

        setPermissionStatus('unknown');
        setPermissionDetail('위치 권한 상태를 확인하지 못했습니다.');
      }
    };

    checkInitialPermission();

    return () => {
      isMounted = false;
    };
  }, []);

  const moveCamera = (target: typeof SEOUL_CITY_HALL) => {
    mapRef.current?.animateCameraTo({
      latitude: target.latitude,
      longitude: target.longitude,
      zoom: target.zoom,
      duration: 700,
      easing: 'EaseOut',
    });
  };

  const moveToCoordinate = (coordinate: CurrentCoordinate) => {
    mapRef.current?.animateCameraTo({
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      zoom: 16,
      duration: 700,
      easing: 'EaseOut',
    });
  };

  const resetBottomSheetDrag = useCallback(() => {
    Animated.spring(bottomSheetDragY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  }, [bottomSheetDragY]);

  const changeBottomSheetSnapPoint = (nextSnapPoint: BottomSheetSnapPoint) => {
    Keyboard.dismiss();
    setBottomSheetSnapPoint(nextSnapPoint);
    resetBottomSheetDrag();
  };

  const selectSpot = (spot: CollectionSpot) => {
    setSelectedSpotId(spot.id);
    changeBottomSheetSnapPoint('half');

    if (isValidCoordinate(spot.coordinate)) {
      moveToCoordinate(spot.coordinate);
    }
  };

  const bottomSheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dy) > 8 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderGrant: () => {
          Keyboard.dismiss();
        },
        onPanResponderMove: (_, gestureState) => {
          const limitedDy = Math.max(-90, Math.min(90, gestureState.dy));

          bottomSheetDragY.setValue(limitedDy);
        },
        onPanResponderRelease: (_, gestureState) => {
          const currentIndex =
            bottomSheetSnapOrder.indexOf(bottomSheetSnapPoint);
          const nextIndex =
            gestureState.dy > 48 || gestureState.vy > 0.7
              ? Math.max(currentIndex - 1, 0)
              : gestureState.dy < -48 || gestureState.vy < -0.7
                ? Math.min(currentIndex + 1, bottomSheetSnapOrder.length - 1)
                : currentIndex;

          setBottomSheetSnapPoint(bottomSheetSnapOrder[nextIndex]);
          resetBottomSheetDrag();
        },
        onPanResponderTerminate: resetBottomSheetDrag,
      }),
    [bottomSheetDragY, bottomSheetSnapPoint, resetBottomSheetDrag]
  );

  const requestCurrentLocation = async () => {
    try {
      setPermissionStatus('checking');
      setLookupStatus('locating');
      setPermissionDetail(null);

      const permission = await Location.requestForegroundPermissionsAsync();
      const nextPermissionStatus = mapPermission(permission);

      setPermissionStatus(nextPermissionStatus);
      setPermissionDetail(describePermissionDetails(permission));

      if (nextPermissionStatus === 'requestable') {
        setLookupStatus('permission-undetermined');
        setNearbySearchStatus('location-unavailable');
        setNearbySearchMessage('위치 권한 요청이 완료되지 않아 주변 검색을 실행하지 않았습니다.');
        return;
      }

      if (nextPermissionStatus === 'denied') {
        setLookupStatus('permission-denied');
        setNearbySearchStatus('location-unavailable');
        setNearbySearchMessage('위치 권한이 없어 주변 검색을 실행하지 않았습니다.');
        return;
      }

      if (nextPermissionStatus === 'blocked') {
        setLookupStatus('permission-blocked');
        setNearbySearchStatus('location-unavailable');
        setNearbySearchMessage('설정에서 위치 권한을 허용한 뒤 다시 시도해 주세요.');
        return;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();

      if (!servicesEnabled) {
        setPermissionStatus('unavailable');
        setLookupStatus('location-service-disabled');
        setNearbySearchStatus('location-unavailable');
        setNearbySearchMessage('기기 위치 서비스가 꺼져 있어 주변 검색을 실행하지 않았습니다.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const nextCoordinate = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
      };

      setCurrentCoordinate(nextCoordinate);
      setLookupStatus('success');
      moveToCoordinate(nextCoordinate);
      await searchNearbySpots(nextCoordinate);
    } catch (error) {
      setLookupStatus('unknown-error');
      setNearbySearchStatus('location-unavailable');
      setNearbySearchMessage('현재 위치를 가져오지 못해 주변 검색을 실행하지 않았습니다.');
      Alert.alert(
        '현재 위치 조회 실패',
        error instanceof Error
          ? error.message
          : '알 수 없는 오류가 발생했습니다.'
      );
    }
  };

  const openAppSettings = () => {
    Linking.openSettings();
  };

  const searchDistrict = async (keyword = districtKeyword) => {
    const normalizedKeyword = keyword.trim();

    if (!normalizedKeyword) {
      setDistrictSearchStatus('validation-error');
      setDistrictSearchMessage('예: 역삼동, 서교동, 종로1가');
      setSpotSearchResults([]);
      setSpotSearchResultCount(0);
      setActiveSpotResultSource(null);
      setIsSpotSearchPartial(false);
      setSelectedSpotId(null);
      return;
    }

    searchAbortControllerRef.current?.abort();

    const requestId = searchRequestIdRef.current + 1;
    const abortController = new AbortController();

    searchRequestIdRef.current = requestId;
    searchAbortControllerRef.current = abortController;
    setLastSearchedDistrict(normalizedKeyword);
    setActiveSpotResultSource('district');
    setDistrictSearchStatus('loading');
    setDistrictSearchMessage(`${normalizedKeyword} 검색 중`);
    changeBottomSheetSnapPoint('collapsed');
    setSpotSearchResults([]);
    setSpotSearchResultCount(0);
    setIsSpotSearchPartial(false);
    setSelectedSpotId(null);

    const result = await getSpotClient.searchByAddress({
      address: normalizedKeyword,
      signal: abortController.signal,
    });

    if (requestId !== searchRequestIdRef.current) {
      return;
    }

    searchAbortControllerRef.current = null;
    setDistrictSearchStatus(result.status);

    if (result.ok) {
      setSpotSearchResults(result.spots);
      setSpotSearchResultCount(result.spots.length);
      setIsSpotSearchPartial(result.isPartial);
      changeBottomSheetSnapPoint('half');
      setDistrictSearchMessage(
        result.status === 'empty'
          ? `${normalizedKeyword} 검색 결과가 없습니다.`
          : `${normalizedKeyword} 기준 ${result.spots.length}건`
      );
      return;
    }

    if (result.status === 'cancelled') {
      setDistrictSearchMessage(null);
      return;
    }

    setDistrictSearchMessage(result.message);
  };

  const searchNearbySpots = async (coordinate: CurrentCoordinate) => {
    searchAbortControllerRef.current?.abort();

    const requestId = searchRequestIdRef.current + 1;
    const abortController = new AbortController();

    searchRequestIdRef.current = requestId;
    searchAbortControllerRef.current = abortController;
    setActiveSpotResultSource('nearby');
    setNearbySearchStatus('loading');
    setNearbySearchMessage(
      `현재 위치 반경 ${NEARBY_SEARCH_RADIUS_METER}m 검색 중`
    );
    changeBottomSheetSnapPoint('collapsed');
    setSpotSearchResults([]);
    setSpotSearchResultCount(0);
    setIsSpotSearchPartial(false);
    setSelectedSpotId(null);

    const result = await getSpotClient.searchByLocation({
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      radiusMeter: NEARBY_SEARCH_RADIUS_METER,
      signal: abortController.signal,
    });

    if (requestId !== searchRequestIdRef.current) {
      return;
    }

    searchAbortControllerRef.current = null;
    setNearbySearchStatus(result.status);

    if (result.ok) {
      setSpotSearchResults(result.spots);
      setSpotSearchResultCount(result.spots.length);
      setIsSpotSearchPartial(result.isPartial);
      changeBottomSheetSnapPoint('half');
      setNearbySearchMessage(
        result.status === 'empty'
          ? `현재 위치 반경 ${NEARBY_SEARCH_RADIUS_METER}m 검색 결과가 없습니다.`
          : `현재 위치 반경 ${NEARBY_SEARCH_RADIUS_METER}m 기준 ${result.spots.length}건`
      );
      return;
    }

    if (result.status === 'cancelled') {
      setNearbySearchMessage(null);
      return;
    }

    setNearbySearchMessage(result.message);
  };

  const loadMarkerSamples = () => {
    searchAbortControllerRef.current?.abort();
    searchAbortControllerRef.current = null;
    searchRequestIdRef.current += 1;
    setActiveSpotResultSource('sample');
    setDistrictSearchStatus('success');
    setDistrictSearchMessage('마커 선택 검증용 Spike 샘플을 표시했습니다.');
    setNearbySearchStatus('idle');
    setNearbySearchMessage(null);
    setSpotSearchResults(SPIKE_MARKER_SAMPLE_SPOTS);
    setSpotSearchResultCount(SPIKE_MARKER_SAMPLE_SPOTS.length);
    setIsSpotSearchPartial(false);
    setSelectedSpotId(null);
    changeBottomSheetSnapPoint('half');

    const firstMappableSampleSpot = getMappableSpots(SPIKE_MARKER_SAMPLE_SPOTS)[0];

    if (firstMappableSampleSpot) {
      moveToCoordinate(firstMappableSampleSpot.coordinate);
    }
  };

  const retryDistrictSearch = () => {
    if (lastSearchedDistrict) {
      searchDistrict(lastSearchedDistrict);
    }
  };

  const canRetryDistrictSearch =
    lastSearchedDistrict !== null &&
    ['network-error', 'api-error', 'parse-error'].includes(
      districtSearchStatus
    );
  const isCurrentLocationActionRunning =
    lookupStatus === 'locating' || nearbySearchStatus === 'loading';
  const resultSourceLabel =
    activeSpotResultSource === 'district' && lastSearchedDistrict
      ? `${lastSearchedDistrict} 검색 결과`
      : activeSpotResultSource === 'nearby'
        ? `현재 위치 반경 ${NEARBY_SEARCH_RADIUS_METER}m 검색 결과`
        : activeSpotResultSource === 'sample'
          ? '마커 선택 Spike 샘플'
          : null;
  const spotSearchStatusLabel =
    activeSpotResultSource === 'nearby'
      ? nearbySearchLabels[nearbySearchStatus]
      : activeSpotResultSource === 'sample'
        ? '샘플 결과 표시 중'
        : districtSearchLabels[districtSearchStatus];
  const hiddenSpotCount = Math.max(
    spotSearchResults.length - mappableSpotResults.length,
    0
  );
  const bottomSheetHeight = bottomSheetHeights[bottomSheetSnapPoint];
  const bottomSheetTranslateY = useMemo(
    () =>
      bottomSheetDragY.interpolate({
        inputRange: [-90, 0, 90],
        outputRange: [-32, 0, 58],
        extrapolate: 'clamp',
      }),
    [bottomSheetDragY]
  );
  const sheetTitle = selectedSpot
    ? '선택 장소'
    : resultSourceLabel ?? '검색 결과';
  const hasSearchResult = spotSearchResults.length > 0;

  return (
    <View style={styles.container}>
      <NaverMapView
        ref={mapRef}
        style={styles.map}
        mapType="Basic"
        initialCamera={SEOUL_CITY_HALL}
        isShowCompass
        isShowScaleBar
        isShowZoomControls
        isScrollGesturesEnabled
        isZoomGesturesEnabled
        logoAlign="BottomLeft"
        logoMargin={{ left: 16, bottom: 24 }}
        onCameraChanged={({ latitude, longitude, zoom }) => {
          const safeZoom = zoom ?? SEOUL_CITY_HALL.zoom;

          setCameraLabel(
            `${latitude.toFixed(4)}, ${longitude.toFixed(4)} / z${safeZoom.toFixed(1)}`
          );
        }}
        onTapMap={() => setSelectedSpotId(null)}
      >
        {currentCoordinate && (
          <NaverMapMarkerOverlay
            latitude={currentCoordinate.latitude}
            longitude={currentCoordinate.longitude}
            width={34}
            height={42}
            zIndex={900}
            image={{ symbol: 'black' }}
            caption={{
              text: '현재 위치',
              color: '#12312A',
              haloColor: '#FFFFFF',
              textSize: 12,
            }}
          />
        )}
        <NaverMapMarkerOverlay
          latitude={SEOUL_CITY_HALL.latitude}
          longitude={SEOUL_CITY_HALL.longitude}
          caption={{ text: SEOUL_CITY_HALL.label }}
          image={{ symbol: 'green' }}
        />
        <NaverMapMarkerOverlay
          latitude={GANGNAM_STATION.latitude}
          longitude={GANGNAM_STATION.longitude}
          caption={{ text: GANGNAM_STATION.label }}
          image={{ symbol: 'blue' }}
        />
        {mappableSpotResults.map((spot) => {
          const isSelected = spot.id === selectedSpotId;

          return (
            <NaverMapMarkerOverlay
              key={spot.id}
              latitude={spot.coordinate.latitude}
              longitude={spot.coordinate.longitude}
              width={isSelected ? 42 : 32}
              height={isSelected ? 52 : 40}
              zIndex={isSelected ? 1000 : 500}
              image={{
                symbol: isSelected ? 'red' : spotMarkerSymbols[spot.type],
              }}
              caption={{
                text: isSelected ? spot.name : spotTypeLabels[spot.type],
                requestedWidth: isSelected ? 180 : 96,
                color: isSelected ? '#991B1B' : '#12312A',
                haloColor: '#FFFFFF',
                textSize: isSelected ? 13 : 11,
                minZoom: isSelected ? 0 : 15,
              }}
              subCaption={
                isSelected
                  ? {
                    text: spot.address,
                    requestedWidth: 180,
                    color: '#4F635D',
                    haloColor: '#FFFFFF',
                    textSize: 10,
                  }
                  : undefined
              }
              isHideCollidedCaptions={!isSelected}
              isForceShowIcon={isSelected}
              onTap={() => selectSpot(spot)}
            />
          );
        })}
      </NaverMapView>

      <View pointerEvents="box-none" style={styles.overlay}>
        <View style={styles.header}>
          <Text style={styles.title}>여기버려 지도 Spike</Text>
          <Text style={styles.description}>{cameraLabel}</Text>
          <Text style={styles.statusText}>
            위치 권한: {permissionLabels[permissionStatus]}
          </Text>
          <Text style={styles.statusText}>
            위치 조회: {lookupLabels[lookupStatus]}
          </Text>
          {permissionDetail && (
            <Text style={styles.statusText}>권한 세부: {permissionDetail}</Text>
          )}
          {currentCoordinate && (
            <Text style={styles.statusText}>
              현재 위치: {currentCoordinate.latitude.toFixed(5)},{' '}
              {currentCoordinate.longitude.toFixed(5)}
              {typeof currentCoordinate.accuracy === 'number'
                ? ` / 정확도 ${Math.round(currentCoordinate.accuracy)}m`
                : ''}
            </Text>
          )}
          <Text style={styles.statusText}>
            주변 검색: {nearbySearchLabels[nearbySearchStatus]}
          </Text>
          {nearbySearchMessage && (
            <Text style={styles.statusText}>{nearbySearchMessage}</Text>
          )}

          <View style={styles.searchSection}>
            <Text style={styles.searchLabel}>동/읍/면 수거 장소 검색</Text>
            <View style={styles.searchRow}>
              <TextInput
                accessibilityLabel="동 읍 면 검색어"
                autoCapitalize="none"
                autoCorrect={false}
                enterKeyHint="search"
                placeholder="예: 역삼동, 서교동"
                placeholderTextColor="#7A8F87"
                returnKeyType="search"
                style={styles.searchInput}
                value={districtKeyword}
                onChangeText={setDistrictKeyword}
                onSubmitEditing={() => searchDistrict()}
              />
              <Pressable
                accessibilityRole="button"
                disabled={districtSearchStatus === 'loading'}
                style={[
                  styles.searchButton,
                  districtSearchStatus === 'loading' && styles.disabledButton,
                ]}
                onPress={() => searchDistrict()}
              >
                <Text style={styles.searchButtonText}>
                  {districtSearchStatus === 'loading' ? '검색 중' : '검색'}
                </Text>
              </Pressable>
            </View>
            <View style={styles.searchStatusRow}>
              <Text style={styles.searchStatusText}>
                검색 상태: {districtSearchLabels[districtSearchStatus]}
              </Text>
              {activeSpotResultSource === 'district' &&
                spotSearchResultCount > 0 && (
                <Text style={styles.searchCountText}>
                  {spotSearchResultCount}건
                </Text>
                )}
            </View>
            {districtSearchMessage && (
              <Text style={styles.searchMessage}>{districtSearchMessage}</Text>
            )}
            {spotSearchResults.length > 0 && (
              <Text style={styles.searchMessage}>
                지도 마커: {mappableSpotResults.length}/{spotSearchResults.length}
              </Text>
            )}
            {hiddenSpotCount > 0 && (
              <Text style={styles.searchMessage}>
                좌표 없는 {hiddenSpotCount}건은 리스트에만 표시됩니다.
              </Text>
            )}
            {selectedSpot && (
              <Text style={styles.searchMessage}>
                선택 장소: {selectedSpot.name}
              </Text>
            )}
            {canRetryDistrictSearch && (
              <Pressable
                accessibilityRole="button"
                style={styles.retryButton}
                onPress={retryDistrictSearch}
              >
                <Text style={styles.retryButtonText}>다시 검색</Text>
              </Pressable>
            )}
          </View>
        </View>

        <Animated.View
          style={[
            styles.bottomSheet,
            {
              height: bottomSheetHeight,
              transform: [{ translateY: bottomSheetTranslateY }],
            },
          ]}
        >
          <View
            accessibilityRole="adjustable"
            accessibilityLabel="검색 결과 바텀시트"
            style={styles.sheetDragArea}
            {...bottomSheetPanResponder.panHandlers}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeaderRow}>
              <View style={styles.sheetTitleGroup}>
                <Text style={styles.sheetTitle}>{sheetTitle}</Text>
                <Text style={styles.sheetSubtitle}>
                  {hasSearchResult
                    ? `전체 ${spotSearchResults.length}건 / 지도 ${mappableSpotResults.length}건`
                    : '검색 결과가 Sheet에 표시됩니다.'}
                </Text>
              </View>
              <View style={styles.sheetSnapControls}>
                {bottomSheetSnapOrder.map((snapPoint) => (
                  <Pressable
                    key={snapPoint}
                    accessibilityRole="button"
                    accessibilityState={{
                      selected: bottomSheetSnapPoint === snapPoint,
                    }}
                    style={[
                      styles.sheetSnapButton,
                      bottomSheetSnapPoint === snapPoint &&
                        styles.activeSheetSnapButton,
                    ]}
                    onPress={() => changeBottomSheetSnapPoint(snapPoint)}
                  >
                    <Text
                      style={[
                        styles.sheetSnapButtonText,
                        bottomSheetSnapPoint === snapPoint &&
                          styles.activeSheetSnapButtonText,
                      ]}
                    >
                      {bottomSheetSnapLabels[snapPoint]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetScrollContent}
          >
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                disabled={isCurrentLocationActionRunning}
                style={[
                  styles.locationButton,
                  isCurrentLocationActionRunning && styles.disabledButton,
                ]}
                onPress={requestCurrentLocation}
              >
                <Text style={styles.locationButtonText}>
                  {isCurrentLocationActionRunning ? '위치 검색 중' : '현재 위치'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={styles.primaryButton}
                onPress={() => moveCamera(SEOUL_CITY_HALL)}
              >
                <Text style={styles.primaryButtonText}>서울시청</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={styles.secondaryButton}
                onPress={() => moveCamera(GANGNAM_STATION)}
              >
                <Text style={styles.secondaryButtonText}>강남역</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={styles.secondaryButton}
                onPress={loadMarkerSamples}
              >
                <Text style={styles.secondaryButtonText}>마커 샘플</Text>
              </Pressable>
              {permissionStatus === 'blocked' && (
                <Pressable
                  accessibilityRole="button"
                  style={styles.settingsButton}
                  onPress={openAppSettings}
                >
                  <Text style={styles.settingsButtonText}>설정</Text>
                </Pressable>
              )}
            </View>

            {selectedSpot && (
              <View style={styles.selectedSpotPanel}>
                <Text style={styles.selectedSpotLabel}>선택 장소</Text>
                <Text numberOfLines={1} style={styles.selectedSpotName}>
                  {selectedSpot.name}
                </Text>
                <Text style={styles.selectedSpotType}>
                  {spotTypeLabels[selectedSpot.type]}
                  {isValidCoordinate(selectedSpot.coordinate)
                    ? ' / 지도 이동 가능'
                    : ' / 리스트 전용'}
                </Text>
                <Text numberOfLines={2} style={styles.selectedSpotAddress}>
                  {selectedSpot.address}
                </Text>
                {selectedSpot.detailLocation && (
                  <Text numberOfLines={2} style={styles.resultDetail}>
                    {selectedSpot.detailLocation}
                  </Text>
                )}
              </View>
            )}

            <View style={styles.sheetStatusPanel}>
              <Text style={styles.sheetStatusText}>
                검색 상태: {spotSearchStatusLabel}
              </Text>
              {resultSourceLabel && (
                <Text style={styles.sheetStatusText}>{resultSourceLabel}</Text>
              )}
              {isSpotSearchPartial && (
                <Text style={styles.sheetStatusText}>
                  일부 페이지 조회 실패로 확인된 결과만 표시 중
                </Text>
              )}
              {hiddenSpotCount > 0 && (
                <Text style={styles.sheetStatusText}>
                  좌표 없는 {hiddenSpotCount}건은 리스트에만 표시됩니다.
                </Text>
              )}
            </View>

            {hasSearchResult ? (
              spotSearchResults.map((spot) => {
                const isSelected = spot.id === selectedSpotId;
                const canMoveToMap = isValidCoordinate(spot.coordinate);

                return (
                  <Pressable
                    key={`${activeSpotResultSource}-${spot.id}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${spot.name}, ${spotTypeLabels[spot.type]}, ${
                      canMoveToMap ? '지도 이동 가능' : '리스트 전용'
                    }`}
                    style={[
                      styles.resultItem,
                      isSelected && styles.selectedResultItem,
                    ]}
                    onPress={() => selectSpot(spot)}
                  >
                    <View style={styles.resultTitleRow}>
                      <Text numberOfLines={1} style={styles.resultName}>
                        {spot.name}
                      </Text>
                      <Text
                        style={[
                          styles.resultType,
                          !canMoveToMap && styles.listOnlyResultType,
                        ]}
                      >
                        {canMoveToMap ? spotTypeLabels[spot.type] : '리스트'}
                      </Text>
                    </View>
                    <Text numberOfLines={2} style={styles.resultAddress}>
                      {spot.address}
                    </Text>
                    {spot.detailLocation && (
                      <Text numberOfLines={1} style={styles.resultDetail}>
                        {spot.detailLocation}
                      </Text>
                    )}
                  </Pressable>
                );
              })
            ) : (
              <Text style={styles.emptySheetText}>
                동/읍/면 검색, 현재 위치 검색, 마커 샘플 결과가 여기에 표시됩니다.
              </Text>
            )}
          </ScrollView>
        </Animated.View>
      </View>

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7FAF8',
  },
  map: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    padding: 16,
    paddingTop: 48,
  },
  header: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(247, 250, 248, 0.94)',
    borderColor: '#D8E2DC',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    color: '#12312A',
    fontSize: 20,
    fontWeight: '700',
  },
  description: {
    marginTop: 6,
    color: '#4F635D',
    fontSize: 14,
  },
  statusText: {
    marginTop: 4,
    color: '#274A42',
    fontSize: 13,
  },
  searchSection: {
    borderTopColor: '#D8E2DC',
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 12,
  },
  searchLabel: {
    color: '#12312A',
    fontSize: 14,
    fontWeight: '700',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    backgroundColor: '#FFFFFF',
    borderColor: '#BCCDC5',
    borderRadius: 8,
    borderWidth: 1,
    color: '#12312A',
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchButton: {
    minHeight: 44,
    minWidth: 72,
    alignItems: 'center',
    backgroundColor: '#0F766E',
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  disabledButton: {
    opacity: 0.55,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  searchStatusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    marginTop: 8,
  },
  searchStatusText: {
    flex: 1,
    color: '#274A42',
    fontSize: 13,
  },
  searchCountText: {
    color: '#0F766E',
    fontSize: 13,
    fontWeight: '700',
  },
  searchMessage: {
    marginTop: 4,
    color: '#4F635D',
    fontSize: 12,
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#E7ECE9',
    borderColor: '#9FB2AA',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryButtonText: {
    color: '#12312A',
    fontSize: 13,
    fontWeight: '700',
  },
  resultItem: {
    borderTopColor: '#D8E2DC',
    borderTopWidth: 1,
    paddingVertical: 8,
  },
  selectedResultItem: {
    backgroundColor: '#FEECEC',
    borderRadius: 8,
    marginHorizontal: -8,
    paddingHorizontal: 8,
  },
  resultTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  resultName: {
    flex: 1,
    color: '#12312A',
    fontSize: 14,
    fontWeight: '700',
  },
  resultType: {
    backgroundColor: '#E7F4F1',
    borderRadius: 8,
    color: '#0F766E',
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  listOnlyResultType: {
    backgroundColor: '#EEF2F1',
    color: '#4F635D',
  },
  resultAddress: {
    marginTop: 4,
    color: '#274A42',
    fontSize: 12,
  },
  resultDetail: {
    marginTop: 2,
    color: '#60736D',
    fontSize: 12,
  },
  selectedSpotPanel: {
    backgroundColor: '#FFF6F6',
    borderColor: '#F0B8B8',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },
  selectedSpotLabel: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '700',
  },
  selectedSpotName: {
    marginTop: 2,
    color: '#12312A',
    fontSize: 14,
    fontWeight: '700',
  },
  selectedSpotType: {
    marginTop: 2,
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '700',
  },
  selectedSpotAddress: {
    marginTop: 2,
    color: '#4F635D',
    fontSize: 12,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(247, 250, 248, 0.98)',
    borderColor: '#D8E2DC',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sheetDragArea: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    backgroundColor: '#9FB2AA',
    borderRadius: 3,
    marginBottom: 10,
  },
  sheetHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  sheetTitleGroup: {
    flex: 1,
  },
  sheetTitle: {
    color: '#12312A',
    fontSize: 18,
    fontWeight: '800',
  },
  sheetSubtitle: {
    marginTop: 2,
    color: '#4F635D',
    fontSize: 12,
  },
  sheetSnapControls: {
    flexDirection: 'row',
    gap: 4,
  },
  sheetSnapButton: {
    minWidth: 44,
    alignItems: 'center',
    backgroundColor: '#EEF2F1',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  activeSheetSnapButton: {
    backgroundColor: '#0F766E',
  },
  sheetSnapButtonText: {
    color: '#4F635D',
    fontSize: 11,
    fontWeight: '700',
  },
  activeSheetSnapButtonText: {
    color: '#FFFFFF',
  },
  sheetScroll: {
    flex: 1,
  },
  sheetScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  sheetStatusPanel: {
    borderTopColor: '#D8E2DC',
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 10,
  },
  sheetStatusText: {
    marginTop: 2,
    color: '#4F635D',
    fontSize: 12,
  },
  emptySheetText: {
    borderTopColor: '#D8E2DC',
    borderTopWidth: 1,
    color: '#60736D',
    fontSize: 13,
    marginTop: 12,
    paddingTop: 14,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    paddingTop: 2,
  },
  locationButton: {
    minWidth: 96,
    alignItems: 'center',
    backgroundColor: '#0F766E',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  locationButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  primaryButton: {
    minWidth: 96,
    alignItems: 'center',
    backgroundColor: '#12312A',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    minWidth: 96,
    alignItems: 'center',
    backgroundColor: '#F7FAF8',
    borderColor: '#BCCDC5',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: '#12312A',
    fontSize: 15,
    fontWeight: '700',
  },
  settingsButton: {
    minWidth: 80,
    alignItems: 'center',
    backgroundColor: '#E7ECE9',
    borderColor: '#9FB2AA',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  settingsButtonText: {
    color: '#12312A',
    fontSize: 15,
    fontWeight: '700',
  },
});
