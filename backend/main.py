from fastapi import FastAPI, File, UploadFile
from backend.services.pitch_analyzer import load_audio
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="UtaCoach API",
    version="0.1.0",
    description="Backend API for the UtaCoach singing analysis project.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root() -> dict[str, str]:
    """Simple health endpoint used to verify that the API is running."""
    return {"message": "UtaCoach API is running"}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/audio/upload")
async def upload_audio(audio: UploadFile = File(...)):
    content = await audio.read()

    audio_info = load_audio(content)

    return {
        "filename": audio.filename,
        "content_type": audio.content_type,
        "size_bytes": len(content),
        "audio_info": audio_info
    }
