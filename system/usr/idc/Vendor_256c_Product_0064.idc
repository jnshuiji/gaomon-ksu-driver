# Copyright (C) 2026 The Android Open Source Project
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

#
# Input Device Configuration file for Gaomon Drawing Tablet
#
# Target Hardware Specifications:
# ==============================================================================
# Digitizer Peripheral:
#   Manufacturer: GAOMON (USB String: GAOMON, Huion OEM Architecture)
#   Product String: Gaomon Tablet_M8
#   USB Vendor ID (VID): 0x256c
#   USB Product ID (PID): 0x0064
#   Device Version: 0x0110 (bcdDevice 0111)
#   USB Power: 480mA, Full-Speed 12Mbps, Bus-Powered, Remote Wakeup
#   Input Node: GAOMON Gaomon Tablet_M8 Pen (/dev/input/event9, EventHub Bus 0x0003)
#   Raw Evdev Active Area: X [0, 51694] (res: 204 units/mm -> 253.4 mm)
#                          Y [0, 32308] (res: 204 units/mm -> 158.4 mm)
#   Pressure Sensing Range: [0, 16383] (14-bit physical resolution, 16384 discrete levels)
#   Tilt Angle: TiltX [-127, 127], TiltY [-127, 127]
#   Transducer Technology: Battery-Free EMR Passive Stylus (Inductive RF Resonance)
#
# Target Host Platform:
#   Market Name: OnePlus Pad 3 Pro
#   Device Model: OPD2513 (Product: OPD2513, Device: OP6547L1, Platform: canoe)
#   Application Processor (SoC): Qualcomm Snapdragon 8 Elite
#                                (SM8850P, soc_id 661, 3nm process, Oryon architecture)
#   Kernel: Linux 6.12.69 (Android 16 GKI, android16-6.12)
#   Operating System: Android 17 (ColorOS V17.0.0, API Level 37, Build OPD2513_17.0.0.105(CN01))
#   Display Panel: 2400 x 3392 (7:5 Aspect Ratio, 420 dpi, 144Hz VRR, native portrait frame)
# ==============================================================================
#

# Device Classification
# Configures the digitizer as an on-screen touch/stylus device mapped directly to the display viewport.
# Bypasses the default indirect 'pointer' mode (mouse cursor emulation) and eliminates cursor latency.
touch.deviceType = touchScreen

# Orientation Alignment
# Set to 0 (disabled) because the drawing tablet has a fixed physical orientation on the desk.
# Disabling orientationAware prevents Android from rotating coordinate transformation matrices
# when the host tablet rotates between portrait and landscape modes.
touch.orientationAware = 0

# Pressure Calibration
# Maps the 14-bit pressure sensor (0 - 16383) to normalized pressure units [0.0, 1.0].
touch.pressure.calibration = physical
touch.pressure.scale = 0.00006103515625

# Geometry and Size Calibration
touch.size.calibration = none
touch.orientation.calibration = none
touch.distance.calibration = none

# Gesture Handling
touch.gestureMode = spots
