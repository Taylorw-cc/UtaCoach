import io
import subprocess
import tempfile
from pathlib import Path

import librosa
import numpy as np


def convert_to_wav(audio_bytes: bytes, input_suffix: str = ".webm") -> bytes:
    with tempfile.NamedTemporaryFile(
        suffix=input_suffix,
        delete=False
    ) as input_file:
        input_file.write(audio_bytes)
        input_path = Path(input_file.name)

    with tempfile.NamedTemporaryFile(
        suffix=".wav",
        delete=False
    ) as output_file:
        output_path = Path(output_file.name)

    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(input_path),
                "-ac",
                "1",
                "-ar",
                "44100",
                str(output_path),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        return output_path.read_bytes()

    finally:
        input_path.unlink(missing_ok=True)
        output_path.unlink(missing_ok=True)


def load_audio(
    audio_bytes: bytes,
    input_suffix: str = ".wav"
):
    if input_suffix.lower() != ".wav":
        audio_bytes = convert_to_wav(
            audio_bytes,
            input_suffix=input_suffix
        )

    audio_file = io.BytesIO(audio_bytes)

    y, sr = librosa.load(
        audio_file,
        sr=None,
        mono=True
    )

    f0, voiced_flag, voiced_prob = librosa.pyin(
        y,
        fmin=librosa.note_to_hz("C2"),
        fmax=librosa.note_to_hz("C7"),
        sr=sr
    )

    times = librosa.times_like(
        f0,
        sr=sr
    )

    pitch_points = []

    for time, frequency, voiced in zip(
        times,
        f0,
        voiced_flag
    ):
        if voiced and np.isfinite(frequency):
            midi_note = librosa.hz_to_midi(frequency)
            note_name = librosa.hz_to_note(frequency)

            pitch_points.append({
                "time": float(time),
                "frequency": float(frequency),
                "midi": float(midi_note),
                "note": note_name
            })

    return {
        "sample_rate": sr,
        "samples": len(y),
        "duration_seconds": len(y) / sr,
        "pitch_points": pitch_points
    }