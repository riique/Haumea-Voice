"""
Haumea Voice — Faster-Whisper transcription server.

Runs as a long-lived process, receiving JSON commands via stdin
and emitting PROGRESS/RESULT/READY lines via stdout.
Model persists in memory between transcriptions.

Protocol:
  → stdin:  one JSON object per line
  ← stdout: READY | PROGRESS:<int> | RESULT:<json> | ERROR:<msg>
"""

import json
import os
import struct
import subprocess
import sys
import tempfile
import wave

# P7: known Whisper hallucinations — segments matching these are discarded
_HALLUCINATIONS = {
    "thank you for watching",
    "thanks for watching",
    "obrigado por assistir",
    "obrigada por assistir",
    "inscreva-se",
    "subscribe",
    "like and subscribe",
    "legendas pela comunidade amara.org",
    "subtitles by the amara.org community",
    "please subscribe",
    "thank you",
    "obrigado",
    "you",
    "...",
}

# models that benefit from greedy decoding (trained for it)
_GREEDY_MODELS = {"large-v3-turbo"}


def _detect_device():
    """Auto-detect best available device."""
    try:
        import ctranslate2
        if "cuda" in ctranslate2.get_supported_compute_types("cuda"):
            return "cuda"
    except Exception:
        pass
    return "cpu"


def _best_compute_type(device: str) -> str:
    """Pick optimal quantization for the device."""
    if device == "cuda":
        try:
            import ctranslate2
            supported = ctranslate2.get_supported_compute_types("cuda")
            for prefer in ("float16", "int8_float16", "int8"):
                if prefer in supported:
                    return prefer
        except Exception:
            pass
        return "float16"
    return "int8"


def _cpu_threads() -> int:
    """Use physical cores, capped at 8 to avoid diminishing returns."""
    try:
        count = os.cpu_count() or 4
        # rough heuristic: half logical = physical
        return min(max(count // 2, 2), 8)
    except Exception:
        return 4


def _is_pcm16_wav(path: str) -> bool:
    """Check if file is already 16kHz mono PCM s16le WAV."""
    try:
        with wave.open(path, "rb") as wf:
            return (
                wf.getnchannels() == 1
                and wf.getframerate() == 16000
                and wf.getsampwidth() == 2  # 16-bit
            )
    except Exception:
        return False


def _convert_wav(src: str) -> str:
    """Convert any audio to 16kHz mono PCM WAV via FFmpeg."""
    fd, dst = tempfile.mkstemp(suffix=".wav", prefix="haumea_")
    os.close(fd)

    proc = subprocess.run(
        [
            "ffmpeg", "-y",
            "-i", src,
            "-ar", "16000",
            "-ac", "1",
            "-c:a", "pcm_s16le",
            "-loglevel", "error",
            dst,
        ],
        capture_output=True,
        text=True,
        timeout=30,
    )

    if proc.returncode != 0:
        if os.path.exists(dst):
            os.unlink(dst)
        tail = proc.stderr.strip().splitlines()[-1] if proc.stderr.strip() else "erro desconhecido"
        raise RuntimeError(f"FFmpeg falhou: {tail}")

    return dst


def _is_hallucination(text: str) -> bool:
    return text.strip().lower().rstrip(".!?,;:") in _HALLUCINATIONS


class TranscriptionServer:
    """Persistent server that keeps the model loaded."""

    def __init__(self):
        self._model = None
        self._model_path = None
        self._device = None
        self._compute_type = None

    def _ensure_model(self, model_path: str, device: str, compute_type: str):
        """Load model only if path/device/quantization changed."""
        if (
            self._model is not None
            and self._model_path == model_path
            and self._device == device
            and self._compute_type == compute_type
        ):
            return  # already loaded

        from faster_whisper import WhisperModel

        threads = _cpu_threads()

        self._model = WhisperModel(
            model_path,
            device=device,
            compute_type=compute_type,
            cpu_threads=threads if device == "cpu" else 0,
            num_workers=1,
        )
        self._model_path = model_path
        self._device = device
        self._compute_type = compute_type

    def _infer_model_id(self, model_path: str) -> str:
        """Extract model id from path (last directory name)."""
        return os.path.basename(model_path.rstrip("/\\"))

    def transcribe(self, cmd: dict):
        model_path = cmd["modelPath"]
        audio_path = cmd["audioPath"]
        language = cmd.get("language", "auto")
        device = cmd.get("device", "auto")
        compute_type = cmd.get("computeType", "auto")

        if device == "auto":
            device = _detect_device()
        if compute_type == "auto":
            compute_type = _best_compute_type(device)

        lang = None if language == "auto" else language
        model_id = self._infer_model_id(model_path)

        _emit("PROGRESS:5")

        # skip FFmpeg if already optimal format
        wav_path = None
        if _is_pcm16_wav(audio_path):
            effective_path = audio_path
        else:
            try:
                wav_path = _convert_wav(audio_path)
                effective_path = wav_path
            except Exception as e:
                print(f"Aviso: conversao FFmpeg falhou ({e}), usando arquivo original", file=sys.stderr)
                effective_path = audio_path

        _emit("PROGRESS:10")

        self._ensure_model(model_path, device, compute_type)

        _emit("PROGRESS:15")

        # turbo models: greedy is faster with negligible quality loss
        beam = 1 if model_id in _GREEDY_MODELS else 5

        segments_iter, info = self._model.transcribe(
            effective_path,
            language=lang,
            beam_size=beam,
            temperature=0,
            condition_on_previous_text=False,
            vad_filter=True,
            vad_parameters=dict(
                min_silence_duration_ms=500,
                speech_pad_ms=200,
                min_speech_duration_ms=250,
                threshold=0.35,
            ),
            initial_prompt="Haumea Voice.",
        )

        detected_language = info.language
        duration = info.duration

        _emit("PROGRESS:20")

        segments = []
        for seg in segments_iter:
            text = seg.text.strip()

            if not text or _is_hallucination(text):
                continue

            segments.append({
                "start": round(seg.start, 3),
                "end": round(seg.end, 3),
                "text": text,
            })

            if duration and duration > 0:
                pct = min(95, int(20 + (seg.end / duration) * 75))
                _emit(f"PROGRESS:{pct}")

        full_text = " ".join(s["text"] for s in segments)

        result = {
            "text": full_text,
            "segments": segments,
            "language": detected_language,
            "duration": round(duration, 3) if duration else 0,
        }

        _emit("PROGRESS:100")
        _emit(f"RESULT:{json.dumps(result, ensure_ascii=False)}")

        # cleanup temp WAV
        if wav_path and os.path.exists(wav_path):
            try:
                os.unlink(wav_path)
            except OSError:
                pass

    def run(self):
        """Main loop — read JSON commands from stdin, process, repeat."""
        _emit("READY")

        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue

            try:
                cmd = json.loads(line)
            except json.JSONDecodeError as e:
                _emit(f"ERROR:JSON invalido: {e}")
                continue

            action = cmd.get("action", "transcribe")

            if action == "transcribe":
                try:
                    self.transcribe(cmd)
                except Exception as e:
                    _emit(f"ERROR:{e}")
            elif action == "ping":
                _emit("PONG")
            elif action == "exit":
                break
            else:
                _emit(f"ERROR:Acao desconhecida: {action}")


def _emit(msg: str):
    print(msg, flush=True)


def main():
    try:
        from faster_whisper import WhisperModel  # noqa: F401
    except ImportError:
        print("ERRO: faster-whisper nao instalado. Execute: pip install faster-whisper", file=sys.stderr)
        sys.exit(1)

    server = TranscriptionServer()
    server.run()


if __name__ == "__main__":
    main()
