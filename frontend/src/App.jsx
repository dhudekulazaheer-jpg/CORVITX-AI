import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  HeartPulse, 
  ShieldAlert, 
  History, 
  Users, 
  Link as LinkIcon, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Smartphone,
  ChevronRight,
  Stethoscope,
  Sparkles
} from 'lucide-react';
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
    <div className={`min-h-screen transition-colors duration-500 pb-20 font-sans ${hasCritical && activeTab === 'ward' ? 'bg-rose-50/40' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Apple Health Frosted Glass Header */}
      <header className="bg-white/85 border-b border-slate-200/80 px-6 py-3.5 sticky top-0 z-30 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          
          {/* Logo & Clinical Brand */}
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-teal-400 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-slate-900 font-sans">
                  CORVITX-AI
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200/80 uppercase tracking-wider">
                  Clinical rPPG
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-semibold tracking-wide uppercase">
                Contactless Patient Triage & Autonomous Clinical Monitoring
              </p>
            </div>
          </div>

          {/* Apple-Style Segmented Navigation Capsules */}
          <div className="flex items-center bg-slate-100/90 p-1 rounded-2xl border border-slate-200/80 shadow-inner">
            <button
              onClick={() => setActiveTab('ward')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 ${
                activeTab === 'ward' 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Activity className="w-4 h-4 text-sky-600" />
              Nurse Ward Station
            </button>
            <button
              onClick={() => { setActiveTab('research'); fetchResearchData(); }}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 ${
                activeTab === 'research' 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users className="w-4 h-4 text-emerald-600" />
              Remote Research Trials
              {researchMetrics && (
                <span className="px-2 py-0.2 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                  {researchMetrics.valid_paired_sessions || 0}
                </span>
              )}
            </button>
          </div>

          {/* Action Button & Hardware Status */}
          <div className="flex items-center gap-3">
            {activeTab === 'ward' && (
              <button 
                onClick={async () => {
                  try {
                    await fetch("http://localhost:8000/api/beds/add", { method: "POST" });
                  } catch(e) { console.error(e); }
                }}
                className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-full text-xs font-bold shadow-sm transition-all hover:shadow hover:scale-[1.02] flex items-center gap-1.5 cursor-pointer"
              >
                <span className="text-sm leading-none font-extrabold">+</span> Add Bed
              </button>
            )}

            <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors ${
              connected 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}>
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
              {connected ? 'BACKEND LIVE' : 'OFFLINE'}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto p-6 mt-2">
        
        {/* ========================================================= */}
        {/* TAB 1: HOSPITAL WARD TELEMETRY STATION                   */}
        {/* ========================================================= */}
        {activeTab === 'ward' && (
          <div>
            {/* Apple-Style Critical Alert Notification */}
            {hasCritical && (
              <div className="mb-6 bg-rose-50/90 border border-rose-200 rounded-3xl p-5 shadow-lg shadow-rose-500/5 flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-rose-100 rounded-2xl text-rose-600 shadow-sm">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-rose-950 uppercase tracking-wide">
                      Critical Medical Triage Alarm
                    </h2>
                    <p className="text-xs text-rose-800 font-medium mt-0.5">
                      Patient MEWS risk threshold exceeded, Apnea detected, or High Fall Risk / Bed Exit. Immediate nursing evaluation dispatched.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Dashboard Bed Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              {beds.length === 0 ? (
                <div className="col-span-full py-24 text-center bg-white rounded-3xl border border-slate-200/80 shadow-[0_4px_25px_-4px_rgba(15,23,42,0.05)]">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-3xl bg-sky-50 flex items-center justify-center text-sky-500 border border-sky-100">
                    <Activity className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">Awaiting Live Ward Edge Streams</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Edge client connects automatically. Run the edge telemetry node in your terminal:
                  </p>
                  <code className="inline-block mt-3 bg-slate-100 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-mono border border-slate-200 font-semibold">
                    python camera_client.py
                  </code>
                </div>
              ) : (
                beds.map((bed) => (
                  <BedCard key={bed.bed_id} bed={bed} />
                ))
              )}
            </div>

            {/* Triage Audit History Database Table */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-[0_4px_25px_-4px_rgba(15,23,42,0.05)] overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700">
                    <History className="w-4 h-4 text-slate-700" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                      Emergency Triage Database Audit Logs
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Persistent SQLite clinical history recorded in real time
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-200/60 font-mono">
                  {history.length} Event(s)
                </span>
              </div>
              <div className="p-0 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-3.5">Timestamp</th>
                      <th className="px-6 py-3.5">Bed Location</th>
                      <th className="px-6 py-3.5">Heart Rate</th>
                      <th className="px-6 py-3.5">MEWS Score</th>
                      <th className="px-6 py-3.5">Clinical State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-6 py-10 text-center text-slate-400 font-medium">
                          No critical emergency alerts logged in the triage audit database yet.
                        </td>
                      </tr>
                    ) : (
                      history.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-3.5 font-mono text-slate-500">{row.timestamp}</td>
                          <td className="px-6 py-3.5 font-bold text-slate-800">Bed #{row.bed_id}</td>
                          <td className="px-6 py-3.5 text-rose-600 font-bold font-mono">{Math.round(row.hr)} BPM</td>
                          <td className="px-6 py-3.5 font-bold text-slate-800 font-mono">{row.mews} / 14</td>
                          <td className="px-6 py-3.5">
                            <span className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-[10px] font-extrabold uppercase tracking-wide">
                              {row.status}
                            </span>
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
            
            {/* Apple Health Remote Invitation Banner */}
            <div className="bg-gradient-to-r from-sky-50 via-teal-50 to-emerald-50 border border-sky-100 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 bg-white rounded-2xl text-sky-600 border border-sky-100 shadow-sm">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Remote Participant Clinical Trial Link</h2>
                    <p className="text-xs text-slate-500">
                      Send this WebRTC link to participants. They open it in their mobile browser to give consent, enter reference vitals, and stream 30s video.
                    </p>
                  </div>
                </div>
                <button
                  onClick={fetchResearchData}
                  disabled={loadingResearch}
                  className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingResearch ? 'animate-spin' : ''}`} />
                  Refresh Statistics
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200/90 shadow-sm">
                <div className="flex-1 min-w-[280px]">
                  <input
                    type="text"
                    value={portalUrl}
                    onChange={(e) => setPortalUrl(e.target.value)}
                    className="w-full bg-transparent px-3 py-1.5 text-xs text-slate-700 font-mono focus:outline-none"
                    placeholder="Enter https://... tunnel URL for remote participants"
                  />
                </div>
                <button
                  onClick={copyPortalLink}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  {copied ? 'Copied to Clipboard!' : 'Copy Portal URL'}
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                💡 <span className="font-semibold text-slate-700">Remote Internet Access:</span> For participants outside your Wi-Fi, run <code className="bg-white px-2 py-0.5 rounded text-sky-700 border border-slate-200 font-mono">cloudflared tunnel --url http://localhost:8000</code> or ngrok and paste the resulting <code className="text-teal-700 font-semibold">https://.../participant</code> URL above.
              </p>
            </div>

            {/* Apple Health Metric Stat Cards */}
            {researchMetrics && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Valid Trials</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-emerald-600 font-mono">{researchMetrics.valid_paired_sessions}</span>
                    <span className="text-xs text-slate-400">/ {researchMetrics.total_attempted_sessions}</span>
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-700">
                    {researchMetrics.total_attempted_sessions > 0
                      ? `${Math.round((researchMetrics.valid_paired_sessions / researchMetrics.total_attempted_sessions) * 100)}% Success`
                      : 'No trials yet'}
                  </span>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
                  <span className="text-[10px] uppercase font-bold text-rose-500 block tracking-wider">HR MAE</span>
                  <div className="mt-1">
                    <span className="text-2xl font-black text-slate-900 font-mono">{researchMetrics.heart_rate?.mae_bpm ?? '--'}</span>
                    <span className="text-xs text-slate-400 ml-1">BPM</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Mean Abs Error</span>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
                  <span className="text-[10px] uppercase font-bold text-rose-500 block tracking-wider">HR RMSE</span>
                  <div className="mt-1">
                    <span className="text-2xl font-black text-slate-900 font-mono">{researchMetrics.heart_rate?.rmse_bpm ?? '--'}</span>
                    <span className="text-xs text-slate-400 ml-1">BPM</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Root Mean Sq Err</span>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
                  <span className="text-[10px] uppercase font-bold text-indigo-600 block tracking-wider">HR Pearson r</span>
                  <div className="mt-1">
                    <span className="text-2xl font-black text-indigo-600 font-mono">{researchMetrics.heart_rate?.pearson_r ?? '--'}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Correlation</span>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
                  <span className="text-[10px] uppercase font-bold text-teal-600 block tracking-wider">RR MAE</span>
                  <div className="mt-1">
                    <span className="text-2xl font-black text-slate-900 font-mono">{researchMetrics.respiration_rate?.mae_rpm ?? '--'}</span>
                    <span className="text-xs text-slate-400 ml-1">RPM</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Mean Abs Error</span>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
                  <span className="text-[10px] uppercase font-bold text-teal-600 block tracking-wider">RR RMSE</span>
                  <div className="mt-1">
                    <span className="text-2xl font-black text-slate-900 font-mono">{researchMetrics.respiration_rate?.rmse_rpm ?? '--'}</span>
                    <span className="text-xs text-slate-400 ml-1">RPM</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Root Mean Sq Err</span>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
                  <span className="text-[10px] uppercase font-bold text-teal-600 block tracking-wider">RR Pearson r</span>
                  <div className="mt-1">
                    <span className="text-2xl font-black text-teal-600 font-mono">{researchMetrics.respiration_rate?.pearson_r ?? '--'}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Correlation</span>
                </div>
              </div>
            )}

            {/* Condition Breakdown */}
            {researchMetrics?.conditions && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {['Resting', 'Motion', 'Occlusion'].map(cond => {
                  const cStats = researchMetrics.conditions[cond] || {};
                  return (
                    <div key={cond} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">{cond} Condition</span>
                        <span className="text-[10px] bg-slate-100 px-2.5 py-0.5 rounded-full text-slate-700 font-mono font-bold">
                          N = {cStats.count || 0}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                        <div>HR MAE: <strong className="text-slate-900">{cStats.hr_mae ?? '--'}</strong> BPM</div>
                        <div>RR MAE: <strong className="text-slate-900">{cStats.rr_mae ?? '--'}</strong> RPM</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Research Participant Records Table */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-[0_4px_25px_-4px_rgba(15,23,42,0.05)] overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700">
                    <Users className="w-4 h-4 text-slate-700" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                      Research Trial Records ({researchRecords.length} sessions logged)
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Standardized clinical trials collected across Resting, Motion, and Occlusion conditions
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-slate-500 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
                  Target: 15–20 subjects
                </span>
              </div>
              <div className="p-0 overflow-x-auto max-h-[480px]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 text-slate-500 uppercase font-bold text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-3">Participant</th>
                      <th className="px-4 py-3">Condition</th>
                      <th className="px-4 py-3">Ref HR</th>
                      <th className="px-4 py-3">Est HR</th>
                      <th className="px-4 py-3">HR Error</th>
                      <th className="px-4 py-3">Ref RR</th>
                      <th className="px-4 py-3">Est RR</th>
                      <th className="px-4 py-3">RR Error</th>
                      <th className="px-4 py-3">SNR</th>
                      <th className="px-4 py-3">Trial Validity</th>
                      <th className="px-4 py-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {researchRecords.length === 0 ? (
                      <tr>
                        <td colSpan="11" className="px-6 py-12 text-center text-slate-400 font-medium">
                          No real research participants logged yet. Send the portal link to friends to start acquiring data!
                        </td>
                      </tr>
                    ) : (
                      researchRecords.map((row, i) => {
                        const isValid = row.Valid_Session === "True" || row.Valid_Session === true;
                        return (
                          <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3 font-mono font-bold text-sky-700">{row.Participant_ID}</td>
                            <td className="px-4 py-3">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/70">
                                {row.Condition}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-600">{row.HR_Reference_BPM || '--'}</td>
                            <td className="px-4 py-3 font-mono text-rose-600 font-bold">{row.HR_Estimated_BPM || 'null'}</td>
                            <td className="px-4 py-3 font-mono font-bold text-slate-900">{row.HR_Abs_Error ? `${row.HR_Abs_Error} BPM` : '--'}</td>
                            <td className="px-4 py-3 font-mono text-slate-600">{row.RR_Reference_RPM || '--'}</td>
                            <td className="px-4 py-3 font-mono text-teal-600 font-bold">{row.RR_Estimated_RPM || 'null'}</td>
                            <td className="px-4 py-3 font-mono font-bold text-slate-900">{row.RR_Abs_Error ? `${row.RR_Abs_Error} RPM` : '--'}</td>
                            <td className="px-4 py-3 font-mono text-slate-500">{row.Avg_SNR_dB ? `${row.Avg_SNR_dB} dB` : '--'}</td>
                            <td className="px-4 py-3">
                              {isValid ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Valid
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200" title={row.Failure_Reason}>
                                  <XCircle className="w-3 h-3 text-rose-600" /> Invalid
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
  
  let cardClass = "bg-white border-slate-200/80 shadow-[0_4px_25px_-4px_rgba(15,23,42,0.05),0_1px_3px_rgba(15,23,42,0.03)] hover:shadow-[0_12px_35px_-5px_rgba(15,23,42,0.08)]";
  let statusBadge = "bg-emerald-50 text-emerald-700 border-emerald-200/80";
  let iconBg = "bg-rose-50 text-rose-500 border-rose-100";
  let graphColor = "#f43f5e"; // Apple Health vibrant coral line

  if (activeUnauthorized) {
    cardClass = "bg-red-50/70 border-red-300 shadow-[0_4px_25px_rgba(239,68,68,0.12)] animate-pulse";
    statusBadge = "bg-red-100 text-red-800 border-red-200";
    iconBg = "bg-red-100 text-red-600 border-red-200";
    graphColor = "#ef4444";
  } else if (bed.is_fallback || (bed.status && bed.status.includes("Secondary ROI"))) {
    cardClass = "bg-amber-50/50 border-amber-300 shadow-[0_4px_25px_rgba(245,158,11,0.10)]";
    statusBadge = "bg-amber-100 text-amber-800 border-amber-200";
    iconBg = "bg-amber-100 text-amber-600 border-amber-200";
    graphColor = "#f59e0b";
  } else if (activeCritical) {
    cardClass = "bg-rose-50/70 border-rose-300 shadow-[0_4px_25px_rgba(244,63,94,0.15)] animate-pulse";
    statusBadge = "bg-rose-100 text-rose-800 border-rose-200";
    iconBg = "bg-rose-100 text-rose-600 border-rose-200";
    graphColor = "#fb7185";
  } else if (isWarning) {
    cardClass = "bg-amber-50/40 border-amber-200";
    statusBadge = "bg-amber-100 text-amber-800 border-amber-200";
    iconBg = "bg-amber-50 text-amber-600 border-amber-100";
    graphColor = "#fbbf24";
  }

  const graphData = bed.hr_history ? bed.hr_history.map((h, i) => ({ index: i, hr: h.hr })) : [];

  return (
    <div className={`relative rounded-3xl border p-6 transition-all duration-300 ${cardClass} flex flex-col h-full overflow-hidden`}>
      
      {/* Alert Overlays */}
      {activeFallRisk && !activeUnauthorized && (
        <div className="absolute inset-0 bg-rose-600/95 z-20 flex flex-col items-center justify-center animate-pulse backdrop-blur-md border-4 border-rose-500 rounded-3xl p-6 text-center text-white">
           <AlertTriangle className="w-12 h-12 text-white mb-2" />
           <h2 className="text-xl font-black tracking-wider uppercase">Fall Risk / Bed Exit</h2>
           <p className="text-xs text-rose-100 font-bold mt-1">PATIENT DISPLACED FROM BED</p>
        </div>
      )}

      {activeApnea && !activeUnauthorized && (
        <div className="absolute inset-0 bg-rose-600/95 z-10 flex flex-col items-center justify-center animate-pulse backdrop-blur-md border-4 border-rose-500 rounded-3xl p-6 text-center text-white">
           <AlertTriangle className="w-12 h-12 text-white mb-2" />
           <h2 className="text-xl font-black tracking-wider uppercase">Apnea Detected</h2>
           <p className="text-xs text-rose-100 font-bold mt-1">NO RESPIRATORY MOVEMENT</p>
        </div>
      )}

      {/* Bed Card Header */}
      <div className="flex justify-between items-start mb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Bed #{bed.bed_id}</h3>
            <button 
              onClick={async () => {
                try { await fetch(`http://localhost:8000/api/beds/remove/${bed.bed_id}`, { method: "DELETE" }); } 
                catch(e) {}
              }}
              className="w-6 h-6 rounded-full bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-600 text-xs flex items-center justify-center transition-colors cursor-pointer"
              title="Discharge / Remove Bed"
            >
              ✕
            </button>
          </div>
          <span className={`inline-block px-3 py-0.5 rounded-full text-[11px] font-bold uppercase mt-2 border shadow-2xs ${statusBadge}`}>
            {bed.status || "Monitoring"}
          </span>
        </div>
        <div className={`p-3 rounded-2xl border shadow-xs ${iconBg}`}>
          <HeartPulse className="w-6 h-6" />
        </div>
      </div>

      {/* Apple Health Micro-Pill Filter Toggles */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        <button 
          onClick={() => toggle('hr')} 
          className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all cursor-pointer ${
            monitors.hr ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
          }`}
        >
          HR
        </button>
        <button 
          onClick={() => toggle('rr')} 
          className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all cursor-pointer ${
            monitors.rr ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
          }`}
        >
          Resp
        </button>
        <button 
          onClick={() => toggle('fall')} 
          className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all cursor-pointer ${
            monitors.fall ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
          }`}
        >
          Fall Risk
        </button>
        <button 
          onClick={() => toggle('apnea')} 
          className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all cursor-pointer ${
            monitors.apnea ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
          }`}
        >
          Apnea
        </button>
        <button 
          onClick={() => toggle('auth')} 
          className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all cursor-pointer ${
            monitors.auth ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
          }`}
        >
          Security
        </button>
      </div>

      {/* Clinical Metric Tiles */}
      <div className="space-y-3 mb-5">
        
        {/* Heart Rate Tile */}
        <div className={`rounded-2xl p-4 border transition-all ${
          monitors.hr 
            ? 'bg-gradient-to-br from-rose-50/70 via-rose-50/30 to-white border-rose-100/90 shadow-2xs' 
            : 'bg-slate-50/60 border-slate-100 opacity-40'
        }`}>
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-bold text-rose-500 uppercase tracking-wider">Heart Rate</span>
            <div className="text-right flex items-baseline">
              <span className={`text-3xl font-black font-sans tracking-tight ${monitors.hr ? 'text-slate-900' : 'text-slate-400'}`}>
                {monitors.hr ? Math.round(bed.hr) : '--'}
              </span>
              <span className="text-xs font-bold text-rose-500 ml-1.5 uppercase">BPM</span>
            </div>
          </div>
        </div>

        {/* Respiration Tile */}
        <div className={`rounded-2xl p-4 border transition-all ${
          monitors.rr 
            ? 'bg-gradient-to-br from-teal-50/70 via-teal-50/30 to-white border-teal-100/90 shadow-2xs' 
            : 'bg-slate-50/60 border-slate-100 opacity-40'
        }`}>
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-bold text-teal-700 uppercase tracking-wider">Respiration</span>
            <div className="text-right flex items-baseline">
              <span className={`text-3xl font-black font-sans tracking-tight ${monitors.rr ? 'text-slate-900' : 'text-slate-400'}`}>
                {monitors.rr ? Math.round(bed.rr || 0) : '--'}
              </span>
              <span className="text-xs font-bold text-teal-600 ml-1.5 uppercase">RPM</span>
            </div>
          </div>
        </div>

        {/* MEWS Score Tile */}
        <div className={`rounded-2xl p-4 border transition-all ${
          (monitors.hr || monitors.rr) 
            ? 'bg-gradient-to-br from-slate-50 to-white border-slate-200/70 shadow-2xs' 
            : 'bg-slate-50/60 border-slate-100 opacity-40'
        }`}>
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">MEWS Score</span>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-black font-sans tracking-tight ${
                activeCritical ? 'text-rose-600' : ((monitors.hr || monitors.rr) ? 'text-slate-900' : 'text-slate-400')
              }`}>
                {(monitors.hr || monitors.rr) ? bed.mews : '--'}
              </span>
              <span className="text-xs text-slate-400 font-semibold">/ 14</span>
              {(monitors.hr || monitors.rr) && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  bed.mews >= 5 
                    ? 'bg-rose-50 text-rose-700 border-rose-200' 
                    : bed.mews >= 3 
                    ? 'bg-amber-50 text-amber-700 border-amber-200' 
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  {bed.mews >= 5 ? 'CRITICAL' : bed.mews >= 3 ? 'WARNING' : 'STABLE'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Live Apple Health PPG Waveform Sweep */}
      <div className={`mt-auto pt-4 border-t border-slate-100 ${monitors.hr ? '' : 'opacity-30 grayscale'}`}>
        <div className="flex justify-between items-center mb-2.5">
          <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Live PPG Wave</span>
          {monitors.hr && (
            <span className="flex items-center gap-1.5 text-[10px] text-rose-500 font-bold">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span> rPPG SWEEP
            </span>
          )}
        </div>
        <div className="h-22 w-full bg-slate-50/90 rounded-2xl overflow-hidden border border-slate-200/60 relative p-1.5 shadow-inner">
           {graphData.length > 5 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={graphData}>
                  <YAxis domain={['dataMin - 5', 'dataMax + 5']} hide={true} />
                  <Line 
                    type="monotone" 
                    dataKey="hr" 
                    stroke={graphColor} 
                    strokeWidth={2.5} 
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
           ) : (
             <div className="w-full h-full flex items-center justify-center text-xs font-semibold text-slate-400">
               Gathering Vitals Waveform...
             </div>
           )}
        </div>
      </div>
    </div>
  );
}

export default App;
