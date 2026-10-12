"""Step 1: train the models. Run:  python train.py"""
import sys, joblib
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score, r2_score, mean_absolute_error
from sklearn.ensemble import IsolationForest
from xgboost import XGBClassifier, XGBRegressor
import ml

try:
    raw = pd.read_csv(ml.CSV)
except FileNotFoundError:
    sys.exit(f"Put the dataset here first: {ml.CSV}")
print("Rows:", len(raw))

# --- Sanity check: can the ORIGINAL labels be learned from the sensors? ---
Xa, Xb, ya, yb = train_test_split(raw[ml.FEATURES], raw["Failure_Probability"], test_size=0.2, random_state=1)
chk = XGBClassifier(n_estimators=100, max_depth=4, eval_metric="logloss").fit(Xa, ya)
print(f"\n[Check] AUC on the dataset's ORIGINAL failure label: {roc_auc_score(yb, chk.predict_proba(Xb)[:,1]):.2f}"
      "  (0.50 = random guessing -> original labels are noise, so we use rule-based labels)\n")

# --- Our labels from sensor rules ---
lab = ml.make_labels(raw)
print("Failure rate with our rules: %.1f%%" % (100 * lab.failure.mean()))
X = raw[ml.FEATURES]
Xtr, Xte, ytr, yte, rtr, rte = train_test_split(X, lab.failure, lab.rul, test_size=0.2, random_state=42, stratify=lab.failure)

# XGBoost classifier: will this vehicle fail?
w = (ytr == 0).sum() / (ytr == 1).sum()   # failures are rarer, so give them more weight
clf = XGBClassifier(n_estimators=200, max_depth=4, learning_rate=0.1, scale_pos_weight=w,
                    eval_metric="logloss", random_state=42).fit(Xtr, ytr)
print(classification_report(yte, clf.predict(Xte), target_names=["No failure", "Failure"]))
print("ROC-AUC: %.3f" % roc_auc_score(yte, clf.predict_proba(Xte)[:, 1]))

# XGBoost regressor: Remaining Useful Life (RUL)
reg = XGBRegressor(n_estimators=300, max_depth=5, learning_rate=0.1, random_state=42).fit(Xtr, rtr)
p = reg.predict(Xte)
print("RUL  R2: %.3f   MAE: %.1f cycles" % (r2_score(rte, p), mean_absolute_error(rte, p)))

# Isolation Forest: unusual sensor behaviour (no labels needed)
iso = IsolationForest(n_estimators=200, contamination=0.05, random_state=42).fit(X)

joblib.dump(clf, f"{ml.DATA}/clf.joblib"); joblib.dump(reg, f"{ml.DATA}/reg.joblib")
joblib.dump(iso, f"{ml.DATA}/iso.joblib"); joblib.dump({"ok": True}, f"{ml.DATA}/stats.joblib")
print("\nSaved models to backend/data/")
