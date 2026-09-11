# SELENE-MATCH UI Redesign Documentation

## Overview
This document details the comprehensive UI/UX redesign of **SELENE-MATCH** (Chandrayaan-2 & LRO Multi-modal Lunar Image Registration Workbench).

The redesign focused on transforming the application into a clean, modern, intuitive workbench inspired by NASA/ISRO workbench standards while removing artificial AI template gimmicks and preserving 100% of underlying business logic and state management.

---

## Key Design Principles
1. **Clean Scientific Workbench Aesthetic**: Standardized dark neutral palette (`slate-900`, `slate-950`), crisp typography (`Inter`, `Plus Jakarta Sans`, `JetBrains Mono`), and clear high-contrast status badges.
2. **Simplified Navigation**: Structured 5-step numbered workflow navigation (`Upload`, `Register`, `Matches`, `Results`, `Exports`).
3. **No AI Template Clutter**: Removed decorative noise overlays, floating artificial AI assistant orbs, and 3-second artificial boot delay timers.
4. **Interactive Visualization**: Lightweight split-curtain comparison slider, sub-pixel vector correspondence canvas, and deformation heatmap visualizer.
5. **Zero Logic Regression**: Retained full compatibility with `AppContext`, FastAPI backend endpoints, and all registration options.

---

## Workflow Views Summary

| View | Purpose | Highlights |
| --- | --- | --- |
| **Landing Page** | Highlighting core features & problem statement | Clean Hero, 4-step pipeline cards, accuracy benchmark table |
| **Dashboard** | Mission overview hub | 4 KPI summary cards, sensor selector status |
| **Upload View** | Dual-pane image dropzone | Drag & drop for reference/target images, synthetic generator toggle |
| **Register View** | Pipeline configuration & execution | Stage selector, matcher model routing, live 9-stage progress bar |
| **Matches View** | Feature correspondence inspection | MAGSAC++ inlier stats, interactive vector correspondence canvas |
| **Results View** | Output visualizer | Split curtain slider, 8x8 checkerboard, GCP quiver vectors |
| **Exports View** | Output products deliverable hub | GeoTIFF, GCP CSV matrix, and printable PDF registration report |
| **Logs View** | Live telemetry log console | Real-time stdout/stderr stream with clear action |
| **Settings View** | Preferences & server config | API base URL configuration & default GSD strategy |
| **About View** | SIH 2026 Problem statement | Algorithm comparison matrix & ISRO/LRO sensor metadata |

---

## Tech Stack
- **Framework**: React 18, TypeScript, Vite
- **Styling**: Vanilla CSS tokens & Tailwind CSS utilities
- **Icons**: Lucide React
- **Data Visualization**: Recharts & HTML5 Canvas
- **Animation**: Framer Motion
