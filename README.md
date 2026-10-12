# Cloud-Based Predictive Maintenance and Fleet Intelligence System for SDVs

Capstone project. A simulated fleet of 50 software-defined vehicles is scored by ML models and shown on a web dashboard.

**Stack:** React (Vite) + Recharts, FastAPI, MongoDB Atlas, Pandas, NumPy, Scikit-learn, XGBoost, Render, GitHub

## Dataset
EV Predictive Maintenance Dataset (15-minute telemetry, Kaggle): battery voltage / temperature / SoH,
motor temperature / vibration / RPM, tire pressure, brake pad wear, distance, etc.
The file is one vehicle's history (175,393 rows). We split it into **50 slices = 50 vehicles** (SDV-001 to SDV-050).
Each vehicle's current state is the last row of its slice, and its 7-day history is one reading per day.

### Why we made our own labels (say this in the viva)
We trained XGBoost on the dataset's original labels (Failure_Probability, RUL). It scored **AUC about 0.5, which is random guessing**,
so those labels have no relation to the sensors. Instead we wrote simple engineering rules (`ml.py`, `RULES`):
low battery SoH, low voltage, high battery/motor temperature, high vibration, low tire pressure, worn brakes, high RPM.
They give a health score 0-100, a failure label (health < 50) and an RUL (health x 3 cycles).
XGBoost learns these from the sensors. Isolation Forest needs no labels and runs directly on the sensors.

**Honest limitation:** because the labels come from our rules, the near-perfect scores (AUC 0.999, RUL R2 0.997) show that the model
reproduces the rules, not that it predicts real-world failures. With real labelled fleet data the same pipeline can be reused.

## How it works
1. `train.py` trains an XGBoost classifier (failure), an XGBoost regressor (RUL) and an Isolation Forest (anomalies).
2. `seed.py` builds the 50 vehicles, scores them and saves them (MongoDB Atlas, or `data/fleet.json` if no MongoDB).
3. `main.py` is the FastAPI server: `/vehicles`, `/vehicles/{id}`, `/fleet/summary`, `/predict`.
4. `frontend/` is the React dashboard: Dashboard, Vehicles, Alerts, Predict, plus a vehicle details panel.

Status: Healthy (health >= 75), At Risk (50-74), Critical (< 50). Priority 1 = needs maintenance first.

## Run locally
```bash
# Backend
cd backend
pip install -r requirements.txt
# copy EV_Predictive_Maintenance_Dataset_15min.csv into backend/data/
python train.py
python seed.py
uvicorn main:app --reload        # http://localhost:8000/docs

# Frontend (new terminal)
cd frontend
npm install
npm run dev                      # http://localhost:5173
```
For MongoDB Atlas: copy `backend/.env.example` to `backend/.env`, paste your connection string after `MONGO_URI=`, then run `python seed.py` again.

## Deploy on Render
The CSV is large (93 MB) and is git-ignored, so train locally first, then commit the generated `backend/data/*.joblib` files.
- Backend (Web Service): root `backend`, build `pip install -r requirements.txt`, start `uvicorn main:app --host 0.0.0.0 --port $PORT`. Add env var `MONGO_URI`.
- Frontend (Static Site): root `frontend`, build `npm install && npm run build`, publish `dist`. Add env var `VITE_API_URL` = your backend URL.
- Free Render services sleep when idle, so open the backend URL once before presenting.

## Limitations
- Vehicles are simulated slices of one vehicle's data. Labels are rule-based (see above).
- Model scores are not real-world accuracy.
