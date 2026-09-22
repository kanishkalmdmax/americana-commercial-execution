# Americana Commercial Execution Platform
### Saudi Traditional Trade (TT) & Van Sales Execution System

An enterprise commercial execution application designed for Americana Foods Saudi Arabia, supporting national sales leadership, field route supervisors, and handheld van sales representatives (VSRs).

---

## 🌟 Key Functional Architecture

The application is a **100% self-contained standalone web application** with five integrated operating perspectives:

1. **Executive Leadership Command Center (`Rishi / Akhil`)**
   - Real-time Q1 commercial run-rate, target pacing, and margin performance.
   - Interactive 90-day pilot ROI & revenue growth calculator with dynamic levers:
     - Extra productive drops per van per day (+0.5 to +3.0)
     - Upsell basket size expansion (+5% to +30%)
     - Dormant account recovery share (25% to 100%)

2. **Route Operations & Dispatch Supervisor (`Tanzeel / Riyadh`)**
   - Live 8-van dispatch board across Riyadh central corridors.
   - Stop-by-stop visit compliance, dwell time tracking, and geofenced store check-ins.
   - Live inventory depletion monitoring with automated bay reload approval.

3. **VSR Mobile Van Sales Terminal (`Omar Al-Harbi`)**
   - Mobile-first field execution view for van drivers and presellers.
   - Real-time GPS geofenced check-in at audited baqala and mini-market doors.
   - Intelligent upsell prompts (Kunafa Bars, Cupcake 18-packs) and instant digital invoicing.

4. **Master SKU Catalog (76 Audited On-Shelf Lines)**
   - **Pilot Focus Department**: Ambient Bakery & Snacks (29 SKUs: Cakes, Cookies, Rusks/Shabora).
   - **Automated Cold-Chain Department**: Frozen Foods (43 SKUs: Poultry, Red Meat, Seafood, Vegetables & Fruits handled via automated 3PL logistics).
   - **Canned Grocery & Pantry** (4 SKUs).
   - **Granular Sorting**: Instant sort by Price (SAR 1.50 – 32.00), Net Weight in Grams (45g – 2.5kg), Piece Count (1 Pc – 75 Pcs), Pack Format, and SKU Name.
   - Interactive slide-over drawer with bilingual Arabic typography and shelf visual identification markers.

5. **Store & Customer Intelligence Directory (81.4k Outlets)**
   - Audited traditional trade census covering 81,454 registered stores (50,414 Traditional Trade baqalas & tamwinat).
   - Complete 21-Outlet Taxonomy (`T01`–`T21`) with operational merchandising recommendations.
   - 7 Operating Segments (`G1`–`G7`) with delivery dynamics.
   - 6 Riyadh Locality Corridors with customer-level records, settlement terms (78.2% Cash / 21.8% Credit), and GPS coordinates.

---

## 🚀 Getting Started

No build steps, Node packages, or server runtimes are required.

Simply double-click `index.html` (or `execution_demo.html`) to open the complete application in Google Chrome, Microsoft Edge, Safari, or Firefox.

```bash
# Optional: run a local Python HTTP server
python -m http.server 8080
# Navigate to http://localhost:8080 in your browser
```

---

## 📦 Master Catalog Data Export
The repository includes `Americana_SKU_Catalog.xlsx` containing:
- **Sheet 1**: `Master_SKU_Catalog` (76 on-shelf lines with prices, weights, pieces, formats, barcode refs).
- **Sheet 2**: `Category_Breakdown` (Ambient vs Frozen vs Canned distribution).
- **Sheet 3**: `Pilot_Ambient_Focus` (29 sweet bakery SKUs optimized for van sales).
- **Sheet 4**: `Full_Americana_Portfolio` (11,595 historical master line references).
