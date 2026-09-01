import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import Base, engine
from app.routes import auth, patients, medicines, prescriptions, comparisons, savings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("medicompare")

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="MediCompare API",
    description="Prescription intelligence and price comparison platform (hackathon MVP).",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Never leak stack traces to the client; log server-side instead.
    logger.exception("Unhandled error on %s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Something went wrong on our end. Please try again."},
    )


app.include_router(auth.router)
app.include_router(patients.router)
app.include_router(medicines.router)
app.include_router(prescriptions.router)
app.include_router(comparisons.router)
app.include_router(savings.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": settings.APP_NAME, "ai_provider": settings.AI_PROVIDER}


@app.get("/")
def root():
    return {"message": "MediCompare API is running. See /docs for the API reference."}
