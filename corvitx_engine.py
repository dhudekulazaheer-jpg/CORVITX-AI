import os
import cv2
import numpy as np
from scipy import signal, fft
import time
import math

class WardPatientBed:
    """
    Core physiological digital signal processing engine for CORVITX-AI.
    Extracts cardiac pulsatility via Plane-Orthogonal-to-Skin (POS)
    and respiratory dynamics from detrended green chrominance.
    """
    def __init__(self, bed_id, buffer_size=300):
        self.bed_id = bed_id
        self.buffer_size = buffer_size

        # (timestamp, [r, g, b]) tuples
        self.rgb_buffer = []

        self.current_bpm = 0.0
        self.current_rr = 0.0
        self.last_snr = 0.0

        # Clinical Alerts
        self.apnea_alert = False
        self.fall_risk = False
        self.mews_score = 0
        self.status = "Calibrating..."

        # Tracking state
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

        # Motion-artifact rejection gate
        self.prev_mean_intensity = None
        self.motion_reject_threshold = 8.0

        # LBPH Facial Recognition (Identity Locking)
        try:
            self.face_recognizer = cv2.face.LBPHFaceRecognizer_create()
        except Exception:
            self.face_recognizer = None
        self.face_samples = []
        self.is_trained = False
        self.unauthorized = False
        self.unauthorized_counter = 0
        self.adaptive_update_counter = 0
        self.compute_counter = 0

    def process_face_recognition(self, gray_face):
        if gray_face is None or self.face_recognizer is None:
            return True

        gray_face = cv2.resize(gray_face, (100, 100))
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

        try:
            label, confidence = self.face_recognizer.predict(gray_face)
            if confidence > 165:
                self.unauthorized_counter += 1
                if self.unauthorized_counter >= 45:
                    self.unauthorized = True
                    self.status = f"UNAUTHORIZED FACE (Conf: {int(confidence)})"
                    self.current_bpm = 0.0
                    self.current_rr = 0.0
                    return False
                return True
            else:
                self.unauthorized_counter = 0
                self.unauthorized = False
                self.adaptive_update_counter += 1
                if confidence < 100 and self.adaptive_update_counter % 60 == 0:
                    try:
                        self.face_recognizer.update([gray_face], np.array([self.bed_id]))
                    except Exception:
                        pass
                return True
        except Exception:
            return True

    def _passes_motion_gate(self, roi):
        mean_intensity = float(np.mean(roi))
        if self.prev_mean_intensity is None:
            self.prev_mean_intensity = mean_intensity
            return True
        delta = abs(mean_intensity - self.prev_mean_intensity)
        self.prev_mean_intensity = mean_intensity
        return delta < self.motion_reject_threshold

    def update_vitals(self, roi, fps, gray_face=None, is_fallback=False, frame_time=None):
        if frame_time is None:
            frame_time = time.time()
        self.has_seen_patient = True
        self.last_seen = frame_time
        if not is_fallback:
            self.has_seen_face = True
            self.last_seen_face = frame_time
            self.is_fallback_active = False
            if gray_face is not None and not self.process_face_recognition(gray_face):
                return
        else:
            self.last_seen_skin = frame_time
            self.is_fallback_active = True
            self.unauthorized = False
            if self.status != "CRITICAL" and "Measuring" not in self.status:
                self.status = "Monitoring (Secondary ROI: Neck)"

        mean_bgr = np.mean(roi, axis=(0, 1))
        mean_rgb = [mean_bgr[2], mean_bgr[1], mean_bgr[0]]

        if not self._passes_motion_gate(roi):
            if len(self.rgb_buffer) > 0:
                mean_rgb = self.rgb_buffer[-1][1]
            else:
                return

        target_frames = self.buffer_size  # Default 300 frames (10 seconds at 30 fps)
        self.rgb_buffer.append((frame_time, mean_rgb))

        if len(self.rgb_buffer) > target_frames:
            self.rgb_buffer.pop(0)

        if len(self.rgb_buffer) == target_frames:
            self.compute_counter += 1
            if self.compute_counter % 15 == 0:
                bpm, rr, apnea, snr = self.pos_algorithm_bpm(self.rgb_buffer)
                self.last_snr = snr

                if 42.0 <= bpm <= 180.0:
                    self.lost_signal_counter = 0
                    self.current_bpm = (0.85 * self.current_bpm + 0.15 * bpm) if self.current_bpm > 0 else bpm
                    if 6.0 <= rr <= 40.0:
                        self.current_rr = (0.85 * self.current_rr + 0.15 * rr) if self.current_rr > 0 else rr
                    self.apnea_alert = apnea
                    self.calculate_mews_score()
                else:
                    self.lost_signal_counter += 1
                    if self.lost_signal_counter >= 6:
                        self.current_bpm = 0.0
                        self.current_rr = 0.0
                        self.apnea_alert = False
                        self.mews_score = 0
                        self.status = "SIGNAL LOST"

            if self.current_bpm > 0:
                if is_fallback or self.is_fallback_active:
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
        bpm = self.current_bpm
        rr = self.current_rr
        score = 0

        if bpm == 0:
            self.mews_score = 0
            if not self.unauthorized:
                self.status = "SIGNAL LOST"
            return

        if bpm <= 40 or bpm >= 130:
            score += 3
        elif 111 <= bpm <= 129:
            score += 2
        elif (101 <= bpm <= 110) or (41 <= bpm <= 50):
            score += 1

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
        """
        Executes Plane-Orthogonal-to-Skin (POS) projection with Butterworth filtering,
        FFT peak extraction, and in-band spectral SNR liveness check.
        Returns: (bpm, rr, apnea_bool, snr_value)
        """
        if len(timestamped_rgb_signals) < self.buffer_size:
            return 0.0, 0.0, False, 0.0

        data, fps = self._resample_uniform(timestamped_rgb_signals)
        if data is None or fps is None or fps <= 0:
            return 0.0, 0.0, False, 0.0

        if np.std(data) < 0.1:
            return 0.0, 0.0, False, 0.0

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

        # Heart Rate Bandpass (Butterworth 3rd order, 0.7 to 3.0 Hz, 42-180 BPM)
        hi_cut = min(3.0, nyquist * 0.98)
        b_hr, a_hr = signal.butter(3, [0.7 / nyquist, hi_cut / nyquist], btype='bandpass')
        filtered_hr = signal.filtfilt(b_hr, a_hr, pulse_wave)
        freqs_hr = fft.rfftfreq(n, d=(1.0 / fps))
        fft_mag_hr = np.abs(fft.rfft(filtered_hr))

        valid_idx_hr = np.where((freqs_hr >= 0.7) & (freqs_hr <= hi_cut))[0]
        snr = 0.0
        if len(valid_idx_hr) > 0:
            peak_local_pos = int(np.argmax(fft_mag_hr[valid_idx_hr]))
            peak_power = float(fft_mag_hr[valid_idx_hr[peak_local_pos]])

            noise_mask = np.ones(len(valid_idx_hr), dtype=bool)
            noise_mask[max(0, peak_local_pos - 2): min(len(valid_idx_hr), peak_local_pos + 3)] = False

            if np.any(noise_mask):
                noise_mean = float(np.mean(fft_mag_hr[valid_idx_hr][noise_mask]))
            else:
                noise_mean = float(np.mean(fft_mag_hr[valid_idx_hr]))

            snr = peak_power / (noise_mean + 1e-6)
            if snr < 1.30:
                return 0.0, 0.0, False, snr

            bpm = float(freqs_hr[valid_idx_hr[peak_local_pos]] * 60.0)
        else:
            bpm = 0.0

        # Respiration Rate from detrended green channel (Butterworth 3rd order, 0.15 to 0.50 Hz)
        raw_green = signal.detrend(data[:, 1])
        lo_rr = max(0.05, 0.15) / nyquist
        hi_rr = min(0.5, nyquist * 0.98) / nyquist
        if lo_rr < hi_rr:
            b_rr, a_rr = signal.butter(3, [lo_rr, hi_rr], btype='bandpass')
            filtered_rr = signal.filtfilt(b_rr, a_rr, raw_green)
            freqs_rr = fft.rfftfreq(n, d=(1.0 / fps))
            fft_mag_rr = np.abs(fft.rfft(filtered_rr))

            valid_idx_rr = np.where((freqs_rr >= 0.15) & (freqs_rr <= 0.5))[0]
            if len(valid_idx_rr) > 0:
                rr = float(freqs_rr[valid_idx_rr[np.argmax(fft_mag_rr[valid_idx_rr])]] * 60.0)
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

        return bpm, rr, apnea, snr

    def to_dict(self):
        return {
            "bed_id": self.bed_id,
            "hr": round(self.current_bpm, 1),
            "rr": round(self.current_rr, 1),
            "snr": round(self.last_snr, 2),
            "apnea_alert": self.apnea_alert,
            "fall_risk": self.fall_risk,
            "unauthorized": self.unauthorized,
            "mews": self.mews_score,
            "status": self.status
        }


class CORVITXEngine:
    """
    Reusable frame processing engine. Can process frames from:
    1. Local camera / webcam
    2. Remote WebRTC participant video track
    3. Recorded video files
    """
    def __init__(self, max_beds=4, buffer_size=300):
        self.max_beds = max_beds
        self.buffer_size = buffer_size
        self.fps = 30.0
        self.beds = {}
        self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        self.face_cascade_alt = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_alt2.xml')

    def get_or_create_bed(self, bed_id=1):
        if bed_id not in self.beds:
            self.beds[bed_id] = WardPatientBed(bed_id=bed_id, buffer_size=self.buffer_size)
        return self.beds[bed_id]

    def get_forehead_roi(self, frame, face_box):
        x, y, w, h = face_box
        roi_y1 = max(0, y + int(h * 0.12))
        roi_y2 = min(frame.shape[0], y + int(h * 0.38))
        roi_x1 = max(0, x + int(w * 0.25))
        roi_x2 = min(frame.shape[1], x + int(w * 0.75))

        if roi_x2 > roi_x1 and roi_y2 > roi_y1:
            return frame[roi_y1:roi_y2, roi_x1:roi_x2], (roi_x1, roi_y1, roi_x2, roi_y2)
        return None, None

    def process_frame(self, frame, timestamp=None, bed_id=1):
        """
        Processes a single incoming BGR frame and returns:
        (annotated_frame, metrics_dict, face_detected_bool)
        """
        if frame is None:
            return None, {}, False

        if timestamp is None:
            timestamp = time.time()

        h_orig, w_orig = frame.shape[:2]
        if w_orig > 800:
            scale = 800.0 / w_orig
            frame = cv2.resize(frame, (800, int(h_orig * scale)))

        h, w = frame.shape[:2]
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        slot = self.get_or_create_bed(bed_id)

        # Detect candidate faces
        faces = self.face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(55, 55))
        if len(faces) == 0:
            faces = self.face_cascade_alt.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(55, 55))

        # Bio-verification skin ratio test
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

        face_detected = len(valid_faces) > 0

        if face_detected:
            # Sort by area descending (largest face = target participant)
            face_entries = sorted(valid_faces, key=lambda b: -(b[2] * b[3]))
            fx, fy, fw, fh = face_entries[0]
            fx, fy = max(0, fx), max(0, fy)
            fw, fh = min(w - fx, fw), min(h - fy, fh)

            if fw > 0 and fh > 0:
                slot.centroid = (fx + fw // 2, fy + fh // 2)
                slot.last_seen = timestamp
                slot.last_seen_face = timestamp
                slot.has_seen_patient = True
                slot.is_fallback_active = False
                slot.face_coords = (fx, fy, fw, fh)
                slot.fall_risk = bool(fx < int(w * 0.15) or (fx + fw) > int(w * 0.85))

                gray_face = gray[fy:fy + fh, fx:fx + fw]
                roi, box_coords = self.get_forehead_roi(frame, (fx, fy, fw, fh))
                if roi is not None and roi.size > 0:
                    slot.box_coords = box_coords
                    slot.update_vitals(roi, self.fps, gray_face, is_fallback=False, frame_time=timestamp)

                # Draw bounding box
                color = (0, 255, 0)
                if slot.unauthorized:
                    color = (0, 165, 255)
                elif slot.fall_risk:
                    color = (0, 0, 255)
                cv2.rectangle(frame, (fx, fy), (fx + fw, fy + fh), color, 3)
                if box_coords:
                    rx1, ry1, rx2, ry2 = box_coords
                    cv2.rectangle(frame, (rx1, ry1), (rx2, ry2), (0, 255, 255), 2)
        else:
            # Multi-ROI HSV Skin Fallback
            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
            skin_mask = cv2.inRange(hsv, np.array([0, 20, 45]), np.array([25, 255, 255]))
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
            skin_mask = cv2.morphologyEx(skin_mask, cv2.MORPH_OPEN, kernel, iterations=1)
            skin_mask = cv2.morphologyEx(skin_mask, cv2.MORPH_CLOSE, kernel, iterations=2)

            contours, _ = cv2.findContours(skin_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            fallback_engaged = False
            for c in contours:
                area = cv2.contourArea(c)
                if area > 1800:
                    bx, by, bw, bh = cv2.boundingRect(c)
                    bcx = bx + bw // 2
                    if int(w * 0.10) <= bcx <= int(w * 0.90):
                        crop_mask = skin_mask[by:by + bh, bx:bx + bw]
                        skin_ratio = np.count_nonzero(crop_mask) / float(bw * bh)
                        if skin_ratio >= 0.22:
                            slot.centroid = (bcx, by + bh // 2)
                            slot.last_seen = timestamp
                            slot.last_seen_skin = timestamp
                            slot.has_seen_patient = True
                            slot.is_fallback_active = True
                            slot.face_coords = (bx, by, bw, bh)

                            roi_y1 = max(0, by + int(bh * 0.15))
                            roi_y2 = min(h, by + int(bh * 0.70))
                            roi_x1 = max(0, bx + int(bw * 0.20))
                            roi_x2 = min(w, bx + int(bw * 0.80))
                            if roi_x2 > roi_x1 and roi_y2 > roi_y1:
                                slot.box_coords = (roi_x1, roi_y1, roi_x2, roi_y2)
                                roi = frame[roi_y1:roi_y2, roi_x1:roi_x2]
                                slot.update_vitals(roi, self.fps, gray_face=None, is_fallback=True, frame_time=timestamp)
                                cv2.rectangle(frame, (bx, by), (bx + bw, by + bh), (255, 255, 0), 2)
                                cv2.rectangle(frame, (roi_x1, roi_y1), (roi_x2, roi_y2), (0, 255, 255), 2)
                                fallback_engaged = True
                                break

        return frame, slot.to_dict(), face_detected
