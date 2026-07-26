# J.A.R.V.I.S — Voice Control System v2.0

> Iron Man Arc Reactor HUD Chrome Extension  
> Powered by Puter.js AI · Manifest V3

---

## Features

- **Iron Man HUD Design** — Arc Reactor visual with animated rotating arcs, hex core, tick rings, and state-driven animations
- **Voice Recognition** — Web Speech API with continuous mode option
- **AI Chat via Puter.js** — Ask any question; JARVIS routes non-commands to AI automatically
- **Text-to-Speech** — JARVIS reads every response aloud
- **30+ Local Commands** — Tab control, navigation, scrolling, zoom, bookmarks, and more
- **4 View Tabs** — HUD, Chat, Log, Settings

---

## AI Models Available

| Model | ID | Notes |
|---|---|---|
| Ling 3.0 Flash | `ling-3.0-flash` | **Default — Free** |
| GPT-4o Mini | `gpt-4o-mini` | Fast, capable |
| Claude 3.5 Sonnet | `claude-3-5-sonnet` | Advanced reasoning |

---

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `jarvis-extension/` folder
5. Pin the JARVIS icon from the toolbar
6. Click the icon to open the HUD

> **No API key needed!** Puter.js provides AI access through its free tier.

---

## Voice Commands Reference

### Navigation
| Say | Action |
|---|---|
| "Open YouTube" | Go to YouTube |
| "Open Google" | Go to Google |
| "Open GitHub" | Go to GitHub |
| "Open [site]" | Navigate to any site |
| "Go to [url]" | Navigate to URL |

### Browser Control
| Say | Action |
|---|---|
| "New tab" | Open new tab |
| "Close tab" | Close current tab |
| "Next tab" | Switch to next tab |
| "Previous tab" | Switch to prev tab |
| "List tabs" | List all open tabs |
| "Go back" | Browser back |
| "Go forward" | Browser forward |
| "Reload" / "Refresh" | Reload page |

### Page Control
| Say | Action |
|---|---|
| "Scroll down" | Scroll page down |
| "Scroll up" | Scroll page up |
| "Scroll to top" | Jump to top |
| "Scroll to bottom" | Jump to bottom |
| "Zoom in" | Increase page zoom |
| "Zoom out" | Decrease page zoom |
| "Zoom reset" | Reset to 100% |
| "Find [text]" | Find text on page |
| "Bookmark" | Bookmark this page |
| "Take a screenshot" | Capture visible tab |

### System
| Say | Action |
|---|---|
| "Status report" | System status |
| "What time is it" | Current time |
| "What's the date" | Today's date |

### AI (anything else)
| Say | Result |
|---|---|
| "Who was Albert Einstein?" | AI answers |
| "Explain quantum physics" | AI explains |
| "Write a Python function that..." | AI generates code |
| Any question not matched above | → Puter.js AI |

---

## HUD State Visual Guide

| State | Arc Speed | Core Color | Wave |
|---|---|---|---|
| IDLE | Slow | Cyan | Gentle |
| LISTENING | Fast | Orange | Active orange |
| THINKING | Very fast | Yellow flicker | Rapid yellow |
| SPEAKING | Medium | Green | Green pulse |

---

## Settings

- **AI Model** — Select Ling 3.0 Flash, GPT-4o Mini, or Claude 3.5 Sonnet
- **Voice Rate / Pitch** — Adjust TTS speed and pitch
- **Language** — Recognition & speech language
- **Speak AI Responses** — Toggle TTS for AI answers
- **Continuous Listening** — Keep mic open after each command
- **Wakeword** — Prefix to strip from commands (default: `jarvis`)
- **Show Page Indicator** — HUD overlay on page when command executes

---

## Architecture

```
jarvis-extension/
├── manifest.json      # MV3 manifest — permissions, CSP
├── background.js      # Service worker — tab & browser commands
├── content.js         # Injected into pages — DOM commands & indicator
├── popup.html         # Main UI shell
├── popup.css          # HUD theme — Arc Reactor animations
├── popup.js           # Master controller — state, voice, AI, commands
└── icons/             # Extension icons (16, 48, 128px)
```

### Hybrid Command Flow
```
User input (voice / text)
        │
        ▼
matchLocalCommand()
        │
    ┌───┴───┐
  Local?   No → Puter.js AI (puter.ai.chat)
    │                │
    ▼                ▼
background.js   JARVIS responds
(tab commands)  speak + display
        │
    respondJarvis()
        │
    TTS + chat bubble
```
