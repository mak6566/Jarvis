# J.A.R.V.I.S — Voice Control System

> Iron Man Arc Reactor HUD in a Chrome extension. Full hands‑free browser control, AI chat via Puter.js, and a text‑to‑speech assistant that actually feels like JARVIS.

<p align="center">
  <img src="icons/icon128.png" alt="JARVIS" width="96">
</p>

<p align="center">
  <b>Voice + Chat</b> · <b>30+ Local Commands</b> · <b>Iron Man HUD</b> · <b>Puter.js AI</b> · <b>No API key needed</b>
</p>

---

## Table of Contents

- [What is JARVIS?](#what-is-jarvis)
- [Highlights](#highlights)
- [Screenshots / HUD states](#screenshots--hud-states)
- [Install](#install)
- [First launch — connect Puter](#first-launch--connect-puter)
- [Full command reference](#full-command-reference)
  - [Sites & search](#sites--search)
  - [Browser internal pages](#browser-internal-pages)
  - [Tabs & windows](#tabs--windows)
  - [Navigation & scrolling](#navigation--scrolling)
  - [Zoom & fullscreen](#zoom--fullscreen)
  - [Page interaction (click / type / find)](#page-interaction-click--type--find)
  - [Link‑hint mode (hands‑free clicking)](#link-hint-mode-hands-free-clicking)
  - [Media control](#media-control)
  - [Read / summarize the page](#read--summarize-the-page)
  - [Bookmark & screenshot](#bookmark--screenshot)
  - [System info](#system-info)
  - [Ask anything — AI passthrough](#ask-anything--ai-passthrough)
- [Settings](#settings)
- [AI model catalog](#ai-model-catalog)
- [Architecture](#architecture)
- [Troubleshooting](#troubleshooting)
- [Privacy](#privacy)
- [License](#license)

---

## What is JARVIS?

JARVIS is a Manifest V3 Chrome extension that turns your browser into a voice‑ and text‑controlled workstation, styled after Tony Stark's HUD. It combines a hybrid command grammar (30+ deterministic voice commands) with an AI chat backend powered by **Puter.js** — so anything the grammar doesn't match falls through to the AI, and the AI's reply is spoken back to you.

Everything runs locally in the extension. There is no separate backend, no telemetry, and no API key to buy.

## Highlights

- **True hands‑free browsing.** Open sites, switch tabs, scroll, click links by number, type into inputs, submit forms, play/pause video, take screenshots — all by voice.
- **Iron Man HUD.** Animated arc reactor with state‑driven colors (idle / listening / thinking / speaking), rotating arcs, hex core, waveform monitor, boot log, and a chat console styled as a mission terminal.
- **AI that speaks.** Ask any question and JARVIS answers via Puter AI and reads the reply aloud with TTS. Voice, model, rate, pitch and language are all configurable.
- **Read‑the‑page mode.** *"Summarize this page"* extracts the readable text and asks the AI to summarize/explain it.
- **Link‑hint mode.** Say *"show links"* → every clickable element gets a cyan number badge. Say *"click 7"*. Done.
- **Continuous & wake‑word mode.** Keep the mic hot; JARVIS strips the wake word (default `jarvis`) from every command.
- **No API key.** Puter.js provides free AI access — you just log in with a free Puter account once.

## Screenshots / HUD states

| State | Arc speed | Core color | Waveform |
|---|---|---|---|
| **IDLE** | slow rotation | cyan | gentle |
| **LISTENING** | fast | orange | active orange |
| **THINKING** | very fast | yellow flicker | rapid yellow |
| **SPEAKING** | medium | green | green pulse |

---

## Install

### Option A — Load unpacked (recommended for now)

1. Download the latest release ZIP (or `git clone` this repo).
2. Unzip somewhere permanent (Chrome loads the folder in place).
3. Open `chrome://extensions` and turn on **Developer mode** (top‑right).
4. Click **Load unpacked** and pick the unzipped `J.A.R.V.I.S-1.0.0` folder.
5. Pin the JARVIS icon to the toolbar and click it — the HUD opens.

### Option B — Drag & drop (packed)

1. Open `chrome://extensions` with **Developer mode** on.
2. Drag the `.crx` (or the `.zip`) onto the page.
3. Confirm and pin.

> Works on Chrome, Edge, Brave, Arc, Opera and any other Chromium‑based browser that supports Manifest V3 and the `offscreen` API.

## First launch — connect Puter

On first launch you'll see the **CONNECT PUTER ACCOUNT** overlay.

1. Click **CONNECT PUTER ACCOUNT**.
2. A new tab opens on Puter's real login page (`puter.com/?action=authme`).
3. Log in or create a free account (email + password — Google/Apple/Microsoft also work).
4. The tab closes itself, the badge in the header flips to `AI: <YOUR‑USERNAME>`, and you're live.

The auth token is stored locally in `chrome.storage.local` and applied to the bundled Puter.js SDK — you'll only need to sign in once per machine.

> Voice commands (open, scroll, click, tabs, media, screenshot…) work **without** a Puter account. Only AI chat and the *read/summarize the page* command need Puter.

---

## Full command reference

Say the phrase, or type it into the chat box. All matching is case‑insensitive and forgives filler words. Anything that doesn't match a local command is sent to the AI.

### Sites & search

| Say | What happens |
|---|---|
| `open youtube` | Navigate current tab to youtube.com |
| `open google` / `open gmail` / `open drive` / `open calendar` / `open maps` / `open translate` | Google product shortcuts |
| `open github` / `open twitter` / `open reddit` / `open netflix` / `open spotify` / `open twitch` / `open linkedin` / `open instagram` / `open facebook` / `open whatsapp` / `open amazon` / `open wikipedia` / `open chatgpt` / `open puter` | Site shortcuts |
| `open <anything>` / `go to <url>` / `navigate to <site>` / `visit <domain>` | Dynamic navigation — parses natural URLs (`the verge`, `hacker news`, `example.com`, …) |
| `search for cats` / `google weather in Prague` / `look up bitcoin price` | Google search |

### Browser internal pages

| Say | Opens |
|---|---|
| `open history` | `chrome://history` |
| `open downloads` | `chrome://downloads` |
| `open bookmarks` | `chrome://bookmarks` |
| `open extensions` | `chrome://extensions` |
| `open settings` / `open browser settings` | `chrome://settings` |

### Tabs & windows

| Say | Action |
|---|---|
| `new tab` | Open a new tab |
| `close tab` / `close this tab` | Close the current tab |
| `close tab 3` | Close the 3rd tab in the window |
| `next tab` / `previous tab` / `last tab` | Cycle tabs |
| `switch to tab 2` / `go to tab 4` | Jump to a tab by index |
| `list tabs` | JARVIS reads out all open tabs |
| `duplicate tab` | Clone the current tab |
| `pin tab` / `unpin tab` | Toggle pin |
| `mute tab` / `unmute tab` | Toggle tab audio |
| `reopen tab` / `restore closed tab` | Undo close |
| `new window` | Open a new window |
| `incognito` / `private window` | Open an incognito window |

### Navigation & scrolling

| Say | Action |
|---|---|
| `go back` / `back` | Browser back |
| `go forward` | Browser forward |
| `reload` / `refresh` / `refresh page` | Reload |
| `scroll down` / `scroll up` | Smooth scroll by ~400px |
| `scroll to top` / `scroll to bottom` | Jump to page edges |
| `scroll to <text>` / `jump to <text>` | Find text on page, scroll it into view, briefly highlight it |

### Zoom & fullscreen

| Say | Action |
|---|---|
| `zoom in` / `zoom out` | Adjust page zoom by 10% (clamped to 0.3×–3×) |
| `zoom reset` | Back to 100% |
| `fullscreen` | Toggle fullscreen for the active tab |

### Page interaction (click / type / find)

| Say | Action |
|---|---|
| `click <text>` / `press submit` / `tap continue` / `choose sign in` | Finds the element whose visible text / label / aria‑label / value contains the phrase and clicks it |
| `type your message here` | Types into the focused input, or the first available text field / contenteditable |
| `submit` / `press enter` / `hit enter` / `confirm` | Dispatches Enter + submits the enclosing form |
| `find <text>` | Native browser find |

### Link‑hint mode (hands‑free clicking)

Best combo for pure voice control.

| Say | Action |
|---|---|
| `show links` / `enable numbers` | Overlays cyan numbered badges on up to 150 visible clickable/typable elements |
| `click 7` / `open 12` / `press number 3` / `hit #4` | Activates that element (clicks buttons/links, focuses inputs) |
| `hide links` / `clear numbers` | Removes the overlays |

### Media control

Works on any `<video>` or `<audio>` element on the page (YouTube, Netflix, Spotify web player, Twitch…).

| Say | Action |
|---|---|
| `play` / `resume` | Play the current media |
| `pause` / `stop video` | Pause |
| `mute` / `unmute` | Toggle media mute (different from `mute tab`) |
| `speed up` / `faster` | +0.25× playback rate (max 4×) |
| `slow down` / `slower` | −0.25× playback rate (min 0.25×) |

### Read / summarize the page

| Say | Action |
|---|---|
| `read this page` / `read the article` | Extract readable text and let the AI read/explain it |
| `summarize this` / `summarize the page` | Same, but asks the AI to summarize |

Up to 6,000 characters of the main article body are sent to Puter AI.

### Bookmark & screenshot

| Say | Action |
|---|---|
| `bookmark` / `save page` | Bookmark the current page (uses Chrome's bookmarks API) |
| `take a screenshot` / `take screenshot` | Capture the visible tab and store the data URL in the chat log |

### System info

| Say | Result |
|---|---|
| `status` / `status report` | JARVIS reports system state + AI connection + selected model |
| `what time is it` / `time` | Current time |
| `what's the date` / `date` | Today's date |
| `help` / `what can you do` / `list commands` | Quick voice cheat‑sheet |

### Ask anything — AI passthrough

Anything the grammar doesn't match is forwarded to Puter AI. Examples:

- `who was albert einstein`
- `write a python function that reverses a string`
- `explain quantum entanglement in one paragraph`
- `translate "good morning" to japanese`
- `give me 3 dinner ideas with chicken and rice`

JARVIS speaks the reply (if *Speak AI responses* is on) and shows it in the chat pane.

---

## Settings

Open the **⚙ SETTINGS** tab in the popup.

| Setting | What it does |
|---|---|
| **AI Model** | Pick any Puter‑compatible model id (defaults included, or paste your own) |
| **Voice** | Selects a system voice for TTS |
| **Speech rate / pitch** | 0.5×–2× rate, 0.5×–2× pitch |
| **Language** | Language for speech recognition **and** speech synthesis |
| **Speak AI responses** | Toggle TTS for AI replies |
| **Continuous listening** | Keep the mic hot after every command |
| **Wake word** | Prefix stripped from every voice command (default: `jarvis`) |
| **Show page indicator** | Cyan HUD overlay flashes on the page when a command executes |
| **Puter Account** | Sign in / sign out — status shown as `@username` |

---

## AI model catalog

Puter's model catalog changes frequently. Any valid Puter model id works — just paste it into the model box.

| Model | ID | Notes |
|---|---|---|
| Ling 3.0 Flash | `ling-3.0-flash` | Default — free, fast |
| GPT‑4o Mini | `gpt-4o-mini` | Fast, general purpose |
| Claude 3.5 Sonnet | `claude-3-5-sonnet` | Deeper reasoning |

Any current Puter model id (GPT‑5, Claude 4, Gemini, DeepSeek, etc.) will also work as long as your Puter account has access to it.

---

## Architecture

```
J.A.R.V.I.S-1.0.0/
├── manifest.json          # MV3 manifest — permissions, CSP, offscreen doc
├── background.js          # Service worker — tab / browser / page commands
│                          # + Puter token bridge (real-user only)
├── content.js             # Injected into pages — HUD overlay indicator
├── offscreen.html/.js     # Hidden document that owns the microphone and
│                          # runs SpeechRecognition (workaround for Chrome's
│                          # popup-microphone limitation)
├── mic-permission.html/.js# Fallback page that requests mic permission
├── popup.html/.css/.js    # Main HUD UI — Arc Reactor, chat, log, settings
├── puter.js               # Bundled Puter.js SDK (no CDN, CSP-safe)
└── icons/                 # 16 / 48 / 128 px
```

### Hybrid command flow

```
┌─────────────────────────────────────────────┐
│  User input (voice via offscreen mic /      │
│              text in the chat pane)         │
└──────────────────────┬──────────────────────┘
                       │
                strip wake word
                       │
                 matchCommand()
                       │
        ┌──────────────┴──────────────┐
        │                             │
   local match?                    no match
        │                             │
        ▼                             ▼
  runCommand()                   Puter.js AI
  ├─ url        (chrome.tabs)   (puter.ai.chat)
  ├─ bg cmd     (background.js)     │
  ├─ hint       (link-hint)         ▼
  ├─ click_text / type_text     jarvisReply()
  ├─ search / navigate               │
  └─ read / scroll_to           TTS + chat bubble
        │
   jarvisReply()
```

### Puter auth model

Chrome extension popups can't reliably run `puter.auth.signIn()` (the OAuth popup inside a `chrome-extension://` origin doesn't return the token). JARVIS solves this with a **token bridge**:

1. `background.js` opens `https://puter.com/?action=authme` — the `authme` action **disables Puter's temporary/guest user auto‑creation**, forcing the real login form.
2. Once the user signs in, `background.js` reads the token from that tab's `localStorage` — but **only if `logged_in_users` is non‑empty**, guaranteeing it's a real account, not a guest.
3. The token is handed to the popup, which calls `puter.setAuthToken(token)` on the bundled SDK and persists it in `chrome.storage.local`.
4. `verifyUser()` rejects `is_temp` / `temp_*` users as an extra safety net.

This is the fix that landed in v1.0.0 — previous builds opened `puter.com/` (which silently signed users in as guests, and guest tokens can't use `puter.ai.chat`).

---

## Troubleshooting

<details>
<summary><b>The badge says <code>AI: READY</code> and the AI overlay keeps coming back.</b></summary>

You're not signed in yet, or the token was rejected as a guest.

1. Open Settings → **Puter Account** → **CONNECT**.
2. Complete the login on the new tab.
3. The tab should close itself within 1–2 seconds after login. If it doesn't, refresh the popup (close & reopen it).
</details>

<details>
<summary><b>AI error: <code>unauthorized</code></b></summary>

The stored token is stale or belonged to a guest. Sign out and sign back in — v1.0.0 auto‑clears guest tokens on startup, so this should heal itself on the next popup open.
</details>

<details>
<summary><b>Microphone doesn't work / permission prompt loops.</b></summary>

Chrome requires an explicit permission grant for extension origins. Open the popup, click the mic, and — if no prompt appears — visit `chrome://settings/content/microphone` and add the extension's origin (`chrome-extension://<id>`) to *Allowed to use your microphone*.
</details>

<details>
<summary><b><code>click 5</code> doesn't do anything.</b></summary>

Say `show links` first — hint numbers are computed on demand and cleared after each activation.
</details>

<details>
<summary><b>Speech recognition is inaccurate for my language.</b></summary>

Change **Settings → Language** to a locale code your Chrome supports (`en-US`, `en-GB`, `sk-SK`, `de-DE`, `fr-FR`, `es-ES`, `pt-BR`, …). This flips both recognition and TTS.
</details>

---

## Privacy

- **No server.** The extension is 100% client‑side. There is no backend under our control.
- **Puter.js** is called directly from the popup — your prompts and page‑summary text go to Puter's servers under your account. See [Puter's privacy policy](https://puter.com/privacy).
- **Voice** is transcribed by Chrome's built‑in Web Speech API. Depending on your Chrome build this may involve Google's speech service — that call is made by the browser itself, not by the extension.
- **Storage.** Only your Puter auth token and your settings live in `chrome.storage.local`. Nothing else is persisted.
- **Permissions requested and why:**
  - `activeTab`, `tabs`, `scripting` — read the current tab, execute page commands, click/type into pages
  - `storage` — persist settings + Puter token
  - `bookmarks` — for the *bookmark this page* command
  - `sessions` — for *reopen closed tab*
  - `offscreen` — host the microphone document
  - `host_permissions: <all_urls>` — required to run page commands on any site
  - `connect-src https://*.puter.com` — talk to Puter's API from the extension

---

## License

MIT © 2026 — Stark Industries fan project. Iron Man, JARVIS and the arc reactor are trademarks of Marvel; this project is not affiliated with or endorsed by Marvel Studios.
