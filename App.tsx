import { useRef, useState } from 'react';
import {
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

export default function App() {
  const mapRef = useRef<NaverMapViewRef>(null);
  const [cameraLabel, setCameraLabel] = useState('37.5666, 126.9784 / z15.0');

  const moveCamera = (target: typeof SEOUL_CITY_HALL) => {
    mapRef.current?.animateCameraTo({
      latitude: target.latitude,
      longitude: target.longitude,
      zoom: target.zoom,
      duration: 700,
      easing: 'EaseOut',
    });
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
        </View>

        <View style={styles.actions}>
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
  actions: {
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
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
});
