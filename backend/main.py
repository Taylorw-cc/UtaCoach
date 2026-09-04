from fastapi import FastAPI

app = FastAPI(
    title="UtaCoach API",
    version="0.1.0",
    description="Backend API for the UtaCoach singing analysis project.",
)


@app.get("/")
def root() -> dict[str, str]:
    """Simple health endpoint used to verify that the API is running."""
    return {"message": "UtaCoach API is running"}
