#!/bin/bash
# Unified emulator testing script for fyNaNs mobile app
# Usage: ./scripts/emu.sh [--install] [--login] [--screenshot] [--plaid-link] [--tap TEXT] [--dump] [--nav TAB]
#
# Examples:
#   ./scripts/emu.sh --install --login              # Install APK and login
#   ./scripts/emu.sh --login --nav Accounts          # Login then go to Accounts tab
#   ./scripts/emu.sh --plaid-link                    # Full Plaid sandbox link flow (end-to-end)
#   ./scripts/emu.sh --plaid-test                    # Legacy: navigate to dev settings
#   ./scripts/emu.sh --tap "Link Bank Account"       # Tap element with text
#   ./scripts/emu.sh --cdp get-text                  # Run CDP command on active WebView
#   ./scripts/emu.sh --start                          # Start emulator (gpu host, no snapshot)
#   ./scripts/emu.sh --stop                           # Stop emulator
#   ./scripts/emu.sh --screenshot                    # Take screenshot
#   ./scripts/emu.sh --dump                          # Dump UI hierarchy texts

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APK="$PROJECT_DIR/android/app/build/outputs/apk/release/app-release.apk"
PACKAGE="com.fynans.app"
SCREENSHOT_DIR="${SCREENSHOT_DIR:-/tmp/claude}"
UI_XML="/tmp/claude/ui.xml"
# Local emulator-only test credentials (not used in staging/production)
EMAIL="${EMU_EMAIL:-test@kumaranik.com}"
PASS="${EMU_PASS:-TestPass123}"

AVD_NAME="${AVD_NAME:-fynans_test}"

mkdir -p "$SCREENSHOT_DIR"

# ─── Helpers ───────────────────────────────────────────────────────────────────

dump_ui() {
    adb shell uiautomator dump /sdcard/ui.xml 2>/dev/null
    adb pull /sdcard/ui.xml "$UI_XML" 2>/dev/null
}

show_texts() {
    python3 -c "
import xml.etree.ElementTree as ET
for n in ET.parse('$UI_XML').iter('node'):
    t = n.get('text','')
    if t: print(t)
" | head -30
}

find_and_tap() {
    local target="$1"
    dump_ui
    local coords
    coords=$(python3 -c "
import xml.etree.ElementTree as ET
for n in ET.parse('$UI_XML').iter('node'):
    t = n.get('text','')
    b = n.get('bounds','')
    if '$target' in t and b:
        p = b.replace('][',',').replace('[','').replace(']','').split(',')
        print(f'{(int(p[0])+int(p[2]))//2} {(int(p[1])+int(p[3]))//2}')
        break
")
    if [ -n "$coords" ]; then
        adb shell input tap $coords
        echo "Tapped '$target' at ($coords)"
        return 0
    else
        echo "NOT FOUND: '$target'"
        return 1
    fi
}

screenshot() {
    local name="${1:-emu_current}"
    adb shell screencap -p /sdcard/screen.png
    adb pull /sdcard/screen.png "$SCREENSHOT_DIR/${name}.png" 2>/dev/null
    echo "Screenshot: $SCREENSHOT_DIR/${name}.png"
}

tap_bottom_tab() {
    local tab="$1"
    dump_ui
    local coords
    coords=$(python3 -c "
import xml.etree.ElementTree as ET
for n in ET.parse('$UI_XML').iter('node'):
    t = n.get('text','')
    b = n.get('bounds','')
    if t == '$tab' and b:
        p = b.replace('][',',').replace('[','').replace(']','').split(',')
        y = (int(p[1])+int(p[3]))//2
        if y > 2200:
            print(f'{(int(p[0])+int(p[2]))//2} {y}')
            break
")
    if [ -n "$coords" ]; then
        adb shell input tap $coords
        echo "Navigated to $tab"
    else
        echo "Tab '$tab' not found in bottom nav"
        return 1
    fi
}

# ─── CDP (Chrome DevTools Protocol) helpers for WebView interaction ────────────

CDP_PORT="${CDP_PORT:-9222}"
CDP_HELPER="$SCRIPT_DIR/cdp-helper.js"

forward_cdp() {
    # Find the WebView debug socket for our package and forward it
    local socket
    socket=$(adb shell cat /proc/net/unix 2>/dev/null \
        | grep -o '@webview_devtools_remote_[0-9]*' \
        | head -1 | tr -d '@')
    if [ -z "$socket" ]; then
        echo "ERROR: No WebView debug socket found. Is Plaid Link open?"
        return 1
    fi
    adb forward tcp:"$CDP_PORT" "localabstract:$socket" 2>/dev/null
}

cdp() {
    # Run a CDP action via the helper script
    # Usage: cdp <action> [args...]
    forward_cdp || return 1
    node "$CDP_HELPER" "$@"
}

tap_add_account_plus() {
    # Tap the + icon in the Accounts header (top-right, no text)
    dump_ui
    local coords
    coords=$(python3 -c "
import xml.etree.ElementTree as ET
for n in ET.parse('$UI_XML').iter('node'):
    b = n.get('bounds','')
    if n.get('clickable')=='true' and b and not n.get('text'):
        p = b.replace('][',',').replace('[','').replace(']','').split(',')
        x1,y1,x2,y2 = int(p[0]),int(p[1]),int(p[2]),int(p[3])
        if y1 < 300 and x1 > 800:
            print(f'{(x1+x2)//2} {(y1+y2)//2}')
            break
")
    if [ -n "$coords" ]; then
        adb shell input tap $coords
        echo "Tapped + button"
    else
        echo "ERROR: + button not found in header"
        return 1
    fi
}

# ─── Commands ──────────────────────────────────────────────────────────────────

do_start() {
    echo "=== Starting emulator ($AVD_NAME) ==="
    # Use host GPU to avoid software renderer memory bloat (29GB+)
    # Skip snapshot load for clean boot
    emulator "@$AVD_NAME" -gpu host -no-snapshot-load -no-audio &>/dev/null &
    echo "Waiting for boot..."
    adb wait-for-device
    for i in $(seq 1 60); do
        boot=$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')
        if [ "$boot" = "1" ]; then
            echo "Emulator booted in ~$((i*2))s"
            return 0
        fi
        sleep 2
    done
    echo "ERROR: Emulator did not boot within 120s"
    return 1
}

do_stop() {
    echo "=== Stopping emulator ==="
    adb emu kill 2>/dev/null || true
    sleep 2
    pkill -f "qemu-system" 2>/dev/null || true
    pkill -f "emulator/netsimd" 2>/dev/null || true
    pkill -f "emulator/crashpad" 2>/dev/null || true
    echo "Emulator stopped"
}

do_install() {
    echo "=== Installing APK ==="
    if [ ! -f "$APK" ]; then
        echo "ERROR: APK not found at $APK"
        echo "Run: cd apps/mobile && JAVA_HOME=... ./android/gradlew app:assembleRelease"
        return 1
    fi
    adb install -r "$APK" 2>&1
    echo "Installed $(ls -lh "$APK" | awk '{print $5}') APK"
}

do_login() {
    echo "=== Logging in as $EMAIL ==="
    adb shell am force-stop "$PACKAGE"
    sleep 1
    adb shell am start "$PACKAGE/.MainActivity"
    sleep 5

    # Get email field position
    dump_ui
    local email_y
    email_y=$(python3 -c "
import xml.etree.ElementTree as ET
for n in ET.parse('$UI_XML').iter('node'):
    if n.get('text','') == 'you@example.com':
        b = n.get('bounds','').replace('][',',').replace('[','').replace(']','').split(',')
        print((int(b[1])+int(b[3]))//2); break
")

    # Type email
    adb shell input tap 540 "$email_y"
    sleep 1
    adb shell input text "$EMAIL"
    sleep 0.3
    adb shell input keyevent KEYCODE_BACK
    sleep 1

    # Get password field position
    dump_ui
    local pw_y
    pw_y=$(python3 -c "
import xml.etree.ElementTree as ET
for n in ET.parse('$UI_XML').iter('node'):
    if n.get('password','') == 'true':
        b = n.get('bounds','').replace('][',',').replace('[','').replace(']','').split(',')
        print((int(b[1])+int(b[3]))//2); break
")

    # Type password
    adb shell input tap 540 "$pw_y"
    sleep 1
    adb shell input text "$PASS"
    sleep 0.3
    adb shell input keyevent KEYCODE_BACK
    sleep 0.5

    # Find and tap sign in button
    dump_ui
    local btn_y
    btn_y=$(python3 -c "
import xml.etree.ElementTree as ET
for n in ET.parse('$UI_XML').iter('node'):
    b = n.get('bounds','')
    if n.get('clickable')=='true' and not n.get('text') and b:
        p = b.replace('][',',').replace('[','').replace(']','').split(',')
        y1, y2 = int(p[1]), int(p[3])
        if y1 > 1250 and y2 < 1500:
            print((y1+y2)//2); break
")

    adb shell input tap 540 "$btn_y"
    echo "Tapped sign in, waiting..."
    sleep 6

    # Show result
    dump_ui
    local first_text
    first_text=$(python3 -c "
import xml.etree.ElementTree as ET
for n in ET.parse('$UI_XML').iter('node'):
    t = n.get('text','')
    if t:
        print(t)
        break
")
    if [ "$first_text" = "Dashboard" ]; then
        echo "Login successful"
    else
        echo "Login may have failed. First text: $first_text"
        show_texts
    fi
}

do_plaid_test() {
    echo "=== Plaid Sandbox Test Flow ==="

    echo ""
    echo "--- Step 1: Navigate to Profile ---"
    dump_ui
    # Tap profile icon (clickable in top-right, no text)
    local profile_coords
    profile_coords=$(python3 -c "
import xml.etree.ElementTree as ET
for n in ET.parse('$UI_XML').iter('node'):
    b = n.get('bounds','')
    if n.get('clickable')=='true' and b and not n.get('text'):
        p = b.replace('][',',').replace('[','').replace(']','').split(',')
        if int(p[1]) < 300 and int(p[0]) > 800:
            print(f'{(int(p[0])+int(p[2]))//2} {(int(p[1])+int(p[3]))//2}')
            break
")
    if [ -n "$profile_coords" ]; then
        adb shell input tap $profile_coords
        echo "Tapped profile icon"
    else
        echo "Profile icon not found"
        return 1
    fi
    sleep 2

    echo ""
    echo "--- Step 2: Tap Dev Settings ---"
    find_and_tap "Dev Settings"
    sleep 2

    echo ""
    echo "--- Step 3: Enable Plaid Sandbox ---"
    dump_ui
    # Find toggle switch
    local switch_coords
    switch_coords=$(python3 -c "
import xml.etree.ElementTree as ET
for n in ET.parse('$UI_XML').iter('node'):
    cls = n.get('class','')
    b = n.get('bounds','')
    if 'Switch' in cls and b:
        p = b.replace('][',',').replace('[','').replace(']','').split(',')
        print(f'{(int(p[0])+int(p[2]))//2} {(int(p[1])+int(p[3]))//2}')
        break
")
    if [ -n "$switch_coords" ]; then
        adb shell input tap $switch_coords
        echo "Toggled sandbox switch"
    else
        find_and_tap "Use Plaid Sandbox"
    fi
    sleep 2
    screenshot "dev_settings"

    echo ""
    echo "--- Step 4: Go back to Accounts ---"
    adb shell input keyevent KEYCODE_BACK
    sleep 1
    adb shell input keyevent KEYCODE_BACK
    sleep 1
    tap_bottom_tab "Accounts"
    sleep 3
    screenshot "accounts"

    echo ""
    echo "--- Step 5: Current state ---"
    dump_ui
    show_texts
}

do_plaid_link() {
    echo "=== Plaid Sandbox Link Flow ==="

    echo ""
    echo "--- Step 1: Navigate to Accounts ---"
    # Go to Dashboard first to reset any sub-page state, then to Accounts
    tap_bottom_tab "Dashboard"
    sleep 1
    tap_bottom_tab "Accounts"
    sleep 2

    echo ""
    echo "--- Step 2: Open Add Account ---"
    dump_ui
    # Check if "Link Bank Account" is already visible (empty state or Add Account page)
    local has_link
    has_link=$(python3 -c "
import xml.etree.ElementTree as ET
for n in ET.parse('$UI_XML').iter('node'):
    if 'Link Bank Account' in n.get('text',''):
        print('yes'); break
")
    if [ "$has_link" != "yes" ]; then
        tap_add_account_plus
        sleep 2
    else
        echo "Link Bank Account already visible"
    fi

    echo ""
    echo "--- Step 3: Tap Link Bank Account ---"
    find_and_tap "Link Bank Account"
    sleep 3

    echo ""
    echo "--- Step 4: Run Plaid sandbox flow via CDP ---"
    # Wait for WebView to appear then forward CDP
    sleep 3
    cdp plaid-sandbox-flow
    local cdp_exit=$?

    sleep 3
    screenshot "plaid_result"

    if [ $cdp_exit -ne 0 ]; then
        echo ""
        echo "--- Plaid link flow failed ---"
        return 1
    fi

    echo ""
    echo "--- Step 5: Verify accounts linked ---"
    # Wait for app to return to accounts screen
    sleep 5
    dump_ui
    show_texts
    screenshot "accounts_after_link"

    echo ""
    echo "=== Plaid Link Complete ==="
}

do_nav() {
    local tab="$1"
    tap_bottom_tab "$tab"
    sleep 3
    screenshot "$(echo "$tab" | tr '[:upper:]' '[:lower:]')"
}

# ─── Main ──────────────────────────────────────────────────────────────────────

if [ $# -eq 0 ]; then
    echo "Usage: $0 [--install] [--login] [--screenshot [NAME]] [--plaid-link] [--tap TEXT] [--cdp ACTION] [--dump] [--nav TAB]"
    echo ""
    echo "Commands:"
    echo "  --start             Start emulator (host GPU, no snapshot)"
    echo "  --stop              Stop emulator and free memory"
    echo "  --install           Install release APK"
    echo "  --login             Login with test credentials"
    echo "  --plaid-link        Full Plaid sandbox link flow (end-to-end)"
    echo "  --plaid-test        Legacy: navigate to dev settings"
    echo "  --tap TEXT          Tap native UI element containing TEXT"
    echo "  --cdp ACTION [ARGS] Run CDP action on active WebView (click-text, get-text, etc.)"
    echo "  --screenshot [NAME] Take a screenshot"
    echo "  --dump              Dump native UI hierarchy texts"
    echo "  --nav TAB           Navigate to bottom tab (Dashboard, Accounts, Activity, Budgets, Bills)"
    echo ""
    echo "Environment variables:"
    echo "  EMU_EMAIL       Login email (default: test@kumaranik.com)"
    echo "  EMU_PASS        Login password (default: TestPass123)"
    echo "  SCREENSHOT_DIR  Screenshot output dir (default: /tmp/claude)"
    exit 0
fi

while [ $# -gt 0 ]; do
    case "$1" in
        --start)
            do_start
            shift
            ;;
        --stop)
            do_stop
            shift
            ;;
        --install)
            do_install
            shift
            ;;
        --login)
            do_login
            shift
            ;;
        --screenshot)
            if [ $# -gt 1 ] && [[ ! "$2" == --* ]]; then
                screenshot "$2"
                shift 2
            else
                screenshot
                shift
            fi
            ;;
        --plaid-link)
            do_plaid_link
            shift
            ;;
        --plaid-test)
            do_plaid_test
            shift
            ;;
        --cdp)
            if [ $# -lt 2 ]; then
                echo "ERROR: --cdp requires an action (click-text, click-exact, type-field, get-text, wait-text, plaid-sandbox-flow)"
                exit 1
            fi
            shift
            cdp "$@"
            # consume all remaining args (cdp actions may have variable args)
            shift $#
            ;;
        --tap)
            if [ $# -lt 2 ]; then
                echo "ERROR: --tap requires a text argument"
                exit 1
            fi
            find_and_tap "$2"
            shift 2
            ;;
        --dump)
            dump_ui
            show_texts
            shift
            ;;
        --nav)
            if [ $# -lt 2 ]; then
                echo "ERROR: --nav requires a tab name (Dashboard, Accounts, Activity, Budgets, Bills)"
                exit 1
            fi
            do_nav "$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
    sleep 1
done
