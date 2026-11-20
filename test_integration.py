import os
import sys
from fastapi.testclient import TestClient

# Ensure current dir is in sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "backend")))

from backend.server import app
from study_data_manager import (
    log_real_research_session,
    calculate_real_study_statistics,
    REAL_STUDY_FILE,
    RESEARCH_SCHEMA_HEADERS
)

client = TestClient(app)

def test_participant_html_served():
    """Verify participant portal page is reachable."""
    resp = client.get("/participant")
    assert resp.status_code == 200
    assert "CORVITX-AI" in resp.text
    assert "Research Participant Portal" in resp.text
    assert "face-guide-oval" in resp.text

def test_research_session_lifecycle():
    """Test full session lifecycle via API."""
    # 1. Create Session
    create_payload = {
        "condition": "Resting",
        "age": 22,
        "lighting": "Indoor LED",
        "notes": "Automated Integration Test Session",
        "consent": True
    }
    resp = client.post("/api/webrtc/session/create", json=create_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "session_token" in data
    assert "participant_id" in data
    token = data["session_token"]

    # 2. Status Check
    st_resp = client.get(f"/api/webrtc/session/{token}/status")
    assert st_resp.status_code == 200
    st_data = st_resp.json()
    assert st_data["participant_id"] == data["participant_id"]

    # 3. Finalize Session (Simulate reference inputs & signal results)
    fin_payload = {
        "session_token": token,
        "ref_hr": 72.0,
        "ref_hr_method": "Pulse Oximeter",
        "ref_rr": 16.0,
        "ref_rr_method": "Manual Guided Count",
        "age": 22,
        "condition": "Resting",
        "notes": "Integration test finish"
    }
    fin_resp = client.post("/api/webrtc/session/finalize", json=fin_payload)
    assert fin_resp.status_code == 200
    fin_data = fin_resp.json()
    assert fin_data["status"] == "saved"
    record = fin_data["record"]

    # In integration test with no video track sent, valid must be False, NOT fabricated or copied!
    assert record["HR_Estimated_BPM"] is None or record["HR_Estimated_BPM"] == ""
    assert record["Valid_Session"] is False or record["Valid_Session"] == "False"
    assert "No valid HR rPPG signals" in record["Failure_Reason"]
    print("\n[VERIFIED] Empty stream logged as INVALID without reference substitution.")

def test_research_metrics_api():
    """Test metrics calculation and CSV retrieval API."""
    m_resp = client.get("/api/research/metrics")
    assert m_resp.status_code == 200
    metrics = m_resp.json()
    assert "total_attempted_sessions" in metrics
    assert "valid_paired_sessions" in metrics

    r_resp = client.get("/api/research/records")
    assert r_resp.status_code == 200
    records = r_resp.json()
    assert isinstance(records, list)

def test_strict_no_reference_substitution():
    """Ensure that if est_hr or est_rr is missing, reference value is NEVER substituted."""
    dummy_session = {
        "session_id": "TEST-NO-SUB-01",
        "participant_id": "P-TEST",
        "session_type": "unit_test",
        "age": 20,
        "condition": "Resting",
        "lighting": "Indoor",
        "camera_device": "TestCam",
        "duration_sec": 30.0,
        "ref_hr_bpm": 75.0,
        "ref_hr_method": "PulseOx",
        "est_hr_bpm": None, # Missing!
        "ref_rr_rpm": 15.0,
        "ref_rr_method": "Manual",
        "est_rr_rpm": None, # Missing!
        "valid": False,
        "failure_reason": "Simulated signal drop",
        "avg_snr_db": 0.5,
        "face_detection_rate": 0.1,
        "total_frames": 900,
        "valid_hr_frames": 0,
        "valid_rr_frames": 0,
        "notes": "Integrity unit test"
    }
    res = log_real_research_session(dummy_session)
    # Check that est_hr is NOT 75.0 and est_rr is NOT 15.0
    assert res["HR_Estimated_BPM"] is None
    assert res["RR_Estimated_RPM"] is None
    assert res["HR_Abs_Error"] is None
    assert res["RR_Abs_Error"] is None
    assert res["Valid_Session"] is False
    print("[VERIFIED] Strict data integrity: No reference substitution occurred!")

if __name__ == "__main__":
    test_participant_html_served()
    test_research_session_lifecycle()
    test_research_metrics_api()
    test_strict_no_reference_substitution()
    print("\nALL INTEGRATION TESTS PASSED!")
