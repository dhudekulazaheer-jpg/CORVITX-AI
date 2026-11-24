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
  FileText,
  Download,
  User,
  X,
  Calendar,
  Pill,
  Check,
  AlertCircle,
  SlidersHorizontal,
  ChevronRight,
  Volume2,
  VolumeX,
  Bell,
  BellOff
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
  
  // Feature 3: Patient EHR Drawer State
  const [showEhrDrawer, setShowEhrDrawer] = useState(false);
  
  // Feature 4: Interactive Clinical Alarm Thresholds
  const [thresholds, setThresholds] = useState({
    highHr: 120,
    lowHr: 50,
    highRr: 28,
    lowRr: 8
  });

  // Export success toast
  const [exportSuccess, setExportSuccess] = useState(false);

  // Feature: ICU Audio Alarm & Nurse Silence System (Web Audio API)
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isSilenced, setIsSilenced] = useState(false);
  const [silenceCountdown, setSilenceCountdown] = useState(0);

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

  const safeBeds = Array.isArray(beds) ? beds : [];
  const activeBed = (safeBeds.find(b => b && b.bed_id === selectedBedId)) 
    || safeBeds[0] 
    || fallbackBed;

  // Custom threshold violations & Active Alarm State
  const customHrViolation = activeBed.hr > 0 && (activeBed.hr > thresholds.highHr || activeBed.hr < thresholds.lowHr);
  const customRrViolation = activeBed.rr > 0 && (activeBed.rr > thresholds.highRr || activeBed.rr < thresholds.lowRr);
  const isAlarmActive = customHrViolation || customRrViolation || activeBed.mews >= 5 || activeBed.apnea_alert || activeBed.fall_risk;
  const hasCritical = safeBeds.some(b => b && (b.mews >= 5 || b.apnea_alert || b.fall_risk)) || customHrViolation;

  // Formatted clinical alarm reasons
  const alarmReasons = [];
  if (activeBed.hr > thresholds.highHr) alarmReasons.push(`Tachycardia (${Math.round(activeBed.hr)} > ${thresholds.highHr} BPM)`);
  if (activeBed.hr > 0 && activeBed.hr < thresholds.lowHr) alarmReasons.push(`Bradycardia (${Math.round(activeBed.hr)} < ${thresholds.lowHr} BPM)`);
  if (activeBed.rr > thresholds.highRr) alarmReasons.push(`Tachypnea (${Math.round(activeBed.rr)} > ${thresholds.highRr} RPM)`);
  if (activeBed.rr > 0 && activeBed.rr < thresholds.lowRr) alarmReasons.push(`Bradypnea/Apnea (${Math.round(activeBed.rr)} < ${thresholds.lowRr} RPM)`);
  if (activeBed.mews >= 5) alarmReasons.push(`Critical MEWS ${activeBed.mews}/14`);
  if (activeBed.apnea_alert) alarmReasons.push("Apnea Detected");
  if (activeBed.fall_risk) alarmReasons.push("Fall Risk Detected");

  // Silence Timer Countdown Effect
  useEffect(() => {
    let timer;
    if (isSilenced && silenceCountdown > 0) {
      timer = setInterval(() => {
        setSilenceCountdown((prev) => {
          if (prev <= 1) {
            setIsSilenced(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isSilenced, silenceCountdown]);

  // Clinical Audio Chime Synthesizer (IEC 60601-1-8 standard harmonic alerts)
  const playAlarmChime = (priority = 'high') => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const now = ctx.currentTime;

      if (priority === 'high') {
        // High Priority: 3 rapid pulse tones (880 Hz / A5)
        [0, 0.16, 0.32].forEach((offset) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, now + offset);
          gain.gain.setValueAtTime(0.18, now + offset);
          gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.12);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + offset);
          osc.stop(now + offset + 0.12);
        });
      } else {
        // Medium Priority: descending alert chime (659.25 Hz -> 587.33 Hz)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(659.25, now);
        osc.frequency.setValueAtTime(587.33, now + 0.15);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch (err) {
      console.warn("Audio alarm playback prevented:", err);
    }
  };

  // Trigger Audio Chime periodically during active alarm
  useEffect(() => {
    if (!audioEnabled || isSilenced || !isAlarmActive) return;

    playAlarmChime(activeBed.mews >= 5 ? 'high' : 'medium');

    const chimeInterval = setInterval(() => {
      playAlarmChime(activeBed.mews >= 5 ? 'high' : 'medium');
    }, 4000);

    return () => clearInterval(chimeInterval);
  }, [audioEnabled, isSilenced, isAlarmActive, activeBed.mews]);

  const triggerSilenceAlarm = (seconds = 120) => {
    setIsSilenced(true);
    setSilenceCountdown(seconds);
  };

  const cancelSilence = () => {
    setIsSilenced(false);
    setSilenceCountdown(0);
  };

  const toggleAudioMaster = () => {
    setAudioEnabled(prev => !prev);
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') ctx.resume();
      }
    } catch(e) {}
  };

  // Ward KPI aggregations
  const activeCount = safeBeds.filter(b => b && b.hr > 0).length;
  const avgHr = activeCount > 0 ? Math.round(safeBeds.reduce((acc, b) => acc + (b.hr || 0), 0) / activeCount) : 0;
  const avgRr = activeCount > 0 ? (safeBeds.reduce((acc, b) => acc + (b.rr || 0), 0) / activeCount).toFixed(1) : 0;
  const criticalCount = safeBeds.filter(b => b && (b.mews >= 5 || b.apnea_alert || b.fall_risk)).length;

  // ============================================================
  // FEATURE 2: ONE-CLICK CLINICAL EMR REPORT EXPORT (CSV / EMR)
  // ============================================================
  const exportClinicalReport = (bed) => {
    const timestamp = new Date().toLocaleString();
    const bedHistory = history.filter(h => h.bed_id === bed.bed_id);
    
    let csv = "CORVITX-AI CLINICAL PATIENT TRIAGE & HEMODYNAMIC REPORT\r\n";
    csv += "========================================================\r\n";
    csv += `Report Generated: "${timestamp}"\r\n`;
    csv += `Hospital Center: KARE Clinical Research Center - ICU Stepdown Bay A\r\n`;
    csv += `Bed Identifier: Bed #${bed.bed_id}\r\n`;
    csv += `Patient Name: Zaheer D.\r\n`;
    csv += `Patient Age / Gender: 21 / Male\r\n`;
    csv += `Blood Group: O+ Positive\r\n`;
    csv += `Attending Physician: Dr. Sarah Vance, MD (Chief Intensivist)\r\n`;
    csv += `Clinical Indication: Post-Operative Hemodynamic & Respiratory Surveillance\r\n\r\n`;
    
    csv += "CURRENT TRIAGE & VITALS SNAPSHOT\r\n";
    csv += "Metric,Value,Unit,Clinical_Status\r\n";
    csv += `Heart Rate,${bed.hr ? Math.round(bed.hr) : 'N/A'},BPM,${bed.hr > thresholds.highHr ? 'Tachycardia Alert' : (bed.hr < thresholds.lowHr && bed.hr > 0) ? 'Bradycardia Alert' : 'Normal Sinus Rhythm'}\r\n`;
    csv += `Respiration Rate,${bed.rr ? Math.round(bed.rr) : 'N/A'},RPM,${bed.rr < thresholds.lowRr ? 'Apnea / Bradypnea Alert' : 'Eupnea / Normal'}\r\n`;
    csv += `Modified Early Warning Score (MEWS),${bed.mews ?? 0},/14,${bed.mews >= 5 ? 'Critical (Immediate Resuscitation)' : bed.mews >= 3 ? 'Warning (Increased Monitoring)' : 'Stable (Low Risk)'}\r\n`;
    csv += `Optical Tracking Channel,"${bed.status || 'Monitoring'}",rPPG,Cutaneous POS Algorithm\r\n\r\n`;
    
    csv += "LIVE 30-SAMPLE INSTANTANEOUS CARDIAC WAVE LOG\r\n";
    csv += "Sample_Index,Recorded_Time,Pulse_BPM\r\n";
    if (bed.hr_history && bed.hr_history.length > 0) {
      bed.hr_history.forEach((sample, i) => {
        const sampleTime = sample.time ? new Date(sample.time * 1000).toLocaleTimeString() : `T-${bed.hr_history.length - i}s`;
        csv += `${i + 1},"${sampleTime}",${sample.hr}\r\n`;
      });
    } else {
      csv += `1,"Current",${bed.hr || 0}\r\n`;
    }
    
    csv += "\r\nEMERGENCY AUDIT DATABASE LOGS FOR THIS BED (SQLITE)\r\n";
    csv += "Timestamp,Bed_ID,Heart_Rate_BPM,MEWS_Score,Triage_Event\r\n";
    if (bedHistory.length > 0) {
      bedHistory.forEach(h => {
        csv += `"${h.timestamp}",${h.bed_id},${h.hr},${h.mews},"${h.status}"\r\n`;
      });
    } else {
      csv += `"N/A",${bed.bed_id},${bed.hr || 0},${bed.mews || 0},"No critical alerts logged for this bed"\r\n`;
    }
    
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `CORVITX_EMR_Report_Bed_${bed.bed_id}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 3000);
  };

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

          {/* Clock, Export, Audio Alarm Control, Add Bed & Live Status */}
          <div className="flex items-center gap-3">
            
            {/* Audio Alarm Control Pill */}
            {isAlarmActive ? (
              !isSilenced ? (
                <button
                  onClick={() => triggerSilenceAlarm(120)}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer animate-pulse"
                  title="Silence medical alarm siren for 120 seconds"
                >
                  <VolumeX className="w-3.5 h-3.5" />
                  <span>Silence (120s)</span>
                </button>
              ) : (
                <button
                  onClick={cancelSilence}
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-full text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                  title="Alarm audio silenced. Click to resume siren"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Silenced ({silenceCountdown}s)</span>
                </button>
              )
            ) : (
              <button
                onClick={toggleAudioMaster}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 rounded-full text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer hover:border-slate-300"
                title={audioEnabled ? "Audio monitor armed (click to mute)" : "Audio monitor muted (click to arm)"}
              >
                {audioEnabled ? (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="hidden sm:inline">Audio Armed</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                    <span className="hidden sm:inline">Audio Muted</span>
                  </>
                )}
              </button>
            )}

            {/* Feature 2: Header Export Button */}
            <button
              onClick={() => exportClinicalReport(activeBed)}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 rounded-full text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer hover:border-slate-300"
              title="Download Clinical EMR Triage Report"
            >
              <Download className="w-3.5 h-3.5 text-sky-600" />
              <span className="hidden sm:inline">Export EMR Report</span>
            </button>

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
      {/* CLINICAL EMERGENCY STROBE BANNER & NURSE SILENCE CONTROL    */}
      {/* ============================================================ */}
      {isAlarmActive && (
        <div className={`px-6 py-2.5 transition-all shadow-md ${
          isSilenced 
            ? 'bg-amber-500 text-white' 
            : 'bg-rose-600 text-white animate-pulse'
        }`}>
          <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <div>
                <span className="text-xs font-black tracking-wide uppercase mr-2">
                  {isSilenced ? '🔕 ALARM AUDIO SILENCED' : '🚨 CRITICAL TELEMETRY ALARM'}
                </span>
                <span className="text-xs font-medium opacity-95">
                  Bed #{activeBed.bed_id} — {alarmReasons.join(' • ') || 'Abnormal Vitals Detected'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isSilenced ? (
                <button
                  onClick={() => triggerSilenceAlarm(120)}
                  className="bg-white text-rose-700 hover:bg-rose-50 px-4 py-1.5 rounded-full text-xs font-black transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <VolumeX className="w-3.5 h-3.5" />
                  Silence Alarm Siren (120s)
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold bg-white/20 px-3 py-1 rounded-full">
                    Silenced: {silenceCountdown}s remaining
                  </span>
                  <button
                    onClick={cancelSilence}
                    className="bg-white/90 hover:bg-white text-amber-900 px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer"
                  >
                    Resume Audio
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Export Success Toast Notification */}
      {exportSuccess && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-xs font-bold">EMR Clinical Report Exported to CSV!</span>
        </div>
      )}

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
                      {customHrViolation 
                        ? `Custom Heart Rate Alarm Triggered: ${Math.round(activeBed.hr)} BPM exceeds threshold limits (${thresholds.lowHr} - ${thresholds.highHr} BPM)!` 
                        : "MEWS score exceeded critical threshold (>=5), Apnea detected, or Bed-Exit displacement occurring."}
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
                <div className={`bg-white rounded-3xl p-7 border transition-all duration-300 relative overflow-hidden ${
                  isAlarmActive 
                    ? isSilenced
                      ? 'border-amber-400 ring-2 ring-amber-300/50 shadow-[0_0_25px_rgba(245,158,11,0.15)]'
                      : 'border-rose-500 ring-4 ring-rose-400/40 shadow-[0_0_35px_rgba(244,63,94,0.25)] animate-pulse'
                    : 'border-slate-200/80 shadow-[0_4px_25px_-4px_rgba(15,23,42,0.05)]'
                }`}>
                  
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

                          {/* Dynamic Alarm Strobe Badge */}
                          {isAlarmActive && (
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border flex items-center gap-1 ${
                              isSilenced 
                                ? 'bg-amber-50 text-amber-800 border-amber-300' 
                                : 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                            }`}>
                              {isSilenced ? <BellOff className="w-3 h-3 text-amber-700" /> : <Bell className="w-3 h-3 text-rose-700" />}
                              {isSilenced ? `Silenced (${silenceCountdown}s)` : 'Alarm Active'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 font-semibold mt-0.5">
                          Patient: Zaheer D. (21M) • ID: CORVITX-P{String(activeBed.bed_id).padStart(4, '0')} • Room: ICU-Bay A
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Feature 3: Open EHR Drawer Button */}
                      <button 
                        onClick={() => setShowEhrDrawer(true)}
                        className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                      >
                        <User className="w-3.5 h-3.5 text-sky-600" />
                        Patient EHR Profile
                      </button>

                      {/* Feature 2: Export Button */}
                      <button 
                        onClick={() => exportClinicalReport(activeBed)}
                        className="px-3.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                        title="Download CSV Clinical Report"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Export
                      </button>
                    </div>
                  </div>

                  {/* Main Vitals Metric Trio (Apple Health Big Numbers) */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    
                    {/* Heart Rate Tile */}
                    <div className={`rounded-3xl p-5 border shadow-2xs transition-all ${
                      customHrViolation
                        ? 'bg-rose-100/80 border-rose-300 animate-pulse'
                        : 'bg-gradient-to-br from-rose-50/80 via-rose-50/20 to-white border-rose-100'
                    }`}>
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
                        <span>Threshold: {thresholds.lowHr} - {thresholds.highHr}</span>
                        <span className="font-semibold text-rose-600">POS rPPG</span>
                      </div>
                    </div>

                    {/* Respiration Rate Tile */}
                    <div className={`rounded-3xl p-5 border shadow-2xs transition-all ${
                      customRrViolation
                        ? 'bg-teal-100/80 border-teal-300 animate-pulse'
                        : 'bg-gradient-to-br from-teal-50/80 via-teal-50/20 to-white border-teal-100'
                    }`}>
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
                        <span>Threshold: {thresholds.lowRr} - {thresholds.highRr}</span>
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
              {/* RIGHT: WARD BED ROSTER & FEATURE 4 SLIDERS (4 COLS)   */}
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

                {/* ============================================================ */}
                {/* FEATURE 4: INTERACTIVE ALARM THRESHOLD SLIDERS               */}
                {/* ============================================================ */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-[0_4px_25px_-4px_rgba(15,23,42,0.05)]">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="w-4 h-4 text-slate-700" />
                      <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">
                        Custom Alarm Thresholds
                      </h3>
                    </div>
                    <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200">
                      LIVE TUNER
                    </span>
                  </div>

                  <div className="space-y-4">
                    {/* Slider 1: High HR */}
                    <div>
                      <div className="flex justify-between items-center text-xs mb-1.5">
                        <span className="font-bold text-slate-700">Tachycardia Alert (High HR)</span>
                        <span className="font-mono font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                          &gt; {thresholds.highHr} BPM
                        </span>
                      </div>
                      <input 
                        type="range" 
                        min="90" 
                        max="160" 
                        value={thresholds.highHr}
                        onChange={(e) => setThresholds({ ...thresholds, highHr: Number(e.target.value) })}
                        className="w-full accent-rose-500 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                      />
                    </div>

                    {/* Slider 2: Low HR */}
                    <div>
                      <div className="flex justify-between items-center text-xs mb-1.5">
                        <span className="font-bold text-slate-700">Bradycardia Alert (Low HR)</span>
                        <span className="font-mono font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                          &lt; {thresholds.lowHr} BPM
                        </span>
                      </div>
                      <input 
                        type="range" 
                        min="40" 
                        max="65" 
                        value={thresholds.lowHr}
                        onChange={(e) => setThresholds({ ...thresholds, lowHr: Number(e.target.value) })}
                        className="w-full accent-sky-500 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                      />
                    </div>

                    {/* Slider 3: High RR */}
                    <div>
                      <div className="flex justify-between items-center text-xs mb-1.5">
                        <span className="font-bold text-slate-700">Tachypnea Alert (High Resp)</span>
                        <span className="font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                          &gt; {thresholds.highRr} RPM
                        </span>
                      </div>
                      <input 
                        type="range" 
                        min="20" 
                        max="35" 
                        value={thresholds.highRr}
                        onChange={(e) => setThresholds({ ...thresholds, highRr: Number(e.target.value) })}
                        className="w-full accent-teal-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                      />
                    </div>

                    {/* Slider 4: Low RR */}
                    <div>
                      <div className="flex justify-between items-center text-xs mb-1.5">
                        <span className="font-bold text-slate-700">Bradypnea / Apnea Limit</span>
                        <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          &lt; {thresholds.lowRr} RPM
                        </span>
                      </div>
                      <input 
                        type="range" 
                        min="6" 
                        max="14" 
                        value={thresholds.lowRr}
                        onChange={(e) => setThresholds({ ...thresholds, lowRr: Number(e.target.value) })}
                        className="w-full accent-amber-500 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                      />
                    </div>

                    {/* Preset Buttons */}
                    <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
                      <button 
                        onClick={() => setThresholds({ highHr: 120, lowHr: 50, highRr: 28, lowRr: 8 })}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                      >
                        Adult Standard
                      </button>
                      <button 
                        onClick={() => setThresholds({ highHr: 105, lowHr: 55, highRr: 24, lowRr: 10 })}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                      >
                        Geriatric Strict
                      </button>
                      <button 
                        onClick={() => setThresholds({ highHr: 150, lowHr: 70, highRr: 35, lowRr: 14 })}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                      >
                        Pediatric
                      </button>
                    </div>

                    {/* Feature 5: Audio Chime Demonstration Button */}
                    <div className="pt-2 border-t border-slate-100">
                      <button 
                        onClick={() => playAlarmChime('high')}
                        className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs hover:border-slate-300"
                        title="Click to synthesize and test the IEC 60601-1-8 medical alarm tone"
                      >
                        <Volume2 className="w-3.5 h-3.5 text-rose-500" />
                        Test IEC 60601-1-8 Audio Chime
                      </button>
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
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => exportClinicalReport(activeBed)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Full Log Report
                </button>
                <span className="text-xs font-mono font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                  {history.length} Critical Events Logged
                </span>
              </div>
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

      {/* ============================================================ */}
      {/* FEATURE 3: PATIENT CLINICAL EHR DRAWER (MODAL SLIDE-OVER)    */}
      {/* ============================================================ */}
      {showEhrDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-end transition-opacity animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl p-7 overflow-y-auto border-l border-slate-200 flex flex-col justify-between">
            
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-5 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">Electronic Health Record (EHR)</h3>
                    <p className="text-xs text-slate-400 font-medium">Hospital Patient Master Index • Bed #{activeBed.bed_id}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowEhrDrawer(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Patient Identification Card */}
              <div className="mt-6 p-5 rounded-3xl bg-gradient-to-tr from-sky-50 via-teal-50 to-emerald-50 border border-sky-100 flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-600 to-teal-500 text-white font-black text-2xl flex items-center justify-center shadow-md shadow-sky-500/20 font-sans">
                  ZD
                </div>
                <div>
                  <h4 className="text-xl font-black text-slate-900 tracking-tight">Zaheer D.</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-bold text-slate-600">21 Yrs • Male</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs font-bold text-rose-600 bg-white px-2 py-0.5 rounded-full border border-rose-200 font-mono">Blood: O+</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 mt-1 block">MRN: #CORVITX-9042-2026</span>
                </div>
              </div>

              {/* Clinical Detail Cards */}
              <div className="mt-6 space-y-4">
                
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Admission Diagnosis</span>
                  <p className="text-sm font-bold text-slate-800">
                    Post-Operative Pulmonary Surveillance & Autonomous Hemodynamic Monitoring
                  </p>
                  <span className="text-xs text-slate-500 mt-1 block">Admitted: ICU Stepdown Ward Bay A • Bed #{activeBed.bed_id}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Attending Physician</span>
                    <p className="text-xs font-bold text-slate-800">Dr. Sarah Vance, MD</p>
                    <span className="text-[10px] text-slate-500">Chief Intensivist (Critical Care)</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Primary Care Nurse</span>
                    <p className="text-xs font-bold text-slate-800">Staff Nurse Wilson, RN</p>
                    <span className="text-[10px] text-slate-500">ICU Telemetry Station</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-100">
                  <span className="text-[11px] font-bold text-rose-500 uppercase tracking-wider block mb-1">Allergies & Contraindications</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white text-rose-700 border border-rose-200">
                      Penicillin (Moderate Rash)
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white text-rose-700 border border-rose-200">
                      Latex (Contact Dermatitis)
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Active Medical Orders</span>
                  <ul className="text-xs space-y-1.5 text-slate-700 mt-2 font-medium">
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      Continuous Contactless rPPG Telemetry Protocol
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      Cefazolin 1g IV Q8H (Post-op Prophylaxis)
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      Normal Saline 0.9% IV @ 75 mL/hr
                    </li>
                  </ul>
                </div>

              </div>
            </div>

            {/* Drawer Bottom Actions */}
            <div className="pt-6 border-t border-slate-100 space-y-2 mt-6">
              <button 
                onClick={() => exportClinicalReport(activeBed)}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <Download className="w-4 h-4" />
                Export Full EHR Record (CSV)
              </button>
              <button 
                onClick={() => setShowEhrDrawer(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition cursor-pointer"
              >
                Close Drawer
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
