"""Uses MongoDB Atlas if MONGO_URI is set in .env, otherwise a local JSON file
(so the project still runs on your laptop without internet)."""
import os, json
from dotenv import load_dotenv
load_dotenv()

URI = os.getenv("MONGO_URI")
FILE = os.path.join(os.path.dirname(__file__), "data", "fleet.json")

if URI:
    from pymongo import MongoClient
    _db = MongoClient(URI)["sdv_fleet"]


def save(vehicles, trend):
    if URI:
        _db.vehicles.delete_many({}); _db.vehicles.insert_many([dict(v) for v in vehicles])
        _db.trend.delete_many({}); _db.trend.insert_many([dict(t) for t in trend])
    else:
        json.dump({"vehicles": vehicles, "trend": trend}, open(FILE, "w"))


def vehicles():
    if URI:
        return list(_db.vehicles.find({}, {"_id": 0}))
    return json.load(open(FILE))["vehicles"]


def trend():
    if URI:
        return list(_db.trend.find({}, {"_id": 0}))
    return json.load(open(FILE))["trend"]
