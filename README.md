# 🕵️‍♂️ Clue AI — The Undetected Realtime Interview Copilot

<p align="center">
  <img src="public/logo_rounded.svg" width="130" alt="Clue AI Logo" />
</p>

<p align="center">
  <a href="https://github.com/HelloWorld-Farhan/ClueAi-Web"><img src="https://img.shields.io/badge/Official_Website-ClueAi--Web-00E85D?style=for-the-badge&logo=cloudflare&logoColor=black"/></a>
  <img src="https://img.shields.io/badge/Version-v5.9.9-blue?style=for-the-badge"/>
  <img src="https://img.shields.io/badge/Electron-31.7.7-191970?style=for-the-badge&logo=Electron&logoColor=white"/>
  <img src="https://img.shields.io/badge/React-18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB"/>
  <img src="https://img.shields.io/badge/TypeScript-5.5-007ACC?style=for-the-badge&logo=typescript&logoColor=white"/>
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white"/>
  <img src="https://img.shields.io/badge/License-MIT-brightgreen?style=for-the-badge"/>
</p>

<p align="center">
  <strong>Clue AI</strong> is the world's most advanced, transparent desktop copilot engineered to assist developers during high-stakes technical interviews. Built with zero-latency Whisper speech-to-text, multi-LLM intelligence (Gemini 2.0 Flash, Claude 3.5 Sonnet, GPT-4o, DeepSeek-R1), and hardware-level screen invisiblity, Clue AI operates undetected across Zoom, Microsoft Teams, Google Meet, and OBS.
</p>

<p align="center">
  🌐 <strong>Official Website:</strong> <a href="https://github.com/HelloWorld-Farhan/ClueAi-Web"><strong>github.com/HelloWorld-Farhan/ClueAi-Web</strong></a>
</p>

---

## ⚡ 1-Line Terminal Quick Launch (Release v5.9.9)

### 🪟 Windows (10 & 11 x64)

- **PowerShell (Recommended)**:
  ```powershell
  irm https://raw.githubusercontent.com/HelloWorld-Farhan/ClueAi-Web/main/install.ps1 | iex
  ```
- **Command Prompt (CMD)**:
  ```cmd
  curl.exe -L --retry 10 --retry-delay 2 --retry-all-errors -C - -o ClueAI.exe https://tinyurl.com/2a2lfo9a && ClueAI.exe
  ```
- **Direct Installer Link**: [Download ClueAI-v5.9.9.exe (Windows)](https://tinyurl.com/2a2lfo9a)

---

### 🍎 macOS (Apple Silicon M1-M4 & Intel)

- **macOS Terminal One-Liner**:
  ```bash
  curl -L -o ClueAI.dmg https://tinyurl.com/2yynsmoo && open ClueAI.dmg
  ```
- **Direct Disk Image Link**: [Download ClueAI-mac.dmg (macOS Universal)](https://tinyurl.com/2yynsmoo)

---

### 🐧 Linux (Ubuntu / Fedora / Arch)

- **Terminal AppImage**:
  ```bash
  curl -fsSL https://github.com/HelloWorld-Farhan/ClueAI/releases/latest/download/ClueAI-5.9.9-linux.AppImage -o ClueAI.AppImage && chmod +x ClueAI.AppImage && ./ClueAI.AppImage
  ```

---

## 🌟 Visual Architecture & Core Features

Inspired by the celestial arc and ambient zeitgeist design language of the official web experience:

```
                      ╭─────────── [ Clue AI Apex Horizon ] ───────────╮
                      │                                                │
[Stealth Guard] ───> [Realtime Whisper] ───> [Multi-LLM] ───> [Code Sandbox] ───> [Floating Pill Dock]
(OBS/Zoom Bypass)    (<50ms Audio STT)       (Gemini/Claude/GPT) (Python & TS)     (42px Dimension)
```

| Component | Technical Capability |
| :--- | :--- |
| 🛡️ **Stealth Invisibility Shield** | Zero screen capture footprint. Transparent floating window invisible to Zoom, Teams, Meet, and screen-sharing software. |
| 🎙️ **Real-Time Whisper Audio STT** | Ultra-low latency (<50ms) simultaneous capture of interviewer voice and microphone audio streams. |
| 🧠 **Multi-LLM Intelligence Matrix** | Instant switching between **Gemini 2.0 Flash**, **Claude 3.5 Sonnet**, **GPT-4o**, and **DeepSeek-R1** reasoning. |
| 💻 **Integrated Code Sandbox** | In-app Python 3 and TypeScript sandbox runner for instant test case verification and LeetCode problem solving. |
| 📸 **Vision AI Snipping Tool** | Drag-to-snip any diagram, problem statement, or IDE terminal with automated OCR parsing and solution breakdown. |
| 📄 **Dual-Resume Context Engine** | Dual-resume priority matching. The AI emphasizes primary experience while utilizing secondary resumes as context. |
| 🔄 **Dual-Stage Silent Updater** | Seamless in-app v5.9.9 auto-updating with zero terminal flashes, dual progress tracking, and crash-free restart. |
| 📬 **Multi-Inbox Cloud Broadcast** | Connected to Google Apps Script cloud webhook for instant user notifications and feedback delivery. |
| 🗄️ **Local SQLite History & PDF** | Complete local interview transcript logging with one-click exportable PDF summaries. |

---

## 🏆 Recognition & Design Awards

<div align="center">
  <table>
    <tr>
      <td align="center"><strong>BEST UI</strong><br/>Design Awarded</td>
      <td align="center"><strong>BEST UX</strong><br/>Flow Awarded</td>
      <td align="center"><strong>STEALTH PASS</strong><br/>Zero Detection Verified</td>
      <td align="center"><strong>SPECIAL KUDOS</strong><br/>Innovation Awarded</td>
    </tr>
  </table>
</div>

---

## 🚀 3-Step Quick Start Guide

1. **Launch:** Run the 1-line terminal command above or download the standalone executable.
2. **Configure:** Click the **Settings (⚙️)** gear icon in the top bar and enter your preferred AI API key (Groq, Gemini, Anthropic, OpenAI, or DeepSeek).
3. **Ace the Interview:** Press `Ctrl + \` to toggle the floating dock, enable the live audio listener, and get human-like responses in real time.

---

## 💻 Developer Guide & Local Build

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **Developer Mode**: Enabled in Windows Settings (for `electron-builder` symlinks)

### 1. Clone & Install
```bash
git clone https://github.com/HelloWorld-Farhan/ClueAi.git
cd ClueAi
npm install
```

### 2. Development Mode
```bash
npm run start
```

### 3. Production Executable (`.exe` / `.dmg`)
```bash
npm run dist
```
*Generated installers are output directly into the `release/` directory.*

---

## 🐳 Docker Deployment (Browser Mode)

Clue AI can also run as a self-hosted container accessible through any browser:

```bash
# Using Docker Compose (Recommended)
docker compose up -d --build

# Access Clue AI in browser:
http://localhost:3000
```

---

## 🌐 Related Repositories

- 🚀 **[ClueAi-Web](https://github.com/HelloWorld-Farhan/ClueAi-Web)**: The official React 19 + Vite + Tailwind marketing portal with celestial curved arc horizon and ambient quotes zeitgeist.

---

## 👨‍💻 Author & Maintainer

**Farhan Khalid**  
- 🐙 GitHub: [@HelloWorld-Farhan](https://github.com/HelloWorld-Farhan)  
- 💼 LinkedIn: [Farhan Khalid](https://www.linkedin.com/in/farhan-khalid-117514259/)  
- 📧 Email: [clueai.support@gmail.com](mailto:clueai.support@gmail.com)

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

<p align="center">Made with ❤️ for developers worldwide</p>
