"""Step 2: split the dataset into 50 vehicles, score them, store them. Run: python seed.py"""
import numpy as np, pandas as pd
import ml, db

raw = pd.read_csv(ml.CSV, parse_dates=["Timestamp"])
N = 50
size = len(raw) // N            # each vehicle gets its own slice of the data
DAY = 96                        # 96 rows x 15 min = 1 day

vehicles, daily = [], []
for i in range(N):
    block = raw.iloc[i * size:(i + 1) * size]
    idx = [len(block) - 1 - DAY * k for k in range(6, -1, -1)]   # last 7 days, oldest first
    days = block.iloc[idx]
    res = ml.score(days)
    cur, r = block.iloc[-1], res[-1]
    daily.append([x["status"] for x in res])
    vehicles.append({
        "id": f"SDV-{i + 1:03d}", "model": "SDV-Model X",
        "mileage_km": int(block["Distance_Traveled"].sum()),
        "last_update": cur["Timestamp"].strftime("%Y-%m-%d %H:%M"),
        "sensors": {"battery_voltage": round(cur["Battery_Voltage"], 1),
                    "battery_temp": round(cur["Battery_Temperature"], 1),
                    "battery_soh": round(cur["SoH"] * 100),
                    "motor_temp": round(cur["Motor_Temperature"], 1),
                    "motor_rpm": int(cur["Motor_RPM"]),
                    "vibration": round(cur["Motor_Vibration"], 2),
                    "tire_pressure": round(cur["Tire_Pressure"], 1),
                    "brake_wear": round(cur["Brake_Pad_Wear"] * 100)},
        "history": [{"day": f"Day {k + 1}", "health": x["health_score"]} for k, x in enumerate(res)],
        **r})

# Priority 1 = needs maintenance first
RANK = {"Critical": 0, "At Risk": 1, "Healthy": 2}
for pr, v in enumerate(sorted(vehicles, key=lambda v: (RANK[v["status"]], v["health_score"], -v["failure_probability"])), 1):
    v["priority"] = pr

trend = [{"day": f"Day {k + 1}", **{s: sum(d[k] == s for d in daily) for s in ["Healthy", "At Risk", "Critical"]}}
         for k in range(7)]

db.save(vehicles, trend)
last = trend[-1]
print(f"Saved {N} vehicles -> Healthy {last['Healthy']}, At Risk {last['At Risk']}, Critical {last['Critical']}")