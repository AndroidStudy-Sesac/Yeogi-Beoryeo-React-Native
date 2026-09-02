import type { ConfigContext, ExpoConfig } from 'expo/config';
import {
  AndroidConfig,
  withInfoPlist,
  withStringsXml,
  type ConfigPlugin,
} from 'expo/config-plugins';

const PRODUCTION_IDENTIFIER = 'com.team.yeogibeoryeo';
const DEVELOPMENT_IDENTIFIER = 'com.team.yeogibeoryeo.debug';

const withAppDisplayName: ConfigPlugin<{ displayName: string }> = (
  config,
  { displayName },
) => {
  const configWithAndroidName = withStringsXml(config, (modConfig) => {
    modConfig.modResults = AndroidConfig.Strings.setStringItem(
      [
        AndroidConfig.Resources.buildResourceItem({
          name: 'app_name',
          value: displayName,
        }),
      ],
      modConfig.modResults,
    );

    return modConfig;
  });

  return withInfoPlist(configWithAndroidName, (modConfig) => {
    modConfig.modResults.CFBundleDisplayName = displayName;
    return modConfig;
  });
};

export default ({ config }: ConfigContext): ExpoConfig => {
  const isProduction = process.env.APP_VARIANT === 'production';
  const identifier = isProduction
    ? PRODUCTION_IDENTIFIER
    : DEVELOPMENT_IDENTIFIER;
  const displayName = isProduction ? '여기버려' : '여기버려 Debug';

  return withAppDisplayName(
    {
      ...config,
      name: isProduction ? 'YeogiBeoryeo' : 'YeogiBeoryeoDebug',
      slug: 'yeogi-beoryeo',
      scheme: 'yeogi-beoryeo',
      version: '1.0.0',
      orientation: 'portrait',
      ios: {
        ...config.ios,
        bundleIdentifier: identifier,
        supportsTablet: false,
      },
      android: {
        ...config.android,
        package: identifier,
        predictiveBackGestureEnabled: false,
      },
    },
    { displayName },
  );
};
