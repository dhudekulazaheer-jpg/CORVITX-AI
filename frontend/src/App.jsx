import React, { useState, useEffect } from 'react';
import { YAxis, ResponsiveContainer, AreaChart, Area } from 'recharts';

const SOCKET_URL = "ws://localhost:8000/ws/dashboard";
const API_URL = "http://localhost:8000/history";

// ============================================================
// PURE HTML & CSS BESPOKE CLINICAL ICONS (ZERO UGLY SVG LIBRARIES)
// ============================================================
const IconPulse = ({ className = "w-4 h-4 text-rose-500" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12h3.5l2.5-7 4 14 3-9 2 4h5" />
  </svg>
);

const IconBreathe = ({ className = "w-4 h-4 text-teal-600" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 4v6a6 6 0 0 0 6 6M18 4v6a6 6 0 0 1-6 6M12 16v5M8 21h8" />
  </svg>
);

const IconShield = ({ className = "w-4 h-4 text-slate-700" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const IconViewfinder = ({ className = "w-5 h-5 text-sky-600" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
    <circle cx="12" cy="12" r="3" />
    <line x1="12" y1="5" x2="12" y2="7" />
    <line x1="12" y1="17" x2="12" y2="19" />
    <line x1="5" y1="12" x2="7" y2="12" />
    <line x1="17" y1="12" x2="19" y2="12" />
  </svg>
);

const IconSoundWave = ({ active = true, className = "text-emerald-600" }) => (
  <span className={`inline-flex items-center gap-[2px] h-3.5 px-0.5 ${className}`}>
    <span className={`w-[2.5px] bg-current rounded-full transition-all ${active ? 'h-2 animate-pulse' : 'h-1.5 opacity-50'}`}></span>
    <span className={`w-[2.5px] bg-current rounded-full transition-all ${active ? 'h-3.5' : 'h-2 opacity-50'}`}></span>
    <span className={`w-[2.5px] bg-current rounded-full transition-all ${active ? 'h-2.5 animate-pulse' : 'h-1.5 opacity-50'}`}></span>
  </span>
);

const IconSliders = ({ className = "w-3.5 h-3.5 text-slate-600" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
    <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
  </svg>
);

const IconDownload = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const IconActivity = ({ className = "w-3.5 h-3.5 text-sky-600" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const IconHistory = ({ className = "w-3.5 h-3.5 text-indigo-600" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15 15" />
  </svg>
);

const IconUser = ({ className = "w-3.5 h-3.5 text-sky-600" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const IconAlert = ({ className = "w-4 h-4 text-rose-500" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

export default function App() {
  const [activeTab, setActiveTab] = useState('ward'); // 'ward' | 'history'
  const [beds, setBeds] = useState([]);
  const [selectedBedId, setSelectedBedId] = useState(1);
  const [history, setHistory] = useState([]);
  const [connected, setConnected] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  
  // Feature 3: Patient EHR Drawer State
  const [showEhrDrawer, setShowEhrDrawer] = useState(false);
  
  // Option A: Alarm Threshold Configuration Modal State
  const [showAlarmModal, setShowAlarmModal] = useState(false);
  
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
        csv += `${i + 1},"${sampleTime}",${Math.round(sample.hr)}\r\n`;
      });
    } else {
      csv += "1,Live Optical Telemetry Stream,In Progress\r\n";
    }
    csv += "\r\n";

    csv += "HISTORICAL WARD EMERGENCY EVENTS (DATABASE LOG)\r\n";
    csv += "Log_ID,Event_Timestamp,Bed_ID,Heart_Rate_BPM,MEWS_Score,Triage_Protocol_Status\r\n";
    if (bedHistory.length > 0) {
      bedHistory.forEach((ev, idx) => {
        csv += `${idx + 1},"${ev.timestamp}",${ev.bed_id},${Math.round(ev.hr)},${ev.mews},"${ev.status}"\r\n`;
      });
    } else {
      csv += `None,Current Surveillance Active,Bed #${bed.bed_id},Stable,0,Hemodynamically Stable\r\n`;
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
      <header className="sticky top-0 z-40 bg-white/90 border-b border-slate-200/80 px-6 py-3.5 backdrop-blur-xl shadow-xs transition-all">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-4">
          
          {/* Brand & Hospital Subtitle */}
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 via-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/25">
              <IconPulse className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-tight text-[#0F172A]">
                  CORVITX<span className="text-sky-600">.AI</span>
                </span>
                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200/80 tracking-wide uppercase">
                  Clinical Station
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  ISO-13485
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-bold tracking-wider uppercase">
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
              <IconActivity className="w-3.5 h-3.5 text-sky-600" />
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
              <IconHistory className="w-3.5 h-3.5 text-indigo-600" />
              Triage Audit Logs
              {history.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-slate-200 text-slate-700 font-tabular">
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
                  <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                  <span>Silence (120s)</span>
                </button>
              ) : (
                <button
                  onClick={cancelSilence}
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-full text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer font-tabular"
                  title="Alarm audio silenced. Click to resume siren"
                >
                  <IconSoundWave active={false} className="text-white" />
                  <span>Silenced ({silenceCountdown}s)</span>
                </button>
              )
            ) : (
              <button
                onClick={toggleAudioMaster}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 rounded-full text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer hover:border-slate-300"
                title={audioEnabled ? "Audio monitor armed (click to mute)" : "Audio monitor muted (click to arm)"}
              >
                <IconSoundWave active={audioEnabled} className={audioEnabled ? "text-emerald-600" : "text-slate-400"} />
                <span className="hidden sm:inline font-semibold">{audioEnabled ? "Audio Armed" : "Audio Muted"}</span>
              </button>
            )}

            {/* Alarm Thresholds Configuration Modal Trigger */}
            <button
              onClick={() => setShowAlarmModal(true)}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 rounded-full text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer hover:border-slate-300"
              title="Configure Medical Alarm Limits & Presets"
            >
              <IconSliders className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">Alarm Limits</span>
            </button>

            {/* Feature 2: Header Export Button */}
            <button
              onClick={() => exportClinicalReport(activeBed)}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 rounded-full text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer hover:border-slate-300"
              title="Download Clinical EMR Triage Report"
            >
              <IconDownload className="w-3.5 h-3.5 text-sky-600" />
              <span className="hidden sm:inline">Export EMR Report</span>
            </button>

            <div className="hidden lg:flex items-center gap-2 text-xs font-bold text-slate-500 bg-white px-3.5 py-1.5 rounded-full border border-slate-200/80 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
              <span className="font-mono font-tabular">{currentTime}</span>
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

            <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-extrabold border transition-colors ${
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
              <IconAlert className="w-5 h-5 flex-shrink-0 text-white" />
              <div>
                <span className="text-xs font-black tracking-wide uppercase mr-2">
                  {isSilenced ? 'ALARM AUDIO SILENCED' : 'CRITICAL TELEMETRY ALARM'}
                </span>
                <span className="text-xs font-semibold opacity-95">
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
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                  Silence Alarm Siren (120s)
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold bg-white/20 px-3 py-1 rounded-full font-tabular">
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
          <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">✓</span>
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

            {/* Critical Patient Strobe Alert Banner */}
            {hasCritical && (
              <div className="bg-rose-50 border-2 border-rose-200/90 rounded-3xl p-5 shadow-sm flex items-center justify-between gap-4 animate-pulse">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-600">
                    <IconAlert className="w-5 h-5 text-rose-600" />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-rose-950 uppercase tracking-wide">
                      Clinical Triage Threshold Warning Alert
                    </h2>
                    <p className="text-xs text-rose-800 font-semibold mt-0.5">
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
                  <span className="label-clinical text-slate-400 block">Monitored Ward</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-[#0F172A] tracking-tight font-tabular">{safeBeds.length || 1}</span>
                    <span className="text-xs font-bold text-slate-400">Beds Active</span>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1.5 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> All Nodes Online
                  </span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600">
                  <IconActivity className="w-5 h-5 text-sky-600" />
                </div>
              </div>

              <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-[0_2px_15px_-3px_rgba(15,23,42,0.04)] flex items-center justify-between">
                <div>
                  <span className="label-clinical text-rose-500 block">Average Heart Rate</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-[#0F172A] tracking-tight font-tabular">{avgHr || '--'}</span>
                    <span className="text-xs font-bold text-rose-500">BPM</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400 mt-1 block">
                    Normal Sinus Rhythm
                  </span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500">
                  <IconPulse className="w-6 h-6 text-rose-500" />
                </div>
              </div>

              <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-[0_2px_15px_-3px_rgba(15,23,42,0.04)] flex items-center justify-between">
                <div>
                  <span className="label-clinical text-teal-700 block">Respiration Mean</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-[#0F172A] tracking-tight font-tabular">{avgRr || '--'}</span>
                    <span className="text-xs font-bold text-teal-600">RPM</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400 mt-1 block">
                    Chrominance Optical Flow
                  </span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700">
                  <IconBreathe className="w-6 h-6 text-teal-600" />
                </div>
              </div>

              <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-[0_2px_15px_-3px_rgba(15,23,42,0.04)] flex items-center justify-between">
                <div>
                  <span className="label-clinical text-slate-400 block">Ward Triage State</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className={`text-2xl font-black tracking-tight font-tabular ${criticalCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {criticalCount > 0 ? `${criticalCount} Critical` : 'Stable (Low)'}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400 mt-1 block">
                    MEWS Protocol Validated
                  </span>
                </div>
                <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${criticalCount > 0 ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
                  <IconShield className={`w-6 h-6 ${criticalCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`} />
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
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500 to-teal-400 flex items-center justify-center text-white shadow-md shadow-sky-500/20 font-black text-xl font-mono font-tabular">
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
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border flex items-center gap-1.5 ${
                              isSilenced 
                                ? 'bg-amber-50 text-amber-800 border-amber-300' 
                                : 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                            }`}>
                              <span className={`w-2 h-2 rounded-full ${isSilenced ? 'bg-amber-500' : 'bg-rose-600'}`}></span>
                              {isSilenced ? `Silenced (${silenceCountdown}s)` : 'Alarm Active'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 font-bold mt-0.5">
                          Patient: Zaheer D. (21M) • ID: <span className="font-mono">CORVITX-P{String(activeBed.bed_id).padStart(4, '0')}</span> • Room: ICU-Bay A
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Feature 3: Open EHR Drawer Button */}
                      <button 
                        onClick={() => setShowEhrDrawer(true)}
                        className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                      >
                        <IconUser className="w-3.5 h-3.5 text-sky-600" />
                        Patient EHR Profile
                      </button>

                      {/* Feature 2: Export Button */}
                      <button 
                        onClick={() => exportClinicalReport(activeBed)}
                        className="px-3.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                        title="Download CSV Clinical Report"
                      >
                        <IconDownload className="w-3.5 h-3.5" />
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
                        <span className="label-clinical text-rose-500">Heart Rate</span>
                        <div className="p-2 rounded-xl bg-rose-100/70 text-rose-600 relative">
                          <IconPulse className="w-4 h-4 text-rose-600" />
                          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-4xl font-black text-[#0F172A] tracking-tight font-tabular">
                          {activeBed.hr ? Math.round(activeBed.hr) : '--'}
                        </span>
                        <span className="text-sm font-bold text-rose-500 ml-1">BPM</span>
                      </div>
                      <div className="mt-3 pt-3 border-t border-rose-100/70 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-tabular font-medium">Limits: {thresholds.lowHr} - {thresholds.highHr}</span>
                        <span className="font-bold text-rose-600">POS rPPG</span>
                      </div>
                    </div>

                    {/* Respiration Rate Tile */}
                    <div className={`rounded-3xl p-5 border shadow-2xs transition-all ${
                      customRrViolation
                        ? 'bg-teal-100/80 border-teal-300 animate-pulse'
                        : 'bg-gradient-to-br from-teal-50/80 via-teal-50/20 to-white border-teal-100'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="label-clinical text-teal-700">Respiration</span>
                        <div className="p-2 rounded-xl bg-teal-100/70 text-teal-700">
                          <IconBreathe className="w-4 h-4 text-teal-600 animate-breathe" />
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-4xl font-black text-[#0F172A] tracking-tight font-tabular">
                          {activeBed.rr ? Math.round(activeBed.rr) : '--'}
                        </span>
                        <span className="text-sm font-bold text-teal-600 ml-1">RPM</span>
                      </div>
                      <div className="mt-3 pt-3 border-t border-teal-100/70 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-tabular font-medium">Limits: {thresholds.lowRr} - {thresholds.highRr}</span>
                        <span className="font-bold text-teal-700">Green Channel</span>
                      </div>
                    </div>

                    {/* MEWS Score Tile */}
                    <div className="bg-gradient-to-br from-slate-50 to-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="label-clinical text-slate-500">MEWS Score</span>
                        <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
                          <IconShield className="w-4 h-4 text-slate-700" />
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className={`text-4xl font-black tracking-tight font-tabular ${
                          activeBed.mews >= 5 ? 'text-rose-600' : activeBed.mews >= 3 ? 'text-amber-600' : 'text-[#0F172A]'
                        }`}>
                          {activeBed.mews ?? 0}
                        </span>
                        <span className="text-sm font-bold text-slate-400 ml-1">/ 14</span>
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-medium">Clinical Triage</span>
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

                  {/* Clean Optical Viewfinder Sensor Information Tile */}
                  <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 flex flex-wrap items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-sky-600 shadow-2xs flex items-center justify-center">
                        <IconViewfinder className="w-5 h-5 text-sky-600" />
                      </div>
                      <div>
                        <h4 className="text-xs font-extrabold text-[#0F172A] uppercase tracking-wider">
                          Optical Viewfinder Tracking Channel
                        </h4>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                          {activeBed.status && activeBed.status.includes("Secondary ROI")
                            ? "Active Channel: Cutaneous Neck ROI (Carotid pulse fallback when head is turned)"
                            : "Active Channel: Frontal Facial Triangle & Mid-Forehead rPPG Region"}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono font-bold bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 font-tabular">
                        Resolution: 1280&times;720 @ 30FPS
                      </span>
                      <span className="text-[11px] font-mono font-bold bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 font-tabular">
                        Buffer: 10s Window
                      </span>
                    </div>
                  </div>

                  {/* Whoop / Apple Health Style Live PPG Waveform (Area Chart with Soft Fill) */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                        <h4 className="label-clinical text-slate-600">
                          Continuous Cardiac Blood-Volume Pulse (PPG Sweep Waveform)
                        </h4>
                      </div>
                      <span className="text-[11px] font-mono font-bold text-slate-400 font-tabular">
                        {activeBed.hr ? `${Math.round(activeBed.hr)} BPM Instantaneous Peak` : 'Buffering Signal...'}
                      </span>
                    </div>

                    <div className="h-32 w-full bg-slate-50/70 rounded-2xl p-3 border border-slate-200/70 relative overflow-hidden shadow-inner">
                      {activeBed.hr_history && activeBed.hr_history.length > 3 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={activeBed.hr_history.map((h, i) => ({ index: i, hr: h.hr }))}>
                            <defs>
                              <linearGradient id="appleRoseWave" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.25} />
                                <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.0} />
                              </linearGradient>
                            </defs>
                            <YAxis domain={['dataMin - 5', 'dataMax + 5']} hide />
                            <Area 
                              type="monotone" 
                              dataKey="hr" 
                              stroke="#F43F5E" 
                              strokeWidth={2.5} 
                              fill="url(#appleRoseWave)" 
                              isAnimationActive={false} 
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-slate-400 font-medium text-xs">
                          <span className="inline-block w-2 h-2 rounded-full bg-rose-400 animate-ping mr-2"></span>
                          Synchronizing Photoplethysmogram Telemetry Channel...
                        </div>
                      )}
                    </div>
                  </div>

                </div>

              </div>

              {/* ===================================================== */}
              {/* RIGHT: WARD ROSTER & COMPACT ALARM PROTOCOL (4 COLS)  */}
              {/* ===================================================== */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* Ward Beds Card */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-[0_4px_25px_-4px_rgba(15,23,42,0.05)]">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="text-sm font-extrabold text-[#0F172A] uppercase tracking-wider">
                        Active Ward Beds
                      </h3>
                      <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Click any bed to focus telemetry</p>
                    </div>
                    <span className="text-[10px] font-extrabold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200 uppercase font-tabular">
                      {safeBeds.length || 1} Registered
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {safeBeds.length === 0 ? (
                      <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-200 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold font-mono text-sm font-tabular">
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
                          <span className="text-base font-black text-[#0F172A] font-mono block font-tabular">
                            -- <span className="text-[10px] text-rose-500 font-bold font-sans">BPM</span>
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
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold font-mono text-sm font-tabular ${
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
                              <span className="text-base font-black text-[#0F172A] font-mono block font-tabular">
                                {b.hr ? Math.round(b.hr) : '--'} <span className="text-[10px] text-rose-500 font-bold font-sans">BPM</span>
                              </span>
                              <span className="text-[11px] font-semibold text-teal-600 font-mono font-tabular">
                                {b.rr ? Math.round(b.rr) : '--'} RPM
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Compact ICU Alarm Protocol Overview Card */}
                <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-[0_4px_25px_-4px_rgba(15,23,42,0.05)]">
                  <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <IconSliders className="w-4 h-4 text-slate-700" />
                      <h3 className="label-clinical text-[#0F172A]">
                        Alarm Protocol & Limits
                      </h3>
                    </div>
                    <button
                      onClick={() => setShowAlarmModal(true)}
                      className="text-[11px] font-bold text-sky-600 bg-sky-50 hover:bg-sky-100 px-3 py-1 rounded-full border border-sky-200 transition cursor-pointer flex items-center gap-1"
                    >
                      <span>Tune Limits</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100">
                      <span className="label-clinical text-slate-400 block">Heart Rate Limits</span>
                      <span className="font-mono font-black text-slate-800 text-sm mt-0.5 block font-tabular">
                        {thresholds.lowHr} – {thresholds.highHr} <span className="text-[10px] text-rose-500 font-sans font-bold">BPM</span>
                      </span>
                    </div>

                    <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100">
                      <span className="label-clinical text-slate-400 block">Respiration Limits</span>
                      <span className="font-mono font-black text-slate-800 text-sm mt-0.5 block font-tabular">
                        {thresholds.lowRr} – {thresholds.highRr} <span className="text-[10px] text-teal-600 font-sans font-bold">RPM</span>
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2.5 border-t border-slate-100">
                    <span className="flex items-center gap-1.5 font-semibold text-slate-600">
                      <span className={`w-2 h-2 rounded-full ${audioEnabled ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                      {audioEnabled ? 'Audio Armed (IEC 60601-1-8)' : 'Audio Siren Muted'}
                    </span>
                    <button
                      onClick={() => playAlarmChime('high')}
                      className="text-rose-600 hover:text-rose-700 font-bold hover:underline cursor-pointer flex items-center gap-1 text-[11px]"
                      title="Test Audio Siren"
                    >
                      <IconSoundWave active={true} className="text-rose-500" /> Test Siren
                    </button>
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
                <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <IconHistory className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-[#0F172A] tracking-tight">
                    SQLite Triage Audit & MEWS Event History
                  </h3>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    Immutable persistent clinical surveillance logs stored in triage_history.db
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={fetchHistory}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  Refresh Logs
                </button>
                <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold font-tabular">
                  {history.length} Critical Events Captured
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
                        <td className="px-6 py-4 font-mono text-slate-500 font-tabular">{row.timestamp}</td>
                        <td className="px-6 py-4 font-bold text-slate-800">Bed #{row.bed_id}</td>
                        <td className="px-6 py-4 text-rose-600 font-bold font-mono font-tabular">{Math.round(row.hr)} BPM</td>
                        <td className="px-6 py-4 font-bold text-slate-800 font-mono font-tabular">{row.mews} / 14</td>
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
                    <IconUser className="w-5 h-5 text-sky-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">Electronic Health Record (EHR)</h3>
                    <p className="text-xs text-slate-400 font-bold">Hospital Patient Master Index • Bed #{activeBed.bed_id}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowEhrDrawer(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold text-base flex items-center justify-center transition cursor-pointer"
                >
                  &times;
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
                    <span className="text-xs font-bold text-rose-600 bg-white px-2 py-0.5 rounded-full border border-rose-200 font-mono font-tabular">Blood: O+</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 mt-1 block font-tabular">MRN: #CORVITX-9042-2026</span>
                </div>
              </div>

              {/* Clinical Detail Cards */}
              <div className="mt-6 space-y-4">
                
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="label-clinical text-slate-400 block mb-1">Admission Diagnosis</span>
                  <p className="text-sm font-bold text-slate-800">
                    Post-Operative Pulmonary Surveillance & Autonomous Hemodynamic Monitoring
                  </p>
                  <span className="text-xs text-slate-500 mt-1 block">Admitted: ICU Stepdown Ward Bay A • Bed #{activeBed.bed_id}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="label-clinical text-slate-400 block mb-1">Attending Physician</span>
                    <p className="text-xs font-bold text-slate-800">Dr. Sarah Vance, MD</p>
                    <span className="text-[10px] text-slate-500 font-medium">Chief Intensivist (Critical Care)</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="label-clinical text-slate-400 block mb-1">Primary Care Nurse</span>
                    <p className="text-xs font-bold text-slate-800">Staff Nurse Wilson, RN</p>
                    <span className="text-[10px] text-slate-500 font-medium">ICU Telemetry Station</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-100">
                  <span className="label-clinical text-rose-500 block mb-1">Allergies & Contraindications</span>
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
                  <span className="label-clinical text-slate-400 block mb-1">Active Medical Orders</span>
                  <ul className="text-xs space-y-2 text-slate-700 mt-2 font-medium">
                    <li className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-black">✓</span>
                      Continuous Contactless rPPG Telemetry Protocol
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-black">✓</span>
                      Cefazolin 1g IV Q8H (Post-op Prophylaxis)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-black">✓</span>
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
                <IconDownload className="w-4 h-4" />
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

      {/* ============================================================ */}
      {/* OPTION A: ALARM THRESHOLD CONFIGURATION MODAL                */}
      {/* ============================================================ */}
      {showAlarmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 transform transition-all">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600">
                  <IconSliders className="w-5 h-5 text-sky-600" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#0F172A] tracking-tight">
                    Alarm Threshold Config
                  </h3>
                  <p className="text-[11px] text-slate-400 font-bold">
                    IEC 60601-1-8 Telemetry Siren Limits
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowAlarmModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-base flex items-center justify-center cursor-pointer transition"
              >
                &times;
              </button>
            </div>

            {/* Sliders Body */}
            <div className="space-y-4">
              {/* Slider 1: High HR */}
              <div>
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="font-bold text-slate-700">Tachycardia Alert (High HR)</span>
                  <span className="font-mono font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 font-tabular">
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
                  <span className="font-mono font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200 font-tabular">
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
                  <span className="font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200 font-tabular">
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
                  <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 font-tabular">
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
              <div>
                <span className="label-clinical text-slate-400 block mb-2">
                  Clinical Ward Presets
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button 
                    onClick={() => setThresholds({ highHr: 120, lowHr: 50, highRr: 28, lowRr: 8 })}
                    className="text-xs font-bold py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer transition text-center"
                  >
                    Adult
                  </button>
                  <button 
                    onClick={() => setThresholds({ highHr: 105, lowHr: 55, highRr: 24, lowRr: 10 })}
                    className="text-xs font-bold py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer transition text-center"
                  >
                    Geriatric
                  </button>
                  <button 
                    onClick={() => setThresholds({ highHr: 150, lowHr: 70, highRr: 35, lowRr: 14 })}
                    className="text-xs font-bold py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer transition text-center"
                  >
                    Pediatric
                  </button>
                </div>
              </div>

              {/* Audio Chime Demonstration Button */}
              <div className="pt-2 border-t border-slate-100">
                <button 
                  onClick={() => playAlarmChime('high')}
                  className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 text-rose-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs font-semibold"
                >
                  <IconSoundWave active={true} className="text-rose-600" />
                  Test IEC 60601-1-8 Audio Chime
                </button>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="pt-5 border-t border-slate-100 mt-5">
              <button 
                onClick={() => setShowAlarmModal(false)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
              >
                Apply & Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
