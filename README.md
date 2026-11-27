# Velqara Client

Android companion app and Bedrock add-on exporter for Minecraft Bedrock.

## What is included

- Dark neon Russian/English UI with module catalog, profiles, HUD preview and local settings.
- Toggleable module configuration with Ban risk labels for ESP, Ore vision and Free camera.
- Local profile storage through AsyncStorage.
- Export button that generates a real `Velqara_Client.mcaddon` from the selected modules and opens Android's share/import sheet.
- Behavior pack script for supported Bedrock Script API worlds: optional night vision (Fulbright), hit particles/sounds, kill sound, jump ring, action-bar potion/TNT/death/waypoint HUD.
- Resource pack manifest and custom fog definition.
- Minecraft launch/version actions are kept separate from Google Play availability; the app targets package `com.mojang.minecraftpe`.

## Run

```bash
npm install
npx expo start
```

## Build an APK

```bash
CI=1 npx expo prebuild --platform android --no-install
cd android
./gradlew assembleRelease --no-daemon
```

A GitHub Actions workflow in `.github/workflows/build-apk.yml` builds `app-release.apk` and uploads it as `velqara-client-release`.

## Importing the Bedrock pack

1. Install and open Velqara Client.
2. Enable the modules you want.
3. Tap **Экспортировать .mcaddon**.
4. Choose Minecraft in the Android share sheet.
5. In the world settings, activate both Velqara behavior and resource packs; enable Beta APIs if that version requests them.

## Limits

Bedrock add-ons cannot freely change the RenderDragon renderer or memory. Therefore X-ray through blocks, true ESP boxes, free camera, aspect-ratio forcing, custom FOV and item physics are not implemented by the exported pack. Server use can violate server rules; the app shows Ban risk labels and is intended for worlds where the owner permits the pack.
