# CORVITX-AI: A Contactless Vision-Based Patient Triage and Vitals Monitoring System

[![IEEE Format](https://img.shields.io/badge/Paper-IEEE%20Format-blue.svg)](#)
[![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-brightgreen.svg)](#)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-teal.svg)](#)
[![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61dafb.svg)](#)

CORVITX-AI is an edge-native, contactless computer vision and digital signal processing (DSP) platform designed to bridge the "Failure to Rescue" monitoring gap in general hospital wards. By utilizing standard RGB camera feeds, CORVITX-AI continuously extracts cardiorespiratory vital signs and detects patient bed-exit intent without requiring invasive, adhesive wearable sensors.

---

## 🌟 Key Features

* **Contactless Vital Signs Extraction (rPPG):**
  * Plane-Orthogonal-to-Skin (POS) projection algorithm for optical Blood Volume Pulse (BVP) estimation.
  * Fast Fourier Transform (FFT) peak detection within the human cardiac band ($0.75 - 3.50\text{ Hz}$).
  * Secondary detrended green-channel branch for Respiratory Rate (RR) estimation.
  * In-band Signal-to-Noise Ratio (SNR) liveness filtering to reject inanimate/ambient illumination noise.
* **Occlusion-Resilient Patient Tracking:**
  * Frontal face detection via Haar Cascades paired with Local Binary Patterns Histograms (LBPH) identity association.
  * Automatic Multi-ROI Fallback using HSV skin color segmentation (e.g., cervical/neck patches) when the face is occluded or turned away.
* **Proactive Fall-Risk & Bed-Exit Detection:**
  * Spatial boundary constraints (15% virtual margins) on the camera frame to alert nurses before a patient leaves the bed.
* **Clinical Triage & Telemetry:**
  * Real-time Modified Early Warning Score (MEWS) calculation based on continuous physiological telemetry.
  * Sub-400ms end-to-end telemetry dispatch via WebSockets to an asynchronous FastAPI backend and a React clinical dashboard.

---

## 📂 Repository Structure

```text
corvitx_ai_system/
├── backend/
│   ├── server.py              # Asynchronous FastAPI WebSocket triage server
│   ├── requirements.txt       # Backend dependencies
│   └── static/                # Static assets and participant web interface
├── frontend/
│   ├── src/                   # React dashboard components and telemetry UI
│   ├── package.json           # Frontend dependencies (React, Vite, Tailwind CSS)
│   └── vite.config.js
├── camera_client.py           # Optical ingestion and edge video streaming client
├── corvitx_engine.py          # Core rPPG DSP and computer vision pipeline
├── study_data_manager.py      # Research data logging and evaluation manager
├── generate_diagram.py        # System architecture diagram generator
├── generate_plots.py          # Scatter and Bland-Altman evaluation plot generator
├── test_integration.py        # End-to-end system integration tests
├── corvitx_ai_paper.tex       # Full IEEE-formatted research paper LaTeX source
└── .gitignore
```

---

## 🚀 Quick Start

### 1. Backend Setup
```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
python server.py
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### 3. Edge Camera / Processing Engine
```bash
python camera_client.py
```

---

## 📄 Research Paper
The complete manuscript detailing the methodology, clinical cohort validation ($N=15$), Bland-Altman agreement analysis, and edge latency benchmarks is included in [`corvitx_ai_paper.tex`](corvitx_ai_paper.tex).
