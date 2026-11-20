import json
import asyncio
import time
import sqlite3
import os
import sys
import csv
import uuid
import numpy as np
from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

from aiortc import RTCPeerConnection, RTCSessionDescription, RTCConfiguration, RTCIceServer

# Ensure root directory is on sys.path for internal modules
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from corvitx_engine import CORVITXEngine
from study_data_manager import (
    log_real_research_session,
    calculate_real_study_statistics,
    REAL_STUDY_FILE
)

app = FastAPI(title="CORVITX-AI Backend & Remote Research Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------
# STATIC FILES & PARTICIPANT PORTAL SETUP
# ---------------------------------------------------------
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/participant")
def get_participant_page():
    html_file = os.path.join(STATIC_DIR, "participant.html")
    if os.path.exists(html_file):
        return FileResponse(html_file)
    return HTMLResponse("<h2>Participant portal file not found.</h2>", status_code=404)

# ---------------------------------------------------------
# DATABASE SETUP (SQLite)
# ---------------------------------------------------------
DB_FILE = "triage_history.db"

def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            bed_id INTEGER,
            hr REAL,
            mews INTEGER,
            status TEXT
        )
    ''')
    conn.commit()
    conn.close()

init_db()

def log_critical_alert(bed_id, hr, mews, status):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    c.execute("INSERT INTO alerts (timestamp, bed_id, hr, mews, status) VALUES (?, ?, ?, ?, ?)",
              (ts, bed_id, hr, mews, status))
    conn.commit()
    conn.close()

# ---------------------------------------------------------
# STATE MANAGEMENT (Local Beds & Dashboards)
# ---------------------------------------------------------
beds_state: Dict[int, dict] = {}
last_logged_time: Dict[int, float] = {}

class ConnectionManager:
    def __init__(self):
        self.dashboard_clients: List[WebSocket] = []

    async def connect_dashboard(self, websocket: WebSocket):
        await websocket.accept()
        self.dashboard_clients.append(websocket)
        await self.broadcast_to_dashboards(self.get_all_beds_list())

    def disconnect_dashboard(self, websocket: WebSocket):
        if websocket in self.dashboard_clients:
            self.dashboard_clients.remove(websocket)

    async def broadcast_to_dashboards(self, message: list):
        disconnected = []
        for connection in self.dashboard_clients:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)
        for dead_conn in disconnected:
            self.disconnect_dashboard(dead_conn)

    def get_all_beds_list(self):
        return sorted(beds_state.values(), key=lambda b: (-b.get("mews", 0), b.get("bed_id", 0)))

manager = ConnectionManager()

# ---------------------------------------------------------
# REMOTE WEBRTC RESEARCH SESSIONS
# ---------------------------------------------------------
# Stores active participant streaming sessions
remote_research_sessions: Dict[str, dict] = {}

class SessionCreateRequest(BaseModel):
    condition: Optional[str] = "Resting"
    age: Optional[int] = 21
    lighting: Optional[str] = "Indoor LED"
    notes: Optional[str] = ""
    consent: bool = True

class OfferRequest(BaseModel):
    session_token: str
    sdp: str
    type: str

class FinalizeRequest(BaseModel):
    session_token: str
    ref_hr: Optional[float] = None
    ref_hr_method: Optional[str] = "Smartwatch / Pulse Oximeter"
    ref_rr: Optional[float] = None
    ref_rr_method: Optional[str] = "Guided Timer Count (60s)"
    age: Optional[int] = None
    condition: Optional[str] = None
    notes: Optional[str] = None

def get_next_participant_id() -> str:
    count = 0
    if os.path.exists(REAL_STUDY_FILE):
        try:
            with open(REAL_STUDY_FILE, "r", encoding="utf-8") as f:
                count = max(0, len(f.readlines()) - 1)
        except Exception:
            count = 0
    count += len(remote_research_sessions)
    return f"P-{count + 1:04d}"

async def consume_video_track(track, session: dict):
    """Processes incoming WebRTC video frames through CORVITXEngine in real time."""
    engine: CORVITXEngine = session["engine"]
    print(f"[WebRTC] Started video processing loop for participant {session['participant_id']}")
    
    try:
        while True:
            frame = await track.recv()
            # Convert av.VideoFrame to OpenCV BGR numpy array
            bgr = frame.to_ndarray(format="bgr24")
            
            # Pass frame into the exact same signal processing pipeline
            vitals = engine.process_frame(bgr)
            
            session["total_frames"] += 1
            if vitals.get("face_detected", False):
                session["face_detected_frames"] += 1
                
            hr = vitals.get("hr", 0.0)
            rr = vitals.get("rr", 0.0)
            snr = vitals.get("snr", 0.0)
            
            if hr > 0:
                session["samples_hr"].append(hr)
            if rr > 0:
                session["samples_rr"].append(rr)
            if snr > 0:
                session["snr_list"].append(snr)
                
            session["last_vital"] = vitals
            session["last_frame_time"] = time.time()
            
    except asyncio.CancelledError:
        print(f"[WebRTC] Video loop cancelled for {session['participant_id']}")
    except Exception as e:
        print(f"[WebRTC] Video loop finished/closed for {session['participant_id']}: {e}")

@app.post("/api/webrtc/session/create")
async def create_webrtc_session(req: SessionCreateRequest, request: Request):
    if not req.consent:
        raise HTTPException(status_code=400, detail="Participant consent is strictly required.")

    session_token = uuid.uuid4().hex[:16]
    participant_id = get_next_participant_id()
    client_host = request.client.host if request.client else "unknown"

    session = {
        "session_token": session_token,
        "participant_id": participant_id,
        "created_at": time.time(),
        "age": req.age or 21,
        "condition": req.condition or "Resting",
        "lighting": req.lighting or "Indoor LED",
        "notes": req.notes or "",
        "consent": req.consent,
        "client_host": client_host,
        "engine": CORVITXEngine(max_beds=1, buffer_size=300),
        "pc": None,
        "task": None,
        "samples_hr": [],
        "samples_rr": [],
        "snr_list": [],
        "total_frames": 0,
        "face_detected_frames": 0,
        "last_vital": {},
        "last_frame_time": time.time()
    }
    remote_research_sessions[session_token] = session

    print(f"[SESSION CREATE] Assigned {participant_id} (Token: {session_token})")
    return {
        "session_token": session_token,
        "participant_id": participant_id,
        "condition": session["condition"]
    }

@app.post("/api/webrtc/offer")
async def handle_webrtc_offer(req: OfferRequest):
    session = remote_research_sessions.get(req.session_token)
    if not session:
        raise HTTPException(status_code=404, detail="Invalid or expired session token")

    # Configure STUN for reliable NAT traversal over mobile/Wi-Fi
    config = RTCConfiguration(
        iceServers=[
            RTCIceServer(urls=["stun:stun.l.google.com:19302"]),
            RTCIceServer(urls=["stun:stun1.l.google.com:19302"]),
            RTCIceServer(urls=["stun:stun2.l.google.com:19302"]),
        ]
    )
    pc = RTCPeerConnection(configuration=config)
    session["pc"] = pc

    @pc.on("track")
    def on_track(track):
        if track.kind == "video":
            task = asyncio.create_task(consume_video_track(track, session))
            session["task"] = task

    @pc.on("connectionstatechange")
    async def on_state_change():
        print(f"[WebRTC] Connection state: {pc.connectionState} for {session['participant_id']}")
        if pc.connectionState in ["failed", "closed"]:
            await pc.close()

    # Apply remote offer
    offer = RTCSessionDescription(sdp=req.sdp, type=req.type)
    await pc.setRemoteDescription(offer)

    # Generate answer
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    return {
        "sdp": pc.localDescription.sdp,
        "type": pc.localDescription.type
    }

@app.get("/api/webrtc/session/{session_token}/status")
async def get_session_status(session_token: str):
    session = remote_research_sessions.get(session_token)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    last_v = session.get("last_vital", {})
    return {
        "participant_id": session["participant_id"],
        "total_frames": session["total_frames"],
        "face_detected": bool(last_v.get("face_detected", False)),
        "face_detection_rate": round(session["face_detected_frames"] / max(1, session["total_frames"]), 2),
        "current_hr": last_v.get("hr", 0.0),
        "current_rr": last_v.get("rr", 0.0),
        "current_snr": last_v.get("snr", 0.0),
        "active": session["pc"] is not None and session["pc"].connectionState not in ["failed", "closed"]
    }

@app.post("/api/webrtc/session/finalize")
async def finalize_webrtc_session(req: FinalizeRequest):
    session = remote_research_sessions.get(req.session_token)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Cancel processing task & close peer connection
    if session.get("task"):
        session["task"].cancel()
    if session.get("pc"):
        try:
            await session["pc"].close()
        except Exception:
            pass

    # Extract valid physiologically bounded samples
    valid_hrs = [h for h in session["samples_hr"] if 40.0 <= h <= 180.0]
    valid_rrs = [r for r in session["samples_rr"] if 6.0 <= r <= 40.0]

    # STRICT RESEARCH INTEGRITY: Never substitute reference values!
    est_hr = round(float(np.median(valid_hrs)), 1) if valid_hrs else None
    est_rr = round(float(np.median(valid_rrs)), 1) if valid_rrs else None

    ref_hr = req.ref_hr
    ref_rr = req.ref_rr
    age = req.age or session["age"]
    condition = req.condition or session["condition"]
    notes = req.notes or session["notes"]

    avg_snr = round(float(np.mean(session["snr_list"])), 2) if session["snr_list"] else 0.0
    face_det_rate = round(float(session["face_detected_frames"]) / max(1, session["total_frames"]), 3)

    valid = True
    failure_reasons = []
    if est_hr is None:
        valid = False
        failure_reasons.append("No valid HR rPPG signals (low SNR or patient motion)")
    if est_rr is None:
        valid = False
        failure_reasons.append("No valid RR signals (respiratory chrominance unresolved)")
    if len(valid_hrs) < 5:
        valid = False
        failure_reasons.append(f"Insufficient stable frames ({len(valid_hrs)} < 5)")
    if ref_hr is None or ref_rr is None:
        valid = False
        failure_reasons.append("Missing ground-truth reference values")

    failure_reason = "; ".join(failure_reasons) if failure_reasons else ""
    duration = round(time.time() - session["created_at"], 1)

    session_record = {
        "session_id": f"REC-REMOTE-{int(time.time())}",
        "participant_id": session["participant_id"],
        "session_type": "remote_webrtc",
        "age": age,
        "gender": "Unknown",
        "condition": condition,
        "lighting": session["lighting"],
        "camera_device": "Mobile Browser (WebRTC)",
        "resolution": "WebRTC VideoStream",
        "duration_sec": duration,
        "ref_hr_bpm": ref_hr,
        "ref_hr_method": req.ref_hr_method or "Pulse Oximeter / Smartwatch",
        "est_hr_bpm": est_hr,
        "ref_rr_rpm": ref_rr,
        "ref_rr_method": req.ref_rr_method or "Guided Timer Count (60s)",
        "est_rr_rpm": est_rr,
        "valid": valid,
        "failure_reason": failure_reason,
        "avg_snr_db": avg_snr,
        "face_detection_rate": face_det_rate,
        "total_frames": session["total_frames"],
        "valid_hr_frames": len(valid_hrs),
        "valid_rr_frames": len(valid_rrs),
        "client_ip_hash": session.get("client_host", "remote"),
        "notes": notes
    }

    saved_record = log_real_research_session(session_record)
    del remote_research_sessions[req.session_token]

    return {
        "status": "saved",
        "record": saved_record,
        "message": "Research session successfully recorded." if valid else f"Session logged as INVALID: {failure_reason}"
    }

# ---------------------------------------------------------
# RESEARCH METRICS & RECORDS APIS
# ---------------------------------------------------------
@app.get("/api/research/metrics")
def get_research_metrics():
    return calculate_real_study_statistics(print_report=False)

@app.get("/api/research/records")
def get_research_records():
    records = []
    if os.path.exists(REAL_STUDY_FILE):
        try:
            with open(REAL_STUDY_FILE, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    records.append(row)
        except Exception as e:
            print(f"Error reading {REAL_STUDY_FILE}:", e)
    return records

# ---------------------------------------------------------
# REST API (Local Hospital Ward Bed Management)
# ---------------------------------------------------------
active_beds_set = set()

@app.get("/api/beds/active")
def get_active_beds():
    return list(active_beds_set)

@app.post("/api/beds/add")
def add_bed():
    for i in range(1, 5):
        if i not in active_beds_set:
            active_beds_set.add(i)
            return {"bed_id": i}
    return {"error": "Maximum beds reached"}

@app.delete("/api/beds/remove/{bed_id}")
async def remove_bed(bed_id: int):
    if bed_id in active_beds_set:
        active_beds_set.remove(bed_id)
    if bed_id in beds_state:
        del beds_state[bed_id]
    await manager.broadcast_to_dashboards(manager.get_all_beds_list())
    return {"status": "removed"}

@app.get("/history")
def get_history():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT timestamp, bed_id, hr, mews, status FROM alerts ORDER BY id DESC LIMIT 20")
    rows = c.fetchall()
    conn.close()
    
    result = []
    for r in rows:
        result.append({
            "timestamp": r[0],
            "bed_id": r[1],
            "hr": r[2],
            "mews": r[3],
            "status": r[4]
        })
    return result

# ---------------------------------------------------------
# WEBSOCKET ENDPOINTS
# ---------------------------------------------------------
@app.websocket("/ws/camera")
async def camera_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("[SERVER] Camera connected!")
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            
            updates = payload if isinstance(payload, list) else [payload]
            
            for bed in updates:
                bid = bed.get("bed_id")
                if bid is not None:
                    if bid not in beds_state:
                        bed["hr_history"] = []
                    else:
                        bed["hr_history"] = beds_state[bid].get("hr_history", [])
                    
                    if bed.get("hr", 0) > 0:
                        bed["hr_history"].append({"time": time.time(), "hr": bed["hr"]})
                        if len(bed["hr_history"]) > 30:
                            bed["hr_history"].pop(0)

                    beds_state[bid] = bed
                    
                    mews = bed.get("mews", 0)
                    if mews >= 5:
                        now = time.time()
                        last_log = last_logged_time.get(bid, 0)
                        if now - last_log > 60:
                            log_critical_alert(bid, bed.get("hr"), mews, bed.get("status"))
                            last_logged_time[bid] = now

            await manager.broadcast_to_dashboards(manager.get_all_beds_list())

    except WebSocketDisconnect:
        print("[SERVER] Camera disconnected.")
    except Exception as e:
        print(f"[SERVER] Error handling camera data: {e}")

@app.websocket("/ws/dashboard")
async def dashboard_endpoint(websocket: WebSocket):
    await manager.connect_dashboard(websocket)
    print("[SERVER] Dashboard connected.")
    try:
        while True:
            _ = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_dashboard(websocket)

if __name__ == "__main__":
    print("Starting CORVITX-AI Backend Server on port 8000...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
