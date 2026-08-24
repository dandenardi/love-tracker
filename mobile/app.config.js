import 'dotenv/config';
import { withProjectBuildGradle, withAppBuildGradle } from "@expo/config-plugins";

/** @type {import('expo/config').ExpoConfig} */
const config = ({ config }) => {
  // Dynamic versioning: base version from app.json + build number (versionCode)
  // During EAS build, EAS_BUILD_NUMBER is the build number (incremented automatically)
  const baseVersion = "1.0";
  // Fallback to versionCode from app.json if EAS_BUILD_NUMBER is not set
  const buildNumber = process.env.EAS_BUILD_NUMBER || config.android?.versionCode || "1";
  const dynamicVersion = `${baseVersion}.${buildNumber}`;

  return {
    ...config,
    version: dynamicVersion,
    android: {
      ...config.android,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || "./google-services.json",
    },
    extra: {
      ...config.extra,
      apiUrl: process.env.API_URL,
      revenueCatAndroidKey: process.env.REVENUECAT_ANDROID_KEY,
      admobBannerUnitId: process.env.ADMOB_BANNER_UNIT_ID_ANDROID,
    },
    plugins: [
      "@react-native-google-signin/google-signin",
      [
        "react-native-google-mobile-ads",
        {
          // Falls back to Google's official test App ID until ADMOB_ANDROID_APP_ID is set
          // as an EAS env var (see server-side pattern used for REVENUECAT_ANDROID_KEY).
          androidAppId: process.env.ADMOB_ANDROID_APP_ID || "ca-app-pub-3940256099942544~3347511713",
        },
      ],
      ...(config.plugins || []),
      [
        "expo-build-properties",
        {
          "android": {
            "minSdkVersion": 24,
            "compileSdkVersion": 36,
            "targetSdkVersion": 36,
            "newArchEnabled": true
          }
        }
      ],
      (config) => {
        return withProjectBuildGradle(config, (config) => {
          if (config.modResults.language === "groovy") {
            const buildGradle = config.modResults.contents;
            if (!buildGradle.includes("minSdkVersion =")) {
              config.modResults.contents = `ext {\n    minSdkVersion = 26\n    minSdk = 26\n    compileSdkVersion = 36\n    compileSdk = 36\n    targetSdkVersion = 36\n    targetSdk = 36\n    ndkVersion = "27.1.12297006"\n}\n\nsubprojects {\n    if (project.hasProperty('android')) {\n        project.android {\n            defaultConfig {\n                minSdkVersion 26\n                minSdk 26\n                externalNativeBuild {\n                    cmake {\n                        arguments "-DANDROID_PLATFORM=android-26", "-DCMAKE_SYSTEM_VERSION=26"\n                    }\n                }\n            }\n        }\n    }\n}\n\n${buildGradle}`;
            }
          }
          return config;
        });
      },
      (config) => {
        return withAppBuildGradle(config, (config) => {
          if (config.modResults.language === "groovy") {
            config.modResults.contents = config.modResults.contents
              .replace(/minSdkVersion rootProject\.ext\.minSdkVersion/g, "minSdk 26")
              .replace(/compileSdk rootProject\.ext\.compileSdkVersion/g, "compileSdk 36")
              .replace(/targetSdkVersion rootProject\.ext\.targetSdkVersion/g, "targetSdk 36")
              .replace(/ndkVersion rootProject\.ext\.ndkVersion/g, 'ndkVersion "27.1.12297006"');
          }
          return config;
        });
      }
    ]
  };
};

export default config;
