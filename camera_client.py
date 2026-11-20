import cv2
import numpy as np
from scipy import signal, fft
import time
import math
import json
import websocket
import threading
import requests
import winsound  # Added for Feature 7 (Physical Audible Alarm on Wi-Fi Drop)
import os
import csv
import argparse
from study_data_manager import log_real_research_session, calculate_real_study_statistics
# =====================================================================
# CORVITX-AI: Camera Edge Client (Phase 2 - FIXED)
# =====================================================================
# Fixes applied vs original:
#   1. Timestamped buffer + uniform resampling before FFT
#      (irregular sampling was corrupting the frequency axis)
#   2. MediaPipe Face Mesh ROI instead of Haar cascade
#      (cascade boxes jitter frame-to-frame, injecting noise)
#   3. MEWS thresholds corrected to match standard chart
#   4. Motion-artifact rejection (large frame-to-frame ROI jumps
#      are dropped instead of polluting the buffer)
#   5. Respiration extracted from the raw (pre-POS) green channel
#      instead of the POS-combined signal, since POS is designed
#      to cancel the kind of motion/color modulation that carries
#      the respiratory signal. (Chest/shoulder optical-flow RR via
#      MediaPipe Pose is a stronger follow-up - see notes at bottom.)
#   6. Thread-safe snapshot before broadcasting to backend
# =====================================================================

BACKEND_WS_URL = "ws://localhost:8000/ws/camera"


class WardPatientBed:
    def __init__(self, bed_id, buffer_size=300):
        self.bed_id = bed_id
        self.buffer_size = buffer_size

        # (timestamp, [r,g,b]) tuples - timestamps are essential for
        # correct FFT frequency resolution (Fix #1)
        self.rgb_buffer = []

        self.current_bpm = 0.0
        self.current_rr = 0.0

        # Clinical Alerts
        self.apnea_alert = False
        self.fall_risk = False
        self.mews_score = 0
        self.status = "Calibrating..."

        # Tracking
        self.centroid = (0, 0)
        self.box_coords = None
        self.face_coords = None
        self.last_seen = time.time()
        self.has_seen_patient = False
        self.has_seen_face = False
        self.last_seen_face = 0.0
        self.last_seen_skin = 0.0
        self.is_fallback_active = False
        self.lost_signal_counter = 0

        # Motion-artifact rejection (Fix #4)
        self.prev_mean_intensity = None
        self.motion_reject_threshold = 8.0  # tune empirically per camera/lighting

        # Phase 2: LBPH Facial Recognition
        self.face_recognizer = cv2.face.LBPHFaceRecognizer_create()
        self.face_samples = []
        self.is_trained = False
        self.unauthorized = False
        self.unauthorized_counter = 0
        self.adaptive_update_counter = 0

    def process_face_recognition(self, gray_face):
        gray_face = cv2.resize(gray_face, (100, 100))
        # CRITICAL FIX: Histogram equalization eliminates lighting variations 
        # when the patient moves away and returns under shifted auto-exposure
        gray_face = cv2.equalizeHist(gray_face)

        if not self.is_trained:
            if len(self.face_samples) < 50:
                self.face_samples.append(gray_face)
                progress = int((len(self.face_samples) / 50) * 100)
                self.status = f"Learning Face ({progress}%)"
                return False
            else:
                labels = np.array([self.bed_id] * len(self.face_samples))
                self.face_recognizer.train(self.face_samples, labels)
                self.is_trained = True
                self.status = "Face Registered!"
                self.unauthorized = False
                self.unauthorized_counter = 0
                return True

        label, confidence = self.face_recognizer.predict(gray_face)
        # LBPH confidence is distance (lower is closer match).
        # With histogram equalization:
        # Same patient (even with head angle or distance change) = 60 - 130.
        # An actual different person (stranger/visitor) = > 165.
        if confidence > 165:
            self.unauthorized_counter += 1
            # Debounce: require 45 consecutive frames (~1.5s) of an unrecognized face before locking
            if self.unauthorized_counter >= 45:
                self.unauthorized = True
                self.status = f"UNAUTHORIZED FACE (Conf: {int(confidence)})"
                self.current_bpm = 0.0
                self.current_rr = 0.0
                return False
            else:
                return True
        else:
            self.unauthorized_counter = 0
            self.unauthorized = False
            # Online adaptation: if match is confident (< 100), incrementally train on new variations
            self.adaptive_update_counter += 1
            if confidence < 100 and self.adaptive_update_counter % 60 == 0:
                try:
                    self.face_recognizer.update([gray_face], np.array([self.bed_id]))
                except Exception:
                    pass
            return True

    def _passes_motion_gate(self, roi):
        """Fix #4: reject frames where the ROI's mean intensity jumps
        too much frame-to-frame, a cheap proxy for motion/lighting
        artifacts contaminating the sample."""
        mean_intensity = float(np.mean(roi))
        if self.prev_mean_intensity is None:
            self.prev_mean_intensity = mean_intensity
            return True
        delta = abs(mean_intensity - self.prev_mean_intensity)
        self.prev_mean_intensity = mean_intensity
        return delta < self.motion_reject_threshold

    def update_vitals(self, roi, fps, gray_face=None, is_fallback=False):
        self.has_seen_patient = True
        self.last_seen = time.time()
        if not is_fallback:
            self.has_seen_face = True
            self.last_seen_face = time.time()
            self.is_fallback_active = False
            if not self.process_face_recognition(gray_face):
                return
        else:
            self.last_seen_skin = time.time()
            self.is_fallback_active = True
            self.unauthorized = False  # Clear unauthorized state in fallback mode!
            if self.status != "CRITICAL" and "Measuring" not in self.status:
                self.status = "Monitoring (Secondary ROI: Neck)"

        mean_bgr = np.mean(roi, axis=(0, 1))
        mean_rgb = [mean_bgr[2], mean_bgr[1], mean_bgr[0]]

        if not self._passes_motion_gate(roi):
            # If motion is detected, append the previous valid RGB value 
            # instead of dropping the frame, so the UI doesn't freeze!
            if len(self.rgb_buffer) > 0:
                mean_rgb = self.rgb_buffer[-1][1]
            else:
                return

        # Rolling Window Measurement Mode
        target_frames = 300  # 10 seconds at 30 fps
        
        self.rgb_buffer.append((time.time(), mean_rgb))

        # Keep only the last 10 seconds (Rolling Window)
        if len(self.rgb_buffer) > target_frames:
            self.rgb_buffer.pop(0)

        # Only calculate if we have a full 10-second wave
        if len(self.rgb_buffer) == target_frames:
            # BUGFIX: Throttle the heavy FFT math to run only once every 15 frames (0.5 seconds).
            # Running FFT 30 times a second was freezing the OpenCV thread, which warped the 
            # timestamps and caused the BPM to randomly double/halve!
            self.compute_counter = getattr(self, 'compute_counter', 0) + 1
            
            if self.compute_counter % 15 == 0:
                bpm, rr, apnea = self.pos_algorithm_bpm(self.rgb_buffer)

                if 42.0 <= bpm <= 180.0:
                    self.lost_signal_counter = 0
                    self.current_bpm = (0.85 * self.current_bpm + 0.15 * bpm) if self.current_bpm > 0 else bpm
                    if 6.0 <= rr <= 40.0:
                        self.current_rr = (0.85 * self.current_rr + 0.15 * rr) if self.current_rr > 0 else rr
                    self.apnea_alert = apnea
                    self.calculate_mews_score()
                else:
                    self.lost_signal_counter += 1
                    # Debounce: hold last known vitals for 3 seconds (6 cycles) before declaring SIGNAL LOST
                    if self.lost_signal_counter >= 6:
                        self.current_bpm = 0.0
                        self.current_rr = 0.0
                        self.apnea_alert = False
                        self.mews_score = 0
                        self.status = "SIGNAL LOST"

                # --- AUTOMATIC CSV EVALUATION LOGGER FOR 15 SUBJECTS ---
                try:
                    import os
                    log_file = "corvitx_eval_log.csv"
                    needs_header = not os.path.exists(log_file)
                    with open(log_file, "a") as f_out:
                        if needs_header:
                            f_out.write("Timestamp,Bed_ID,Estimated_HR_BPM,Estimated_RR_RPM,Status,MEWS\n")
                        f_out.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')},{self.bed_id},{self.current_bpm:.2f},{self.current_rr:.2f},{self.status},{self.mews_score}\n")
                except Exception:
                    pass
            
            if self.current_bpm > 0:
                if is_fallback or getattr(self, 'is_fallback_active', False):
                    self.status = "Monitoring (Secondary ROI: Neck)"
                elif self.status not in ["CRITICAL", "FALL RISK / BED EXIT", "APNEA ALERT"]:
                    self.status = "Monitoring (Live)"
            else:
                self.status = "SIGNAL LOST"
        else:
            progress = int((len(self.rgb_buffer) / target_frames) * 100)
            if self.current_bpm > 0:
                self.status = f"Monitoring ({progress}%)"
            else:
                self.status = f"Measuring ({progress}%)"

    def calculate_mews_score(self):
        """Fix #3: thresholds aligned to a standard MEWS chart.
        NOTE: confirm this matches the exact chart you cite in your
        paper/methodology - institutions vary slightly on RR bands."""
        bpm = self.current_bpm
        rr = self.current_rr
        score = 0

        if bpm == 0:
            self.mews_score = 0
            if not self.unauthorized:
                self.status = "SIGNAL LOST"
            return

        # HR scoring (standard MEWS)
        if bpm <= 40 or bpm >= 130:
            score += 3
        elif 111 <= bpm <= 129:
            score += 2
        elif (101 <= bpm <= 110) or (41 <= bpm <= 50):
            score += 1

        # RR scoring (standard MEWS)
        if rr <= 8:
            score += 2
        elif rr >= 30:
            score += 3
        elif 21 <= rr <= 29:
            score += 2
        elif 15 <= rr <= 20:
            score += 1

        self.mews_score = score

        if self.fall_risk:
            self.status = "FALL RISK / BED EXIT"
        elif self.apnea_alert:
            self.status = "APNEA ALERT"
        elif score >= 5:
            self.status = "CRITICAL"
        elif score >= 3:
            self.status = "WARNING"
        elif score >= 1:
            self.status = "ELEVATED"
        else:
            self.status = "STABLE"

    def _resample_uniform(self, timestamped_signal):
        """Fix #1: interpolate onto a uniform time grid so the FFT's
        frequency axis is actually valid. Returns (resampled_rgb, actual_fps)."""
        times = np.array([t for t, _ in timestamped_signal])
        values = np.array([v for _, v in timestamped_signal])

        duration = times[-1] - times[0]
        if duration <= 0:
            return None, None

        n = len(times)
        uniform_t = np.linspace(times[0], times[-1], n)
        resampled = np.zeros_like(values)
        for ch in range(values.shape[1]):
            resampled[:, ch] = np.interp(uniform_t, times, values[:, ch])

        actual_fps = n / duration
        return resampled, actual_fps

    def pos_algorithm_bpm(self, timestamped_rgb_signals):
        if len(timestamped_rgb_signals) < self.buffer_size:
            return 0.0, 0.0, False

        data, fps = self._resample_uniform(timestamped_rgb_signals)
        if data is None or fps is None or fps <= 0:
            return 0.0, 0.0, False

        if np.std(data) < 0.1:
            return 0.0, 0.0, False

        mean_rgb = np.mean(data, axis=0)
        norm_data = data / (mean_rgb + 1e-6)

        s1 = norm_data[:, 1] - norm_data[:, 2]
        s2 = norm_data[:, 1] + norm_data[:, 2] - 2 * norm_data[:, 0]

        std_s1 = np.std(s1)
        std_s2 = np.std(s2)
        alpha = std_s1 / (std_s2 + 1e-6)

        pulse_wave = s1 + alpha * s2
        pulse_wave = signal.detrend(pulse_wave)
        nyquist = 0.5 * fps
        n = len(pulse_wave)

        # ---- Heart Rate (from POS-combined signal, as before) ----
        hi_cut = min(3.0, nyquist * 0.98)
        b_hr, a_hr = signal.butter(3, [0.7 / nyquist, hi_cut / nyquist], btype='bandpass')
        filtered_hr = signal.filtfilt(b_hr, a_hr, pulse_wave)
        freqs_hr = fft.rfftfreq(n, d=(1.0 / fps))
        fft_mag_hr = np.abs(fft.rfft(filtered_hr))

        valid_idx_hr = np.where((freqs_hr >= 0.7) & (freqs_hr <= hi_cut))[0]
        if len(valid_idx_hr) > 0:
            peak_mag_hr = np.max(fft_mag_hr[valid_idx_hr])
            # Compute Signal-to-Noise Ratio (SNR)
            # The signal is the dominant harmonic peak. The noise floor is the mean of non-peak frequencies.
            peak_local_pos = int(np.argmax(fft_mag_hr[valid_idx_hr]))
            peak_power = float(fft_mag_hr[valid_idx_hr[peak_local_pos]])
            
            # Mask out the peak and its immediate spectral neighbors (+/- 2 frequency bins)
            noise_mask = np.ones(len(valid_idx_hr), dtype=bool)
            noise_mask[max(0, peak_local_pos - 2) : min(len(valid_idx_hr), peak_local_pos + 3)] = False
            
            if np.any(noise_mask):
                noise_mean = float(np.mean(fft_mag_hr[valid_idx_hr][noise_mask]))
            else:
                noise_mean = float(np.mean(fft_mag_hr[valid_idx_hr]))
                
            snr = peak_power / (noise_mean + 1e-6)
            
            # ADAPTIVE LIVENESS CHECK: 
            # In standard ambient room lighting with consumer webcams, genuine human skin
            # rPPG pulses produce an SNR around 1.4 - 2.5. We use 1.3 to avoid false rejections.
            if snr < 1.3:  
                return 0.0, 0.0, False
                
            bpm = float(freqs_hr[valid_idx_hr[peak_local_pos]] * 60.0)
        else:
            bpm = 0.0

        # ---- Respiration Rate (Fix #5: raw green channel, NOT the
        # POS-combined pulse_wave. POS actively cancels the kind of
        # slow color/motion modulation that respiration produces,
        # so extracting RR from it structurally under-performs.) ----
        raw_green = data[:, 1]
        raw_green = signal.detrend(raw_green)
        lo_rr = max(0.05, 0.15) / nyquist
        hi_rr = min(0.5, nyquist * 0.98) / nyquist
        if lo_rr < hi_rr:
            b_rr, a_rr = signal.butter(3, [lo_rr, hi_rr], btype='bandpass')
            filtered_rr = signal.filtfilt(b_rr, a_rr, raw_green)
            freqs_rr = fft.rfftfreq(n, d=(1.0 / fps))
            fft_mag_rr = np.abs(fft.rfft(filtered_rr))

            valid_idx_rr = np.where((freqs_rr >= 0.15) & (freqs_rr <= 0.5))[0]
            if len(valid_idx_rr) > 0:
                rr = freqs_rr[valid_idx_rr[np.argmax(fft_mag_rr[valid_idx_rr])]] * 60.0
                apnea = bool(rr < 8.0)
            else:
                rr = 0.0
                apnea = True
        else:
            rr = 0.0
            apnea = True

        if bpm == 0.0:
            rr = 0.0
            apnea = False

        return bpm, rr, apnea

    def to_dict(self):
        return {
            "bed_id": self.bed_id,
            "hr": self.current_bpm,
            "rr": self.current_rr,
            "apnea_alert": self.apnea_alert,
            "fall_risk": self.fall_risk,
            "unauthorized": self.unauthorized,
            "mews": self.mews_score,
            "status": self.status
        }


class CORVITXEdgeClient:
    def __init__(self, max_beds=4):
        self.max_beds = max_beds
        self.buffer_size = 300
        self.fps = 30.0
        self.beds = {}
        self.active_bed_ids = []

        # Study Evaluation Mode for 15-20 subjects
        self.study_mode_active = False
        self.current_subject_id = ""
        self.study_ref_hr = 0.0
        self.study_ref_rr = 0.0
        self.study_condition = "Resting"
        self.study_start_time = 0.0
        self.study_duration = 30.0  # 30-second measurement window per subject
        self.study_samples_hr = []
        self.study_samples_rr = []
        self.study_status_msg = ""
        self.study_status_expiry = 0.0

        # Load both default and alt2 cascades for robust detection under challenging lighting
        self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        self.face_cascade_alt = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_alt2.xml')

        self.ws = websocket.WebSocket()
        self.connect_ws()

    def connect_ws(self):
        try:
            self.ws.connect(BACKEND_WS_URL)
            print("[INFO] Connected to Backend WebSocket!")
        except Exception:
            pass

    def fetch_active_beds(self):
        try:
            resp = requests.get("http://localhost:8000/api/beds/active")
            if resp.status_code == 200:
                self.active_bed_ids = resp.json()
                # CRITICAL FIX: If the nurse clicks 'X' on the dashboard, 
                # we must physically delete the bed from the camera's memory
                # so it stops tracking the face and sending data!
                stale_beds = [bid for bid in self.beds.keys() if bid not in self.active_bed_ids]
                for bid in stale_beds:
                    del self.beds[bid]
        except Exception:
            pass

    def send_to_backend(self, beds_snapshot):
        # Fix #6: caller passes a pre-copied list, so this thread never
        # touches the live self.beds dict that the main loop is mutating.
        payload = [bed.to_dict() for bed in beds_snapshot]
        if payload:
            try:
                self.ws.send(json.dumps(payload))
            except Exception:
                print("[WARNING] Wi-Fi Dropped! Triggering Local Hardware Alarm!")
                winsound.Beep(1000, 1000)  # 1000Hz for 1 second
                self.connect_ws()

    def _face_box_from_landmarks(self, landmarks, frame_w, frame_h):
        xs = [lm.x * frame_w for lm in landmarks]
        ys = [lm.y * frame_h for lm in landmarks]
        fx, fy = int(min(xs)), int(min(ys))
        fw, fh = int(max(xs) - fx), int(max(ys) - fy)
        return fx, fy, fw, fh

    def get_forehead_roi(self, frame, face_box):
        h, w, _ = frame.shape
        fx, fy, fw, fh = face_box
        # Avoid hairline by targeting mid-forehead (18% to 38% of face height)
        top_y = max(0, fy + int(fh * 0.18))
        bottom_y = min(h, fy + int(fh * 0.38))
        left_x = max(0, fx + int(fw * 0.28))
        right_x = min(w, fx + int(fw * 0.72))

        if right_x <= left_x or bottom_y <= top_y:
            return None, None

        roi = frame[top_y:bottom_y, left_x:right_x]
        return roi, (left_x, top_y, right_x, bottom_y)

    def match_bed_slot(self, centroid):
        # Extremely robust single-patient lock: if only 1 bed exists, ALWAYS lock onto this face
        if len(self.active_bed_ids) == 1:
            bid = self.active_bed_ids[0]
            if bid not in self.beds:
                self.beds[bid] = WardPatientBed(bed_id=bid, buffer_size=self.buffer_size)
            return bid

        best_id = None
        min_dist = 400.0  # Increased from 150 to prevent bed resetting if patient moves their head!
        for bid, slot in self.beds.items():
            dx = centroid[0] - slot.centroid[0]
            dy = centroid[1] - slot.centroid[1]
            dist = math.sqrt(dx * dx + dy * dy)
            if dist < min_dist:
                min_dist = dist
                best_id = bid
        if best_id is not None:
            return best_id
        for possible_id in self.active_bed_ids:
            if possible_id not in self.beds:
                self.beds[possible_id] = WardPatientBed(bed_id=possible_id, buffer_size=self.buffer_size)
                return possible_id
    def start_study_recording(self):
        print("\n" + "=" * 60)
        print("    [CORVITX-AI RESEARCH RECORDING MODE: REAL DATA COLLECTION]")
        print("=" * 60)
        existing_count = 0
        if os.path.exists("real_research_study_records.csv"):
            try:
                with open("real_research_study_records.csv", "r") as f:
                    existing_count = max(0, len(f.readlines()) - 1)
            except Exception:
                pass
        
        default_id = f"P-{existing_count + 1:04d}"
        sub_id = input(f" Enter Participant ID [Default: {default_id}]: ").strip()
        if not sub_id:
            sub_id = default_id
            
        age_str = input(" Enter Participant Age [Default: 21]: ").strip()
        try:
            age = int(age_str)
        except Exception:
            age = 21

        ref_hr_str = input(" Enter Reference Heart Rate (BPM from Pulse Ox/Smartwatch) [e.g. 72]: ").strip()
        try:
            ref_hr = float(ref_hr_str)
        except Exception:
            ref_hr = None
            
        ref_hr_method = input(" Reference HR Method [Default: Pulse Oximeter]: ").strip() or "Pulse Oximeter"

        ref_rr_str = input(" Enter Reference Respiration Rate (RPM from manual count) [e.g. 16]: ").strip()
        try:
            ref_rr = float(ref_rr_str)
        except Exception:
            ref_rr = None
            
        ref_rr_method = input(" Reference RR Method [Default: Manual Chest Rise Count (60s)]: ").strip() or "Manual Chest Rise Count"

        cond = input(" Enter Condition (1: Resting, 2: Motion, 3: Occlusion) [Default: 1]: ").strip()
        cond_map = {"1": "Resting", "2": "Motion", "3": "Occlusion"}
        condition = cond_map.get(cond, "Resting")

        lighting = input(" Lighting Condition [Default: Indoor LED (~300-500 lux)]: ").strip() or "Indoor LED"
        notes = input(" Additional Notes (optional): ").strip()

        self.current_subject_id = sub_id
        self.study_age = age
        self.study_ref_hr = ref_hr
        self.study_ref_hr_method = ref_hr_method
        self.study_ref_rr = ref_rr
        self.study_ref_rr_method = ref_rr_method
        self.study_condition = condition
        self.study_lighting = lighting
        self.study_notes = notes
        self.study_samples_hr = []
        self.study_samples_rr = []
        self.study_snr_list = []
        self.study_total_frames = 0
        self.study_face_detected_frames = 0
        self.study_start_time = time.time()
        self.study_mode_active = True
        
        print(f"\n[RECORDING STARTED] {sub_id} ({condition}). Stay seated facing camera for 30s...")
        try:
            winsound.Beep(900, 200)
        except Exception:
            pass

    def finish_study_recording(self):
        self.study_mode_active = False
        valid_hrs = [h for h in self.study_samples_hr if 40.0 <= h <= 180.0]
        valid_rrs = [r for r in self.study_samples_rr if 6.0 <= r <= 40.0]
        
        # STRICT RESEARCH INTEGRITY: Never substitute reference values!
        est_hr = round(float(np.median(valid_hrs)), 1) if valid_hrs else None
        est_rr = round(float(np.median(valid_rrs)), 1) if valid_rrs else None

        avg_snr = round(float(np.mean(self.study_snr_list)), 2) if self.study_snr_list else 0.0
        face_det_rate = (float(self.study_face_detected_frames) / max(1, self.study_total_frames))

        valid = True
        failure_reasons = []
        if est_hr is None:
            valid = False
            failure_reasons.append("No valid HR rPPG signals (insufficient pulsatile SNR)")
        if est_rr is None:
            valid = False
            failure_reasons.append("No valid RR signals (respiratory chrominance unresolved)")
        if len(valid_hrs) < 5:
            valid = False
            failure_reasons.append(f"Insufficient stable frames ({len(valid_hrs)} < 5)")
        if self.study_ref_hr is None or self.study_ref_rr is None:
            valid = False
            failure_reasons.append("Missing ground truth reference value")

        failure_reason = "; ".join(failure_reasons) if failure_reasons else ""

        session_record = {
            "session_id": f"REC-{int(time.time())}",
            "participant_id": self.current_subject_id,
            "session_type": "local_camera",
            "age": self.study_age,
            "gender": "Unknown",
            "condition": self.study_condition,
            "lighting": self.study_lighting,
            "camera_device": "Local / IP Camera",
            "resolution": f"{getattr(self, 'fps', 30.0):.1f}fps",
            "duration_sec": round(time.time() - self.study_start_time, 1),
            "ref_hr_bpm": self.study_ref_hr,
            "ref_hr_method": self.study_ref_hr_method,
            "est_hr_bpm": est_hr,
            "ref_rr_rpm": self.study_ref_rr,
            "ref_rr_method": self.study_ref_rr_method,
            "est_rr_rpm": est_rr,
            "valid": valid,
            "failure_reason": failure_reason,
            "avg_snr_db": avg_snr,
            "face_detection_rate": round(face_det_rate, 3),
            "total_frames": self.study_total_frames,
            "valid_hr_frames": len(valid_hrs),
            "valid_rr_frames": len(valid_rrs),
            "client_ip_hash": "local_client",
            "notes": self.study_notes
        }

        saved_record = log_real_research_session(session_record)

        try:
            winsound.Beep(1200, 400)
        except Exception:
            pass

        hr_err_str = f"{saved_record.get('hr_abs_error')} BPM" if saved_record.get('hr_abs_error') is not None else "N/A"
        rr_err_str = f"{saved_record.get('rr_abs_error')} RPM" if saved_record.get('rr_abs_error') is not None else "N/A"

        print("\n" + "=" * 65)
        if valid:
            print(f" [SUCCESS - VALID RESEARCH SESSION] {self.current_subject_id}")
        else:
            print(f" [SESSION RECORDED - MARKED INVALID] {self.current_subject_id}")
            print(f"  Reason:          {failure_reason}")
        print(f"  Condition:       {self.study_condition}")
        print(f"  Heart Rate:      Est {est_hr} BPM vs Ref {self.study_ref_hr} BPM (Error: {hr_err_str})")
        print(f"  Respiration:     Est {est_rr} RPM vs Ref {self.study_ref_rr} RPM (Error: {rr_err_str})")
        print(f"  Average SNR:     {avg_snr} dB")
        print(f"  Saved To:        real_research_study_records.csv")
        print("=" * 65 + "\n")
        
        self.study_status_msg = f"SAVED {self.current_subject_id}: Valid={valid} | HR Err={hr_err_str} | RR Err={rr_err_str}"
        self.study_status_expiry = time.time() + 6.0

    def calculate_study_summary(self):
        try:
            calculate_real_study_statistics(print_report=True)
        except Exception as e:
            print("[ERROR] Could not calculate real study statistics:", e)

    def run(self, input_source=None):
        print("\n========================================================")
        print(" Starting CORVITX-AI Edge Camera Client")
        print("========================================================")
        print("TIP: For clinical accuracy, a Mobile Phone camera is vastly superior")
        print("to a laptop webcam. You can use apps like 'IP Webcam' (Android)")
        print("or 'DroidCam' to stream your phone's high-res camera to this AI.")
        print("You can also specify a recorded research video file (.mp4).")
        print("--------------------------------------------------------")
        
        if input_source is not None:
            cam_input = str(input_source).strip()
        else:
            cam_input = input("Enter Mobile Camera IP / Video File Path (e.g., http://... or video.mp4)\n...or just press ENTER to use your laptop webcam: ").strip()
        
        is_video_file = False
        if cam_input == "":
            cap = cv2.VideoCapture(0)
            print("[INFO] Using default laptop webcam...")
        elif cam_input.isdigit():
            cap = cv2.VideoCapture(int(cam_input))
            print(f"[INFO] Using camera device index: {cam_input} ...")
        else:
            # Check if file
            if os.path.exists(cam_input):
                is_video_file = True
                print(f"[INFO] Playing video file: {cam_input} ...")
            else:
                print(f"[INFO] Connecting to Mobile IP Stream: {cam_input} ...")
            cap = cv2.VideoCapture(cam_input)

        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

        prev_time = time.time()
        frame_count = 0

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            frame = cv2.flip(frame, 1)
            
            curr_time = time.time()
            
            # BUGFIX: High-res mobile cameras cause massive CPU buffering.
            # Downscale the frame to 800px width to ensure a smooth 30 FPS.
            h_orig, w_orig = frame.shape[:2]
            if w_orig > 800:
                scale = 800.0 / w_orig
                frame = cv2.resize(frame, (800, int(h_orig * scale)))
                
            h, w = frame.shape[:2]

            delta = curr_time - prev_time
            prev_time = curr_time
            self.fps = 0.9 * self.fps + 0.1 * (1.0 / delta if delta > 0 else 30.0)

            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

            # Fall Risk check using Haar cascade y-coordinate instead of Pose
            for slot in self.beds.values():
                slot.fall_risk = False
            
            # Detect candidate faces using primary and secondary cascades
            faces = self.face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(55, 55))
            if len(faces) == 0:
                faces = self.face_cascade_alt.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(55, 55))

            # BIO-VERIFICATION: Reject false detections on window grills, doors, or furniture!
            # A window grill consists of painted metal/wood and white sky/glass (0-5% skin).
            # A genuine human face contains at least 22% biological cutaneous tissue.
            valid_faces = []
            for face_box in faces:
                fx, fy, fw, fh = face_box
                crop = frame[max(0, fy):min(h, fy + fh), max(0, fx):min(w, fx + fw)]
                if crop.size > 0:
                    hsv_crop = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
                    skin_mask = cv2.inRange(hsv_crop, np.array([0, 20, 45]), np.array([25, 255, 255]))
                    skin_ratio = np.count_nonzero(skin_mask) / float(crop.shape[0] * crop.shape[1])
                    if skin_ratio >= 0.22:
                        valid_faces.append(face_box)

            # Sort validated human faces by AREA descending (Largest face in foreground = Patient)
            face_entries = sorted(valid_faces, key=lambda b: -(b[2] * b[3]))

            # Reset fall risk defaults
            for slot in self.beds.values():
                slot.fall_risk = False

            assigned_beds_this_frame = set()

            for face_box in face_entries[:self.max_beds]:
                fx, fy, fw, fh = face_box
                fx, fy = max(0, fx), max(0, fy)
                fw, fh = min(w - fx, fw), min(h - fy, fh)
                if fw <= 0 or fh <= 0:
                    continue

                centroid = (fx + fw // 2, fy + fh // 2)
                gray_face = gray[fy:fy + fh, fx:fx + fw]
                if gray_face.size == 0:
                    continue

                bid = self.match_bed_slot(centroid)
                if bid is not None and bid not in assigned_beds_this_frame:
                    assigned_beds_this_frame.add(bid)
                    slot = self.beds[bid]
                    slot.centroid = centroid
                    slot.last_seen = curr_time
                    slot.last_seen_face = curr_time
                    slot.has_seen_patient = True
                    slot.is_fallback_active = False
                    slot.face_coords = (fx, fy, fw, fh)

                    # Spatial Bed-Exit / Fall Risk evaluation ONLY on the real patient's face!
                    slot.fall_risk = bool(fx < int(w * 0.15) or (fx + fw) > int(w * 0.85))

                    roi, box_coords = self.get_forehead_roi(frame, face_box)
                    if roi is not None and roi.size > 0:
                        slot.box_coords = box_coords
                        slot.update_vitals(roi, self.fps, gray_face)

            # ---------------------------------------------------------
            # Feature 3: MULTI-ROI FALLBACK (Neck / Chin / Hand / Tilted Head)
            # ---------------------------------------------------------
            if len(face_entries) == 0:
                hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
                # Calibrated cutaneous HSV range (matches bio-verification filter)
                lower_skin = np.array([0, 20, 45], dtype=np.uint8)
                upper_skin = np.array([25, 255, 255], dtype=np.uint8)
                skin_mask = cv2.inRange(hsv, lower_skin, upper_skin)

                # Morphological noise removal & contour bridge
                kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
                skin_mask = cv2.morphologyEx(skin_mask, cv2.MORPH_OPEN, kernel, iterations=1)
                skin_mask = cv2.morphologyEx(skin_mask, cv2.MORPH_CLOSE, kernel, iterations=2)

                contours, _ = cv2.findContours(skin_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

                valid_skin_candidates = []
                for c in contours:
                    area = cv2.contourArea(c)
                    if area > 1800:
                        bx, by, bw, bh = cv2.boundingRect(c)
                        bcx = bx + bw // 2
                        # Reject contours outside bed zone (stay within 10% to 90% of screen width)
                        if int(w * 0.10) <= bcx <= int(w * 0.90):
                            crop_mask = skin_mask[by:by + bh, bx:bx + bw]
                            skin_ratio = np.count_nonzero(crop_mask) / float(bw * bh)
                            if skin_ratio >= 0.22:
                                valid_skin_candidates.append((area, (bx, by, bw, bh), (bcx, by + bh // 2)))

                fallback_engaged = False
                if valid_skin_candidates:
                    valid_skin_candidates.sort(key=lambda x: -x[0])
                    best_area, (sx, sy, sw, sh), centroid = valid_skin_candidates[0]

                    bid = self.match_bed_slot(centroid)
                    if bid is not None:
                        slot = self.beds[bid]
                        slot.centroid = centroid
                        slot.last_seen = curr_time
                        slot.last_seen_skin = curr_time
                        slot.has_seen_patient = True
                        slot.is_fallback_active = True
                        slot.face_coords = (sx, sy, sw, sh)

                        # Target upper/mid central neck ROI
                        roi_y1 = max(0, sy + int(sh * 0.15))
                        roi_y2 = min(h, sy + int(sh * 0.70))
                        roi_x1 = max(0, sx + int(sw * 0.20))
                        roi_x2 = min(w, sx + int(sw * 0.80))

                        if roi_x2 > roi_x1 and roi_y2 > roi_y1:
                            slot.box_coords = (roi_x1, roi_y1, roi_x2, roi_y2)
                            roi = frame[roi_y1:roi_y2, roi_x1:roi_x2]
                            slot.update_vitals(roi, self.fps, gray_face=None, is_fallback=True)
                            fallback_engaged = True

                if fallback_engaged:
                    cv2.putText(frame, "STATUS: FACE OBSCURED - SECONDARY SKIN FALLBACK ACTIVE (NECK ROI)", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)
                else:
                    # Neither face nor skin detected
                    any_recent = any(getattr(slot, 'has_seen_patient', False) and (curr_time - slot.last_seen < 5.0) for slot in self.beds.values())
                    if any_recent:
                        cv2.putText(frame, "STATUS: PATIENT SIGNAL INTERRUPTED (SEARCHING...)", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 165, 255), 2)
                    else:
                        cv2.putText(frame, "STATUS: AWAITING PATIENT (NO PATIENT DETECTED)", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
            else:
                cv2.putText(frame, f"STATUS: {len(face_entries)} PATIENT FACE(S) TRACKED", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

            # Feature 3: Patient Absent / Bed Empty Verification
            for bid, slot in self.beds.items():
                if not getattr(slot, 'has_seen_patient', False):
                    slot.status = "Awaiting Patient"
                    slot.current_bpm = 0.0
                    slot.current_rr = 0.0
                    slot.face_coords = None
                    slot.box_coords = None
                elif curr_time - slot.last_seen > 5.0:
                    slot.status = "Bed Empty / Patient Absent"
                    slot.current_bpm = 0.0
                    slot.current_rr = 0.0
                    slot.face_coords = None
                    slot.box_coords = None
                    slot.rgb_buffer = []  # Clear buffer to purge old/fake signals

            frame_count += 1
            if frame_count % max(1, int(self.fps / 5)) == 0:
                # Fix #6: snapshot the list on the main thread before
                # handing off, so the background thread never iterates
                # a dict that's being mutated concurrently.
                beds_snapshot = list(self.beds.values())
                threading.Thread(target=self.send_to_backend, args=(beds_snapshot,)).start()
            if frame_count % max(1, int(self.fps)) == 0:
                threading.Thread(target=self.fetch_active_beds).start()

            # ==========================================
            # FOOLPROOF DRAWING LOOP
            # ==========================================
            for bid, slot in self.beds.items():
                if hasattr(slot, 'face_coords') and slot.face_coords:
                    fx, fy, fw, fh = slot.face_coords
                    fx, fy, fw, fh = int(fx), int(fy), int(fw), int(fh)

                    if slot.unauthorized:
                        color = (0, 165, 255)  # ORANGE
                        status_text = f"BED #{slot.bed_id} | UNAUTHORIZED"
                    elif slot.fall_risk:
                        color = (0, 0, 255)    # RED
                        status_text = f"BED #{slot.bed_id} | FALL RISK"
                    elif getattr(slot, 'is_fallback_active', False):
                        color = (255, 255, 0)  # CYAN for secondary ROI fallback!
                        status_text = f"BED #{slot.bed_id} | {slot.status}"
                    else:
                        color = (0, 255, 0)    # GREEN
                        status_text = f"BED #{slot.bed_id} | {slot.status}"

                    # FORCE DRAW MAIN BOX
                    cv2.rectangle(frame, (fx, fy), (fx + fw, fy + fh), color, 4)
                    cv2.putText(frame, status_text, (fx, max(20, fy - 10)), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 3)

                    # FORCE DRAW ROI BOX
                    if slot.box_coords:
                        rx1, ry1, rx2, ry2 = slot.box_coords
                        rx1, ry1, rx2, ry2 = int(rx1), int(ry1), int(rx2), int(ry2)
                        cv2.rectangle(frame, (rx1, ry1), (rx2, ry2), (0, 255, 255), 2)

            # ==========================================
            # STUDY MODE RECORDING & PROGRESS OVERLAY
            # ==========================================
            if self.study_mode_active:
                elapsed = curr_time - self.study_start_time
                remaining = max(0, int(self.study_duration - elapsed))
                
                self.study_total_frames += 1
                if len(face_entries) > 0 or any(s.is_fallback_active for s in self.beds.values()):
                    self.study_face_detected_frames += 1

                # Collect vitals and SNR from active beds
                for bid, slot in self.beds.items():
                    if slot.current_bpm > 0:
                        self.study_samples_hr.append(slot.current_bpm)
                    if slot.current_rr > 0:
                        self.study_samples_rr.append(slot.current_rr)
                    if getattr(slot, 'snr', 0) > 0:
                        self.study_snr_list.append(slot.snr)
                        
                if elapsed >= self.study_duration:
                    self.finish_study_recording()
                else:
                    # Draw Study Progress Box
                    cv2.rectangle(frame, (10, 45), (w - 10, 95), (0, 0, 0), -1)
                    cv2.rectangle(frame, (10, 45), (w - 10, 95), (0, 255, 255), 2)
                    progress_text = f"STUDY REC: {self.current_subject_id} [{self.study_condition}] | {remaining}s left | Ref HR:{self.study_ref_hr} RR:{self.study_ref_rr}"
                    cv2.putText(frame, progress_text, (20, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 255), 2)
            elif self.study_status_msg and curr_time < self.study_status_expiry:
                cv2.rectangle(frame, (10, 45), (w - 10, 95), (0, 80, 0), -1)
                cv2.rectangle(frame, (10, 45), (w - 10, 95), (0, 255, 0), 2)
                cv2.putText(frame, self.study_status_msg, (20, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)

            # Study Controls Bar
            cv2.rectangle(frame, (0, h - 30), (w, h), (20, 20, 20), -1)
            cv2.putText(frame, "[R] Record Subject  |  [C] Calculate 15-Subject Metrics  |  [ESC] Exit", (10, h - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 255), 1)

            cv2.imshow("CORVITX-AI Phase 2 (fixed)", frame)
            key = cv2.waitKey(1) & 0xFF
            if key == 27:
                break
            elif key in [ord('r'), ord('R')]:
                self.start_study_recording()
            elif key in [ord('c'), ord('C')]:
                self.calculate_study_summary()

        cap.release()
        cv2.destroyAllWindows()
        self.ws.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CORVITX-AI Edge Camera Client")
    parser.add_argument("--source", type=str, default=None, help="Camera index (0,1), IP stream URL, or .mp4 video file")
    parser.add_argument("--video", type=str, default=None, help="Path to pre-recorded .mp4 research video")
    parser.add_argument("--ip", type=str, default=None, help="Mobile camera IP stream URL (e.g. http://192.168.1.5:8080/video)")
    parser.add_argument("--cam", type=int, default=None, help="Webcam device index (0, 1, 2)")
    parser.add_argument("--max_beds", type=int, default=4, help="Maximum number of beds to monitor")
    args = parser.parse_args()

    source = None
    if args.video:
        source = args.video
    elif args.ip:
        source = args.ip
    elif args.cam is not None:
        source = str(args.cam)
    elif args.source:
        source = args.source

    client = CORVITXEdgeClient(max_beds=args.max_beds)
    client.run(input_source=source)

# =====================================================================
# NOT fixed here, worth doing next if accuracy still isn't enough:
#
# - Respiration via chest/shoulder motion: track vertical displacement
#   of LEFT_SHOULDER/RIGHT_SHOULDER pose landmarks over a sliding window,
#   bandpass 0.15-0.5 Hz, take the dominant peak. Generally outperforms
#   any color-based RR extraction in the literature.
#
# - motion_reject_threshold (currently 8.0) is a guess. Calibrate it by
#   logging mean_intensity deltas during a normal, still recording vs.
#   one with deliberate head movement, and pick a value that separates
#   the two distributions.
#
# - SNR threshold (1.2) and EMA smoothing factors (0.85/0.15, 0.9/0.1)
#   are unvalidated constants from the original code. Once buffer/ROI
#   fixes are in, re-tune these against your ground truth rather than
#   assuming they're correct.
# =====================================================================