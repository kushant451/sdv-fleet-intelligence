const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function get(path) {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error("Request failed: " + path);
  return res.json();
}

export const getSummary = () => get("/fleet/summary");
export const getVehicles = () => get("/vehicles");

export async function predict(reading) {
  const res = await fetch(BASE + "/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reading),
  });
  if (!res.ok) throw new Error("Prediction failed");
  return res.json();
}
