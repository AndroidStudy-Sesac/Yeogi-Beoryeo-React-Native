const baseConfig = require("./app.json").expo;

const SPIKE_APPLICATION_ID = "com.team.yeogibeoryeo.rn";
const UPDATE_APPLICATION_ID = "com.team.yeogibeoryeo";
const isAndroidUpdateBuild = process.env.YEOGI_ANDROID_UPDATE_BUILD === "1";

module.exports = {
  ...baseConfig,
  android: {
    ...baseConfig.android,
    package: isAndroidUpdateBuild
      ? UPDATE_APPLICATION_ID
      : SPIKE_APPLICATION_ID,
    versionCode: isAndroidUpdateBuild ? readUpdateVersionCode() : 1,
  },
};

function readUpdateVersionCode() {
  const rawVersionCode = process.env.YEOGI_ANDROID_VERSION_CODE;
  const versionCode = Number(rawVersionCode);

  if (!Number.isSafeInteger(versionCode) || versionCode <= 7) {
    throw new Error(
      "YEOGI_ANDROID_VERSION_CODE must be an integer greater than the legacy versionCode 7.",
    );
  }

  return versionCode;
}
