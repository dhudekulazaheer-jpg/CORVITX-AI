import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, HeartPulse, ShieldAlert, History, Users, Link as LinkIcon, CheckCircle2, XCircle, RefreshCw, Smartphone } from 'lucide-react';
import { LineChart, Line, YAxis, ResponsiveContainer } from 'recharts';

const SOCKET_URL = "ws://localhost:8000/ws/dashboard";
const API_URL = "http://localhost:8000/history";
const RESEARCH_METRICS_URL = "http://localhost:8000/api/research/metrics";
const RESEARCH_RECORDS_URL = "http://localhost:8000/api/research/records";

function App() {
  const [activeTab, setActiveTab] = useState('ward'); // 'ward' | 'research'
  const [beds, setBeds] = useState([]);
  const [history, setHistory] = useState([]);
  const [connected, setConnected] = useState(false);

  // Research Trials State
  const [researchMetrics, setResearchMetrics] = useState(null);
  const [researchRecords, setResearchRecords] = useState([]);
  const [loadingResearch, setLoadingResearch] = useState(false);
  const [portalUrl, setPortalUrl] = useState(window.location.origin.replace(':5173', ':8000') + '/participant');
  const [copied, setCopied] = useState(false);

  // WebSocket Connection for Ward Beds
  useEffect(() => {
    const ws = new WebSocket(SOCKET_URL);

    ws.onopen = () => {
      console.log("Connected to CORVITX-AI Backend");
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (Array.isArray(data)) {
          setBeds(data);
          if (data.some(b => b && b.mews >= 5)) {
            fetchHistory();
          }
        }
      } catch (error) {
        console.error("Error parsing websocket data", error);
      }
    };

    ws.onclose = () => setConnected(false);
    return () => ws.close();
  }, []);

  // Fetch Database History
  const fetchHistory = async () => {
    try {
      const response = await fetch(API_URL);
      const data = await response.json();
      if (Array.isArray(data)) {
        setHistory(data);
      }
    } catch (error) {
      console.error("Failed to fetch history:", error);
    }
  };

  // Fetch Research Data
  const fetchResearchData = async () => {
    setLoadingResearch(true);
    try {
      const [mRes, rRes] = await Promise.all([
        fetch(RESEARCH_METRICS_URL),
        fetch(RESEARCH_RECORDS_URL)
      ]);
      const mData = await mRes.json();
      const rData = await rRes.json();
      setResearchMetrics(mData);
      setResearchRecords(rData);
    } catch (err) {
      console.error("Failed to fetch research data:", err);
    } finally {
      setLoadingResearch(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    fetchResearchData();
    const interval = setInterval(() => {
      fetchHistory();
      if (activeTab === 'research') {
        fetchResearchData();
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const copyPortalLink = () => {
    navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const hasCritical = beds.some(b => b.mews >= 5 || b.apnea_alert || b.fall_risk);

  return (
    <div className={`min-h-screen text-slate-100 transition-colors duration-500 pb-20 ${hasCritical && activeTab === 'ward' ? 'bg-rose-950/20' : 'bg-slate-900'}`}>
      
      {/* Header */}
      <header className="bg-slate-800/80 border-b border-slate-700 p-4 sticky top-0 z-30 backdrop-blur-md shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-sky-400" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                CORVITX-AI
                <span className="text-xs px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">rPPG Telemetry</span>
              </h1>
              <p className="text-[11px] text-slate-400 font-medium tracking-wider uppercase">Contactless Patient Triage & Clinical Research</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center bg-slate-900/80 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setActiveTab('ward')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${activeTab === 'ward' ? 'bg-sky-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
            >
              <Activity className="w-4 h-4" />
              Nurse Ward Station
            </button>
            <button
              onClick={() => { setActiveTab('research'); fetchResearchData(); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${activeTab === 'research' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
            >
              <Users className="w-4 h-4" />
              Remote Research Trials
              {researchMetrics && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-950 text-emerald-200">
                  {researchMetrics.valid_paired_sessions || 0}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === 'ward' && (
              <button 
                onClick={async () => {
                  try {
                    await fetch("http://localhost:8000/api/beds/add", { method: "POST" });
                  } catch(e) { console.error(e) }
                }}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg transition-colors flex items-center gap-1.5"
              >
                <span className="text-base leading-none">+</span> Add Bed
              </button>
            )}

            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${connected ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></div>
              {connected ? 'BACKEND LIVE' : 'OFFLINE'}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6 mt-2">
        
        {/* ========================================================= */}
        {/* TAB 1: HOSPITAL WARD TELEMETRY STATION                   */}
        {/* ========================================================= */}
        {activeTab === 'ward' && (
          <div>
            {/* Critical Banner */}
            {hasCritical && (
              <div className="mb-6 bg-rose-600 border-2 border-rose-400 rounded-xl p-4 flex items-center justify-between shadow-2xl shadow-rose-600/50 animate-pulse">
                <div className="flex items-center gap-4">
                  <AlertTriangle className="w-10 h-10 text-white" />
                  <div>
                    <h2 className="text-xl font-bold text-white uppercase tracking-wider">CRITICAL MEDICAL EMERGENCY</h2>
                    <p className="text-rose-100 font-medium">Patient MEWS score exceeded safe threshold, Apnea detected, or High Fall Risk / Bed Exit. Immediate Nurse Dispatch Required.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Dashboard Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              {beds.length === 0 ? (
                <div className="col-span-full py-20 text-center text-slate-500 bg-slate-800/30 rounded-2xl border border-slate-700 border-dashed">
                  <Activity className="w-16 h-16 mx-auto mb-4 opacity-50 text-sky-500" />
                  <p className="text-xl font-medium">Awaiting Live Ward Camera Streams...</p>
                  <p className="text-xs text-slate-400 mt-2">Run <code className="bg-slate-800 px-2 py-0.5 rounded text-cyan-400">python camera_client.py</code> on edge camera devices</p>
                </div>
              ) : (
                beds.map((bed) => (
                  <BedCard key={bed.bed_id} bed={bed} />
                ))
              )}
            </div>

            {/* Triage Audit History Table */}
            <div className="bg-slate-800/80 rounded-2xl border border-slate-700 overflow-hidden shadow-lg">
              <div className="p-5 border-b border-slate-700 bg-slate-800 flex items-center gap-3">
                <History className="text-sky-400 w-5 h-5" />
                <h3 className="text-lg font-bold text-white uppercase tracking-wider">Emergency Triage Database Logs</h3>
              </div>
              <div className="p-0 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-900/50 text-slate-400 uppercase font-semibold text-xs tracking-wider">
                    <tr>
                      <th className="px-6 py-4 border-b border-slate-700">Timestamp</th>
                      <th className="px-6 py-4 border-b border-slate-700">Bed ID</th>
                      <th className="px-6 py-4 border-b border-slate-700">Heart Rate</th>
                      <th className="px-6 py-4 border-b border-slate-700">MEWS Score</th>
                      <th className="px-6 py-4 border-b border-slate-700">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {history.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-6 py-8 text-center text-slate-500">No critical emergencies logged in database yet.</td>
                      </tr>
                    ) : (
                      history.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-700/30 transition-colors">
                          <td className="px-6 py-4 font-mono text-slate-300">{row.timestamp}</td>
                          <td className="px-6 py-4 font-bold text-white">Bed #{row.bed_id}</td>
                          <td className="px-6 py-4 text-rose-400 font-bold">{Math.round(row.hr)} BPM</td>
                          <td className="px-6 py-4 text-rose-400 font-bold">{row.mews}</td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded text-xs font-bold uppercase">{row.status}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: REMOTE PARTICIPANT RESEARCH DATA COLLECTION        */}
        {/* ========================================================= */}
        {activeTab === 'research' && (
          <div className="space-y-6">
            
            {/* Remote Link Sharing Banner */}
            <div className="bg-gradient-to-r from-cyan-950/60 to-emerald-950/60 border border-cyan-500/30 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-cyan-500/20 rounded-xl text-cyan-400 border border-cyan-500/30">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Remote Participant Data Collection Link</h2>
                    <p className="text-xs text-slate-300">Send this URL to participants. They can open it on their smartphone browser to give consent, enter reference vitals, and stream 30s video via WebRTC.</p>
                  </div>
                </div>
                <button
                  onClick={fetchResearchData}
                  disabled={loadingResearch}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingResearch ? 'animate-spin' : ''}`} />
                  Refresh Metrics
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 bg-slate-900/90 p-2 rounded-xl border border-slate-700/80">
                <div className="flex-1 min-w-[280px]">
                  <input
                    type="text"
                    value={portalUrl}
                    onChange={(e) => setPortalUrl(e.target.value)}
                    className="w-full bg-transparent px-3 py-1.5 text-xs text-cyan-300 font-mono focus:outline-none"
                    placeholder="Enter https://... tunnel URL for remote friends"
                  />
                </div>
                <button
                  onClick={copyPortalLink}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow"
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  {copied ? 'Copied to Clipboard!' : 'Copy Invite Link'}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                💡 <span className="font-semibold text-slate-300">Remote Internet Access Note:</span> For friends outside your local Wi-Fi, run <code className="bg-slate-900 px-1.5 py-0.5 rounded text-cyan-300">cloudflared tunnel --url http://localhost:8000</code> or ngrok and paste the resulting <code className="text-emerald-400">https://.../participant</code> URL above.
              </p>
            </div>

            {/* Statistical Performance Cards */}
            {researchMetrics && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Valid Trials</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-emerald-400 font-mono">{researchMetrics.valid_paired_sessions}</span>
                    <span className="text-xs text-slate-400">/ {researchMetrics.total_attempted_sessions}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {researchMetrics.total_attempted_sessions > 0
                      ? `${Math.round((researchMetrics.valid_paired_sessions / researchMetrics.total_attempted_sessions) * 100)}% Success`
                      : 'No trials yet'}
                  </span>
                </div>

                <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4">
                  <span className="text-[10px] uppercase font-bold text-rose-400 block">HR MAE</span>
                  <div className="mt-1">
                    <span className="text-2xl font-black text-white font-mono">{researchMetrics.heart_rate?.mae_bpm ?? '--'}</span>
                    <span className="text-xs text-slate-400 ml-1">BPM</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Mean Abs Error</span>
                </div>

                <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4">
                  <span className="text-[10px] uppercase font-bold text-rose-400 block">HR RMSE</span>
                  <div className="mt-1">
                    <span className="text-2xl font-black text-white font-mono">{researchMetrics.heart_rate?.rmse_bpm ?? '--'}</span>
                    <span className="text-xs text-slate-400 ml-1">BPM</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Root Mean Sq Err</span>
                </div>

                <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4">
                  <span className="text-[10px] uppercase font-bold text-rose-400 block">HR Pearson r</span>
                  <div className="mt-1">
                    <span className="text-2xl font-black text-emerald-400 font-mono">{researchMetrics.heart_rate?.pearson_r ?? '--'}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Correlation</span>
                </div>

                <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4">
                  <span className="text-[10px] uppercase font-bold text-sky-400 block">RR MAE</span>
                  <div className="mt-1">
                    <span className="text-2xl font-black text-white font-mono">{researchMetrics.respiration_rate?.mae_rpm ?? '--'}</span>
                    <span className="text-xs text-slate-400 ml-1">RPM</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Mean Abs Error</span>
                </div>

                <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4">
                  <span className="text-[10px] uppercase font-bold text-sky-400 block">RR RMSE</span>
                  <div className="mt-1">
                    <span className="text-2xl font-black text-white font-mono">{researchMetrics.respiration_rate?.rmse_rpm ?? '--'}</span>
                    <span className="text-xs text-slate-400 ml-1">RPM</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Root Mean Sq Err</span>
                </div>

                <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4">
                  <span className="text-[10px] uppercase font-bold text-sky-400 block">RR Pearson r</span>
                  <div className="mt-1">
                    <span className="text-2xl font-black text-emerald-400 font-mono">{researchMetrics.respiration_rate?.pearson_r ?? '--'}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Correlation</span>
                </div>
              </div>
            )}

            {/* Condition Breakdown */}
            {researchMetrics?.conditions && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {['Resting', 'Motion', 'Occlusion'].map(cond => {
                  const cStats = researchMetrics.conditions[cond] || {};
                  return (
                    <div key={cond} className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-white uppercase tracking-wider">{cond} Condition</span>
                        <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded text-cyan-300 font-mono">
                          N = {cStats.count || 0}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                        <div>HR MAE: <strong className="text-white">{cStats.hr_mae ?? '--'}</strong> BPM</div>
                        <div>RR MAE: <strong className="text-white">{cStats.rr_mae ?? '--'}</strong> RPM</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Research Participant Records Table */}
            <div className="bg-slate-800/80 rounded-2xl border border-slate-700 overflow-hidden shadow-lg">
              <div className="p-4 border-b border-slate-700 bg-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="text-cyan-400 w-5 h-5" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Collected Research Records ({researchRecords.length} sessions logged)
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400">
                  Target: 15–20 real subjects across conditions
                </span>
              </div>
              <div className="p-0 overflow-x-auto max-h-[480px]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/60 text-slate-400 uppercase font-semibold text-[10px] tracking-wider sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 border-b border-slate-700">Participant</th>
                      <th className="px-4 py-3 border-b border-slate-700">Condition</th>
                      <th className="px-4 py-3 border-b border-slate-700">Ref HR</th>
                      <th className="px-4 py-3 border-b border-slate-700">Est HR</th>
                      <th className="px-4 py-3 border-b border-slate-700">HR Error</th>
                      <th className="px-4 py-3 border-b border-slate-700">Ref RR</th>
                      <th className="px-4 py-3 border-b border-slate-700">Est RR</th>
                      <th className="px-4 py-3 border-b border-slate-700">RR Error</th>
                      <th className="px-4 py-3 border-b border-slate-700">SNR</th>
                      <th className="px-4 py-3 border-b border-slate-700">Validity</th>
                      <th className="px-4 py-3 border-b border-slate-700">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {researchRecords.length === 0 ? (
                      <tr>
                        <td colSpan="11" className="px-6 py-12 text-center text-slate-500">
                          No real research participants logged yet. Send the portal link to friends to start acquiring data!
                        </td>
                      </tr>
                    ) : (
                      researchRecords.map((row, i) => {
                        const isValid = row.Valid_Session === "True" || row.Valid_Session === true;
                        return (
                          <tr key={i} className="hover:bg-slate-700/20 transition">
                            <td className="px-4 py-3 font-mono font-bold text-cyan-300">{row.Participant_ID}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-700 text-slate-200">
                                {row.Condition}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono">{row.HR_Reference_BPM || '--'}</td>
                            <td className="px-4 py-3 font-mono text-rose-300">{row.HR_Estimated_BPM || 'null'}</td>
                            <td className="px-4 py-3 font-mono font-bold text-white">{row.HR_Abs_Error ? `${row.HR_Abs_Error} BPM` : '--'}</td>
                            <td className="px-4 py-3 font-mono">{row.RR_Reference_RPM || '--'}</td>
                            <td className="px-4 py-3 font-mono text-sky-300">{row.RR_Estimated_RPM || 'null'}</td>
                            <td className="px-4 py-3 font-mono font-bold text-white">{row.RR_Abs_Error ? `${row.RR_Abs_Error} RPM` : '--'}</td>
                            <td className="px-4 py-3 font-mono text-slate-400">{row.Avg_SNR_dB ? `${row.Avg_SNR_dB} dB` : '--'}</td>
                            <td className="px-4 py-3">
                              {isValid ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                  <CheckCircle2 className="w-3 h-3" /> Valid
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20" title={row.Failure_Reason}>
                                  <XCircle className="w-3 h-3" /> Invalid
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-[10px] text-slate-400 font-mono">{row.Recording_Timestamp}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

function BedCard({ bed }) {
  const [monitors, setMonitors] = React.useState({
    hr: true,
    rr: true,
    fall: true,
    apnea: true,
    auth: true
  });

  const toggle = (key) => setMonitors(m => ({ ...m, [key]: !m[key] }));

  const activeFallRisk = monitors.fall && bed.fall_risk;
  const activeApnea = monitors.apnea && bed.apnea_alert;
  const activeUnauthorized = monitors.auth && bed.unauthorized;
  const activeCritical = (bed.mews >= 5 && (monitors.hr || monitors.rr)) || activeApnea || activeFallRisk;
  const isWarning = bed.mews >= 3 && bed.mews < 5 && (monitors.hr || monitors.rr);
  
  let cardClass = "bg-slate-800 border-slate-700";
  let statusColor = "text-emerald-400";
  let iconBg = "bg-emerald-500/20";
  let graphColor = "#34d399";

  if (activeUnauthorized) {
    cardClass = "bg-red-950 border-red-500 animate-pulse";
    statusColor = "text-red-400";
    iconBg = "bg-red-500/30";
    graphColor = "#ef4444";
  } else if (bed.is_fallback) {
    cardClass = "bg-amber-950/70 border-amber-500 animate-pulse";
    statusColor = "text-amber-400";
    iconBg = "bg-amber-500/30";
    graphColor = "#f59e0b";
  } else if (activeCritical) {
    cardClass = "bg-rose-950/80 border-rose-500 shadow-[0_0_20px_rgba(225,29,72,0.3)] animate-pulse";
    statusColor = "text-rose-400";
    iconBg = "bg-rose-500/30";
    graphColor = "#fb7185";
  } else if (isWarning) {
    cardClass = "bg-amber-950/40 border-amber-500/50";
    statusColor = "text-amber-400";
    iconBg = "bg-amber-500/20";
    graphColor = "#fbbf24";
  }

  const graphData = bed.hr_history ? bed.hr_history.map((h, i) => ({ index: i, hr: h.hr })) : [];

  return (
    <div className={`relative rounded-2xl border p-6 transition-all duration-300 ${cardClass} flex flex-col h-full overflow-hidden`}>
      
      {activeFallRisk && !activeUnauthorized && (
        <div className="absolute inset-0 bg-rose-600/95 z-20 flex flex-col items-center justify-center animate-pulse backdrop-blur-sm border-4 border-rose-500 rounded-2xl">
           <AlertTriangle className="w-16 h-16 text-white mb-2" />
           <h2 className="text-2xl font-bold text-white tracking-widest text-center uppercase">Fall Risk<br/>Bed Exit</h2>
           <p className="text-rose-100 font-bold mt-2 tracking-wider">PATIENT MOVING</p>
        </div>
      )}

      {activeApnea && !activeUnauthorized && (
        <div className="absolute inset-0 bg-rose-600/95 z-10 flex flex-col items-center justify-center animate-pulse backdrop-blur-sm border-4 border-rose-500 rounded-2xl">
           <AlertTriangle className="w-16 h-16 text-white mb-2" />
           <h2 className="text-2xl font-bold text-white tracking-widest text-center uppercase">Apnea<br/>Detected</h2>
           <p className="text-rose-100 font-bold mt-2 tracking-wider">NO BREATHING</p>
        </div>
      )}

      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold text-white">Bed #{bed.bed_id}</h3>
            <button 
              onClick={async () => {
                try { await fetch(`http://localhost:8000/api/beds/remove/${bed.bed_id}`, { method: "DELETE" }); } 
                catch(e) {}
              }}
              className="text-xs bg-slate-700 hover:bg-rose-600 text-slate-300 hover:text-white px-2 py-0.5 rounded transition-colors"
              title="Discharge / Remove Bed"
            >
              ✕
            </button>
          </div>
          <span className={`inline-block px-2.5 py-1 rounded text-xs font-bold uppercase mt-2 bg-slate-900/50 ${statusColor}`}>
            {bed.status}
          </span>
        </div>
        <div className={`p-3 rounded-full ${iconBg}`}>
          <HeartPulse className={`w-8 h-8 ${statusColor}`} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => toggle('hr')} className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors ${monitors.hr ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>HR</button>
        <button onClick={() => toggle('rr')} className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors ${monitors.rr ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>Resp</button>
        <button onClick={() => toggle('fall')} className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors ${monitors.fall ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>Fall Risk</button>
        <button onClick={() => toggle('apnea')} className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors ${monitors.apnea ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>Apnea</button>
        <button onClick={() => toggle('auth')} className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors ${monitors.auth ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>Security</button>
      </div>

      <div className="space-y-4 mb-4">
        <div className={`rounded-xl p-4 flex justify-between items-center border transition-colors ${monitors.hr ? 'bg-slate-900/50 border-slate-700/50' : 'bg-slate-900/20 border-slate-800 opacity-50'}`}>
          <span className="text-sm text-slate-400 uppercase font-semibold">Heart Rate</span>
          <div className="text-right">
            <span className={`text-3xl font-bold ${monitors.hr ? statusColor : 'text-slate-600'}`}>{monitors.hr ? Math.round(bed.hr) : '--'}</span>
            <span className="text-xs text-slate-500 ml-1">BPM</span>
          </div>
        </div>

        <div className={`rounded-xl p-4 flex justify-between items-center border transition-colors ${monitors.rr ? 'bg-slate-900/50 border-slate-700/50' : 'bg-slate-900/20 border-slate-800 opacity-50'}`}>
          <span className="text-sm text-slate-400 uppercase font-semibold">Respiration</span>
          <div className="text-right">
            <span className={`text-3xl font-bold ${monitors.rr ? statusColor : 'text-slate-600'}`}>{monitors.rr ? Math.round(bed.rr || 0) : '--'}</span>
            <span className="text-xs text-slate-500 ml-1">RPM</span>
          </div>
        </div>

        <div className={`rounded-xl p-4 flex justify-between items-center border transition-colors ${(monitors.hr || monitors.rr) ? 'bg-slate-900/50 border-slate-700/50' : 'bg-slate-900/20 border-slate-800 opacity-50'}`}>
          <span className="text-sm text-slate-400 uppercase font-semibold">MEWS Score</span>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${activeCritical ? 'text-rose-500' : ((monitors.hr || monitors.rr) ? 'text-slate-200' : 'text-slate-600')}`}>
              {(monitors.hr || monitors.rr) ? bed.mews : '--'}
            </span>
            <span className="text-xs text-slate-500">/ 14</span>
          </div>
        </div>
      </div>

      <div className={`mt-auto pt-4 border-t border-slate-700/50 ${monitors.hr ? '' : 'opacity-30 grayscale'}`}>
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Live PPG Wave</span>
          {monitors.hr && <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-mono"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> REC</span>}
        </div>
        <div className="h-20 w-full bg-slate-900/80 rounded-lg overflow-hidden border border-slate-800 relative">
           {graphData.length > 5 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={graphData}>
                  <YAxis domain={['dataMin - 5', 'dataMax + 5']} hide={true} />
                  <Line 
                    type="monotone" 
                    dataKey="hr" 
                    stroke={graphColor} 
                    strokeWidth={2} 
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
           ) : (
             <div className="w-full h-full flex items-center justify-center text-xs text-slate-600">Gathering Vitals...</div>
           )}
        </div>
      </div>
    </div>
  );
}

export default App;
