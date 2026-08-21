import { useRef, useState } from 'react';
import * as Location from 'expo-location';
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  NaverMapMarkerOverlay,
  NaverMapView,
  type NaverMapViewRef,
} from '@mj-studio/react-native-naver-map';
import { StatusBar } from 'expo-status-bar';

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

type LocationPermissionStatus =
  | 'unknown'
  | 'checking'
  | 'granted'
  | 'denied'
  | 'blocked'
  | 'unavailable';

type LocationLookupStatus =
  | 'idle'
  | 'locating'
  | 'success'
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

const permissionLabels: Record<LocationPermissionStatus, string> = {
  unknown: '권한 미확인',
  checking: '권한 확인 중',
  granted: '권한 허용됨',
  denied: '권한 거부됨',
  blocked: '설정에서 권한 필요',
  unavailable: '위치 사용 불가',
};

const lookupLabels: Record<LocationLookupStatus, string> = {
  idle: '현재 위치 미조회',
  locating: '현재 위치 조회 중',
  success: '현재 위치 조회 완료',
  'permission-denied': '권한 요청 후 다시 시도 필요',
  'permission-blocked': '설정에서 위치 권한 허용 필요',
  'location-service-disabled': '기기 위치 서비스가 꺼져 있음',
  unavailable: '현재 위치를 사용할 수 없음',
  'unknown-error': '위치 조회 실패',
};

const mapPermission = (
  response: Location.LocationPermissionResponse
): LocationPermissionStatus => {
  if (response.granted) {
    return 'granted';
  }

  return response.canAskAgain ? 'denied' : 'blocked';
};

export default function App() {
  const mapRef = useRef<NaverMapViewRef>(null);
  const [cameraLabel, setCameraLabel] = useState('37.5666, 126.9784 / z15.0');
  const [permissionStatus, setPermissionStatus] =
    useState<LocationPermissionStatus>('unknown');
  const [lookupStatus, setLookupStatus] =
    useState<LocationLookupStatus>('idle');
  const [currentCoordinate, setCurrentCoordinate] =
    useState<CurrentCoordinate | null>(null);

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

  const requestCurrentLocation = async () => {
    try {
      setPermissionStatus('checking');
      setLookupStatus('locating');

      const servicesEnabled = await Location.hasServicesEnabledAsync();

      if (!servicesEnabled) {
        setPermissionStatus('unavailable');
        setLookupStatus('location-service-disabled');
        return;
      }

      const permission = await Location.requestForegroundPermissionsAsync();
      const nextPermissionStatus = mapPermission(permission);

      setPermissionStatus(nextPermissionStatus);

      if (nextPermissionStatus === 'denied') {
        setLookupStatus('permission-denied');
        return;
      }

      if (nextPermissionStatus === 'blocked') {
        setLookupStatus('permission-blocked');
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
    } catch (error) {
      setLookupStatus('unknown-error');
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
      >
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
          {currentCoordinate && (
            <Text style={styles.statusText}>
              현재 위치: {currentCoordinate.latitude.toFixed(5)},{' '}
              {currentCoordinate.longitude.toFixed(5)}
              {typeof currentCoordinate.accuracy === 'number'
                ? ` / 정확도 ${Math.round(currentCoordinate.accuracy)}m`
                : ''}
            </Text>
          )}
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            style={styles.locationButton}
            onPress={requestCurrentLocation}
          >
            <Text style={styles.locationButtonText}>현재 위치</Text>
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
    justifyContent: 'space-between',
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
  actions: {
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 16,
    paddingHorizontal: 12,
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
