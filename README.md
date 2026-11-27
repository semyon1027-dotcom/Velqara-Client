# Velqara Client

Free Expo/React Native companion app starter for Minecraft Bedrock.

## What is included

- Dark neon Russian/English UI.
- Home screen, launcher action, module catalog, HUD preview, local profiles, settings.
- All requested module categories with toggles and Ban risk labels for ESP/Ore vision/Free camera.
- Local profile state and accent color controls.
- Native Android version detection using PackageManager for `com.mojang.minecraftpe` (reads the installed package's real `versionName` and `versionCode`).
- Native Android launch through `getLaunchIntentForPackage`, independent of Google Play country availability or installation source.

## Run

```bash
npm install
npx expo start
```

Use Expo Go for the interface preview. The native detector is included in the project but is not available in Expo Go; build the app as a custom Android APK to use it.

## Build an APK

Install the Android SDK and Java 17+, then run `npx expo prebuild -p android` and `npx expo run:android --variant release`, or configure EAS Build with an Expo account. This workspace did not have the Android SDK or Gradle installed, so a signed APK could not be produced here.

## Limits

The companion app can open Minecraft, read its installed package version, and store configuration profiles. It cannot by itself alter Bedrock rendering, memory, or gameplay. ESP, ore visibility, custom fog/sky and similar in-game features need a supported Bedrock add-on/resource pack or a permitted native integration; this starter provides UI and risk labels only and does not bypass anti-cheat.
