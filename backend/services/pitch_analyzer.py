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

def build_note_segments(
    pitch_points,
    max_gap=0.12,
    min_duration=0.15,
    smoothing_window=5,
    pitch_tolerance_cents=35
):
    if not pitch_points:
        return []

    # ==============================
    # 1. 保留原始 MIDI
    # ==============================

    original_midi = np.array(
        [point["midi"] for point in pitch_points],
        dtype=float
    )

    times = np.array(
        [point["time"] for point in pitch_points],
        dtype=float
    )

    # ==============================
    # 2. Segmentation 專用輕度 smoothing
    #    使用 rolling median
    # ==============================

    half_window = smoothing_window // 2

    smoothed_midi = []

    for i in range(len(original_midi)):
        start = max(
            0,
            i - half_window
        )

        end = min(
            len(original_midi),
            i + half_window + 1
        )

        window_values = original_midi[
            start:end
        ]

        smoothed_value = float(
            np.median(window_values)
        )

        smoothed_midi.append(
            smoothed_value
        )

    smoothed_midi = np.array(
        smoothed_midi,
        dtype=float
    )

    # ==============================
    # 3. cents tolerance
    # ==============================

    pitch_tolerance_midi = (
        pitch_tolerance_cents / 100.0
    )

    # ==============================
    # 4. 建立 note segments
    # ==============================

    segments = []
    current = None

    for index, point in enumerate(pitch_points):
        time = times[index]
        original_value = original_midi[index]
        smoothed_value = smoothed_midi[index]

        if current is None:
            current = {
                "start_time": time,
                "end_time": time,

                # 原始值：
                # stability 分析使用
                "original_midi_values": [
                    original_value
                ],

                # smoothing 後的值：
                # segmentation 判斷使用
                "smoothed_midi_values": [
                    smoothed_value
                ]
            }

            continue

        time_gap = (
            time
            - current["end_time"]
        )

        # 目前區段的代表音高
        reference_midi = float(np.median(current["smoothed_midi_values"]))
        pitch_difference = abs(smoothed_value - reference_midi)
        same_note = (pitch_difference <= pitch_tolerance_midi)

        # ==========================
        # 同一個音符
        # ==========================

        if (same_note and time_gap <= max_gap):
            current["end_time"] = time
            current["original_midi_values"].append(original_value)
            current["smoothed_midi_values"].append(smoothed_value)

        # ==========================
        # 新音符
        # ==========================

        else:
            segments.append(current)

            current = {
                "start_time": time,
                "end_time": time,
                "original_midi_values": [original_value],
                "smoothed_midi_values": [smoothed_value]
            }


    if current is not None:
        segments.append(current)

    # ==============================
    # 5. 建立輸出結果
    # ==============================

    result = []

    for segment in segments:

        duration = (
            segment["end_time"]
            - segment["start_time"]
        )


        if duration < min_duration:
            continue

        # --------------------------
        # Note identification
        # 使用 smoothing 後的資料
        # --------------------------

        median_midi = float(np.median(segment["smoothed_midi_values"]))

        # --------------------------
        # Stability
        # 使用原始資料
        # --------------------------

        original_values = np.array(segment["original_midi_values"], dtype=float)

        raw_median = float(np.median(original_values))

        cent_offsets = (original_values - raw_median) * 100

        pitch_std_cents = float(np.std(cent_offsets))

        pitch_range_cents = float(np.max(cent_offsets) - np.min(cent_offsets))

        stability_score = max(0.0, min(100.0, 100.0 - pitch_std_cents * 2))

        result.append({
            "start_time": float(segment["start_time"]),
            "end_time": float(segment["end_time"]),
            "duration": float(duration),

            "midi": median_midi,
            "note": librosa.midi_to_note(median_midi),

            "pitch_std_cents": pitch_std_cents,
            "pitch_range_cents": pitch_range_cents,
            "stability_score": stability_score
        })


    return result

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

    note_segments = build_note_segments(pitch_points)
    midi_values = [
    point["midi"]
    for point in pitch_points
    ]

    if midi_values:
        min_midi = min(midi_values)
        max_midi = max(midi_values)
        median_midi = float(np.median(midi_values))

        pitch_summary = {
            "lowest_note": librosa.midi_to_note(min_midi),
            "highest_note": librosa.midi_to_note(max_midi),
            "main_note": librosa.midi_to_note(median_midi),
            "lowest_midi": float(min_midi),
            "highest_midi": float(max_midi),
            "median_midi": median_midi,
        }
    else:
        pitch_summary = {
            "lowest_note": None,
            "highest_note": None,
            "main_note": None,
            "lowest_midi": None,
            "highest_midi": None,
            "median_midi": None,
        }

    return {
    "sample_rate": sr,
    "samples": len(y),
    "duration_seconds": len(y) / sr,
    "pitch_summary": pitch_summary,
    "pitch_points": pitch_points,
    "note_segments": note_segments
    }