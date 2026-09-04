const audioFile = document.getElementById("audioFile");
const uploadBtn = document.getElementById("uploadBtn");
const status = document.getElementById("status");
const canvas = document.getElementById("pitchChart");
const ctx = canvas.getContext("2d");

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
        const response = await fetch(
            "http://127.0.0.1:8000/audio/upload",
            {
                method: "POST",
                body: formData
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        console.log(data);

        drawPitch(data.audio_info.pitch_points);

        status.textContent = "分析完成";
    } catch (error) {
        console.error(error);
        status.textContent = `分析失敗：${error.message}`;
    }
});


function drawPitch(points) {
    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    if (!points || points.length === 0) {
        status.textContent = "沒有偵測到有效音高";
        return;
    }

    const padding = 50;

    const times = points.map(point => point.time);
    const midiValues = points.map(point => point.midi);

    const maxTime = Math.max(...times);
    const minMidi = Math.min(...midiValues);
    const maxMidi = Math.max(...midiValues);

    function scaleX(time) {
        return (
            padding +
            (time / maxTime) *
            (canvas.width - padding * 2)
        );
    }

    function scaleY(midi) {
        return (
            canvas.height -
            padding -
            ((midi - minMidi) / (maxMidi - minMidi)) *
            (canvas.height - padding * 2)
        );
    }

    ctx.beginPath();

    points.forEach((point, index) => {
        const x = scaleX(point.time);
        const y = scaleY(point.midi);

        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });

    ctx.stroke();
}