# SRO Cockpit UI Resources

## Background Image (cockpit_bg.png)

The `cockpit-view.html` page expects a background image at `/cockpit/cockpit_bg.png` that serves as the visual interface for the patient cockpit view.

### Required Image Specifications

- **Filename**: `cockpit_bg.png`
- **Format**: PNG (or JPG)
- **Dimensions**: 1600x1000 pixels (or any 16:10 aspect ratio)
- **Purpose**: Full HUD-style interface showing:
  - Central patient hub (circular, center ~32-68%)
  - 7 surgical journey sectors positioned radially around the center
  - Status indicators and data visualization elements
  - Dark theme (#0a0e17 background) with cyan (#00e5ff) accents

### Hotspot Overlay Map

The `cockpit-view.html` file overlays **8 clickable hotspots** (invisible on hover, visible areas highlighted) positioned as percentages:

| Sector | Position | Size | Click Handler |
|--------|----------|------|---|
| **Decision** | top:5%, left:38% | 24%×20% | Opens Decision stage details |
| **Pre-Op** | top:12%, left:10% | 22%×22% | Opens Pre-Op stage details |
| **Surgery** | top:12%, left:68% | 22%×22% | Opens Surgery stage details |
| **Billing** | top:38%, left:8% | 22%×22% | Opens Billing stage details |
| **Post-Op** | top:38%, left:70% | 22%×22% | Opens Post-Op stage details |
| **Engagement** | top:65%, left:14% | 22%×20% | Opens Engagement stage details |
| **PT** | top:65%, left:60% | 22%×20% | Opens PT stage details |
| **Patient Hub** | top:30%, left:32% | 36%×35% | Opens Patient Information panel |

### Creating the Background Image

You can:

1. **Use an existing mockup** — If you have a design file (Figma, Adobe XD, Photoshop), export it as PNG
2. **Create a new design** — Design a HUD-style patient view in your design tool with the 7 sectors arranged radially
3. **Use a placeholder** — For development/testing, create a simple dark background with circular/sector shapes

### Hotspot Finder Tool

Use **`/cockpit/tuner.html`** to visually map and test hotspot coordinates:

1. Upload or select your background image in the tuner
2. Use the "HOTSPOT MAPPER" mode to click and drag to draw rectangles
3. Name each hotspot as you create it
4. Export the hotspot data as HTML
5. Adjust coordinates in `cockpit-view.html` based on your specific image layout

### Color Palette (for reference)

- **Background**: #0a0e17
- **Primary Accent**: #00e5ff (cyan)
- **Secondary Accent**: #ffab00 (amber)
- **Success**: #4caf50 (green)
- **Alert**: #f44336 (red)
- **Warning**: #ff9800 (orange)

---

**Next Step**: Place your `cockpit_bg.png` file in this directory, then navigate to `/cockpit-view.html?patient={patientId}` to see the interactive cockpit view.
