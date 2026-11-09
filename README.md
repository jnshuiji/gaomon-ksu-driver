# Gaomon Drawing Tablet Driver & Power Manager for KernelSU

A dedicated KernelSU / Magisk module engineered for Gaomon and Huion USB drawing tablets (Vendor ID: `0x256c`, Product ID: `0x0064`) on Android platforms. Resolves hardware power suspension issues on passive electromagnetic resonance (EMR) styluses and provides low-latency, direct on-screen digitizer mapping via a dedicated Android Input Device Configuration (IDC) driver profile.

---

## Target Hardware Platform Specifications

This module is tailored for the following baseline hardware configuration:

### 1. Digitizer Peripheral (Drawing Tablet)
| Attribute | Specification | Technical Detail |
| :--- | :--- | :--- |
| **Manufacturer** | GAOMON (Huion OEM Architecture) | Identifies on USB bus via Huion VID (`0x256c`) |
| **Product String** | `Gaomon Tablet_M8` | String descriptor reported over USB |
| **USB Vendor ID (VID)** | `0x256c` | Hexadecimal Vendor ID |
| **USB Product ID (PID)** | `0x0064` | Hexadecimal Product ID |
| **USB Device BCD / Version** | `0x0110` (bcdDevice `0111`) | Hardware revision identifier |
| **USB Bus Speed & Power** | Full Speed (12 Mbps), 480 mA | Bus-powered, remote wakeup enabled (`bmAttributes = a0`) |
| **Stylus Transducer Technology** | Battery-Free EMR Passive Stylus | Inductive RF resonance powered by tablet antenna grid |
| **Digitizer Input Node** | `/dev/input/event9` | `GAOMON Gaomon Tablet_M8 Pen` (Bus `0x0003`) |
| **Physical Active Area (Evdev)** | X: `[0, 51694]`, Y: `[0, 32308]` | Hardware resolution: `204 units/mm` (~253.4 mm × 158.4 mm) |
| **Pressure Sensing Range** | `[0, 16383]` | 14-bit resolution (16384 discrete levels) |
| **Pressure Scale Factor** | `0.00006103515625` | Linear normalization ($1 / 16384$) to `[0.0, 1.0]` |
| **Tilt Sensing Range** | TiltX `[-127, 127]`, TiltY `[-127, 127]` | Evdev raw tilt range reporting |
| **Pen Button Keycodes** | `BTN_TOUCH` (0x14a), `BTN_STYLUS` (0x14b) | `BTN_TOOL_PEN` (0x140), `BTN_TOOL_RUBBER` (0x141) |

### 2. Host Platform (Android Tablet)
| Attribute | Specification | Technical Detail |
| :--- | :--- | :--- |
| **Market Device Name** | OnePlus Pad 3 Pro | `ro.vendor.oplus.market.name` |
| **Brand / Manufacturer** | OnePlus / OPPO | `ro.product.brand = OnePlus`, `ro.product.manufacturer = OnePlus` |
| **Model Number / Name** | `OPD2513` | `ro.product.model = OPD2513`, `ro.product.name = OPD2513` |
| **Device Codename / Board** | `OP6547L1` / `canoe` | Machine: `CANOEP`, SKU: `CANOEP-5-AC` |
| **Application Processor (SoC)** | Qualcomm Snapdragon 8 Elite | `ro.soc.model = SM8850P`, `soc_id = 661`, Oryon Architecture (3nm) |
| **Kernel Version** | Linux `6.12.69-android16-6-g242e1a07f878-ab15865446-4k` | Android 16 GKI baseline (`android16-6.12`), aarch64 |
| **Operating System** | ColorOS 17 (Android 17 Base) | Build `OPD2513_17.0.0.105(CN01)`, SDK 37 (`ro.build.version.release = 17`) |
| **Display Panel Identifier** | `local:4630947217761632659` (Port 147) | Internal display connector |
| **Display Native Resolution** | `2400 x 3392` | 7:5 aspect ratio, Native Portrait (~13.2-inch panel) |
| **Display Density** | `420 dpi` (Scale Factor: 2.625) | `xDpi: 315.85`, `yDpi: 314.44` |
| **Hardware Refresh Rates** | `30, 48, 50, 60, 90, 120, 144 Hz` | Variable Refresh Rate (VRR) panel |
| **Power Management Interfaces** | `/sys/devices/virtual/oplus_chg/usb/*` | `otg_online`, `otg_switch`, `persist.sys.oplus.otg_support` |

---

## Technical Problem Statement

### 1. USB Runtime Autosuspend & EMR Passive Stylus Deadlock
Under default Linux kernel USB power management (`CONFIG_USB_AUTOSUSPEND`), USB Human Interface Devices (HID) enter runtime suspension (`power/control = auto`) after an inactivity delay (`autosuspend_delay_ms = 60000`). When suspended:
- The USB host controller reduces interface power consumption and halts active interrupt polling URBs.
- The digitizer control board powers down its electromagnetic resonance (EMR) antenna excitation coils.
- **Passive Stylus Deadlock**: Unlike active pens or battery-powered mice, battery-free passive styluses have no internal energy source and rely exclusively on the tablet's RF field for LC resonant induction. Once the tablet coils are de-energized, hovering or pressing the stylus cannot generate any induction signal or trigger a USB remote wakeup. The digitizer remains suspended indefinitely until the USB cable is physically reconnected.

### 2. OEM OTG Power Timeout
OEM frameworks (such as ColorOS / OxygenOS `OtgHelper`) register an exact 10-minute countdown alarm upon detecting no active mass storage or data transmission on the OTG bus, subsequently disabling the 5V VBUS charge-pump output (`otg_switch = 0`).

### 3. Missing IDC Profile and PointerController Latency
When an external digitizer lacks a vendor-specific Input Device Configuration (`.idc`) file, Android `EventHub` and `InputReader` classify the device under the fallback `DEVICE_TYPE_POINTER` mode. This introduces:
- Software mouse cursor emulation and artificial motion smoothing filters via `PointerController`.
- Motion event dispatching latency and quantization artifacts.
- Non-direct stylus input event classification inside digital ink applications.

### 4. Orientation Transformation Mismatch
Drawing tablets are physically stationary desktop peripherals with a fixed coordinate space. When configured with `touch.orientationAware = 1`, Android applies display rotation matrices to the tablet's coordinate feed whenever the host tablet changes orientation (e.g., rotating into landscape). Because the physical drawing tablet on the desk remains unrotated, this causes inverted or swapped axes in non-native display orientations.

---

## Architectural Solutions

```
+--------------------------------------------------------------------------------+
|                         KernelSU Module Architecture                           |
+--------------------------------------------------------------------------------+
                                       |
    +----------------------------------+----------------------------------+
    |                                                                     |
    v                                                                     v
[Dedicated IDC Driver]                                     [PenCursor KSU Daemon (Rust)]
- System Overlay: /system/usr/idc/                         - Event-driven epoll + inotify + timerfd
- Fallback: /data/system/devices/idc/                      - Dual 64x64 SurfaceFlinger Sprite Layers
- touch.deviceType = touchScreen                           - Linebender kurbo/peniko/vello_cpu engine
- touch.orientationAware = 0 (Fixed mapping)               - Zero-copy oneWay Transaction::setPosition
- 14-bit physical pressure calibration                     - Event-driven sysfs USB Power Governor
```

### 1. Dedicated Input Device Configuration (IDC)
Installs custom IDC descriptors across `EventHub` discovery paths:
- `Vendor_256c_Product_0064.idc`
- `Vendor_256c_Product_0064_Version_0110.idc`
- `GAOMON_Gaomon_Tablet_M8_Pen.idc`

Key parameter mappings:
- `touch.deviceType = touchScreen`: Forces `TouchInputMapper` into direct on-screen digitizer mode, completely bypassing `PointerController` and mouse cursor emulation for lowest input latency.
- `touch.orientationAware = 0`: Disables display-dependent orientation transforms. The digitizer coordinate axes remain anchored to the native portrait frame, ensuring consistent and correct mapping regardless of host display orientation.
- `touch.pressure.calibration = physical`: Scales the raw 14-bit sensor resolution (`0 - 16383`) linearly into normalized Android `MotionEvent.getPressure()` units.

### 2. PenCursor SurfaceFlinger Overlay & Event-Driven USB Power Daemon
- **Dual Pre-Rendered `64x64` `SurfaceControl` Sprite Layers**: Pre-rasterizes anti-aliased `Hover` (`Crosshair + Circle`) and `Contact` (`ContactDot`) vector sprites once at startup via Linebender `kurbo`, `peniko`, and `vello_cpu`. Runtime updates execute zero pixel copies, submitting only asynchronous (`oneWay`) `SurfaceComposerClient::Transaction::setPosition` updates.
- **Event-Driven `evdev` Coalescing (`epoll` + `inotify` + `timerfd`)**: Passively monitors `/dev/input/event*` without `EVIOCGRAB`, coalescing intermediate `SYN_REPORT` packets per wakeup and sleeping with `0.0%` CPU/GPU overhead when the stylus is out of range.
- **Event-Driven USB Power Governor**: Automatically enforces `usbcore.autosuspend = -1`, `power/control = on`, `power/autosuspend_delay_ms = -1`, and OTG persistence (`persist.sys.oplus.otg_support = 1`) on startup and USB hotplug events.

---

## Directory Structure

```
gaomon-ksu-driver/
├── module.prop                  # KernelSU module metadata descriptor
├── system.prop                  # System properties loaded during early init
├── post-fs-data.sh              # Early-stage initialization script
├── service.sh                   # Late-start service launching PenCursor daemon
├── customize.sh                 # KernelSU / Magisk installer script
├── uninstall.sh                 # Module cleanup script for clean uninstallation
├── build.sh                     # Automated Rust build & flashable ZIP packaging script
├── reload.sh                    # Live hot-reload script (zero reboot required)
├── pencursor/                   # Cross-platform Rust 2024 workspace submodule
├── system/
│   └── usr/
│       └── idc/                 # Magisk/KSU overlayfs target for IDC drivers
│           ├── Vendor_256c_Product_0064.idc
│           ├── Vendor_256c_Product_0064_Version_0110.idc
│           └── GAOMON_Gaomon_Tablet_M8_Pen.idc
└── README.md                    # Technical documentation
```

---

## Cursor Display & Mode Trade-offs

In Android's input subsystem:
1. **`touch.deviceType = touchScreen` (Current Default)**:
   - **Behavior**: Designed for direct interaction. Android assumes the physical pen tip touches the active display, and deliberately suppresses the software mouse pointer (`PointerController`).
   - **Advantage**: Lowest latency, direct stylus event dispatching (`TOOL_TYPE_STYLUS`), zero pointer smoothing overhead.
   - **Limitation**: No mouse arrow is rendered during hover or writing.

2. **Feasible Roadmaps for Restoring Cursor Visual Feedback**:
   - **Roadmap 1 (Native Pointer Mode)**: Change `touch.deviceType = pointer` in the `.idc` file. Android will immediately restore the native mouse arrow cursor.
   - **Roadmap 2 (Application-Level Overlay / LSPosed Hook)**: In drawing apps (such as StarNote via an Xposed module), intercept `ACTION_HOVER_MOVE` in `onGenericMotionEvent` and render a floating custom pen cursor layer at `(event.getX(), event.getY())`. This maintains `touchScreen` low-latency pipeline while restoring visual tracking.
   - **Roadmap 3 (System Accessibility / Floating Cursor App)**: Deploy a lightweight background service utilizing `TYPE_APPLICATION_OVERLAY` to draw a cursor tracking stylus hover coordinates.

---

## System Integrity & Power Analysis

### 1. State Restoration Upon Uninstallation
- **100% Non-Destructive**: KernelSU applies module modifications through in-memory Magic Mount (Overlayfs/tmpfs). No read-only system partitions (`/system`, `/vendor`) are ever modified.
- **Sysfs Resets**: Sysfs power configurations (`power/control`, `autosuspend`) exist exclusively in volatile kernel memory. Upon uninstalling and rebooting, the kernel restores all factory default parameters.
- **Storage Cleanup**: `uninstall.sh` automatically purges all fallback IDC copies in `/data/system/devices/idc/`.

### 2. Kernel Configuration & Power Consumption
- **Original Factory Settings**:
  - Global parameter: `/sys/module/usbcore/parameters/autosuspend = 2` (enabled, 2-second default delay).
  - Per-device parameter: `power/control = auto`, `autosuspend_delay_ms = 60000` (60 seconds).
- **Power Impact Analysis**:
  - **When disconnected**: 0% additional power consumption. The USB PHY and xHCI controller remain fully powered down.
  - **When connected**: The tablet draws continuous idle current of ~20mA - 40mA @ 5V (~0.1W - 0.2W) instead of entering <2.5mA sleep. On a standard 9500mAh tablet battery, this represents less than 0.5% battery drain per hour of continuous connection.
  - **Background Daemon Overhead**: `service.sh` sleeps in kernel-level wait queues (`nanosleep`) for 3 seconds between iterations. CPU utilization is strictly below 0.01%, incurring negligible energy impact.

---

## Compilation & Installation

### Option 1: Packaging as a Flashable ZIP
Run the included build script to generate a flashable package:

```bash
chmod +x build.sh
./build.sh
```

The resulting package will be generated at `out/gaomon-ksu-driver.zip`. This ZIP can be directly flashed in **KernelSU Manager**, **Magisk Manager**, or **APatch**.

### Option 2: Live Hot-Reload (Without Rebooting)
To apply configuration updates directly to a connected live device without restarting Android:

```bash
chmod +x reload.sh
./reload.sh
```
