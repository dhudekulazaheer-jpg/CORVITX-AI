import os
import shutil
import matplotlib.pyplot as plt
import matplotlib.patches as patches

def create_architecture_diagram():
    fig = plt.figure(figsize=(16, 5.4), dpi=300)
    ax = fig.add_subplot(111)
    ax.set_xlim(0, 16)
    ax.set_ylim(0, 5.4)
    ax.axis('off')

    boxes = [
        {
            'x': 0.2, 'y': 0.5, 'w': 2.8, 'h': 4.1,
            'title': 'STAGE 1: CAPTURE & INGESTION',
            'head_color': '#1d4ed8', # deep blue
            'items': [
                '• Standard RGB Sensor',
                '  (1080p Stream, 30 FPS)',
                '• Non-Contact Mount (1.8m, 30°)',
                '• Dynamic Frame Rescaling (800 px)',
                '• Motion Artifact Gating',
                '  (|ΔĪ_k| ≤ 8.0 Threshold)'
            ]
        },
        {
            'x': 3.3, 'y': 0.5, 'w': 2.8, 'h': 4.1,
            'title': 'STAGE 2: SPATIAL TRACKING',
            'head_color': '#2563eb', # royal blue
            'items': [
                '• Frontal-Face Haar Cascades',
                '• LBPH Patient Face Verification',
                '• Multi-Patient Anti-Corruption',
                '• Autonomous HSV Multi-ROI',
                '  (Cutaneous Skin Fallback)',
                '• Cervical / Extremity Relocking'
            ]
        },
        {
            'x': 6.4, 'y': 0.5, 'w': 3.0, 'h': 4.1,
            'title': 'STAGE 3: DUAL-BRANCH DSP',
            'head_color': '#0d9488', # teal
            'items': [
                '• 10-Second Timestamped Buffer',
                '  (N = 300, Resampling at 30 Hz)',
                '• Branch 1: POS Pulse Projection',
                '  (Butterworth 0.75–3.50 Hz + FFT)',
                '• Branch 2: Detrended Green RR',
                '  (Butterworth 0.15–0.50 Hz + FFT)'
            ]
        },
        {
            'x': 9.7, 'y': 0.5, 'w': 2.8, 'h': 4.1,
            'title': 'STAGE 4: CLINICAL TRIAGE',
            'head_color': '#d97706', # amber
            'items': [
                '• In-Band Spectral SNR Gate',
                '  (SNR ≥ 1.50 Liveness Check)',
                '• Spurious Noise Cancellation',
                '• Automated Live MEWS Score',
                '• Spatial Bed-Exit Perimeter',
                '  (c_x ∉ [0.15W, 0.85W] Warning)'
            ]
        },
        {
            'x': 12.8, 'y': 0.5, 'w': 2.9, 'h': 4.1,
            'title': 'STAGE 5: TELEMETRY & ALERTS',
            'head_color': '#dc2626', # crimson
            'items': [
                '• Local WebSocket Server (< 400 ms)',
                '• Central Nurse Station Dashboard',
                '• Multi-Bed Cardiorespiratory UI',
                '• Critical Sirens (Apnea / Fall Risk)',
                '• Decentralized Local Processing',
                '  (Strict Biometric Privacy)'
            ]
        }
    ]

    for b in boxes:
        # Main container box with drop shadow feel
        shadow = patches.FancyBboxPatch(
            (b['x'] + 0.03, b['y'] - 0.03), b['w'], b['h'],
            boxstyle="round,pad=0.06,rounding_size=0.14",
            edgecolor='none', facecolor='#e2e8f0',
            zorder=1
        )
        ax.add_patch(shadow)

        rect = patches.FancyBboxPatch(
            (b['x'], b['y']), b['w'], b['h'],
            boxstyle="round,pad=0.06,rounding_size=0.14",
            edgecolor='#cbd5e1', facecolor='#ffffff',
            linewidth=1.2, zorder=2
        )
        ax.add_patch(rect)

        # Header banner
        head_rect = patches.FancyBboxPatch(
            (b['x'], b['y'] + b['h'] - 0.65), b['w'], 0.65,
            boxstyle="round,pad=0.06,rounding_size=0.14",
            edgecolor='none', facecolor=b['head_color'],
            zorder=3
        )
        ax.add_patch(head_rect)

        # Header text
        ax.text(
            b['x'] + b['w']/2.0, b['y'] + b['h'] - 0.32,
            b['title'],
            color='#ffffff', fontsize=8.2, fontweight='bold',
            ha='center', va='center', zorder=4
        )

        # Body items
        y_cursor = b['y'] + b['h'] - 0.95
        for item in b['items']:
            is_sub = item.startswith('  ')
            weight = 'normal'
            size = 7.4 if is_sub else 8.0
            color = '#475569' if is_sub else '#0f172a'
            ax.text(
                b['x'] + (0.22 if is_sub else 0.12), y_cursor,
                item,
                color=color, fontsize=size, fontweight=weight,
                ha='left', va='center', zorder=4
            )
            y_cursor -= 0.48

    # Connecting arrows between stages
    arrow_props = dict(facecolor='#334155', edgecolor='#1e293b', width=2.0, headwidth=6.5, headlength=6.5)
    for i in range(len(boxes) - 1):
        x_start = boxes[i]['x'] + boxes[i]['w'] + 0.04
        x_end = boxes[i+1]['x'] - 0.04
        y_mid = 2.55
        ax.annotate(
            '', xy=(x_end, y_mid), xytext=(x_start, y_mid),
            arrowprops=arrow_props, zorder=5
        )

    # Global banner header
    ax.text(
        8.0, 5.0,
        "CORVITX-AI PURE SOFTWARE CONTACTLESS EDGE TELEMETRY PIPELINE",
        color='#0f172a', fontsize=12, fontweight='bold', ha='center', va='center'
    )

    out_file = "diagram.png"
    plt.savefig(out_file, dpi=300, facecolor='white', edgecolor='none', bbox_inches='tight', pad_inches=0.06)
    plt.close()
    
    # Ensure solid RGB mode without alpha channel for universal LaTeX / Word compatibility
    from PIL import Image
    with Image.open(out_file) as im:
        rgb_im = Image.new('RGB', im.size, (255, 255, 255))
        if im.mode == 'RGBA':
            rgb_im.paste(im, mask=im.split()[3])
        else:
            rgb_im.paste(im)
        rgb_im.save(out_file, 'PNG', dpi=(300, 300))
    print(f"[SUCCESS] Saved crisp RGB {out_file}")

    target_dirs = [
        r"C:\Users\dhude\.gemini\antigravity\brain\2fe8fb36-99d8-4c5f-8454-46f133c95b50",
        r"C:\Users\dhude\Downloads\corvitx_paper_submission"
    ]
    for td in target_dirs:
        os.makedirs(td, exist_ok=True)
        shutil.copy(out_file, os.path.join(td, out_file))
        print(f"[COPIED] Copied {out_file} to {td}")

if __name__ == "__main__":
    create_architecture_diagram()
