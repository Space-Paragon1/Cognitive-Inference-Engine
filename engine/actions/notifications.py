"""
Notification Control — platform-aware suppression of OS notifications.
"""

from __future__ import annotations

import subprocess
import sys


class NotificationController:

    def suppress(self) -> bool:
        """Enable Do Not Disturb / Focus Assist."""
        if sys.platform == "win32":
            return self._windows_dnd(enable=True)
        if sys.platform == "darwin":
            return self._macos_dnd(enable=True)
        return self._linux_dnd(enable=True)

    def allow(self) -> bool:
        """Disable Do Not Disturb."""
        if sys.platform == "win32":
            return self._windows_dnd(enable=False)
        if sys.platform == "darwin":
            return self._macos_dnd(enable=False)
        return self._linux_dnd(enable=False)

    # ------------------------------------------------------------------
    # Platform implementations
    # ------------------------------------------------------------------

    def _windows_dnd(self, enable: bool) -> bool:
        # Windows 11 Focus Assist via PowerShell registry toggle
        value = "1" if enable else "0"
        try:
            subprocess.run(
                [
                    "powershell", "-Command",
                    f"Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\CloudContent' "
                    f"-Name 'DisableWindowsSpotlightFeatures' -Value {value} -Type DWord"
                ],
                check=True, capture_output=True, timeout=5,
            )
            return True
        except Exception:
            return False

    def _macos_dnd(self, enable: bool) -> bool:
        mode = "1" if enable else "0"
        try:
            subprocess.run(
                ["defaults", "-currentHost", "write", "com.apple.notificationcenterui",
                 "doNotDisturb", "-boolean", "TRUE" if enable else "FALSE"],
                check=True, capture_output=True, timeout=5,
            )
            subprocess.run(
                ["killall", "NotificationCenter"],
                capture_output=True, timeout=5,
            )
            return True
        except Exception:
            return False

    def _linux_dnd(self, enable: bool) -> bool:
        # GNOME: toggle via gsettings
        try:
            subprocess.run(
                ["gsettings", "set", "org.gnome.desktop.notifications",
                 "show-banners", "false" if enable else "true"],
                check=True, capture_output=True, timeout=5,
            )
            return True
        except Exception:
            return False
