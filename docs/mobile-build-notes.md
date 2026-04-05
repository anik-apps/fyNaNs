# Mobile App Build Notes

## EAS Account & Project
- Expo account: `fynans` (contact.anik.apps+fynans@gmail.com)
- Project ID: `c9d6170b-35ba-48b1-8dad-584407c33ebd`
- EAS project: `@fynans/fynans`
- Login: `eas login` (interactive)
- Init: `eas init --non-interactive --force`

## Current Stack (SDK 54)
- `expo`: ~54.0
- `react`: 19.1.0
- `react-native`: 0.81.5
- `expo-router`: ~6.0
- `newArchEnabled`: true (required — old arch Hermes lacks WeakRef)

## Known Issues

### Expo Go + SDK 54 — expo-updates error
**Error:** `The expo-updates system is disabled due to an invalid configuration`
**Status:** Unresolved for Expo Go dev testing. EAS builds and dev client builds work fine.
**Workaround:** Test via EAS preview builds or dev client instead of Expo Go.

### Duplicate React in bundle (pnpm monorepo)
**Error:** `TypeError: Cannot read property 'useRef' of null` — app crashes on launch
**Cause:** pnpm hoisting creates nested copies of React. Three copies in the bundle breaks hooks.
**Fix:** Custom `resolveRequest` in `metro.config.js` forces all `react` imports to the single root copy.
**Verify:** `npx expo export --platform android --source-maps` then check source map for duplicate `/react/` paths.

### metro-core canonicalize exports error (local dev)
**Error:** `Package subpath './src/canonicalize' is not defined by "exports" in metro-core/package.json`
**Fix:** Clean reinstall: `rm -rf node_modules apps/mobile/node_modules && pnpm install`
**Also:** Run `eas build` from `apps/mobile/` dir, not repo root.

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
# Start emulator (use emu.sh script)
apps/mobile/scripts/emu.sh --start

# Or manually:
emulator -avd fynans_test -gpu host -no-snapshot-load -no-audio

# Launch app
adb shell am start com.fynans.app/.MainActivity

# Take screenshot
apps/mobile/scripts/emu.sh --screenshot

# Dump UI hierarchy
apps/mobile/scripts/emu.sh --dump

# Full emulator script help
apps/mobile/scripts/emu.sh
```

### Local Testing
```bash
# Run tests (from apps/mobile)
pnpm test

# Export bundle (verify no JS errors)
npx expo export --platform android --output-dir /tmp/fynans-export

# Start dev server with dev client
EXPO_USE_FAST_RESOLVER=1 npx expo start --dev-client
```

### Fetching EAS Build Logs
```bash
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
