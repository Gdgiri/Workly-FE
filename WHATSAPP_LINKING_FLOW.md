# WhatsApp Device Linking Flow

This document outlines the expected flow for linking a WhatsApp device via QR code scanning.

## 1. Initial State (QR Code Display)
When the user navigates to the "WA-Personal Configuration" section and selects the "Device Link" tab:
- The application displays the WhatsApp QR Code.
- Currently, this uses the stored image (`/Whatsappimage.jpeg`).
- The UI waits for the user to open WhatsApp on their phone and physically scan the QR code.

## 2. Scanning & Connecting State
When the user scans the QR code with their mobile device, the application detects the scan:
- **Detection**: In a real production environment, the backend (which runs the WhatsApp Web client) will detect the scan and notify the frontend (e.g., via WebSockets or polling).
- **UI Update**: As soon as the scan is detected, the frontend automatically transitions to the **Connecting** state.
- **Visuals**: The QR code becomes blurred (`blur-[2px]`) and faded (`opacity-30`), and a "Connecting..." spinner (`<RefreshCw />`) appears in front of the QR code.

## 3. Successful Connection (Linked State)
Once the WhatsApp session is fully authenticated and established:
- The backend confirms the successful connection.
- The frontend updates the state (`isDeviceLinked = true`).
- The QR code disappears and is replaced by the **"Device Linked Successfully"** success screen.
- The user is now ready to send automated messages.

---

### Implementation Notes for Frontend:
Since the frontend currently lacks a live WebSocket connection to detect the actual scan, you can manually trigger the "Connecting..." state for testing by keeping the `onClick={simulateConnection}` on the image, or by hooking it up to your backend once the backend WhatsApp API is ready.
