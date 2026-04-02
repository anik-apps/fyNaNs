# Mobile App Build Notes

## EAS Account & Project
- Expo account: `fynans` (contact.anik.apps+fynans@gmail.com)
- Project ID: `c9d6170b-35ba-48b1-8dad-584407c33ebd`
- EAS project: `@fynans/fynans`
- Login: `eas login` (interactive)
- Init: `eas init --non-interactive --force`

## SDK 54 Upgrade Status
Upgraded from SDK 52 → 54. Key changes:
- `expo`: ~52.0 → ~54.0
- `react`: 18.3.1 → 19.1.0
- `react-native`: 0.76.6 → 0.81.5
- `expo-router`: ~4.0 → ~6.0
- `@expo/metro-runtime`: 4.0.1 → 6.1.2 (required by expo-router 6)
- `jest-expo`: ~52.0 → ~54.0
- `typescript`: ~5.3 → ~5.9
- Removed `@testing-library/jest-native` (deprecated)
- Updated `@testing-library/react-native` to 13.3.3
- Added `react-test-renderer@19.1.0`

## Build Issues & Fixes

### 1. Missing Asset Images
**Error:** `ENOENT: no such file or directory, open './assets/images/adaptive-icon.png'`
**Fix:** Generated placeholder images with Pillow:
```bash
python3 << 'EOF'
# See apps/mobile/assets/images/ — generated icon.png, adaptive-icon.png, splash.png, notification-icon.png
EOF
```

### 2. Shared Types Not Built on EAS
**Error:** `Cannot resolve module @fynans/shared-types — dist/index.js does not exist`
**Fix:** Added `postinstall` in root `package.json`:
```json
"postinstall": "pnpm --filter @fynans/shared-types build"
```

### 3. Kotlin/Compose Version Mismatch (SDK 52 only)
**Error:** `Compose Compiler 1.5.15 requires Kotlin 1.9.25 but using 1.9.24`
**Fix for SDK 52:** Two-part:
1. `expo-build-properties` plugin in `app.json` with `"kotlinVersion": "1.9.25"`
2. Custom config plugin `plugins/withKotlinFix.js` that patches `gradle.properties` and adds `suppressKotlinVersionCompatibilityCheck` compiler arg

**SDK 54:** NOT needed — SDK 54 uses Kotlin 2.0+ with KSP. Forcing `kotlinVersion: "1.9.25"` causes: `Can't find KSP version for Kotlin version '1.9.25'. Supported versions are: 2.0.0+`. Remove the Kotlin override and custom plugin for SDK 54.

### 4. react-native-svg C++ Error (SDK 52 only)
**Error:** `no member named 'StyleSizeLength' in namespace 'facebook::yoga'`
**Fix:** Pin `react-native-svg` to `15.8.0` in package.json (not `^15.8.0`). SDK 54 with RN 0.81.5 uses compatible SVG 15.12.1.

### 5. WeakRef Crash (old arch)
**Error:** `ReferenceError: Property 'WeakRef' doesn't exist`
**Fix:** Keep `newArchEnabled: true` in app.json. Old arch Hermes lacks WeakRef.

### 6. Expo Go + SDK 54 — expo-updates error
**Error:** `The expo-updates system is disabled due to an invalid configuration`
**Status:** UNRESOLVED for Expo Go dev testing. EAS production builds work fine.
**Workaround:** Test via EAS preview builds instead of Expo Go.

### 7. metro-core/src/canonicalize exports error (local, SDK 54)
**Error:** `Package subpath './src/canonicalize' is not defined by "exports" in metro-core/package.json`
**Cause:** pnpm hoisting creates a stale nested `metro/node_modules/metro-cache@0.81.5` that imports the old path from `metro-core@0.83.3` which moved it to `metro-core/private/canonicalize`.
**Fix:** Clean reinstall: `rm -rf node_modules apps/mobile/node_modules && pnpm install`
**Also:** Must run `eas build` from `apps/mobile/` dir, not repo root. Delete any `eas.json` created at repo root.

### 9. Duplicate React in bundle (pnpm monorepo)
**Error:** `TypeError: Cannot read property 'useRef' of null` — app crashes immediately on launch
**Cause:** pnpm hoisting creates nested copies of React inside `@radix-ui/react-compose-refs` and `use-sync-external-store`. Three copies of React in the bundle breaks hooks.
**Fix:** Custom `resolveRequest` in `metro.config.js` that forces all `react` imports to resolve to the single root copy. Verified deduplication via source map analysis (3 copies → 1).
**Verify:** `npx expo export --platform android --source-maps` then check source map for duplicate `/react/` paths.

### 8. KSP version error when forcing Kotlin 1.9.25 on SDK 54
**Error:** `Can't find KSP version for Kotlin version '1.9.25'. Supported versions are: 2.0.0+`
**Cause:** SDK 54's expo-modules-core uses KSP which requires Kotlin 2.0+. The `withKotlinFix.js` plugin and `expo-build-properties` `kotlinVersion: "1.9.25"` were SDK 52 workarounds.
**Fix:** Remove `kotlinVersion` override and `./plugins/withKotlinFix` from `app.json` for SDK 54.

## Useful Commands

### EAS Build
```bash
# Login (interactive)
eas login

# Build Android APK (preview profile)
eas build --platform android --profile preview --non-interactive

# View build logs
eas build:view <BUILD_ID> --json

# Get APK URL from build
eas build:view <BUILD_ID> --json | python3 -c "
import sys, json; lines = sys.stdin.read(); d = json.loads(lines[lines.index('{'):]); print(d['artifacts']['applicationArchiveUrl'])"

# Download and install APK on emulator
curl -L -o /tmp/fynans.apk <APK_URL>
adb install -r /tmp/fynans.apk
```

### Emulator
```bash
# List emulators
emulator -list-avds

# Start emulator
emulator -avd ccb_pixel -no-snapshot-load &

# Check devices
adb devices

# Forward port
adb reverse tcp:8081 tcp:8081

# Launch app
adb shell am start com.fynans.app/.MainActivity

# Take screenshot
adb shell screencap -p /sdcard/screen.png && adb pull /sdcard/screen.png /tmp/screen.png

# Get crash logs
adb logcat -c  # clear
adb shell am start com.fynans.app/.MainActivity
sleep 5
adb logcat -d -s AndroidRuntime:E ReactNativeJS:E ReactNativeJS:I

# Install Expo Go on emulator (if needed)
# Download from https://expo.dev/go
```

### Local Testing
```bash
# Run tests (from apps/mobile)
../../node_modules/.bin/jest --no-watchman --passWithNoTests

# Export bundle (verify no JS errors)
npx expo export --platform android --output-dir /tmp/fynans-export

# Start dev server for Expo Go
EXPO_PUBLIC_API_URL=https://fynans.kumaranik.com npx expo start --port 8081
# Then on emulator:
adb shell am start -a android.intent.action.VIEW -d "exp://localhost:8081" host.exp.exponent
```

### Fetching EAS Build Logs
```bash
# Get build error details from log files
eas build:view <BUILD_ID> --json | python3 -c "
import sys, json
lines = sys.stdin.read()
d = json.loads(lines[lines.index('{'):])
for url in d['logFiles']: print(url)
" | while read url; do curl -sL "$url"; done | python3 -c "
import sys, json
for line in sys.stdin:
    try:
        obj = json.loads(line.strip())
        msg = obj.get('msg', '')
        phase = obj.get('phase', '')
        if 'FAILED' in msg or msg.startswith('e:') or 'Error' in msg:
            print(f'{phase}: {msg}')
    except: pass
"
```

## Successful Builds
| Build ID | SDK | Status | Notes |
|----------|-----|--------|-------|
| `8ef63a2a-8b91-4869-a8a7-6e131bdd04dd` | 52 | Working APK | newArch=true, SVG pinned, Kotlin fix |
| `6d499d8c-f680-4783-9bfe-73b60ff73b94` | 52 | APK crashes | newArch=false → WeakRef missing |

## Next Steps
- [ ] EAS build with SDK 54
- [ ] Check if `plugins/withKotlinFix.js` still needed (RN 0.81.5 may have fixed Kotlin version)
- [ ] Test Add Account screen on device
- [ ] Commit all changes and push to PR #87
- [ ] Replace placeholder icons with real brand assets
