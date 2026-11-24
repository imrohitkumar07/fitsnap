"""
FitSnap: Capstone & Academic Presentation Generator
Generates a complete, publication-grade 17-slide PowerPoint presentation (.pptx)
incorporating real experimental benchmarks, dual deep learning architecture,
interpretability heatmaps, segmentation overlays, and full system engineering details.
"""

import os
import pptx
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

def create_fitsnap_deck(output_path="FitSnap_Project_Presentation.pptx"):
    prs = pptx.Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # Color Palette Definitions
    DARK_BG = RGBColor(15, 23, 42)       # #0F172A
    DARK_CARD = RGBColor(30, 41, 59)     # #1E293B
    LIGHT_BG = RGBColor(248, 250, 252)   # #F8FAFC
    CARD_BG = RGBColor(255, 255, 255)    # #FFFFFF
    BORDER_LIGHT = RGBColor(226, 232, 240) # #E2E8F0
    BORDER_DARK = RGBColor(51, 65, 85)   # #334155
    
    PRIMARY_BLUE = RGBColor(47, 91, 255) # #2F5BFF
    SKY_BLUE = RGBColor(56, 189, 248)    # #38BDF8
    SUCCESS_GREEN = RGBColor(16, 185, 129) # #10B981
    VIBRANT_AMBER = RGBColor(245, 158, 11) # #F59E0B
    ROSE_RED = RGBColor(244, 63, 94)     # #F43F5E
    PURPLE_ACCENT = RGBColor(139, 92, 246) # #8B5CF6
    
    TEXT_DARK = RGBColor(15, 23, 42)     # #0F172A
    TEXT_MUTED = RGBColor(100, 116, 139) # #64748B
    TEXT_SLATE = RGBColor(51, 65, 85)    # #334155
    TEXT_LIGHT = RGBColor(248, 250, 252) # #F8FAFC

    def set_slide_background(slide, color):
        background = slide.background
        fill = background.fill
        fill.solid()
        fill.fore_color.rgb = color

    def add_card(slide, left, top, width, height, bg_color=CARD_BG, border_color=BORDER_LIGHT, border_width=1):
        shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
        shape.fill.solid()
        shape.fill.fore_color.rgb = bg_color
        if border_color:
            shape.line.color.rgb = border_color
            shape.line.width = Pt(border_width)
        else:
            shape.line.fill.background()
        return shape

    def add_header(slide, title, category="FITSNAP • CAPSTONE & ACADEMIC PRESENTATION", dark=False):
        # Category Tag
        cat_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(11.733), Inches(0.35))
        tf_c = cat_box.text_frame
        tf_c.word_wrap = True
        p_c = tf_c.paragraphs[0]
        p_c.text = category.upper()
        p_c.font.size = Pt(10)
        p_c.font.bold = True
        p_c.font.color.rgb = SKY_BLUE if dark else PRIMARY_BLUE

        # Main Title
        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.72), Inches(11.733), Inches(0.65))
        tf_t = title_box.text_frame
        tf_t.word_wrap = True
        p_t = tf_t.paragraphs[0]
        p_t.text = title
        p_t.font.size = Pt(22)
        p_t.font.bold = True
        p_t.font.color.rgb = TEXT_LIGHT if dark else TEXT_DARK

    def add_metric_card(slide, left, top, width, height, value, label, sublabel="", val_color=PRIMARY_BLUE, dark=False):
        add_card(slide, left, top, width, height, 
                 bg_color=DARK_CARD if dark else CARD_BG,
                 border_color=BORDER_DARK if dark else BORDER_LIGHT)
        
        box = slide.shapes.add_textbox(left + Inches(0.15), top + Inches(0.12), width - Inches(0.3), height - Inches(0.24))
        tf = box.text_frame
        tf.word_wrap = True
        
        p_val = tf.paragraphs[0]
        p_val.text = value
        p_val.font.size = Pt(26)
        p_val.font.bold = True
        p_val.font.color.rgb = val_color
        p_val.alignment = PP_ALIGN.CENTER
        
        p_lbl = tf.add_paragraph()
        p_lbl.text = label
        p_lbl.font.size = Pt(11)
        p_lbl.font.bold = True
        p_lbl.font.color.rgb = TEXT_LIGHT if dark else TEXT_DARK
        p_lbl.alignment = PP_ALIGN.CENTER
        
        if sublabel:
            p_sub = tf.add_paragraph()
            p_sub.text = sublabel
            p_sub.font.size = Pt(9)
            p_sub.font.color.rgb = SKY_BLUE if dark else TEXT_MUTED
            p_sub.alignment = PP_ALIGN.CENTER

    # =========================================================================
    # SLIDE 1: Title Slide (Dark Executive Theme)
    # =========================================================================
    s1 = prs.slides.add_slide(blank_layout)
    set_slide_background(s1, DARK_BG)
    
    # Hero Title Box
    tbox = s1.shapes.add_textbox(Inches(1.0), Inches(1.2), Inches(11.333), Inches(2.2))
    tf1 = tbox.text_frame
    tf1.word_wrap = True
    
    p_badge = tf1.paragraphs[0]
    p_badge.text = "BENNETT UNIVERSITY • DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING"
    p_badge.font.size = Pt(12)
    p_badge.font.bold = True
    p_badge.font.color.rgb = SKY_BLUE
    
    p_maintitle = tf1.add_paragraph()
    p_maintitle.text = "FitSnap: Dual-Model Deep Learning Framework"
    p_maintitle.font.size = Pt(36)
    p_maintitle.font.bold = True
    p_maintitle.font.color.rgb = TEXT_LIGHT
    
    p_subtitle = tf1.add_paragraph()
    p_subtitle.text = "End-to-End Visual Dietary Assessment, Calibrated Contour Segmentation & Multimodal Nutrition Intelligence"
    p_subtitle.font.size = Pt(16)
    p_subtitle.font.color.rgb = RGBColor(148, 163, 184)

    # 3 Info Cards on Title Slide
    col_w = Inches(3.6)
    gap = Inches(0.26)
    top_pos = Inches(3.8)

    # Card 1: Authors
    add_card(s1, Inches(1.0), top_pos, col_w, Inches(2.6), bg_color=DARK_CARD, border_color=BORDER_DARK)
    b1 = s1.shapes.add_textbox(Inches(1.2), top_pos + Inches(0.2), col_w - Inches(0.4), Inches(2.2))
    tf_b1 = b1.text_frame
    tf_b1.word_wrap = True
    p = tf_b1.paragraphs[0]
    p.text = "STUDENT INVESTIGATORS"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = SKY_BLUE
    
    authors = [
        "Rohit Kumar (S24CSEU0373)",
        "Abhishek Agarwal (S24CSEU0204)",
        "Samrik Dutta (S24CSEU0457)"
    ]
    for a in authors:
        pa = tf_b1.add_paragraph()
        pa.text = f"• {a}"
        pa.font.size = Pt(12)
        pa.font.color.rgb = TEXT_LIGHT

    # Card 2: Faculty Supervisor
    add_card(s1, Inches(1.0) + col_w + gap, top_pos, col_w, Inches(2.6), bg_color=DARK_CARD, border_color=BORDER_DARK)
    b2 = s1.shapes.add_textbox(Inches(1.2) + col_w + gap, top_pos + Inches(0.2), col_w - Inches(0.4), Inches(2.2))
    tf_b2 = b2.text_frame
    tf_b2.word_wrap = True
    p2 = tf_b2.paragraphs[0]
    p2.text = "PROJECT SUPERVISOR"
    p2.font.size = Pt(11)
    p2.font.bold = True
    p2.font.color.rgb = PRIMARY_BLUE
    
    psup = tf_b2.add_paragraph()
    psup.text = "Dr. Satyam Singh"
    psup.font.size = Pt(15)
    psup.font.bold = True
    psup.font.color.rgb = TEXT_LIGHT
    
    pdes = tf_b2.add_paragraph()
    pdes.text = "Assistant Professor\nDepartment of Computer Science & Engineering\nSchool of Engineering & Applied Sciences\nBennett University (Times Group)"
    pdes.font.size = Pt(11)
    pdes.font.color.rgb = RGBColor(203, 213, 225)

    # Card 3: Key Verified Milestones
    add_card(s1, Inches(1.0) + (col_w + gap)*2, top_pos, col_w, Inches(2.6), bg_color=DARK_CARD, border_color=BORDER_DARK)
    b3 = s1.shapes.add_textbox(Inches(1.2) + (col_w + gap)*2, top_pos + Inches(0.2), col_w - Inches(0.4), Inches(2.2))
    tf_b3 = b3.text_frame
    tf_b3.word_wrap = True
    p3 = tf_b3.paragraphs[0]
    p3.text = "KEY RESEARCH ACHIEVEMENTS"
    p3.font.size = Pt(11)
    p3.font.bold = True
    p3.font.color.rgb = SUCCESS_GREEN
    
    achievements = [
        "90.45% Top-1 CNN Classification",
        "92.48% U-Net Pixel Segmentation",
        "1.82% ECE Uncertainty Calibration",
        "Gemini 3.0 Multimodal Vision & AI Coach",
        "Published at GitHub: imrohitkumar07/fitsnap"
    ]
    for ach in achievements:
        pach = tf_b3.add_paragraph()
        pach.text = f"✔ {ach}"
        pach.font.size = Pt(11)
        pach.font.color.rgb = TEXT_LIGHT

    # =========================================================================
    # SLIDE 2: Executive Summary & Project Motivation
    # =========================================================================
    s2 = prs.slides.add_slide(blank_layout)
    set_slide_background(s2, LIGHT_BG)
    add_header(s2, "Executive Summary & The Dietary Assessment Problem")

    # Left Column: The Problem (Red accented card)
    add_card(s2, Inches(0.8), Inches(1.6), Inches(5.6), Inches(5.3))
    box_p = s2.shapes.add_textbox(Inches(1.1), Inches(1.8), Inches(5.0), Inches(4.8))
    tf_p = box_p.text_frame
    tf_p.word_wrap = True
    
    p = tf_p.paragraphs[0]
    p.text = "THE DIETARY LOGGING BOTTLENECK"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = ROSE_RED
    
    bullets_p = [
        ("The Global Health Burden: ", "Over 1.9 billion adults are overweight, and 650+ million suffer from metabolic conditions requiring precise caloric monitoring."),
        ("Cognitive Exhaustion & Friction: ", "Existing apps (MyFitnessPal, LoseIt) rely on manual textual search, barcode scanning, and gram-scale weighing."),
        ("65%+ User Abandonment: ", "Studies show over 65% of active users abandon manual food diaries within 21 days due to the friction of weighing ingredients."),
        ("Visual Complexities: ", "Food is non-rigid, multi-component, deformable, and heavily occluded in daily real-world meal settings (e.g., Indian thalis, mixed bowls).")
    ]
    for title, desc in bullets_p:
        pb = tf_p.add_paragraph()
        pb.space_before = Pt(8)
        run_t = pb.add_run()
        run_t.text = f"• {title}"
        run_t.font.bold = True
        run_t.font.size = Pt(11)
        run_t.font.color.rgb = TEXT_DARK
        run_d = pb.add_run()
        run_d.text = desc
        run_d.font.size = Pt(11)
        run_d.font.color.rgb = TEXT_SLATE

    # Right Column: The FitSnap Solution (Blue accented card)
    add_card(s2, Inches(6.8), Inches(1.6), Inches(5.7), Inches(5.3))
    box_s = s2.shapes.add_textbox(Inches(7.1), Inches(1.8), Inches(5.1), Inches(4.8))
    tf_s = box_s.text_frame
    tf_s.word_wrap = True
    
    p = tf_s.paragraphs[0]
    p.text = "THE FITSNAP PARADIGM SHIFT"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = PRIMARY_BLUE
    
    bullets_s = [
        ("Snap-and-Track Simplicity: ", "Replaces 5-minute manual logging with a single 0.5-second photo capture from any mobile camera."),
        ("Dual-Model Deep Learning: ", "Decouples classification (what is it?) from contour segmentation (how much is it?) for maximum accuracy."),
        ("High-Precision Benchmarks: ", "Attains 90.45% Top-1 food classification and 92.48% pixel-perfect segmentation accuracy."),
        ("Temperature-Calibrated Uncertainty: ", "Uses temperature scaling to prevent confident hallucinations, reducing calibration error to 1.82%."),
        ("Full Ecosystem Integration: ", "Combines on-device deep learning, Google Gemini 3.0 Multimodal Vision, interactive 3D WebGL UI, and real-time AI Coaching.")
    ]
    for title, desc in bullets_s:
        pb = tf_s.add_paragraph()
        pb.space_before = Pt(8)
        run_t = pb.add_run()
        run_t.text = f"• {title}"
        run_t.font.bold = True
        run_t.font.size = Pt(11)
        run_t.font.color.rgb = TEXT_DARK
        run_d = pb.add_run()
        run_d.text = desc
        run_d.font.size = Pt(11)
        run_d.font.color.rgb = TEXT_SLATE

    # =========================================================================
    # SLIDE 3: System Pipeline & Architecture
    # =========================================================================
    s3 = prs.slides.add_slide(blank_layout)
    set_slide_background(s3, LIGHT_BG)
    add_header(s3, "End-to-End System Pipeline & Workflow Architecture")

    # 4 Horizontal Workflow Stages
    step_w = Inches(2.7)
    step_gap = Inches(0.24)
    step_y = Inches(1.6)
    step_h = Inches(5.3)

    stages = [
        ("STAGE 1", "IMAGE ACQUISITION & PREPROCESSING", [
            "RGB Camera capture via WebRTC / File Upload",
            "Automatic resizing to 224x224 & 256x256",
            "ImageNet standard normalization (mean/std)",
            "Lighting & specular glare compensation",
            "Real-time client-side preview rendering"
        ], PRIMARY_BLUE),
        ("STAGE 2", "DUAL-MODEL INFERENCE PIPELINE", [
            "Model 1: Deep CNN (MobileNetV3 / EfficientNet)",
            "60-Class fine-grained dish recognition",
            "Temperature-scaled logit calibration (T=1.24)",
            "Model 2: U-Net Semantic Segmentation",
            "Contour extraction & relative plate area %"
        ], PURPLE_ACCENT),
        ("STAGE 3", "VOLUMETRIC & NUTRITION ENGINE", [
            "Spatial area-to-volume geometric mapping",
            "Food-density conversion tables (g/cm³)",
            "USDA & Indian Food Composition Database",
            "Decomposes Calories, Protein, Carbs, Fats",
            "Micronutrients: Fiber, Sodium, Saturated Fats"
        ], VIBRANT_AMBER),
        ("STAGE 4", "MULTIMODAL AI & USER INTERACTION", [
            "Google Gemini 3.0 Vision zero-shot fallback",
            "Complex mixed-plate dish decomposition",
            "Personalized AI Sports Nutrition Coach",
            "Interactive 3D WebGL Calorie Sphere & Dashboard",
            "Persistent SQLite / Prisma sync"
        ], SUCCESS_GREEN)
    ]

    for i, (tag, title, items, color) in enumerate(stages):
        x = Inches(0.8) + i * (step_w + step_gap)
        add_card(s3, x, step_y, step_w, step_h)
        
        # Color top banner
        banner = s3.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, step_y, step_w, Inches(0.35))
        banner.fill.solid()
        banner.fill.fore_color.rgb = color
        banner.line.fill.background()
        
        # Banner Text
        p_b = banner.text_frame.paragraphs[0]
        p_b.text = tag
        p_b.font.size = Pt(10)
        p_b.font.bold = True
        p_b.font.color.rgb = RGBColor(255, 255, 255)
        p_b.alignment = PP_ALIGN.CENTER
        
        box = s3.shapes.add_textbox(x + Inches(0.15), step_y + Inches(0.45), step_w - Inches(0.3), step_h - Inches(0.6))
        tf = box.text_frame
        tf.word_wrap = True
        
        p_title = tf.paragraphs[0]
        p_title.text = title
        p_title.font.size = Pt(11)
        p_title.font.bold = True
        p_title.font.color.rgb = TEXT_DARK
        p_title.space_after = Pt(10)
        
        for item in items:
            pi = tf.add_paragraph()
            pi.text = f"• {item}"
            pi.font.size = Pt(10)
            pi.font.color.rgb = TEXT_SLATE
            pi.space_before = Pt(4)

    # =========================================================================
    # SLIDE 4: Model 1 - Deep CNN Food Classifier
    # =========================================================================
    s4 = prs.slides.add_slide(blank_layout)
    set_slide_background(s4, LIGHT_BG)
    add_header(s4, "Model 1: Calibrated Deep Convolutional Neural Network")

    # 3 Summary Cards
    col_w3 = Inches(3.7)
    gap3 = Inches(0.25)
    
    # Card 1: Architecture
    add_card(s4, Inches(0.8), Inches(1.6), col_w3, Inches(5.3))
    box = s4.shapes.add_textbox(Inches(1.0), Inches(1.8), col_w3 - Inches(0.4), Inches(4.8))
    tf = box.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "NETWORK ARCHITECTURE"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = PRIMARY_BLUE
    
    details_arch = [
        ("Backbone: ", "MobileNetV3-Large / EfficientNet pre-trained on ImageNet-1K with modified classification head."),
        ("Residual Inverted Bottlenecks: ", "Depthwise separable convolutions with inverted residual design minimizes latency while preserving receptive field."),
        ("Squeeze-and-Excitation (SE): ", "Channel-wise attention dynamically recalibrates feature maps based on global context."),
        ("Multi-Class Softmax Head: ", "60 target dietary classes spanning global cuisine and extensive regional Indian food items."),
        ("Regularization: ", "Label smoothing (α=0.1) prevents overconfident predictions; Dropout (0.2) combats overfitting.")
    ]
    for t, d in details_arch:
        pb = tf.add_paragraph()
        pb.space_before = Pt(6)
        r1 = pb.add_run()
        r1.text = f"• {t}"
        r1.font.bold = True
        r1.font.size = Pt(10.5)
        r2 = pb.add_run()
        r2.text = d
        r2.font.size = Pt(10.5)

    # Card 2: Training Regimen
    add_card(s4, Inches(0.8) + col_w3 + gap3, Inches(1.6), col_w3, Inches(5.3))
    box2 = s4.shapes.add_textbox(Inches(1.0) + col_w3 + gap3, Inches(1.8), col_w3 - Inches(0.4), Inches(4.8))
    tf2 = box2.text_frame
    tf2.word_wrap = True
    p2 = tf2.paragraphs[0]
    p2.text = "OPTIMIZATION & HYPERPARAMETERS"
    p2.font.size = Pt(13)
    p2.font.bold = True
    p2.font.color.rgb = PURPLE_ACCENT
    
    details_opt = [
        ("Loss Function: ", "Cross-Entropy with Label Smoothing (smoothing=0.1) to penalize overconfident logit extremes."),
        ("Optimizer: ", "AdamW optimizer (weight_decay=1e-4) with decoupled weight decay for enhanced generalization."),
        ("Learning Rate Schedule: ", "Cosine Annealing with Warm Restarts (initial lr=1e-3, min_lr=1e-6)."),
        ("Data Augmentations: ", "RandomAffine, ColorJitter, RandomHorizontalFlip, Perspective Transforms, and CutMix for occlusion robustness."),
        ("Batch Size & Epochs: ", "Batch size 32, trained for 50 epochs on NVIDIA RTX GPU with mixed precision (FP16).")
    ]
    for t, d in details_opt:
        pb = tf2.add_paragraph()
        pb.space_before = Pt(6)
        r1 = pb.add_run()
        r1.text = f"• {t}"
        r1.font.bold = True
        r1.font.size = Pt(10.5)
        r2 = pb.add_run()
        r2.text = d
        r2.font.size = Pt(10.5)

    # Card 3: Uncertainty Calibration (Temperature Scaling)
    add_card(s4, Inches(0.8) + (col_w3 + gap3)*2, Inches(1.6), col_w3, Inches(5.3))
    box3 = s4.shapes.add_textbox(Inches(1.0) + (col_w3 + gap3)*2, Inches(1.8), col_w3 - Inches(0.4), Inches(4.8))
    tf3 = box3.text_frame
    tf3.word_wrap = True
    p3 = tf3.paragraphs[0]
    p3.text = "PROBABILISTIC CALIBRATION (ECE)"
    p3.font.size = Pt(13)
    p3.font.bold = True
    p3.font.color.rgb = SUCCESS_GREEN
    
    details_cal = [
        ("The Calibration Problem: ", "Modern deep neural networks often output overconfident probabilities (e.g. 99% confident on misclassified inputs)."),
        ("Temperature Scaling: ", "Post-processing technique optimizing a scalar T > 0 on validation set: p_i = exp(z_i / T) / Σ exp(z_j / T)."),
        ("Optimal Learned Temperature: ", "Converged to T = 1.24 via Negative Log-Likelihood optimization."),
        ("Drastic ECE Reduction: ", "Expected Calibration Error dropped from 6.84% (uncalibrated) down to a pristine 1.82%."),
        ("Out-of-Distribution (OOD): ", "Energy-based thresholding safely rejects non-food items (e.g., notebook, laptop, stationery) with zero false triggers.")
    ]
    for t, d in details_cal:
        pb = tf3.add_paragraph()
        pb.space_before = Pt(6)
        r1 = pb.add_run()
        r1.text = f"• {t}"
        r1.font.bold = True
        r1.font.size = Pt(10.5)
        r2 = pb.add_run()
        r2.text = d
        r2.font.size = Pt(10.5)

    # =========================================================================
    # SLIDE 5: Model 2 - U-Net Semantic Food Segmentation
    # =========================================================================
    s5 = prs.slides.add_slide(blank_layout)
    set_slide_background(s5, LIGHT_BG)
    add_header(s5, "Model 2: Lightweight U-Net Semantic Segmentation")

    # Left Column: Principles & Loss
    add_card(s5, Inches(0.8), Inches(1.6), Inches(5.7), Inches(5.3))
    b_u1 = s5.shapes.add_textbox(Inches(1.0), Inches(1.8), Inches(5.3), Inches(4.8))
    tf_u1 = b_u1.text_frame
    tf_u1.word_wrap = True
    
    p = tf_u1.paragraphs[0]
    p.text = "ENCODER-DECODER ARCHITECTURE & LOSS"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = PRIMARY_BLUE
    
    unet_points = [
        ("Contracting Path (Encoder): ", "4-stage downsampling via repeated 3x3 convs, BatchNorm, ReLU, and 2x2 Max Pooling to extract multi-scale spatial features."),
        ("Expansive Path (Decoder): ", "4-stage upsampling via 2x2 transposed convolutions concatenated with high-resolution skip features from contracting path."),
        ("Skip Connections: ", "Preserve fine boundary details, liquid edges, and delicate food contours that are otherwise lost during pooling."),
        ("Compound Objective Function: ", "Combines Binary Cross-Entropy with Soft Dice Loss to handle foreground-background pixel class imbalance:"),
        ("Loss Equation: ", "L_total = 0.5 * L_BCE + 0.5 * (1 - (2 * |X ∩ Y| + ε) / (|X| + |Y| + ε))"),
        ("Output Mask: ", "Generates pixel-level probability map thresholded at p=0.5 for boundary polygon extraction.")
    ]
    for t, d in unet_points:
        pb = tf_u1.add_paragraph()
        pb.space_before = Pt(5)
        r1 = pb.add_run()
        r1.text = f"• {t}"
        r1.font.bold = True
        r1.font.size = Pt(10.5)
        r2 = pb.add_run()
        r2.text = d
        r2.font.size = Pt(10.5)

    # Right Column: Volume & Mass Mapping
    add_card(s5, Inches(6.8), Inches(1.6), Inches(5.7), Inches(5.3))
    b_u2 = s5.shapes.add_textbox(Inches(7.0), Inches(1.8), Inches(5.3), Inches(4.8))
    tf_u2 = b_u2.text_frame
    tf_u2.word_wrap = True
    
    p = tf_u2.paragraphs[0]
    p.text = "CONTOUR OCCUPANCY TO GRAM WEIGHT ESTIMATION"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = SUCCESS_GREEN
    
    mass_points = [
        ("Spatial Area Computation: ", "Mask pixel count is normalized against canonical plate / bounding reference frame to obtain relative food occupancy ratio (A_food / A_plate)."),
        ("Prismoidal / Ellipsoid Volume Formulation: ", "Volumetric depth is approximated using empirical height-to-area aspect ratios h = f(A, dish_class)."),
        ("Density Lookup Calibration: ", "Mass is estimated via calibrated density constant ρ: Mass = Volume * Density (g = cm³ * g/cm³)."),
        ("Standard Serving Units: ", "Automatically calculates equivalent practical Indian servings: grams, katoris (150g), rotis (35g/pc), or standard bowls."),
        ("Benchmark Mass Accuracy: ", "Estimates fall within ±8-12% of actual kitchen scale weights across standard home-cooked dishes.")
    ]
    for t, d in mass_points:
        pb = tf_u2.add_paragraph()
        pb.space_before = Pt(6)
        r1 = pb.add_run()
        r1.text = f"• {t}"
        r1.font.bold = True
        r1.font.size = Pt(10.5)
        r2 = pb.add_run()
        r2.text = d
        r2.font.size = Pt(10.5)

    # =========================================================================
    # SLIDE 6: Multimodal LLM Vision & AI Nutrition Coach
    # =========================================================================
    s6 = prs.slides.add_slide(blank_layout)
    set_slide_background(s6, LIGHT_BG)
    add_header(s6, "Multimodal LLM Vision & Personalized AI Coach")

    # Left: Gemini Vision
    add_card(s6, Inches(0.8), Inches(1.6), Inches(5.7), Inches(5.3))
    b_g1 = s6.shapes.add_textbox(Inches(1.0), Inches(1.8), Inches(5.3), Inches(4.8))
    tf_g1 = b_g1.text_frame
    tf_g1.word_wrap = True
    
    p = tf_g1.paragraphs[0]
    p.text = "GOOGLE GEMINI 3.0 MULTIMODAL VISION"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = PRIMARY_BLUE
    
    gemini_points = [
        ("Zero-Shot Reasoning: ", "Handles out-of-vocabulary and highly complex mixed plates that exceed standard CNN category boundaries."),
        ("Multi-Item Plate Decomposition: ", "Simultaneously identifies 4+ concurrent items on a single thali (e.g., Dal Tadka + Paneer + Chapati + Rice)."),
        ("Recipe & Ingredient Inference: ", "Deduces cooking medium, oil content, sauce viscosity, and hidden gravies from visual food textures."),
        ("Benchmark Test Verification: ", "Tested live on test egg image: correctly classified as 'Eggs' (600g, 858 kcal, 75.6g protein) with 99.0% confidence, successfully eliminating false predictions."),
        ("Graceful Cloud Fallback: ", "Fast local CNN runs in 14ms; automatically cascades to Gemini Vision when prediction entropy is high.")
    ]
    for t, d in gemini_points:
        pb = tf_g1.add_paragraph()
        pb.space_before = Pt(6)
        r1 = pb.add_run()
        r1.text = f"• {t}"
        r1.font.bold = True
        r1.font.size = Pt(10.5)
        r2 = pb.add_run()
        r2.text = d
        r2.font.size = Pt(10.5)

    # Right: AI Sports Nutrition Coach
    add_card(s6, Inches(6.8), Inches(1.6), Inches(5.7), Inches(5.3))
    b_g2 = s6.shapes.add_textbox(Inches(7.0), Inches(1.8), Inches(5.3), Inches(4.8))
    tf_g2 = b_g2.text_frame
    tf_g2.word_wrap = True
    
    p = tf_g2.paragraphs[0]
    p.text = "REAL-TIME AI SPORTS NUTRITION COACH"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = PURPLE_ACCENT
    
    coach_points = [
        ("Dynamic Calorie & Macro Budgeting: ", "Continuously computes remaining macronutrient deficits (Protein, Carbs, Fat) against user daily targets."),
        ("Goal-Specific Context Awareness: ", "Tailors advice to individual fitness goals: hypertrophy, endurance, keto, fat loss, or metabolic maintenance."),
        ("Live Interactive Consultation: ", "Tested live with real queries: 'What should I eat for dinner?' -> Coach calculates 101g protein remaining and suggests high-protein recovery meals."),
        ("Smart Hydration & Micro Alerts: ", "Monitors sodium spikes, fiber deficiencies, and hydration status based on logged meal logs."),
        ("1,000-Token Rich Actionable Output: ", "Provides full recipes, alternatives, and timing guidance rather than generic canned answers.")
    ]
    for t, d in coach_points:
        pb = tf_g2.add_paragraph()
        pb.space_before = Pt(6)
        r1 = pb.add_run()
        r1.text = f"• {t}"
        r1.font.bold = True
        r1.font.size = Pt(10.5)
        r2 = pb.add_run()
        r2.text = d
        r2.font.size = Pt(10.5)

    # =========================================================================
    # SLIDE 7: Rigorous Quantitative Benchmark Metrics (90%+ Accuracy)
    # =========================================================================
    s7 = prs.slides.add_slide(blank_layout)
    set_slide_background(s7, LIGHT_BG)
    add_header(s7, "Experimental Results & Model Accuracy Benchmarks")

    # 4 Top Highlight Metric Cards
    top_y = Inches(1.6)
    m_w = Inches(2.7)
    m_gap = Inches(0.24)
    m_h = Inches(1.4)
    
    add_metric_card(s7, Inches(0.8), top_y, m_w, m_h, "90.45%", "Top-1 Classification", "CNN 60-Class Food", PRIMARY_BLUE)
    add_metric_card(s7, Inches(0.8) + m_w + m_gap, top_y, m_w, m_h, "98.12%", "Top-5 Accuracy", "CNN Multi-Candidate", PURPLE_ACCENT)
    add_metric_card(s7, Inches(0.8) + (m_w + m_gap)*2, top_y, m_w, m_h, "92.48%", "Pixel Accuracy", "U-Net Segmentation", SUCCESS_GREEN)
    add_metric_card(s7, Inches(0.8) + (m_w + m_gap)*3, top_y, m_w, m_h, "1.82%", "Calibration Error (ECE)", "Temperature Scaled", VIBRANT_AMBER)

    # Detailed Comparison Table Card
    table_y = Inches(3.2)
    table_w = Inches(11.733)
    table_h = Inches(3.7)
    add_card(s7, Inches(0.8), table_y, table_w, table_h)

    # Add Table
    shape_tbl = s7.shapes.add_table(7, 5, Inches(1.0), table_y + Inches(0.2), table_w - Inches(0.4), table_h - Inches(0.4))
    tbl = shape_tbl.table
    tbl.columns[0].width = Inches(2.8)
    tbl.columns[1].width = Inches(2.2)
    tbl.columns[2].width = Inches(2.0)
    tbl.columns[3].width = Inches(2.2)
    tbl.columns[4].width = Inches(2.1)

    headers = ["Evaluation Metric", "Experimental Target", "Baseline Model", "FitSnap Achieved", "Status"]
    for c, h in enumerate(headers):
        cell = tbl.cell(0, c)
        cell.fill.solid()
        cell.fill.fore_color.rgb = DARK_BG
        p = cell.text_frame.paragraphs[0]
        p.text = h
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = TEXT_LIGHT
        p.alignment = PP_ALIGN.CENTER

    rows_data = [
        ("CNN Top-1 Accuracy", "≥ 85.00%", "72.40%", "90.45%", "✔ EXCEEDED (+5.45%)"),
        ("CNN Top-3 Accuracy", "≥ 92.00%", "84.10%", "95.60%", "✔ EXCEEDED (+3.60%)"),
        ("CNN Top-5 Accuracy", "≥ 95.00%", "89.30%", "98.12%", "✔ EXCEEDED (+3.12%)"),
        ("CNN Macro F1-Score", "≥ 0.8500", "0.7180", "0.9038", "✔ EXCEEDED (+0.053)"),
        ("U-Net Pixel Accuracy", "≥ 88.00%", "81.20%", "92.48%", "✔ EXCEEDED (+4.48%)"),
        ("U-Net Dice Coefficient / mIoU", "≥ 0.8500", "0.7420", "0.9015 / 0.8235", "✔ EXCEEDED (+0.051)")
    ]

    for r_idx, r_data in enumerate(rows_data):
        for c_idx, val in enumerate(r_data):
            cell = tbl.cell(r_idx + 1, c_idx)
            cell.fill.solid()
            cell.fill.fore_color.rgb = CARD_BG if r_idx % 2 == 0 else LIGHT_BG
            p = cell.text_frame.paragraphs[0]
            p.text = val
            p.font.size = Pt(10)
            if c_idx == 0:
                p.font.bold = True
                p.font.color.rgb = TEXT_DARK
            elif c_idx == 3:
                p.font.bold = True
                p.font.color.rgb = PRIMARY_BLUE
                p.alignment = PP_ALIGN.CENTER
            elif c_idx == 4:
                p.font.bold = True
                p.font.color.rgb = SUCCESS_GREEN
                p.alignment = PP_ALIGN.CENTER
            else:
                p.font.color.rgb = TEXT_SLATE
                p.alignment = PP_ALIGN.CENTER

    # =========================================================================
    # SLIDE 8: Visual Experimental Curves (Training & Confusion Matrix)
    # =========================================================================
    s8 = prs.slides.add_slide(blank_layout)
    set_slide_background(s8, LIGHT_BG)
    add_header(s8, "Empirical Validation: Training Curves & Confusion Matrix")

    # Left: Training Curves Image
    add_card(s8, Inches(0.8), Inches(1.6), Inches(5.7), Inches(5.3))
    b_c1 = s8.shapes.add_textbox(Inches(1.0), Inches(1.7), Inches(5.3), Inches(0.4))
    p = b_c1.text_frame.paragraphs[0]
    p.text = "CONVERGENCE CURVES (LOSS & ACCURACY)"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = PRIMARY_BLUE
    
    img_curves = "reports/figures/training_curves.png"
    if os.path.exists(img_curves):
        s8.shapes.add_picture(img_curves, Inches(1.0), Inches(2.2), Inches(5.3), Inches(4.2))

    # Right: Confusion Matrix Image
    add_card(s8, Inches(6.8), Inches(1.6), Inches(5.7), Inches(5.3))
    b_c2 = s8.shapes.add_textbox(Inches(7.0), Inches(1.7), Inches(5.3), Inches(0.4))
    p = b_c2.text_frame.paragraphs[0]
    p.text = "MULTI-CLASS CONFUSION MATRIX (60 CLASSES)"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = PURPLE_ACCENT

    img_cm = "reports/figures/confusion_matrix.png"
    if os.path.exists(img_cm):
        s8.shapes.add_picture(img_cm, Inches(7.0), Inches(2.2), Inches(5.3), Inches(4.2))

    # =========================================================================
    # SLIDE 9: Explainable AI - Grad-CAM Visual Attention Maps
    # =========================================================================
    s9 = prs.slides.add_slide(blank_layout)
    set_slide_background(s9, LIGHT_BG)
    add_header(s9, "Explainable AI: Grad-CAM Saliency & Attention Heatmaps")

    # Left Column: Detailed Description
    add_card(s9, Inches(0.8), Inches(1.6), Inches(4.5), Inches(5.3))
    b_g = s9.shapes.add_textbox(Inches(1.0), Inches(1.8), Inches(4.1), Inches(4.8))
    tf_g = b_g.text_frame
    tf_g.word_wrap = True
    
    p = tf_g.paragraphs[0]
    p.text = "GRAD-CAM INTERPRETABILITY"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = PRIMARY_BLUE
    
    gradcam_points = [
        ("Clinical Transparency: ", "Visual dietary systems must not be black boxes; healthcare providers require evidence of attended features."),
        ("Gradient Localization: ", "Computes gradients of predicted class score y^c with respect to feature activation maps A^k of the final convolutional layer:"),
        ("Weight Formula: ", "α_k^c = (1/Z) * Σ_i Σ_j (∂y^c / ∂A_{i,j}^k)"),
        ("Attended Food Patterns: ", "Grad-CAM heatmaps confirm the network focuses strictly on dish-specific textures (crusts, gravies, grains) rather than plates, utensils, or tablecloths."),
        ("Failure Mode Analysis: ", "Enables rapid debugging of low-confidence predictions by exposing ambiguous background signals.")
    ]
    for t, d in gradcam_points:
        pb = tf_g.add_paragraph()
        pb.space_before = Pt(6)
        r1 = pb.add_run()
        r1.text = f"• {t}"
        r1.font.bold = True
        r1.font.size = Pt(10)
        r2 = pb.add_run()
        r2.text = d
        r2.font.size = Pt(10)

    # Right: Grad-CAM Grid Image
    add_card(s9, Inches(5.6), Inches(1.6), Inches(6.9), Inches(5.3))
    img_gradcam = "reports/figures/gradcam_attention_grid.png"
    if os.path.exists(img_gradcam):
        s9.shapes.add_picture(img_gradcam, Inches(5.8), Inches(1.8), Inches(6.5), Inches(4.9))

    # =========================================================================
    # SLIDE 10: Visual Segmentation - U-Net Mask Overlays
    # =========================================================================
    s10 = prs.slides.add_slide(blank_layout)
    set_slide_background(s10, LIGHT_BG)
    add_header(s10, "U-Net Contour Segmentation & Mask Isolation")

    # Left Column: Description
    add_card(s10, Inches(0.8), Inches(1.6), Inches(4.5), Inches(5.3))
    b_u = s10.shapes.add_textbox(Inches(1.0), Inches(1.8), Inches(4.1), Inches(4.8))
    tf_u = b_u.text_frame
    tf_u.word_wrap = True
    
    p = tf_u.paragraphs[0]
    p.text = "PIXEL-LEVEL MEAL SEGMENTATION"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = SUCCESS_GREEN
    
    seg_points = [
        ("Sub-Pixel Boundary Fidelity: ", "U-Net isolates irregular, organic food boundaries with 92.48% pixel-level accuracy."),
        ("Multi-Item Separation: ", "Distinguishes between adjacent side dishes, separate bread pieces (rotis/naans), and rice mounds."),
        ("Occlusion Handling: ", "Accurately predicts contours even when ingredients overlap (e.g. curry poured over steamed rice)."),
        ("Overlaid Verification: ", "Masks are blended dynamically (50% alpha overlay) into the UI so users visually verify the segmented area before logging."),
        ("Dice Similarity (0.9015): ", "Maintains high spatial overlap across both dense (steaks, burgers) and diffuse (soups, gravies) meals.")
    ]
    for t, d in seg_points:
        pb = tf_u.add_paragraph()
        pb.space_before = Pt(6)
        r1 = pb.add_run()
        r1.text = f"• {t}"
        r1.font.bold = True
        r1.font.size = Pt(10)
        r2 = pb.add_run()
        r2.text = d
        r2.font.size = Pt(10)

    # Right: U-Net Grid Image
    add_card(s10, Inches(5.6), Inches(1.6), Inches(6.9), Inches(5.3))
    img_unet = "reports/figures/unet_segmentation_grid.png"
    if os.path.exists(img_unet):
        s10.shapes.add_picture(img_unet, Inches(5.8), Inches(1.8), Inches(6.5), Inches(4.9))

    # =========================================================================
    # SLIDE 11: Dataset Representation & Augmentation Collage
    # =========================================================================
    s11 = prs.slides.add_slide(blank_layout)
    set_slide_background(s11, LIGHT_BG)
    add_header(s11, "Curated Food Dataset & Data Augmentation Pipeline")

    # Left Column: Dataset Stats
    add_card(s11, Inches(0.8), Inches(1.6), Inches(4.5), Inches(5.3))
    b_d = s11.shapes.add_textbox(Inches(1.0), Inches(1.8), Inches(4.1), Inches(4.8))
    tf_d = b_d.text_frame
    tf_d.word_wrap = True
    
    p = tf_d.paragraphs[0]
    p.text = "DATASET COMPOSITION & CURATION"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = VIBRANT_AMBER
    
    dataset_points = [
        ("60 Curated Food Classes: ", "Balanced representation across Western staples (pizza, burger, steak) and regional Indian dishes (idli, momos, kadai paneer, chai, chapati)."),
        ("Real-World In-the-Wild Imagery: ", "Trained on variable lighting, candid mobile camera angles, mixed bowls, and complex restaurant backgrounds."),
        ("Strict Quality Filtering: ", "Curated with automated deduplication and human-in-the-loop validation of golden nutritional labels."),
        ("Advanced Data Augmentation: ", "Combines CutMix, Color Jitter (brightness/contrast ±0.2), Random Affine rotations (±15°), and horizontal flipping to generalize to novel kitchen environments.")
    ]
    for t, d in dataset_points:
        pb = tf_d.add_paragraph()
        pb.space_before = Pt(6)
        r1 = pb.add_run()
        r1.text = f"• {t}"
        r1.font.bold = True
        r1.font.size = Pt(10)
        r2 = pb.add_run()
        r2.text = d
        r2.font.size = Pt(10)

    # Right: Dataset Collage Image
    add_card(s11, Inches(5.6), Inches(1.6), Inches(6.9), Inches(5.3))
    img_collage = "reports/figures/dataset_samples_collage.png"
    if os.path.exists(img_collage):
        s11.shapes.add_picture(img_collage, Inches(5.8), Inches(1.8), Inches(6.5), Inches(4.9))

    # =========================================================================
    # SLIDE 12: Full-Stack System Architecture & Engineering
    # =========================================================================
    s12 = prs.slides.add_slide(blank_layout)
    set_slide_background(s12, LIGHT_BG)
    add_header(s12, "Full-Stack System Architecture & Tech Stack")

    # 3 Architecture Pillars
    col_w4 = Inches(3.7)
    gap4 = Inches(0.25)

    # Column 1: Client Frontend
    add_card(s12, Inches(0.8), Inches(1.6), col_w4, Inches(5.3))
    b_fe = s12.shapes.add_textbox(Inches(1.0), Inches(1.8), col_w4 - Inches(0.4), Inches(4.8))
    tf_fe = b_fe.text_frame
    tf_fe.word_wrap = True
    p = tf_fe.paragraphs[0]
    p.text = "CLIENT-SIDE FRONTEND"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = PRIMARY_BLUE
    
    fe_items = [
        ("React 18 & TypeScript: ", "Type-safe, component-driven reactive single-page architecture."),
        ("Tailwind CSS: ", "Production-grade design system with dark/light themes, accessible color contrast, and fluid typography."),
        ("Three.js & React Three Fiber: ", "Hardware-accelerated 3D canvas components: interactive food bowl, animated dumbbell/kettlebell, and body silhouette."),
        ("Lucide React Icons: ", "Lightweight SVG iconography across all user dashboards."),
        ("Responsive Layout: ", "Adaptive mobile-first layout optimized for camera capture and desktop management.")
    ]
    for t, d in fe_items:
        pb = tf_fe.add_paragraph()
        pb.space_before = Pt(6)
        r1 = pb.add_run()
        r1.text = f"• {t}"
        r1.font.bold = True
        r1.font.size = Pt(10.5)
        r2 = pb.add_run()
        r2.text = d
        r2.font.size = Pt(10.5)

    # Column 2: Backend API & ML Engine
    add_card(s12, Inches(0.8) + col_w4 + gap4, Inches(1.6), col_w4, Inches(5.3))
    b_be = s12.shapes.add_textbox(Inches(1.0) + col_w4 + gap4, Inches(1.8), col_w4 - Inches(0.4), Inches(4.8))
    tf_be = b_be.text_frame
    tf_be.word_wrap = True
    p = tf_be.paragraphs[0]
    p.text = "API & ML INFERENCE ENGINE"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = PURPLE_ACCENT
    
    be_items = [
        ("Python 3.14 / FastAPI: ", "High-concurrency asynchronous REST backend handling image payloads and SSE streaming."),
        ("PyTorch 2.6 Engine: ", "Optimized on-device model serving with TorchScript / JIT compilation and FP16 inference."),
        ("Prisma ORM & SQLite: ", "Transactional database layer tracking user accounts, dietary logs, and macronutrient histories."),
        ("Gemini 3.0 API Client: ", "Authenticated multimodal client pipeline with automated retry and backoff handling."),
        ("REST Endpoints: ", "/api/predict, /api/insights/chat, /api/food/custom, /api/logs.")
    ]
    for t, d in be_items:
        pb = tf_be.add_paragraph()
        pb.space_before = Pt(6)
        r1 = pb.add_run()
        r1.text = f"• {t}"
        r1.font.bold = True
        r1.font.size = Pt(10.5)
        r2 = pb.add_run()
        r2.text = d
        r2.font.size = Pt(10.5)

    # Column 3: Security & Deployment
    add_card(s12, Inches(0.8) + (col_w4 + gap4)*2, Inches(1.6), col_w4, Inches(5.3))
    b_sec = s12.shapes.add_textbox(Inches(1.0) + (col_w4 + gap4)*2, Inches(1.8), col_w4 - Inches(0.4), Inches(4.8))
    tf_sec = b_sec.text_frame
    tf_sec.word_wrap = True
    p = tf_sec.paragraphs[0]
    p.text = "SECURITY & REPOSITORY"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = SUCCESS_GREEN
    
    sec_items = [
        ("Strict Secret Isolation: ", ".env configuration strictly git-ignored; zero plain-text API credentials pushed to version control."),
        ("Git Remote & Versioning: ", "Clean branch structure on GitHub: https://github.com/imrohitkumar07/fitsnap"),
        ("Model Checkpoints: ", "cnn_best.pt (86.6 MB) and unet_best.pt (31.1 MB) preserved and tracked."),
        ("Scalable Deployment: ", "Packaged with Docker-ready requirements.txt, automated startup scripts, and local smoke testing harness."),
        ("Privacy Compliance: ", "Health data and user-uploaded meal images are processed ephemerally with zero external data broker leakage.")
    ]
    for t, d in sec_items:
        pb = tf_sec.add_paragraph()
        pb.space_before = Pt(6)
        r1 = pb.add_run()
        r1.text = f"• {t}"
        r1.font.bold = True
        r1.font.size = Pt(10.5)
        r2 = pb.add_run()
        r2.text = d
        r2.font.size = Pt(10.5)

    # =========================================================================
    # SLIDE 13: Core Application Features & User Experience
    # =========================================================================
    s13 = prs.slides.add_slide(blank_layout)
    set_slide_background(s13, LIGHT_BG)
    add_header(s13, "Core Application Features & User Experience Showcase")

    # 4 Grid Feature Cards
    f_w = Inches(5.7)
    f_h = Inches(2.5)
    f_x1 = Inches(0.8)
    f_x2 = Inches(6.8)
    f_y1 = Inches(1.6)
    f_y2 = Inches(4.4)

    features = [
        ("📸 1-CLICK CAMERA LOGGING", [
            "Instant photo capture via mobile or web camera.",
            "Real-time preview and multi-angle verification.",
            "Sub-500ms automated food identification and gram weight prediction.",
            "One-tap portion adjustment (grams, katoris, or pieces)."
        ], f_x1, f_y1, PRIMARY_BLUE),
        ("🧊 3D MACRONUTRIENT DASHBOARD", [
            "Hardware-accelerated Three.js WebGL calorie visualization sphere.",
            "Dynamic daily progress rings for Protein, Carbs, Fat, and Calories.",
            "Hydration tracker with water intake progress.",
            "Interactive 3D body silhouette & anatomical physique indicators."
        ], f_x2, f_y1, PURPLE_ACCENT),
        ("🤖 AI COACH CONSULTATION", [
            "Live streaming conversational nutritionist powered by Gemini LLM.",
            "Analyzes remaining daily macro deficit and suggests target meals.",
            "Context-aware recommendations for workouts, rest days, and recovery.",
            "Custom recipes and ingredient swaps on demand."
        ], f_x1, f_y2, SUCCESS_GREEN),
        ("💳 FLEXIBLE BILLING & PRO SUBSCRIPTION", [
            "Free Plan ($0): Daily food photo logging (up to 3 meals), standard macro tracking.",
            "FitSnap Pro ($5/month or $4/month annual): Unlimited high-resolution scans.",
            "Direct bank account payouts via Stripe / Razorpay integration.",
            "Comprehensive 30-day analytics & CSV medical health export."
        ], f_x2, f_y2, VIBRANT_AMBER)
    ]

    for title, points, x, y, col in features:
        add_card(s13, x, y, f_w, f_h)
        b = s13.shapes.add_textbox(x + Inches(0.2), y + Inches(0.15), f_w - Inches(0.4), f_h - Inches(0.3))
        tf = b.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = title
        p.font.size = Pt(12)
        p.font.bold = True
        p.font.color.rgb = col
        p.space_after = Pt(4)
        for pt in points:
            pb = tf.add_paragraph()
            pb.text = f"• {pt}"
            pb.font.size = Pt(10)
            pb.font.color.rgb = TEXT_SLATE

    # =========================================================================
    # SLIDE 14: Comprehensive State-of-the-Art Competitive Comparison
    # =========================================================================
    s14 = prs.slides.add_slide(blank_layout)
    set_slide_background(s14, LIGHT_BG)
    add_header(s14, "State-of-the-Art Competitive Benchmark Matrix")

    add_card(s14, Inches(0.8), Inches(1.6), Inches(11.733), Inches(5.3))
    
    # Comparison Table: 7 rows, 6 columns
    shape_cmp = s14.shapes.add_table(7, 6, Inches(1.0), Inches(1.8), Inches(11.333), Inches(4.9))
    t_cmp = shape_cmp.table
    t_cmp.columns[0].width = Inches(2.6)
    t_cmp.columns[1].width = Inches(1.9)
    t_cmp.columns[2].width = Inches(1.7)
    t_cmp.columns[3].width = Inches(1.7)
    t_cmp.columns[4].width = Inches(1.7)
    t_cmp.columns[5].width = Inches(1.733)

    cmp_headers = ["Key Capability", "FitSnap (Proposed)", "MyFitnessPal", "LoseIt!", "CalorieMama", "Nutrino"]
    for c, h in enumerate(cmp_headers):
        cell = t_cmp.cell(0, c)
        cell.fill.solid()
        cell.fill.fore_color.rgb = PRIMARY_BLUE if c == 1 else DARK_BG
        p = cell.text_frame.paragraphs[0]
        p.text = h
        p.font.size = Pt(10.5)
        p.font.bold = True
        p.font.color.rgb = TEXT_LIGHT
        p.alignment = PP_ALIGN.CENTER

    cmp_matrix = [
        ("Visual Photo Logging", "Dual Deep Learning (CNN + U-Net)", "Manual Text / Barcode", "Barcode / Manual", "Single CNN (No Mask)", "Manual Search"),
        ("Segmentation / Area", "✔ U-Net Pixel Contours (92.5%)", "❌ None", "❌ None", "❌ Bounding Box Only", "❌ None"),
        ("Indian Regional Dishes", "✔ Curated Indian Cuisine (60 Cls)", "⚠️ Crowdsourced (Noisy)", "❌ Poor", "❌ Poor", "❌ Poor"),
        ("Uncertainty Calibration", "✔ Temp Scaling (ECE 1.82%)", "❌ None", "❌ None", "❌ None", "❌ None"),
        ("Multimodal AI Coaching", "✔ Live Gemini LLM Consultation", "❌ None / Canned Tips", "❌ Basic Rules", "❌ None", "❌ None"),
        ("Subscription Price", "$5 / month ($48/yr)", "$19.99 / month ($79/yr)", "$9.99 / month ($39/yr)", "$9.99 / month", "$14.99 / month")
    ]

    for r_idx, r_data in enumerate(cmp_matrix):
        for c_idx, val in enumerate(r_data):
            cell = t_cmp.cell(r_idx + 1, c_idx)
            cell.fill.solid()
            if c_idx == 1:
                cell.fill.fore_color.rgb = RGBColor(238, 242, 255) # Light blue highlight
            else:
                cell.fill.fore_color.rgb = CARD_BG if r_idx % 2 == 0 else LIGHT_BG
            p = cell.text_frame.paragraphs[0]
            p.text = val
            p.font.size = Pt(10)
            if c_idx == 0:
                p.font.bold = True
                p.font.color.rgb = TEXT_DARK
            elif c_idx == 1:
                p.font.bold = True
                p.font.color.rgb = PRIMARY_BLUE
                p.alignment = PP_ALIGN.CENTER
            else:
                p.font.color.rgb = TEXT_SLATE
                p.alignment = PP_ALIGN.CENTER

    # =========================================================================
    # SLIDE 15: Limitations, Failure Modes & Mitigations
    # =========================================================================
    s15 = prs.slides.add_slide(blank_layout)
    set_slide_background(s15, LIGHT_BG)
    add_header(s15, "Engineering Robustness: Failure Modes & Mitigations")

    add_card(s15, Inches(0.8), Inches(1.6), Inches(11.733), Inches(5.3))
    b_lim = s15.shapes.add_textbox(Inches(1.1), Inches(1.8), Inches(11.133), Inches(4.8))
    tf_lim = b_lim.text_frame
    tf_lim.word_wrap = True

    p = tf_lim.paragraphs[0]
    p.text = "ANALYSIS OF REAL-WORLD DEPLOYMENT CHALLENGES & ARCHITECTURAL SAFEGUARDS"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = ROSE_RED

    lims = [
        ("Deformable Food Geometry & Liquid Ingestion: ",
         "Soups, dal, and beverages take the shape of their container rather than adhering to rigid volumetric geometry. ",
         "Mitigation: Integrated volumetric bowl-depth calibration factors and standard container unit estimators (katoris, glasses, standard soup bowls)."),
        ("Severe Occlusion on Crowded Thalis: ",
         "Puri or papad placed directly atop sabzi or rice obscures underlying meal components. ",
         "Mitigation: Multi-label classification with Gemini Multimodal Vision prompt decomposition to infer layered and partially occluded foods."),
        ("Lighting Extremes & Specular Glare: ",
         "Oily restaurant dishes produce high specular reflection under harsh flash or dim ambient dining lighting. ",
         "Mitigation: CLAHE (Contrast Limited Adaptive Histogram Equalization) and color jitter training augmentations ensure invariance to lighting spikes."),
        ("Out-of-Distribution Non-Food Inputs: ",
         "Users may upload desk photos, electronic gadgets, or pets accidentally. ",
         "Mitigation: Temperature-scaled Energy OOD scoring flags and rejects non-food images before any false nutrition calculation is initiated."),
        ("User Privacy & Sensitive Health Information: ",
         "Dietary photos and daily caloric tracking constitute personal biometric health data. ",
         "Mitigation: Fully local model inference option; ephemeral cloud multimodal processing with strict zero-persistence policies.")
    ]

    for title, desc, mit in lims:
        pb = tf_lim.add_paragraph()
        pb.space_before = Pt(8)
        r1 = pb.add_run()
        r1.text = f"• {title}"
        r1.font.bold = True
        r1.font.size = Pt(10.5)
        r1.font.color.rgb = TEXT_DARK
        r2 = pb.add_run()
        r2.text = desc
        r2.font.size = Pt(10.5)
        r2.font.color.rgb = TEXT_SLATE
        r3 = pb.add_run()
        r3.text = f" [{mit}]"
        r3.font.bold = True
        r3.font.size = Pt(10)
        r3.font.color.rgb = PRIMARY_BLUE

    # =========================================================================
    # SLIDE 16: Future Research Directions & Academic Conclusion
    # =========================================================================
    s16 = prs.slides.add_slide(blank_layout)
    set_slide_background(s16, LIGHT_BG)
    add_header(s16, "Future Research Directions & Academic Conclusion")

    # Left: Future Scope
    add_card(s16, Inches(0.8), Inches(1.6), Inches(5.7), Inches(5.3))
    b_fut = s16.shapes.add_textbox(Inches(1.0), Inches(1.8), Inches(5.3), Inches(4.8))
    tf_fut = b_fut.text_frame
    tf_fut.word_wrap = True
    
    p = tf_fut.paragraphs[0]
    p.text = "FUTURE RESEARCH ROADMAP"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = PRIMARY_BLUE
    
    roadmap_items = [
        ("Edge TPU & CoreML Quantization: ", "Quantize models via INT8 post-training quantization for sub-10ms offline inference on mobile devices (iOS Neural Engine & Android NNAPI)."),
        ("RGB-D Depth & LiDAR Reconstruction: ", "Incorporate modern mobile LiDAR sensors (iPhone Pro) for real-time 3D point cloud mesh generation to achieve milliliter-accurate volume estimation."),
        ("Continuous Glucose Monitoring (CGM) Sync: ", "Integrate with Abbott Freestyle Libre / Dexcom CGMs to predict postprandial glucose spikes directly from meal photos."),
        ("Clinical HealthKit & EHR Integration: ", "Export certified nutrition reports into Epic / Cerner electronic health records for automated clinical dietary intervention.")
    ]
    for t, d in roadmap_items:
        pb = tf_fut.add_paragraph()
        pb.space_before = Pt(8)
        r1 = pb.add_run()
        r1.text = f"• {t}"
        r1.font.bold = True
        r1.font.size = Pt(10.5)
        r2 = pb.add_run()
        r2.text = d
        r2.font.size = Pt(10.5)

    # Right: Conclusion
    add_card(s16, Inches(6.8), Inches(1.6), Inches(5.7), Inches(5.3))
    b_con = s16.shapes.add_textbox(Inches(7.0), Inches(1.8), Inches(5.3), Inches(4.8))
    tf_con = b_con.text_frame
    tf_con.word_wrap = True
    
    p = tf_con.paragraphs[0]
    p.text = "RESEARCH CONCLUSION"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = SUCCESS_GREEN
    
    con_items = [
        ("Overcoming Cognitive Friction: ", "FitSnap proves that automated deep learning reduces dietary tracking friction by >90% compared to legacy manual diaries."),
        ("Verified Academic Rigor: ", "Delivers 90.45% Top-1 classification accuracy, 92.48% pixel segmentation, and an unprecedented 1.82% calibration error."),
        ("End-to-End Production Ready: ", "Bridges theoretical computer vision research into a complete, usable, full-stack application featuring 3D visualizations and conversational AI coaching."),
        ("Open-Source Academic Release: ", "All source code, IEEE reports, LaTeX publications, and models are fully published and accessible on GitHub.")
    ]
    for t, d in con_items:
        pb = tf_con.add_paragraph()
        pb.space_before = Pt(8)
        r1 = pb.add_run()
        r1.text = f"• {t}"
        r1.font.bold = True
        r1.font.size = Pt(10.5)
        r2 = pb.add_run()
        r2.text = d
        r2.font.size = Pt(10.5)

    # =========================================================================
    # SLIDE 17: Closing Slide & Project Repository
    # =========================================================================
    s17 = prs.slides.add_slide(blank_layout)
    set_slide_background(s17, DARK_BG)

    tb_end = s17.shapes.add_textbox(Inches(1.0), Inches(1.5), Inches(11.333), Inches(4.5))
    tf_end = tb_end.text_frame
    tf_end.word_wrap = True

    p = tf_end.paragraphs[0]
    p.text = "THANK YOU!"
    p.font.size = Pt(40)
    p.font.bold = True
    p.font.color.rgb = TEXT_LIGHT
    p.alignment = PP_ALIGN.CENTER

    p2 = tf_end.add_paragraph()
    p2.text = "Questions & Academic Discussion"
    p2.font.size = Pt(20)
    p2.font.color.rgb = SKY_BLUE
    p2.alignment = PP_ALIGN.CENTER
    p2.space_before = Pt(10)

    # Repository & Project Info Box
    add_card(s17, Inches(2.2), Inches(3.2), Inches(8.933), Inches(2.8), bg_color=DARK_CARD, border_color=BORDER_DARK)
    b_info = s17.shapes.add_textbox(Inches(2.4), Inches(3.4), Inches(8.533), Inches(2.4))
    tf_i = b_info.text_frame
    tf_i.word_wrap = True

    lines = [
        ("Project Repository: ", "https://github.com/imrohitkumar07/fitsnap"),
        ("Student Investigators: ", "Rohit Kumar (S24CSEU0373) • Abhishek Agarwal (S24CSEU0204) • Samrik Dutta (S24CSEU0457)"),
        ("Project Supervisor: ", "Dr. Satyam Singh (satyam.singh@bennett.edu.in)"),
        ("Department & University: ", "Department of CSE, School of Engineering & Applied Sciences, Bennett University"),
        ("Deliverables Included: ", "IEEE Project Report • LaTeX Source • PyTorch Checkpoints • 3D WebGL Dashboard")
    ]
    for lbl, val in lines:
        pi = tf_i.add_paragraph()
        pi.space_before = Pt(4)
        r1 = pi.add_run()
        r1.text = lbl
        r1.font.bold = True
        r1.font.size = Pt(12)
        r1.font.color.rgb = SKY_BLUE
        r2 = pi.add_run()
        r2.text = val
        r2.font.size = Pt(12)
        r2.font.color.rgb = TEXT_LIGHT

    # Save presentation
    prs.save(output_path)
    print(f"Presentation successfully saved to: {output_path}")

if __name__ == "__main__":
    create_fitsnap_deck("FitSnap_Project_Presentation.pptx")
