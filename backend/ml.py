
import os
import numpy as np
import pandas as pd
import joblib

BASE = os.path.dirname(__file__)
DATA = os.path.join(BASE, "data")
CSV = os.path.join(DATA, "EV_Predictive_Maintenance_Dataset_15min.csv")

FEATURES = ["Battery_Voltage", "Battery_Temperature", "SoH", "Motor_Temperature",
            "Motor_Vibration", "Motor_RPM", "Tire_Pressure", "Brake_Pad_Wear"]

RULES = {
    "SoH":                 (lambda x: (0.85 - x) / 0.45,  0.20, "Low battery health (SoH)"),
    "Battery_Voltage":     (lambda x: (330 - x) / 130,    0.15, "Low battery voltage"),
    "Battery_Temperature": (lambda x: (x - 40) / 20,      0.15, "High battery temperature"),
    "Motor_Temperature":   (lambda x: (x - 70) / 30,      0.15, "High motor temperature"),
    "Motor_Vibration":     (lambda x: (x - 0.8) / 1.2,    0.15, "High motor vibration"),
    "Tire_Pressure":       (lambda x: (28 - x) / 8,       0.08, "Low tire pressure"),
    "Brake_Pad_Wear":      (lambda x: (x - 0.6) / 0.4,    0.07, "Worn brake pads"),
    "Motor_RPM":           (lambda x: (x - 4500) / 1500,  0.05, "High motor RPM"),
}
SCALE = 1.8          
MAX_RUL = 300        
CRITICAL_BELOW = 50  
HEALTHY_FROM = 75


def stress(df):
    return {c: np.clip(f(df[c]), 0, 1) for c, (f, w, n) in RULES.items()}


def rule_health(df):
    """Health score 0-100 from the sensor rules."""
    s = stress(df)
    damage = np.clip(SCALE * sum(RULES[c][1] * s[c] for c in RULES), 0, 1)
    return 100 * (1 - damage)


def make_labels(df):
    health = rule_health(df)
    return pd.DataFrame({"health": health,
                         "failure": (health < CRITICAL_BELOW).astype(int),
                         "rul": (health / 100 * MAX_RUL).round()})


_m = {}


def models():
    if not _m:
        for k in ["clf", "reg", "iso", "stats"]:
            _m[k] = joblib.load(os.path.join(DATA, f"{k}.joblib"))
    return _m


def status_from(health):
    return "Healthy" if health >= HEALTHY_FROM else ("At Risk" if health >= CRITICAL_BELOW else "Critical")


def score(df):
    """df: DataFrame with the FEATURES columns (one or many rows). Returns list of dicts."""
    m = models()
    X = df[FEATURES]
    prob = m["clf"].predict_proba(X)[:, 1]
    rul = np.clip(m["reg"].predict(X), 0, MAX_RUL)
    anomaly = m["iso"].predict(X) == -1
    s = stress(df)
    out = []
    for i in range(len(df)):
        contrib = sorted(((RULES[c][1] * float(np.asarray(s[c])[i]), RULES[c][2]) for c in RULES), reverse=True)
        factors = [name for v, name in contrib[:3] if v > 0.02]
        health = int(round(rul[i] / MAX_RUL * 100))
        out.append({"failure_probability": int(round(prob[i] * 100)), "rul": int(round(rul[i])),
                    "health_score": health, "status": status_from(health),
                    "anomaly": bool(anomaly[i]), "factors": factors})
    return out
