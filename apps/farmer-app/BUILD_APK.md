# Building APK for AgriSense Farmer App

This guide covers multiple ways to build an APK for the AgriSense Farmer App.

## Option 1: EAS Build (Recommended) ☁️

Expo Application Services (EAS) provides cloud-based builds - no local Android SDK required.

### Prerequisites
1. **Expo account** - Sign up at [expo.dev](https://expo.dev)
2. **EAS CLI** - `npm install -g eas-cli`
3. **Login** - `eas login`

### Quick Build (Using Scripts)

#### Windows PowerShell
```powershell
# Production APK (for distribution)
.\build-apk.ps1 -Profile apk-production

# Preview build (for testing)
.\build-apk.ps1 -Profile preview

# Development build (with dev client)
.\build-apk.ps1 -Profile development
```

#### Linux/macOS Bash
```bash
# Make script executable
chmod +x build-apk.sh

# Production APK
./build-apk.sh --profile apk-production

# Preview build
./build-apk.sh --profile preview
```

### Manual EAS Commands

```bash
# Configure project (first time only)
eas build:configure

# Build production APK
eas build --profile apk-production --platform android

# Build preview APK
eas build --profile preview --platform android

# Build development client
eas build --profile development --platform android

# Check build status
eas build:list

# Download artifact
eas build:download --artifact-id <artifact-id>
```

### Build Profiles

| Profile | Output | Use Case |
|---------|--------|----------|
| `development` | APK + Dev Client | Development with hot reload |
| `preview` | APK | Internal testing |
| `production` | AAB | Google Play Store |
| `apk-production` | APK | Direct distribution |

---

## Option 2: Local Build with Gradle 🏗️

For offline builds or CI/CD pipelines without EAS.

### Prerequisites
- **JDK 17+** (required for Android Gradle Plugin 8+)
- **Android SDK** (API level 34)
- **Gradle 8.5+** (included via wrapper)

### Setup Local Build

```bash
# 1. Generate native Android project
npx expo prebuild --platform android --clean

# 2. Navigate to android directory
cd android

# 3. Build debug APK (for testing)
./gradlew assembleDebug

# 4. Build release APK (for distribution)
./gradlew assembleRelease
```

### Output Locations

| Build Type | Output Path |
|------------|-------------|
| Debug APK | `android/app/build/outputs/apk/debug/app-debug.apk` |
| Release APK | `android/app/build/outputs/apk/release/app-release.apk` |
| Release AAB | `android/app/build/outputs/bundle/release/app-release.aab` |

### Signing Release Builds

Create `android/keystore.properties` (add to `.gitignore`):

```properties
storePassword=your_store_password
keyPassword=your_key_password
keyAlias=your_key_alias
storeFile=../release.keystore
```

Generate keystore:
```bash
keytool -genkeypair -v -keystore release.keystore -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

Update `android/app/build.gradle.kts`:
```kotlin
android {
    signingConfigs {
        create("release") {
            val keystoreProperties = Properties().apply { load(FileInputStream(rootProject.file("keystore.properties"))) }
            storeFile = file(keystoreProperties["storeFile"] as String)
            storePassword = keystoreProperties["storePassword"] as String
            keyAlias = keystoreProperties["keyAlias"] as String
            keyPassword = keystoreProperties["keyPassword"] as String
        }
    }
    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
            // ... other config
        }
    }
}
```

---

## Option 3: GitHub Actions CI/CD 🤖

Automated builds on every push.

### Workflow: `.github/workflows/build-apk.yml`

```yaml
name: Build APK

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  workflow_dispatch:
    inputs:
      profile:
        description: 'Build profile'
        required: true
        default: 'preview'
        type: choice
        options: [development, preview, production, apk-production]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Setup EAS
        uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Build APK
        run: eas build --profile ${{ github.event.inputs.profile || 'preview' }} --platform android --non-interactive

      - name: Upload APK artifact
        uses: actions/upload-artifact@v4
        if: github.event.inputs.profile == 'apk-production'
        with:
          name: agrisense-apk
          path: ./build-output/
          retention-days: 30
```

### Required Secrets

| Secret | Description |
|--------|-------------|
| `EXPO_TOKEN` | Expo access token (`eas token create`) |

---

## Option 4: Local Preview Build (Fastest) ⚡

For quick iteration without full build:

```bash
# Install expo-dev-client for development builds
npx expo install expo-dev-client

# Start development server
npx expo start --dev-client

# Build local development APK (requires Android Studio)
npx expo run:android --variant debug
```

---

## 📱 Installing the APK

### On Device
1. Enable "Install unknown apps" for your browser/file manager
2. Transfer APK to device (USB, cloud, email)
3. Tap APK to install

### Via ADB (USB Debugging)
```bash
# Install debug APK
adb install android/app/build/outputs/apk/debug/app-debug.apk

# Install release APK
adb install android/app/build/outputs/apk/release/app-release.apk

# Uninstall
adb uninstall com.agrisense.farmer
```

---

## 🔧 Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| `eas build` fails with credentials error | Run `eas credentials` to configure |
| `Gradle` out of memory | Add `org.gradle.jvmargs=-Xmx4g` to `gradle.properties` |
| `SDK location not found` | Set `ANDROID_HOME` env var or create `local.properties` |
| `Duplicate class` error | Clean build: `./gradlew clean` or `eas build --clear-cache` |
| `Min SDK version` error | Ensure `minSdkVersion = 24` in `app/build.gradle.kts` |

### Build Optimization

```gradle
// android/gradle.properties
org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=512m
org.gradle.parallel=true
org.gradle.configureondemand=true
android.enableJetifier=true
android.useAndroidX=true
```

---

## 📦 Distribution

### Internal Testing
- **EAS Preview** → Share build link with team
- **Firebase App Distribution** → `eas build --profile preview` + upload to Firebase
- **Direct APK** → Share via Google Drive, email, etc.

### Google Play Store
1. Build AAB: `eas build --profile production`
2. Upload to Play Console
3. Configure signing (Play App Signing recommended)

### Direct Distribution
- Use `apk-production` profile for signed APK
- Host on your server/CDN
- Implement in-app updates with `expo-updates`

---

## 📋 Checklist Before Release

- [ ] Update version in `app.json`
- [ ] Update `versionCode` in `android/app/build.gradle.kts`
- [ ] Test on multiple devices (Android 7+)
- [ ] Verify permissions work (camera, location)
- [ ] Test offline mode
- [ ] Check app size (target < 100MB)
- [ ] Validate all API keys configured
- [ ] Test push notifications
- [ ] Verify deep links work
- [ ] Run `eas build --profile production` for Play Store

---

## 📞 Support

- **EAS Docs**: https://docs.expo.dev/build/introduction/
- **Expo Forums**: https://forums.expo.dev/
- **Discord**: https://chat.expo.dev/
- **Issues**: Create GitHub issue in repo