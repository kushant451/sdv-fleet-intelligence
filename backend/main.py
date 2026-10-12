"""Step 3: the API. Run:  uvicorn main:app --reload"""
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import ml, db

app = FastAPI(title="SDV Fleet Intelligence API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/")
def home():
    return {"message": "SDV Fleet API is running. See /docs"}


@app.get("/vehicles")
def list_vehicles():
    return sorted(db.vehicles(), key=lambda v: v["priority"])


@app.get("/vehicles/{vid}")
def one_vehicle(vid: str):
    for v in db.vehicles():
        if v["id"] == vid:
            return v
    raise HTTPException(404, "Vehicle not found")


@app.get("/fleet/summary")
def summary():
    vs = db.vehicles()
    n = len(vs)
    count = lambda s: sum(v["status"] == s for v in vs)
    return {
        "total": n, "healthy": count("Healthy"), "at_risk": count("At Risk"), "critical": count("Critical"),
        "avg_health": round(sum(v["health_score"] for v in vs) / n),
        "avg_rul": round(sum(v["rul"] for v in vs) / n),
        "predicted_failures": sum(v["failure_probability"] >= 50 for v in vs),
        "anomalies": sum(v["anomaly"] for v in vs),
        "total_distance_km": sum(v["mileage_km"] for v in vs),
        "trend": db.trend(),
    }


class Reading(BaseModel):
    Battery_Voltage: float = 370
    Battery_Temperature: float = 30
    SoH: float = 0.94            # 0 to 1
    Motor_Temperature: float = 52
    Motor_Vibration: float = 0.4
    Motor_RPM: float = 1800
    Tire_Pressure: float = 32
    Brake_Pad_Wear: float = 0.2  # 0 to 1


@app.post("/predict")
def predict(r: Reading):
    return ml.score(pd.DataFrame([r.model_dump()]))[0]
