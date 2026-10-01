# UtaCoach

UtaCoach is a learning project for building a singing-analysis application step by step while keeping the implementation understandable and well documented.

## Initial MVP

The first milestone focuses on a minimal technical pipeline:

1. Record or upload a vocal sample.
2. Send the audio to a Python backend.
3. Extract a pitch contour from the audio.
4. Return structured analysis data.
5. Visualize the result in the browser.

Japanese pronunciation analysis, MIDI comparison, scoring, and AI coaching will be added only after this basic pipeline is working reliably.

## Project structure

```text
UtaCoach/
├── backend/          # FastAPI backend and later audio-analysis modules
├── frontend/         # Browser interface
├── tests/            # Automated tests
├── requirements.txt  # Python dependencies
└── .gitignore        # Files Git should not track
```

## Run the backend locally

Create and activate a Python virtual environment, install dependencies, then start the development server:

```bash
pip install -r requirements.txt
uvicorn backend.main:app --reload
```

Then open `http://127.0.0.1:8000/` in a browser. A working server should return:

```json
{"message":"UtaCoach API is running"}
```

FastAPI's interactive API documentation is available at `http://127.0.0.1:8000/docs`.

## Development approach

Features will be developed in small, explainable increments using branches, commits, and pull requests so the Git history shows how the application evolves.
