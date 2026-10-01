// ==============================
// 1. DOM 元件
// ==============================

// 手動上傳音訊
const audioFile = document.getElementById("audioFile");
const uploadBtn = document.getElementById("uploadBtn");

// 狀態顯示
const status = document.getElementById("status");
const avgStability = document.getElementById("avgStability");
const leastStableNote = document.getElementById("leastStableNote");

// 音高圖
const canvas = document.getElementById("pitchChart");
const ctx = canvas.getContext("2d");
const mainNote = document.getElementById("mainNote");
const lowestNote = document.getElementById("lowestNote");
const highestNote = document.getElementById("highestNote");
const noteSegmentsCanvas = document.getElementById("noteSegmentsChart");
const noteSegmentsCtx = noteSegmentsCanvas.getContext("2d");

// 錄音相關
const startRecordBtn = document.getElementById("startRecordBtn");
const stopRecordBtn = document.getElementById("stopRecordBtn");
const analyzeRecordingBtn = document.getElementById("analyzeRecordingBtn");

const recordStatus = document.getElementById("recordStatus");
const recordedAudio = document.getElementById("recordedAudio");


// ==============================
// 2. 錄音狀態變數
// ==============================

let mediaRecorder = null;
let audioChunks = [];
let recordedBlob = null;
let recordedAudioUrl = null;


// ==============================
// 3. 手動選擇音訊檔案分析
// ==============================

uploadBtn.addEventListener("click", async () => {
    const file = audioFile.files[0];

    if (!file) {
        status.textContent = "請先選擇音訊檔案";
        return;
    }

    status.textContent = "分析中...";

    const formData = new FormData();
    formData.append("audio", file);

    try {
        const data = await sendAudioToBackend(formData);

        console.log("上傳檔案分析結果：", data);

        showPitchSummary(data.audio_info.pitch_summary);
        showStabilitySummary(data.audio_info.note_segments);
        drawPitch(data.audio_info.pitch_points);
        drawNoteSegments(data.audio_info.note_segments);

        status.textContent = "分析完成";

    } catch (error) {
        console.error(error);
        status.textContent = `分析失敗：${error.message}`;
    }
});


// ==============================
// 4. 開始錄音
// ==============================

startRecordBtn.addEventListener("click", async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true
        });

        mediaRecorder = new MediaRecorder(stream);

        audioChunks = [];
        recordedBlob = null;

        if (recordedAudioUrl) {
            URL.revokeObjectURL(recordedAudioUrl);
            recordedAudioUrl = null;
        }

        recordedAudio.removeAttribute("src");
        recordedAudio.load();

        analyzeRecordingBtn.disabled = true;

        mediaRecorder.addEventListener("dataavailable", (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        });

        mediaRecorder.addEventListener("stop", () => {
            recordedBlob = new Blob(
                audioChunks,
                {
                    type: mediaRecorder.mimeType
                }
            );

            recordedAudioUrl = URL.createObjectURL(recordedBlob);

            recordedAudio.src = recordedAudioUrl;

            recordStatus.textContent =
                `錄音完成：${recordedBlob.size} bytes，格式：${recordedBlob.type}`;

            analyzeRecordingBtn.disabled = false;
        });

        mediaRecorder.start();

        recordStatus.textContent = "錄音中...";

        startRecordBtn.disabled = true;
        stopRecordBtn.disabled = false;

    } catch (error) {
        console.error(error);

        recordStatus.textContent =
            `無法取得麥克風：${error.message}`;
    }
});


// ==============================
// 5. 停止錄音
// ==============================

stopRecordBtn.addEventListener("click", () => {
    if (
        mediaRecorder &&
        mediaRecorder.state === "recording"
    ) {
        mediaRecorder.stop();

        mediaRecorder.stream
            .getTracks()
            .forEach((track) => track.stop());

        startRecordBtn.disabled = false;
        stopRecordBtn.disabled = true;
    }
});


// ==============================
// 6. 分析剛才錄製的音訊
// ==============================

analyzeRecordingBtn.addEventListener("click", async () => {
    if (!recordedBlob) {
        status.textContent = "目前沒有可分析的錄音";
        return;
    }

    status.textContent = "分析錄音中...";

    const formData = new FormData();

    const extension = getAudioExtension(recordedBlob.type);

    formData.append(
        "audio",
        recordedBlob,
        `recording.${extension}`
    );

    try {
        const data = await sendAudioToBackend(formData);

        console.log("錄音分析結果：", data);

        showPitchSummary(data.audio_info.pitch_summary);
        showStabilitySummary(data.audio_info.note_segments);
        drawPitch(data.audio_info.pitch_points);
        drawNoteSegments(data.audio_info.note_segments);

        status.textContent = "錄音分析完成";

    } catch (error) {
        console.error(error);

        status.textContent =
            `錄音分析失敗：${error.message}`;
    }
});


// ==============================
// 7. 共用：送音訊到 FastAPI
// ==============================

async function sendAudioToBackend(formData) {
    const response = await fetch(
        "http://127.0.0.1:8000/audio/upload",
        {
            method: "POST",
            body: formData
        }
    );

    if (!response.ok) {
        let message = `HTTP ${response.status}`;

        try {
            const errorData = await response.json();

            if (errorData.detail) {
                message += `：${errorData.detail}`;
            }
        } catch {
            // 如果後端不是 JSON 錯誤，就保留原本 HTTP 訊息
        }

        throw new Error(message);
    }

    return await response.json();
}


// ==============================
// 8. 共用：依 MIME type 決定副檔名
// ==============================

function getAudioExtension(mimeType) {
    if (!mimeType) {
        return "webm";
    }

    if (mimeType.includes("webm")) {
        return "webm";
    }

    if (mimeType.includes("ogg")) {
        return "ogg";
    }

    if (mimeType.includes("mp4")) {
        return "m4a";
    }

    if (mimeType.includes("wav")) {
        return "wav";
    }

    return "webm";
}


// ==============================
// 9. 畫音高曲線
// ==============================

function showPitchSummary(summary) {
    mainNote.textContent = summary?.main_note ?? "--";
    lowestNote.textContent = summary?.lowest_note ?? "--";
    highestNote.textContent = summary?.highest_note ?? "--";
}

function drawPitch(points) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!points || points.length === 0) {
        status.textContent = "沒有偵測到有效音高";
        return;
    }

    const padding = 60;

    const times = points.map((point) => point.time);
    const midiValues = points.map((point) => point.midi);

    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    const minMidi = Math.floor(Math.min(...midiValues)) - 1;
    const maxMidi = Math.ceil(Math.max(...midiValues)) + 1;

    const timeRange = maxTime - minTime || 1;
    const midiRange = maxMidi - minMidi || 1;

    function scaleX(time) {
        return (
            padding +
            ((time - minTime) / timeRange) *
            (canvas.width - padding * 2)
        );
    }

    function scaleY(midi) {
        return (
            canvas.height -
            padding -
            ((midi - minMidi) / midiRange) *
            (canvas.height - padding * 2)
        );
    }

    function midiToNoteName(midi) {
        const noteNames = [
            "C", "C#", "D", "D#", "E", "F",
            "F#", "G", "G#", "A", "A#", "B"
        ];

        const rounded = Math.round(midi);
        const note = noteNames[rounded % 12];
        const octave = Math.floor(rounded / 12) - 1;

        return `${note}${octave}`;
    }

    // Y 軸音名 + 水平格線
    ctx.font = "14px sans-serif";
    ctx.lineWidth = 1;

    for (let midi = minMidi; midi <= maxMidi; midi++) {
        const y = scaleY(midi);

        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(canvas.width - padding, y);

        ctx.strokeStyle = "#dddddd";
        ctx.stroke();

        ctx.fillStyle = "#555";
        ctx.fillText(
            midiToNoteName(midi),
            15,
            y + 4
        );
    }

    // X / Y 軸
    ctx.beginPath();

    ctx.moveTo(
        padding,
        padding
    );

    ctx.lineTo(
        padding,
        canvas.height - padding
    );

    ctx.lineTo(
        canvas.width - padding,
        canvas.height - padding
    );

    ctx.strokeStyle = "#999";
    ctx.stroke();
    // X 軸時間刻度
    const timeTicks = 5;

    ctx.fillStyle = "#555";
    ctx.font = "14px sans-serif";

    for (let i = 0; i <= timeTicks; i++) {
        const time =
            minTime +
            (timeRange * i / timeTicks);

        const x = scaleX(time);

        // 刻度線
        ctx.beginPath();
        ctx.moveTo(
            x,
            canvas.height - padding
        );
        ctx.lineTo(
            x,
            canvas.height - padding + 6
        );

        ctx.strokeStyle = "#999";
        ctx.stroke();

        // 秒數
        ctx.fillText(
            `${time.toFixed(1)}s`,
            x - 12,
            canvas.height - padding + 25
        );
    }

    // 音高曲線
    ctx.beginPath();

    let previousPoint = null;

    points.forEach((point) => {
        const x = scaleX(point.time);
        const y = scaleY(point.midi);

        const shouldBreak =
            !previousPoint ||
            point.time - previousPoint.time > 0.1;

        if (shouldBreak) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }

        previousPoint = point;
    });

    ctx.strokeStyle = "#222";
    ctx.lineWidth = 2;
    ctx.stroke();    
}

function drawNoteSegments(segments) {
    noteSegmentsCtx.clearRect(
        0,
        0,
        noteSegmentsCanvas.width,
        noteSegmentsCanvas.height
    );

    if (!segments || segments.length === 0) {
        return;
    }

    const padding = 65;

    const minTime = Math.min(
        ...segments.map(segment => segment.start_time)
    );

    const maxTime = Math.max(
        ...segments.map(segment => segment.end_time)
    );

    const midiValues = segments.map(
        segment => segment.midi
    );

    const minMidi =
        Math.floor(Math.min(...midiValues)) - 1;

    const maxMidi =
        Math.ceil(Math.max(...midiValues)) + 1;

    const timeRange =
        maxTime - minTime || 1;

    const midiRange =
        maxMidi - minMidi || 1;


    function scaleX(time) {
        return (
            padding +
            ((time - minTime) / timeRange) *
            (
                noteSegmentsCanvas.width
                - padding * 2
            )
        );
    }


    function scaleY(midi) {
        return (
            noteSegmentsCanvas.height
            - padding
            - (
                (midi - minMidi) / midiRange
            ) *
            (
                noteSegmentsCanvas.height
                - padding * 2
            )
        );
    }


    function midiToNoteName(midi) {
        const noteNames = [
            "C",
            "C#",
            "D",
            "D#",
            "E",
            "F",
            "F#",
            "G",
            "G#",
            "A",
            "A#",
            "B"
        ];

        const rounded =
            Math.round(midi);

        const note =
            noteNames[rounded % 12];

        const octave =
            Math.floor(rounded / 12) - 1;

        return `${note}${octave}`;
    }


    // ==============================
    // Y 軸音名與格線
    // ==============================

    noteSegmentsCtx.font =
        "14px sans-serif";

    noteSegmentsCtx.lineWidth = 1;

    for (
        let midi = minMidi;
        midi <= maxMidi;
        midi++
    ) {
        const y = scaleY(midi);

        noteSegmentsCtx.beginPath();

        noteSegmentsCtx.moveTo(
            padding,
            y
        );

        noteSegmentsCtx.lineTo(
            noteSegmentsCanvas.width
                - padding,
            y
        );

        noteSegmentsCtx.strokeStyle =
            "#dddddd";

        noteSegmentsCtx.stroke();

        noteSegmentsCtx.fillStyle =
            "#555";

        noteSegmentsCtx.fillText(
            midiToNoteName(midi),
            15,
            y + 4
        );
    }


    // ==============================
    // X 軸時間
    // ==============================

    const timeTicks = 5;

    for (
        let i = 0;
        i <= timeTicks;
        i++
    ) {
        const time =
            minTime +
            (
                timeRange
                * i
                / timeTicks
            );

        const x = scaleX(time);

        noteSegmentsCtx.beginPath();

        noteSegmentsCtx.moveTo(
            x,
            noteSegmentsCanvas.height
                - padding
        );

        noteSegmentsCtx.lineTo(
            x,
            noteSegmentsCanvas.height
                - padding + 6
        );

        noteSegmentsCtx.strokeStyle =
            "#999";

        noteSegmentsCtx.stroke();

        noteSegmentsCtx.fillStyle =
            "#555";

        noteSegmentsCtx.fillText(
            `${time.toFixed(1)}s`,
            x - 12,
            noteSegmentsCanvas.height
                - padding + 25
        );
    }


    // ==============================
    // 畫音符區段
    // ==============================

    const noteHeight = 14;

    segments.forEach(segment => {
        const startX = scaleX(segment.start_time);
        const endX = scaleX(segment.end_time);
        const y = scaleY(segment.midi);
    
        const width = Math.max(
            endX - startX,
            3
        );
    
        noteSegmentsCtx.fillStyle = "#333";
    
        noteSegmentsCtx.fillRect(
            startX,
            y - noteHeight / 2,
            width,
            noteHeight
        );
    
        // 顯示音名
        if (width > 35) {
            noteSegmentsCtx.fillStyle = "#000";
    
            noteSegmentsCtx.fillText(
                segment.note,
                startX + 4,
                y - 12
            );
        }
    
        // 顯示穩定度
        if (
            segment.stability_score !== undefined &&
            width > 50
        ) {
            noteSegmentsCtx.fillStyle = "#555";
    
            noteSegmentsCtx.fillText(
                `${segment.stability_score.toFixed(0)}%`,
                startX + 4,
                y + 25
            );
        }
    });
}

function showStabilitySummary(segments) {
    if (!segments || segments.length === 0) {
        avgStability.textContent = "--";
        leastStableNote.textContent = "--";
        return;
    }

    const scores = segments.map(
        segment => segment.stability_score
    );

    const average =
        scores.reduce((sum, score) => sum + score, 0) /
        scores.length;

    const leastStable = segments.reduce(
        (lowest, segment) =>
            segment.stability_score < lowest.stability_score
                ? segment
                : lowest
    );

    avgStability.textContent =
        `${average.toFixed(1)} / 100`;

    leastStableNote.textContent =
        `${leastStable.note} (${leastStable.stability_score.toFixed(1)})`;
}