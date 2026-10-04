import threading

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import advisory, districts, farmers, forecast, model_info, whatsapp
from app.services.mock_data import get_all_districts_snapshot

app = FastAPI(
    title="Foresight API",
    description="Hyperlocal monsoon onset & break prediction system (district scale)",
    version="0.1.0",
)


import logging

logger = logging.getLogger("uvicorn.error")

@app.on_event("startup")
def _warm_district_snapshot_cache():
    # Computing all 423 districts' predictions takes a few seconds -- run it once in
    # the background at boot so the first real request hits a warm cache.
    def _warm():
        try:
            logger.info("Warming district snapshot cache in background thread...")
            get_all_districts_snapshot()
            logger.info("District snapshot cache successfully warmed.")
        except Exception as e:
            logger.error(f"Error warming district snapshot cache: {e}", exc_info=True)

    threading.Thread(target=_warm, daemon=True).start()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(districts.router)
app.include_router(forecast.router)
app.include_router(advisory.router)
app.include_router(farmers.router)
app.include_router(whatsapp.router)
app.include_router(model_info.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "foresight-api"}
