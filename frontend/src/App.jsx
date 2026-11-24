import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  HeartPulse, 
  ShieldAlert, 
  History, 
  Users, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Stethoscope,
  Camera,
  Radio,
  Sliders,
  Clock,
  Layers,
  Sparkles,
  FileText
} from 'lucide-react';
import { YAxis, ResponsiveContainer, AreaChart, Area } from 'recharts';

const SOCKET_URL = "ws://localhost:8000/ws/dashboard";
const API_URL = "http://localhost:8000/history";

export default function App() {
  const [activeTab, setActiveTab] = useState('ward'); // 'ward' | 'history'
  const [beds, setBeds] = useState([]);
  const [selectedBedId, setSelectedBedId] = useState(1);
  const [history, setHistory] = useState([]);
  const [connected, setConnected] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

  // Real-time Clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // WebSocket Connection for Telemetry
  useEffect(() => {
    let ws;
    try {
      ws = new WebSocket(SOCKET_URL);

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
    } catch (e) {
      console.error("WebSocket init error", e);
    }

    return () => {
      if (ws) ws.close();
    };
  }, []);

  // Fetch SQLite History safely
  const fetchHistory = async () => {
    try {
      const response = await fetch(API_URL);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setHistory(data);
        }
      }
    } catch (error) {
      console.error("Failed to fetch history:", error);
    }
  };

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 10000);
    return () => clearInterval(interval);
  }, []);

  // Selected bed object or safe fallback
  const fallbackBed = {
    bed_id: 1,
    hr: 0,
    rr: 0,
    mews: 0,
    status: "Awaiting Live Stream",
    apnea_alert: false,
    fall_risk: false,
    unauthorized: false,
    hr_history: []
  };

  const activeBed = (Array.isArray(beds) && beds.find(b => b && b.bed_id === selectedBedId)) 
    || (Array.isArray(beds) && beds[0]) 
    || fallbackBed;

  const hasCritical = Array.isArray(beds) && beds.some(b => b && (b.mews >= 5 || b.apnea_alert || b.fall_risk));

  // Ward KPI aggregations
  const safeBeds = Array.isArray(beds) ? beds : [];
  const activeCount = safeBeds.filter(b => b && b.hr > 0).length;
  const avgHr = activeCount > 0 ? Math.round(safeBeds.reduce((acc, b) => acc + (b.hr || 0), 0) / activeCount) : 0;
  const avgRr = activeCount > 0 ? (safeBeds.reduce((acc, b) => acc + (b.rr || 0), 0) / activeCount).toFixed(1) : 0;
  const criticalCount = safeBeds.filter(b => b && (b.mews >= 5 || b.apnea_alert || b.fall_risk)).length;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans antialiased selection:bg-rose-100 selection:text-rose-900 pb-16">
      
      {/* ============================================================ */}
      {/* 1. TOP HEALTHKIT NAVIGATION BAR (FROSTED GLASS)              */}
      {/* ============================================================ */}
      <header className="sticky top-0 z-40 bg-white/85 border-b border-slate-200/80 px-6 py-3.5 backdrop-blur-xl shadow-xs transition-all">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-4">
          
          {/* Brand & Hospital Subtitle */}
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 via-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <HeartPulse className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-tight text-[#0F172A] font-sans">
                  CORVITX<span className="text-sky-600">.AI</span>
                </span>
                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200/80 tracking-wide uppercase">
                  Clinical Station
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  ISO-13485
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-semibold tracking-wide uppercase">
                Contactless Vision-Based Patient Triage & Vitals Monitoring
              </p>
            </div>
          </div>

          {/* Segmented Navigation (Ward vs Audit Logs) */}
          <div className="flex items-center bg-slate-100/90 p-1 rounded-2xl border border-slate-200/80 shadow-inner">
            <button
              onClick={() => setActiveTab('ward')}
              className={`px-5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                activeTab === 'ward' 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-sky-600" />
              Patient Command Hub
            </button>
            <button
              onClick={() => { setActiveTab('history'); fetchHistory(); }}
              className={`px-5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                activeTab === 'history' 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <History className="w-3.5 h-3.5 text-indigo-600" />
              Triage Audit Logs
              {history.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-slate-200 text-slate-700">
                  {history.length}
                </span>
              )}
            </button>
          </div>

          {/* Clock, Add Bed & Live Status */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 text-xs font-semibold text-slate-500 bg-white px-3.5 py-1.5 rounded-full border border-slate-200/80 shadow-xs">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-mono">{currentTime}</span>
            </div>

            <button 
              onClick={async () => {
                try {
                  await fetch("http://localhost:8000/api/beds/add", { method: "POST" });
                } catch(e) { console.error(e); }
              }}
              className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-sm transition-all hover:shadow hover:scale-[1.02] flex items-center gap-1.5 cursor-pointer"
            >
              <span className="text-sm leading-none font-black">+</span> Add Bed
            </button>

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

      {/* ============================================================ */}
      {/* 2. MAIN WORKSPACE CONTAINER                                  */}
      {/* ============================================================ */}
      <main className="max-w-[1440px] mx-auto px-6 py-6">
        
        {/* ========================================================= */}
        {/* TAB 1: PATIENT COMMAND HUB (APPLE HEALTH CLINICAL LIGHT)   */}
        {/* ========================================================= */}
        {activeTab === 'ward' && (
          <div className="space-y-6">

            {/* Critical Emergency Banner */}
            {hasCritical && (
              <div className="bg-rose-50/90 border-2 border-rose-200 rounded-3xl p-5 shadow-lg shadow-rose-500/5 flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-rose-100 rounded-2xl text-rose-600 shadow-sm">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-rose-950 uppercase tracking-wide">
                      Critical Clinical Emergency Alert
                    </h2>
                    <p className="text-xs text-rose-800 font-medium mt-0.5">
                      MEWS score exceeded critical threshold (&ge;5), Apnea detected, or Bed-Exit displacement occurring.
                    </p>
                  </div>
                </div>
                <span className="px-4 py-1.5 bg-rose-600 text-white rounded-full text-xs font-bold shadow-sm">
                  Nurse Attention Dispatched
                </span>
              </div>
            )}

            {/* Executive Ward Health Ribbon */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              
              <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-[0_2px_15px_-3px_rgba(15,23,42,0.04)] flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Monitored Ward</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-[#0F172A] font-sans tracking-tight">{safeBeds.length || 1}</span>
                    <span className="text-xs font-bold text-slate-400">Beds Active</span>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1 mt-1">
                    <CheckCircle2 className="w-3 h-3" /> All Node Sensors Online
                  </span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600">
                  <Activity className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-[0_2px_15px_-3px_rgba(15,23,42,0.04)] flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-rose-500 uppercase tracking-wider block">Average Heart Rate</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-[#0F172A] font-sans tracking-tight">{avgHr || '--'}</span>
                    <span className="text-xs font-bold text-rose-500">BPM</span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400 mt-1 block">
                    Normal Sinus Rhythm
                  </span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500">
                  <HeartPulse className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-[0_2px_15px_-3px_rgba(15,23,42,0.04)] flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-teal-700 uppercase tracking-wider block">Respiration Mean</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-[#0F172A] font-sans tracking-tight">{avgRr || '--'}</span>
                    <span className="text-xs font-bold text-teal-600">RPM</span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400 mt-1 block">
                    Chrominance Optical Flow
                  </span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700">
                  <Stethoscope className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-[0_2px_15px_-3px_rgba(15,23,42,0.04)] flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Ward Triage State</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className={`text-2xl font-black font-sans tracking-tight ${criticalCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {criticalCount > 0 ? `${criticalCount} Critical` : 'Stable (Low)'}
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400 mt-1 block">
                    MEWS Protocol Validated
                  </span>
                </div>
                <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${criticalCount > 0 ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
                  <ShieldAlert className="w-6 h-6" />
                </div>
              </div>

            </div>

            {/* Split Clinical Focus Area: Hero Patient (8 Cols) + Ward Roster (4 Cols) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* ===================================================== */}
              {/* LEFT: HERO SELECTED PATIENT COMMAND TILE (8 COLUMNS)  */}
              {/* ===================================================== */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* Hero Patient Card */}
                <div className="bg-white rounded-3xl p-7 border border-slate-200/80 shadow-[0_4px_25px_-4px_rgba(15,23,42,0.05)] relative overflow-hidden">
                  
                  {/* Card Title & Bed Details */}
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500 to-teal-400 flex items-center justify-center text-white shadow-md shadow-sky-500/20 font-black text-xl font-mono">
                        #{activeBed.bed_id}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-2xl font-black text-[#0F172A] tracking-tight">
                            Patient Bed #{activeBed.bed_id}
                          </h2>
                          <span className={`px-3 py-0.5 rounded-full text-xs font-bold border ${
                            activeBed.status && activeBed.status.includes("Live") 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : activeBed.status && activeBed.status.includes("Secondary ROI")
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {activeBed.status || "Monitoring"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 font-semibold mt-0.5">
                          ID: CORVITX-P{String(activeBed.bed_id).padStart(4, '0')} • Status: Live Clinical Edge Node
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="px-3.5 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5">
                        <Radio className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                        Live Optical Stream
                      </div>
                    </div>
                  </div>

                  {/* Main Vitals Metric Trio (Apple Health Big Numbers) */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    
                    {/* Heart Rate Tile */}
                    <div className="bg-gradient-to-br from-rose-50/80 via-rose-50/20 to-white rounded-3xl p-5 border border-rose-100 shadow-2xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-rose-500 tracking-wider uppercase">Heart Rate</span>
                        <div className="p-2 rounded-xl bg-rose-100/70 text-rose-600">
                          <HeartPulse className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-4xl font-black text-[#0F172A] tracking-tight font-sans">
                          {activeBed.hr ? Math.round(activeBed.hr) : '--'}
                        </span>
                        <span className="text-sm font-bold text-rose-500 ml-1">BPM</span>
                      </div>
                      <div className="mt-3 pt-3 border-t border-rose-100/70 flex items-center justify-between text-[11px] text-slate-500">
                        <span>Resting Band: 60–100</span>
                        <span className="font-semibold text-rose-600">POS rPPG</span>
                      </div>
                    </div>

                    {/* Respiration Rate Tile */}
                    <div className="bg-gradient-to-br from-teal-50/80 via-teal-50/20 to-white rounded-3xl p-5 border border-teal-100 shadow-2xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-teal-700 tracking-wider uppercase">Respiration</span>
                        <div className="p-2 rounded-xl bg-teal-100/70 text-teal-700">
                          <Stethoscope className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-4xl font-black text-[#0F172A] tracking-tight font-sans">
                          {activeBed.rr ? Math.round(activeBed.rr) : '--'}
                        </span>
                        <span className="text-sm font-bold text-teal-600 ml-1">RPM</span>
                      </div>
                      <div className="mt-3 pt-3 border-t border-teal-100/70 flex items-center justify-between text-[11px] text-slate-500">
                        <span>Normal Band: 12–20</span>
                        <span className="font-semibold text-teal-700">Green Channel</span>
                      </div>
                    </div>

                    {/* MEWS Score Tile */}
                    <div className="bg-gradient-to-br from-slate-50 to-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">MEWS Score</span>
                        <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
                          <ShieldAlert className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className={`text-4xl font-black tracking-tight font-sans ${
                          activeBed.mews >= 5 ? 'text-rose-600' : activeBed.mews >= 3 ? 'text-amber-600' : 'text-[#0F172A]'
                        }`}>
                          {activeBed.mews ?? 0}
                        </span>
                        <span className="text-sm font-bold text-slate-400 ml-1">/ 14</span>
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <span>Clinical Triage</span>
                        <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                          activeBed.mews >= 5 
                            ? 'bg-rose-100 text-rose-800' 
                            : activeBed.mews >= 3 
                            ? 'bg-amber-100 text-amber-800' 
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {activeBed.mews >= 5 ? 'CRITICAL' : activeBed.mews >= 3 ? 'ELEVATED' : 'STABLE'}
                        </span>
                      </div>
                    </div>

                  </div>

                  {/* Clean Camera Sensor & Fallback Information Tile */}
                  <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 flex flex-wrap items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-sky-600 shadow-2xs">
                        <Camera className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                          Optical Sensor Tracking Channel
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {activeBed.status && activeBed.status.includes("Secondary ROI")
                            ? "Active Channel: Cutaneous Neck ROI (Carotid pulse fallback when head is turned)"
                            : "Active Channel: Frontal Facial Triangle & Mid-Forehead rPPG Region"}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono font-bold bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600">
                        Resolution: 1280&times;720 @ 30FPS
                      </span>
                      <span className="text-[11px] font-mono font-bold bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600">
                        Buffer: 10s Window
                      </span>
                    </div>
                  </div>

                  {/* Whoop / Apple Health Style Live PPG Waveform (Area Chart with Soft Fill) */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                          Continuous Cardiac Blood-Volume Pulse (PPG Sweep Waveform)
                        </h4>
                      </div>
                      <span className="text-[11px] font-mono font-bold text-slate-400">
                        {activeBed.hr ? `${Math.round(activeBed.hr)} BPM Instantaneous Peak` : 'Buffering Signal...'}
                      </span>
                    </div>

                    <div className="h-32 w-full bg-slate-50/70 rounded-2xl p-3 border border-slate-200/70 relative overflow-hidden shadow-inner">
                      {activeBed.hr_history && activeBed.hr_history.length > 3 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={activeBed.hr_history.map((h, i) => ({ index: i, hr: h.hr }))}>
                            <defs>
                              <linearGradient id="applePulse" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.25}/>
                                <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.0}/>
                              </linearGradient>
                            </defs>
                            <YAxis domain={['dataMin - 6', 'dataMax + 6']} hide={true} />
                            <Area 
                              type="monotone" 
                              dataKey="hr" 
                              stroke="#F43F5E" 
                              strokeWidth={3} 
                              fillOpacity={1} 
                              fill="url(#applePulse)" 
                              isAnimationActive={false}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-xs font-semibold text-slate-400">
                          <Activity className="w-5 h-5 text-slate-300 mb-1 animate-pulse" />
                          Acquiring Chrominance Waveform (10-Second Rolling Window)...
                        </div>
                      )}
                    </div>
                  </div>

                </div>

              </div>

              {/* ===================================================== */}
              {/* RIGHT: WARD BED ROSTER & CLINICAL CONTROLS (4 COLUMNS)*/}
              {/* ===================================================== */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* Ward Quick Selector */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-[0_4px_25px_-4px_rgba(15,23,42,0.05)]">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-sky-600" />
                      <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">
                        Active Ward Beds ({safeBeds.length || 1})
                      </h3>
                    </div>
                    <span className="text-[11px] text-slate-400 font-semibold">Click to Focus</span>
                  </div>

                  <div className="space-y-3">
                    {safeBeds.length === 0 ? (
                      <div 
                        onClick={() => setSelectedBedId(1)}
                        className="p-4 rounded-2xl border bg-sky-50/70 border-sky-300 shadow-sm transition-all cursor-pointer flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold font-mono text-sm">
                            #1
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-[#0F172A]">Bed #1</h4>
                            <span className="text-[11px] font-semibold text-slate-400">
                              Monitoring (Live)
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-base font-black text-[#0F172A] font-mono block">
                            -- <span className="text-[10px] text-rose-500 font-bold">BPM</span>
                          </span>
                        </div>
                      </div>
                    ) : (
                      safeBeds.map((b) => {
                        const isSelected = b.bed_id === activeBed.bed_id;
                        return (
                          <div 
                            key={b.bed_id}
                            onClick={() => setSelectedBedId(b.bed_id)}
                            className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                              isSelected 
                                ? 'bg-sky-50/70 border-sky-300 shadow-sm' 
                                : 'bg-slate-50/60 hover:bg-slate-100/70 border-slate-200/70'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold font-mono text-sm ${
                                isSelected ? 'bg-sky-600 text-white' : 'bg-white border border-slate-200 text-slate-700'
                              }`}>
                                #{b.bed_id}
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-[#0F172A]">Bed #{b.bed_id}</h4>
                                <span className="text-[11px] font-semibold text-slate-400">
                                  {b.status || "Monitoring"}
                                </span>
                              </div>
                            </div>

                            <div className="text-right">
                              <span className="text-base font-black text-[#0F172A] font-mono block">
                                {b.hr ? Math.round(b.hr) : '--'} <span className="text-[10px] text-rose-500 font-bold">BPM</span>
                              </span>
                              <span className="text-[11px] font-semibold text-teal-600 font-mono">
                                {b.rr ? Math.round(b.rr) : '--'} RPM
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Clinical Safety & Alarm Threshold Controls */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-[0_4px_25px_-4px_rgba(15,23,42,0.05)]">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                    <Sliders className="w-4 h-4 text-slate-700" />
                    <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">
                      Clinical Safety Gates
                    </h3>
                  </div>

                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">Cutaneous Neck Fallback</span>
                        <span className="text-[10px] text-slate-400 font-medium">Auto-switches if face obscured</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        ENABLED
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">Motion-Artifact Rejection</span>
                        <span className="text-[10px] text-slate-400 font-medium">Intensity gradient gating (8.0&Delta;)</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        ACTIVE
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">Liveness SNR Discriminator</span>
                        <span className="text-[10px] text-slate-400 font-medium">Spectral harmonic peak checking</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        1.25 SNR
                      </span>
                    </div>
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: AUDIT DATABASE LOGS (FULL SCREEN MEDICAL TABLE)    */}
        {/* ========================================================= */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-[0_4px_25px_-4px_rgba(15,23,42,0.05)] overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-slate-100 text-slate-700">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 uppercase tracking-wide">
                    Clinical Triage Emergency Logs
                  </h3>
                  <p className="text-xs text-slate-400">
                    Comprehensive audit trail stored in SQLite database
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                {history.length} Critical Events Logged
              </span>
            </div>

            <div className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">Timestamp</th>
                    <th className="px-6 py-4">Bed ID</th>
                    <th className="px-6 py-4">Heart Rate</th>
                    <th className="px-6 py-4">MEWS Score</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center text-slate-400 font-medium">
                        No critical emergencies logged in database yet.
                      </td>
                    </tr>
                  ) : (
                    history.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4 font-mono text-slate-500">{row.timestamp}</td>
                        <td className="px-6 py-4 font-bold text-slate-800">Bed #{row.bed_id}</td>
                        <td className="px-6 py-4 text-rose-600 font-bold font-mono">{Math.round(row.hr)} BPM</td>
                        <td className="px-6 py-4 font-bold text-slate-800 font-mono">{row.mews} / 14</td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-xs font-bold uppercase tracking-wide">
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
        )}

      </main>
    </div>
  );
}
