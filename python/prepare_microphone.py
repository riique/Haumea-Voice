"""Prepare Windows capture microphone for Haumea Voice.

This script intentionally degrades safely: if pycaw is missing or Core Audio
returns an error, it prints a JSON warning and exits with code 0 so Electron can
continue with browser-level audio fallback.
"""

from __future__ import annotations

import json
import sys
from typing import Any


PREFERRED_LABELS = ("Logitech G733", "G733", "Logitech")


def emit(payload: dict[str, Any]) -> None:
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def warning_result(message: str) -> dict[str, Any]:
    return {
        "ok": False,
        "platform": sys.platform,
        "warnings": [message],
    }


def read_request() -> dict[str, Any]:
    if len(sys.argv) < 2:
        return {}

    try:
        parsed = json.loads(sys.argv[1])
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def friendly_name(device: Any) -> str:
    value = getattr(device, "FriendlyName", "") or ""
    return str(value)


def wrap_device(AudioUtilities: Any, device: Any) -> Any:
    if device is None:
        return None

    if hasattr(device, "EndpointVolume"):
        return device

    create_device = getattr(AudioUtilities, "CreateDevice", None)
    if callable(create_device):
        return create_device(device)

    return device


def find_preferred_device(AudioUtilities: Any, EDataFlow: Any, DEVICE_STATE: Any, preferred_labels: list[str]) -> Any:
    devices = AudioUtilities.GetAllDevices(
        data_flow=EDataFlow.eCapture.value,
        device_state=DEVICE_STATE.ACTIVE.value,
    )
    labels = [label.lower() for label in preferred_labels if label]

    for device in devices:
        name = friendly_name(device).lower()
        if any(label in name for label in labels):
            return device

    return None


def main() -> None:
    if sys.platform != "win32":
        emit(warning_result("prepare_microphone.py deve rodar apenas no Windows."))
        return

    request = read_request()
    preferred_labels = list(PREFERRED_LABELS)
    for label in request.get("preferredLabels", []):
        if isinstance(label, str) and label.strip():
            preferred_labels.append(label.strip())

    try:
        import comtypes
        from pycaw.constants import DEVICE_STATE, EDataFlow
        from pycaw.pycaw import AudioUtilities
    except ImportError as exc:
        emit(warning_result(f"pycaw nao instalado ou indisponivel: {exc}"))
        return

    try:
        comtypes.CoInitialize()
    except Exception:
        pass

    try:
        selected = find_preferred_device(AudioUtilities, EDataFlow, DEVICE_STATE, preferred_labels)
        if selected is None:
            selected = wrap_device(AudioUtilities, AudioUtilities.GetMicrophone())

        if selected is None:
            emit(warning_result("Nenhum microfone de captura ativo foi encontrado pelo Windows Core Audio."))
            return

        volume = selected.EndpointVolume
        volume.SetMute(0, None)
        volume.SetMasterVolumeLevelScalar(1.0, None)

        emit(
            {
                "ok": True,
                "platform": sys.platform,
                "selectedSource": getattr(selected, "id", None),
                "selectedDescription": friendly_name(selected),
                "warnings": [],
            }
        )
    except Exception as exc:
        emit(warning_result(f"Falha ao preparar microfone via pycaw: {exc}"))
    finally:
        try:
            comtypes.CoUninitialize()
        except Exception:
            pass


if __name__ == "__main__":
    main()
