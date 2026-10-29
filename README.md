# Cloud-Based Predictive Maintenance and Fleet Intelligence System for SDVs

Capstone project. A simulated fleet of 50 software-defined vehicles (SDVs) is scored by machine learning models and shown on a web dashboard.


**Stack:** React (Vite) + Recharts, FastAPI, MongoDB Atlas, Pandas, NumPy, Scikit-learn, XGBoost, Render, GitHub

---


## Features
- **Dashboard:** fleet health donut, fleet statistics, top 5 vehicles by priority, 7-day status trend
- **Vehicles:** full list of 50 vehicles, click a row for sensor readings, a 7-day health chart and a maintenance prediction
- **Alerts:** every vehicle that is At Risk or Critical, with the main contributing factors
- **Predict:** enter sensor values and get failure probability, remaining useful life (RUL) and an anomaly flag

## Dataset
EV Predictive Maintenance Dataset (15-minute telemetry) from Kaggle: https://www.kaggle.com/datasets/vjithoshshiva/ev-predictive-maintenance-dataset-15min.  
Fields used: battery voltage / temperature / SoH, motor temperature / vibration / RPM, tire pressure, brake pad wear, distance travelled.

The file is one vehicle's history (175,393 rows). We split it into **50 slices = 50 vehicles** (SDV-001 to SDV-050). Each vehicle's current state is the last row of its slice, and its 7-day history is one reading per day (96 rows x 15 min = 1 day).

The CSV is about 93 MB and is git-ignored. Download it yourself and put it in `backend/data/`.

### Why we made our own labels
We first trained XGBoost on the dataset's original labels (`Failure_Probability`, RUL). It scored **AUC 0.51, which is random guessing**, so those labels have no relation to the sensors.

Instead we wrote simple engineering rules (`ml.py`, `RULES`): low battery SoH, low voltage, high battery/motor temperature, high vibration, low tire pressure, worn brakes, high RPM. They give:
- a **health score** 0-100
- a **failure label** (health < 50)
- an **RUL** (health x 3 cycles, max 300)

XGBoost learns these labels from the sensors. Isolation Forest needs no labels and runs directly on the sensors to flag unusual behaviour.

### Model results (held-out 20% test set)
| Model | Result |
|---|---|
| Original dataset label (sanity check) | ROC-AUC **0.51** (noise) |
| XGBoost failure classifier | ROC-AUC **0.999**, failure recall 1.00, precision 0.74 |
| XGBoost RUL regressor | R² **0.997**, MAE 1.0 cycle |
| Failure rate under our rules | 6.1% of readings |

**Honest limitation:** the labels come from our own rules, so these near-perfect scores show that the models reproduce the rules, not that they predict real-world failures. With real labelled fleet data the same pipeline can be reused. Precision is lower than recall because the classifier is weighted (`scale_pos_weight`) to avoid missing failures.

## Status levels
| Status | Health score |
|---|---|
| Healthy | 75 or more |
| At Risk | 50 to 74 |
| Critical | below 50 |

Priority 1 = needs maintenance first (sorted by failure probability, then lowest health). "Predicted failures" counts vehicles with failure probability of 50% or more. This comes from the classifier, while Critical comes from the RUL model's health score, so the two numbers can differ slightly.

## Project structure
```
.
├── backend/
│   ├── main.py            FastAPI app and endpoints
│   ├── ml.py              features, rules, scoring
│   ├── train.py           trains the models, saves backend/data/*.joblib
│   ├── seed.py            builds the 50 vehicles and saves them
│   ├── db.py              MongoDB Atlas, or data/fleet.json if no MONGO_URI
│   ├── requirements.txt
│   ├── .env.example
│   └── data/              trained models + fleet.json (CSV is git-ignored)
└── frontend/
    ├── src/               React app (App.jsx, api.js, styles.css)
    ├── package.json
    └── .env.example
```

## API
| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Health check |
| GET | `/vehicles` | All vehicles, sorted by priority |
| GET | `/vehicles/{id}` | One vehicle, e.g. `/vehicles/SDV-001` (404 if not found) |
| GET | `/fleet/summary` | Counts, averages, anomalies and 7-day trend |
| POST | `/predict` | Score one sensor reading |

Example `/predict` body (all fields optional, defaults shown):
```json
{
  "Battery_Voltage": 370, "Battery_Temperature": 30, "SoH": 0.94,
  "Motor_Temperature": 52, "Motor_Vibration": 0.4, "Motor_RPM": 1800,
  "Tire_Pressure": 32, "Brake_Pad_Wear": 0.2
}
```

## Run locally

### Quick start (no dataset needed)
The trained models and `fleet.json` are already in the repo, so you can run the app straight away.
```bash
# Backend
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload      # http://localhost:8000/docs

# Frontend (new terminal)
cd frontend
npm install
npm run dev                              # http://localhost:5173
```

### Retrain from scratch (needs the CSV)
```bash
cd backend
# copy EV_Predictive_Maintenance_Dataset_15min.csv into backend/data/
python train.py      # trains models, prints metrics
python seed.py       # rebuilds the 50 vehicles
```

### MongoDB Atlas (optional)
Copy `backend/.env.example` to `backend/.env`, paste your connection string after `MONGO_URI=`, then run `python seed.py` again. Without `MONGO_URI` the app uses `backend/data/fleet.json`.

## Deploy on Render
The CSV is large and git-ignored, so train locally first, then commit the generated `backend/data/*.joblib` files.

**Backend (Web Service)**
- Root directory: `backend`
- Build: `pip install -r requirements.txt`
- Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Env vars: `MONGO_URI` (optional)

**Frontend (Static Site)**
- Root directory: `frontend`
- Build: `npm install && npm run build`
- Publish directory: `dist`
- Env var: `VITE_API_URL` = your backend URL

**Notes**
- **Library versions must match.** The `.joblib` models only load reliably with the scikit-learn and XGBoost versions used to train them, so keep `requirements.txt` pinned. If you retrain on a new version, commit the new `.joblib` files.
- **MongoDB Atlas access.** In Atlas, go to Network Access and allow Render to connect (for example `0.0.0.0/0`), otherwise the backend cannot reach the database.
- **Free tier sleep.** Free Render services sleep when idle, so open the backend URL once before presenting.

## Limitations
- Vehicles are simulated slices of one vehicle's data, not a real fleet.
- Labels are rule-based (see above), so model scores are not real-world accuracy.
- Vehicle data is a static snapshot. Re-run `seed.py` to refresh it.
