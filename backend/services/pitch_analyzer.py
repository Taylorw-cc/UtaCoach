import io
import librosa
import numpy as np

def load_audio(audio_bytes: bytes):
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