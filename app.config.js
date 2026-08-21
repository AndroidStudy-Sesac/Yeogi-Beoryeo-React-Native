const naverMapClientId = process.env.NAVER_MAP_CLIENT_ID ?? '';

module.exports = {
  expo: {
    name: 'yeogi-beoryeo',
    slug: 'yeogi-beoryeo',
    version: '1.0.0',
    orientation: 'portrait',
    scheme: 'yeogibeoryeo',
    newArchEnabled: true,
    android: {
      predictiveBackGestureEnabled: false,
      package: 'com.team.yeogibeoryeo.spike',
    },
    ios: {
      bundleIdentifier: 'com.team.yeogibeoryeo.spike',
    },
    plugins: [
      [
        '@mj-studio/react-native-naver-map',
        {
          client_id: naverMapClientId,
        },
      ],
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            '현재 위치를 기준으로 가까운 수거 장소를 찾기 위해 위치 권한이 필요합니다.',
        },
      ],
      [
        'expo-build-properties',
        {
          android: {
            extraMavenRepos: ['https://repository.map.naver.com/archive/maven'],
          },
        },
      ],
    ],
  },
};
