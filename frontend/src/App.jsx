import { useEffect, useState } from "react";
import {
  PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  CartesianGrid, ResponsiveContainer,
} from "recharts";
import { getSummary, getVehicles, predict } from "./api";

const COLORS = { Healthy: "#2e9e5b", "At Risk": "#f0a30a", Critical: "#d93a3a" };
const PAGES = ["Dashboard", "Vehicles", "Alerts", "Predict"];

function Badge({ status }) {
  return <span className={"badge " + status.replace(" ", "").toLowerCase()}>{status}</span>;
}

function Card({ label, value, color }) {
  return (
    <div className="card stat">
      <div className="dot" style={{ background: color }} />
      <div>
        <div className="muted">{label}</div>
        <div className="big" style={{ color }}>{value}</div>
      </div>
    </div>
  );
}

function VehicleTable({ vehicles, onPick }) {
  return (
    <table>
      <thead>
        <tr><th>Vehicle</th><th>Health</th><th>Risk</th><th>RUL</th><th>Status</th><th>Priority</th></tr>
      </thead>
      <tbody>
        {vehicles.map((v) => (
          <tr key={v.id} className="clickable" onClick={() => onPick(v)}>
            <td>{v.id}</td>
            <td>{v.health_score}%</td>
            <td>{v.failure_probability}%</td>
            <td>{v.rul}</td>
            <td><Badge status={v.status} /></td>
            <td>{v.priority}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Dashboard({ summary, vehicles, onPick }) {
  const pie = [
    { name: "Healthy", value: summary.healthy },
    { name: "At Risk", value: summary.at_risk },
    { name: "Critical", value: summary.critical },
  ];
  return (
    <>
      <div className="grid4">
        <Card label="Total vehicles" value={summary.total} color="#2f6fd0" />
        <Card label="Healthy" value={summary.healthy} color={COLORS.Healthy} />
        <Card label="At Risk" value={summary.at_risk} color={COLORS["At Risk"]} />
        <Card label="Critical" value={summary.critical} color={COLORS.Critical} />
      </div>

      <div className="grid2">
        <div className="card">
          <h3>Fleet health overview</h3>
          <div className="row">
            <div style={{ width: 200, height: 200, position: "relative" }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pie} dataKey="value" innerRadius={60} outerRadius={90}>
                    {pie.map((p) => <Cell key={p.name} fill={COLORS[p.name]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center">
                <b>{summary.avg_health}%</b>
                <span>Avg. health</span>
              </div>
            </div>
            <ul className="legend">
              {pie.map((p) => (
                <li key={p.name}>
                  <span className="sq" style={{ background: COLORS[p.name] }} />
                  {p.name} <b>{Math.round((p.value / summary.total) * 100)}% ({p.value})</b>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="card">
          <h3>Fleet statistics</h3>
          <dl className="stats">
            <dt>Average fleet health</dt><dd>{summary.avg_health}%</dd>
            <dt>Average RUL (cycles)</dt><dd>{summary.avg_rul}</dd>
            <dt>Predicted failures</dt><dd>{summary.predicted_failures}</dd>
            <dt>Anomalies detected</dt><dd>{summary.anomalies}</dd>
            <dt>Total distance (km)</dt><dd>{summary.total_distance_km.toLocaleString()}</dd>
          </dl>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <h3>Vehicle health (top 5 by priority)</h3>
          <VehicleTable vehicles={vehicles.slice(0, 5)} onPick={onPick} />
        </div>
        <div className="card">
          <h3>Fleet health trend (vehicles per status)</h3>
          <div style={{ height: 230 }}>
            <ResponsiveContainer>
              <LineChart data={summary.trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" /><YAxis /><Tooltip /><Legend />
                {Object.keys(COLORS).map((k) => (
                  <Line key={k} dataKey={k} stroke={COLORS[k]} strokeWidth={2} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </>
  );
}

function Vehicles({ vehicles, onPick }) {
  return (
    <div className="card">
      <h3>All vehicles (click a row for details)</h3>
      <VehicleTable vehicles={vehicles} onPick={onPick} />
    </div>
  );
}

function Alerts({ vehicles, onPick }) {
  const bad = vehicles.filter((v) => v.status !== "Healthy");
  return (
    <div className="card">
      <h3>Alerts ({bad.length})</h3>
      {bad.map((v) => (
        <div key={v.id} className={"alert " + v.status.replace(" ", "").toLowerCase()} onClick={() => onPick(v)}>
          <b>{v.id}</b> is <b>{v.status}</b>
          {v.status === "Critical"
            ? <> with {v.failure_probability}% failure probability (health {v.health_score}%).</>
            : <> - health {v.health_score}%, about {v.rul} cycles of life left.</>}
          {v.factors.length > 0 && <> Main factors: {v.factors.join(", ")}.</>}
        </div>
      ))}
    </div>
  );
}

function Details({ v, onClose }) {
  const s = v.sensors;
  const cls = v.status.replace(" ", "").toLowerCase();
  return (
    <div className="card details">
      <div className="row between">
        <h3>Vehicle details – {v.id}</h3>
        <button className="link" onClick={onClose}>Close</button>
      </div>
      <div className="grid3">
        <div>
          <p><Badge status={v.status} /> &nbsp;{v.model}</p>
          <dl className="stats">
            <dt>Health score</dt><dd>{v.health_score}%</dd>
            <dt>Failure probability</dt><dd>{v.failure_probability}%</dd>
            <dt>Remaining useful life</dt><dd>{v.rul} cycles</dd>
            <dt>Mileage</dt><dd>{v.mileage_km.toLocaleString()} km</dd>
            <dt>Last update</dt><dd>{v.last_update}</dd>
          </dl>
        </div>
        <div>
          <b>Sensor readings</b>
          <dl className="stats">
            <dt>Battery voltage</dt><dd>{s.battery_voltage} V</dd>
            <dt>Battery temp</dt><dd>{s.battery_temp} °C</dd>
            <dt>Battery health (SoH)</dt><dd>{s.battery_soh}%</dd>
            <dt>Motor temp</dt><dd>{s.motor_temp} °C</dd>
            <dt>Motor RPM</dt><dd>{s.motor_rpm}</dd>
            <dt>Vibration</dt><dd>{s.vibration}</dd>
            <dt>Tire pressure</dt><dd>{s.tire_pressure} PSI</dd>
            <dt>Brake pad wear</dt><dd>{s.brake_wear}%</dd>
          </dl>
        </div>
        <div>
          <b>Health – last 7 days</b>
          <div style={{ height: 190 }}>
            <ResponsiveContainer>
              <LineChart data={v.history}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" fontSize={11} /><YAxis domain={[0, 100]} fontSize={11} /><Tooltip />
                <Line dataKey="health" stroke="#2f6fd0" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className={"alert " + cls}>
        <b>Maintenance prediction:</b> {v.failure_probability}% failure probability, about {v.rul} cycles of life left.
        {v.anomaly && " Isolation Forest flagged unusual sensor behaviour."}
        {v.factors.length > 0 ? <> Main contributing factors: {v.factors.join(", ")}.</> : " No major risk factors."}
      </div>
    </div>
  );
}

const FIELDS = [
  ["Battery_Voltage", "Battery voltage (V)", 370],
  ["Battery_Temperature", "Battery temp (°C)", 30],
  ["SoH", "Battery health SoH (0-1)", 0.94],
  ["Motor_Temperature", "Motor temp (°C)", 52],
  ["Motor_Vibration", "Vibration (0.2-2)", 0.4],
  ["Motor_RPM", "Motor RPM", 1800],
  ["Tire_Pressure", "Tire pressure (PSI)", 32],
  ["Brake_Pad_Wear", "Brake pad wear (0-1)", 0.2],
];

function Predict() {
  const [f, setF] = useState(Object.fromEntries(FIELDS.map(([k, , d]) => [k, d])));
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: Number(e.target.value) });
  const run = async () => {
    try { setErr(""); setRes(await predict(f)); } catch (e) { setErr(e.message); }
  };
  return (
    <div className="card">
      <h3>Try a prediction</h3>
      <p className="muted">Change the sensor values and the models estimate failure risk and remaining useful life.</p>
      <div className="form">
        {FIELDS.map(([k, label]) => (
          <label key={k}>{label}<input type="number" step="any" value={f[k]} onChange={set(k)} /></label>
        ))}
      </div>
      <button className="btn" onClick={run}>Predict</button>
      {err && <p className="error">{err}</p>}
      {res && (
        <div className={"alert " + res.status.replace(" ", "").toLowerCase()}>
          Status: <b>{res.status}</b> · Failure probability: <b>{res.failure_probability}%</b> · Health: <b>{res.health_score}</b> · RUL: <b>{res.rul} cycles</b>
          {res.anomaly && " · Anomaly detected"}
          {res.factors.length > 0 && <> · Factors: {res.factors.join(", ")}</>}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState("Dashboard");
  const [summary, setSummary] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [picked, setPicked] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getSummary(), getVehicles()])
      .then(([s, v]) => { setSummary(s); setVehicles(v); })
      .catch(() => setError("Cannot reach the backend. Start it with: uvicorn main:app --reload"));
  }, []);

  return (
    <div className="layout">
      <aside>
        <div className="logo">SDV Fleet</div>
        {PAGES.map((p) => (
          <button key={p} className={p === page ? "nav active" : "nav"} onClick={() => { setPage(p); setPicked(null); }}>
            {p}
          </button>
        ))}
      </aside>
      <main>
        <header><h1>Fleet Intelligence Dashboard</h1></header>
        {error && <p className="error">{error}</p>}
        {!summary && !error && <p>Loading…</p>}
        {summary && (
          <>
            {picked && <Details v={picked} onClose={() => setPicked(null)} />}
            {page === "Dashboard" && <Dashboard summary={summary} vehicles={vehicles} onPick={setPicked} />}
            {page === "Vehicles" && <Vehicles vehicles={vehicles} onPick={setPicked} />}
            {page === "Alerts" && <Alerts vehicles={vehicles} onPick={setPicked} />}
            {page === "Predict" && <Predict />}
          </>
        )}
      </main>
    </div>
  );
}