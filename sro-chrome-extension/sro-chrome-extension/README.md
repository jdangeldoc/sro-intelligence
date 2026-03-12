# SRO Intelligence — Chrome Extension

## What This Does

Opens the SRO dashboard in a **side panel** alongside Meditech (or any EMR). Staff clicks the SRO icon, panel slides open on the right, EMR stays on the left. No Meditech integration needed — just visual side-by-side access.

---

## Installation (2 minutes)

### Step 1: Copy the folder

Copy the entire `sro-chrome-extension` folder to the clinic workstation. Put it somewhere permanent (e.g., `C:\SRO\sro-chrome-extension`). Don't delete it after installing — Chrome reads from this folder.

### Step 2: Load in Chrome

1. Open Chrome
2. Go to `chrome://extensions`
3. Turn on **Developer mode** (toggle in top-right corner)
4. Click **"Load unpacked"**
5. Select the `sro-chrome-extension` folder
6. The SRO icon (blue "S") appears in your toolbar

### Step 3: Configure the URL

1. Click the SRO icon in the toolbar
2. Enter your NUC's IP address: `http://192.168.x.x:3000`
   - Replace `x.x` with your actual NUC IP
   - If testing locally, leave as `http://localhost:3000`
3. Click **Save**
4. The status dot shows green if connected

### Step 4: Pin the extension

Right-click the SRO icon → **"Pin"** so it's always visible in the toolbar.

---

## Usage

**Open Side Panel:** Click the SRO icon → "Open Side Panel"
- Panel slides open on the right side of Chrome
- Meditech (or any page) stays visible on the left
- Use the quick-nav bar at top: Dashboard | Pre-Op | Surg Prep | Analytics | RPM

**Refresh:** Click ⟳ in the side panel header

**Pop Out:** Click ⤢ to open SRO in a full browser tab

**Change Server URL:** Click the SRO icon → edit the URL → Save

---

## Required: Server.js Patch

For the side panel iframe to load SRO pages, add this line near the top of `sro-local/server.js`, right after the `app.use(express.json())` line:

```javascript
// Allow Chrome extension side panel to iframe SRO pages
app.use((req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self' chrome-extension://*");
  next();
});
```

This tells the browser: "SRO pages can be loaded inside Chrome extension iframes." Without this, the browser may block the side panel from showing SRO content.

---

## Troubleshooting

**Side panel shows "Can't reach SRO server":**
- Is the NUC running? Check that `npm start` is active in sro-local
- Are you on the clinic network? The NUC is only reachable on the local network
- Is the URL correct? Click the SRO icon and verify the IP address

**Side panel shows blank white page:**
- Apply the server.js patch above (X-Frame-Options fix)
- Restart the SRO server after patching

**Extension disappeared after Chrome update:**
- Go to `chrome://extensions`, it may just be disabled
- If removed, re-load the unpacked folder

---

## Enterprise Deployment (Optional)

For deploying to multiple clinic workstations without manual install, Chrome supports enterprise policy-based extension installation. This requires setting up a Windows Group Policy or using Chrome Browser Cloud Management. Not needed for pilot — just load unpacked on each workstation.
