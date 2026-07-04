import { useEffect, useState, useRef } from 'react';
import { Play, Square, Mic, Upload, Cpu, FileText, Pause, Settings, LayoutPanelTop, Trash2, X, Minus, Loader2, Maximize, MoreVertical, Download, Plus, Move, Copy, Eye, EyeOff, ChevronDown, ChevronRight, Save, Crop, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { initAIClient, getInterviewAnswer, switchProvider } from './AIClient';
import { initSTT, transcribeAudioChunk, setSTTApiKey } from './STTClient';
// @ts-ignore
const { ipcRenderer, shell } = window.require('electron');

function App() {
  const [provider, setProvider] = useState<'groq' | 'gemini'>('groq');
  const [groqKeys, setGroqKeys] = useState<string[]>(() => {
    try { 
      const keys = JSON.parse(localStorage.getItem('groq_api_keys') || '[]'); 
      return keys.length === 15 ? keys : [...keys, ...Array(15).fill('')].slice(0, 15);
    } catch { return Array(15).fill(''); }
  });
  const [geminiKeys, setGeminiKeys] = useState<string[]>(() => {
    try { 
      const keys = JSON.parse(localStorage.getItem('gemini_api_keys') || '[]'); 
      return keys.length === 15 ? keys : [...keys, ...Array(15).fill('')].slice(0, 15);
    } catch { return Array(15).fill(''); }
  });

  const [showGroqKeys, setShowGroqKeys] = useState<boolean[]>(Array(15).fill(false));
  const [showGeminiKeys, setShowGeminiKeys] = useState<boolean[]>(Array(15).fill(false));

  const [apiAccordion, setApiAccordion] = useState<'none' | 'groq' | 'gemini'>('none');
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [sources, setSources] = useState<any[]>([]);
  const [selectedSource, setSelectedSource] = useState('');
  const [stealthMode, setStealthMode] = useState(true);
  const [showStealthWarning, setShowStealthWarning] = useState(false);
  
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionName, setEditingSessionName] = useState('');

  // Reminders
  const [reminders, setReminders] = useState<{id: string, text: string, time: string}[]>(() => {
    try { return JSON.parse(localStorage.getItem('reminders') || '[]'); } catch { return []; }
  });
  const [reminderInput, setReminderInput] = useState('');
  
  const [resumeText, setResumeText] = useState(localStorage.getItem('resume_text') || '');
  const [resumeFileName, setResumeFileName] = useState(localStorage.getItem('resume_file_name') || '');
  const [isUploadingResume, setIsUploadingResume] = useState(false);

  const [resumeText2, setResumeText2] = useState(localStorage.getItem('resume_text_2') || '');
  const [resumeFileName2, setResumeFileName2] = useState(localStorage.getItem('resume_file_name_2') || '');
  const [isUploadingResume2, setIsUploadingResume2] = useState(false);
  const [resumePriority, setResumePriority] = useState<number>(parseInt(localStorage.getItem('resume_priority') || '1'));

  const [personalContextText, setPersonalContextText] = useState(localStorage.getItem('personal_context_text') || '');
  const [personalContextFileName, setPersonalContextFileName] = useState(localStorage.getItem('personal_context_file_name') || '');
  const [isUploadingPersonalContext, setIsUploadingPersonalContext] = useState(false);

  const [opacity, setOpacity] = useState(1.0);
  const [layout, setLayout] = useState('horizontal');
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [copiedAnswer, setCopiedAnswer] = useState(false);
  // Snapshot States
  const [currentSnapshot, setCurrentSnapshot] = useState<string | null>(null);
  const [snapshotHistory, setSnapshotHistory] = useState<{id: string, image: string, transcriptContext: string}[]>([]);
  const [previewSnapshot, setPreviewSnapshot] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{x: number, y: number, id: string | null}>({x: 0, y: 0, id: null});

  // Session History
  const [sessions, setSessions] = useState<{id: string, name: string, time: string, transcript: string, aiAnswer: string, date?: string, snapshotHistory?: {id: string, image: string, transcriptContext: string}[]}[]>(() => {
    try { return JSON.parse(localStorage.getItem('sessions') || '[]'); } catch { return []; }
  });
  const [showSessionPrompt, setShowSessionPrompt] = useState(false);
  const [sessionNameInput, setSessionNameInput] = useState('');
  const [currentSessionId, setCurrentSessionId] = useState('');
  
  const [sessionLog, setSessionLog] = useState('');
  const [interviewTitle, setInterviewTitle] = useState(localStorage.getItem('interview_title') || '');
  const [sessionError, setSessionError] = useState('');
  
  const [saveMessage, setSaveMessage] = useState('');
  const [deleteMessage, setDeleteMessage] = useState<{provider: string, index: number} | null>(null);

  const [activeAIInfo, setActiveAIInfo] = useState<{provider: string, index: number} | null>(null);
  const [modelChangeMsg, setModelChangeMsg] = useState('');

  const saveApiKeys = () => {
    const invalidGroq = groqKeys.some(k => k.trim() !== '' && !(k.trim().startsWith('gsk_') && k.trim().length === 56));
    const invalidGemini = geminiKeys.some(k => k.trim() !== '' && !((k.trim().startsWith('AIza') || k.trim().startsWith('AQ.')) && k.trim().length === 39));

    if (invalidGroq || invalidGemini) {
      setSaveMessage('Invalid API Key detected! Please correct or remove the invalid key (Red Cross).');
    } else {
      localStorage.setItem('groq_api_keys', JSON.stringify(groqKeys));
      localStorage.setItem('gemini_api_keys', JSON.stringify(geminiKeys));
      initAIClient(provider, groqKeys, geminiKeys);
      setSTTApiKey(groqKeys.filter(k => k.trim()));
      setSaveMessage('Saved successfully!');
    }
    setTimeout(() => setSaveMessage(''), 3000);
  };

  useEffect(() => {
    localStorage.setItem('resume_text', resumeText);
  }, [resumeText]);

  useEffect(() => {
    localStorage.setItem('resume_file_name', resumeFileName);
  }, [resumeFileName]);

  useEffect(() => {
    localStorage.setItem('resume_text_2', resumeText2);
  }, [resumeText2]);

  useEffect(() => {
    localStorage.setItem('resume_file_name_2', resumeFileName2);
  }, [resumeFileName2]);

  useEffect(() => {
    localStorage.setItem('resume_priority', resumePriority.toString());
  }, [resumePriority]);

  useEffect(() => {
    localStorage.setItem('personal_context_text', personalContextText);
  }, [personalContextText]);

  useEffect(() => {
    localStorage.setItem('personal_context_file_name', personalContextFileName);
  }, [personalContextFileName]);

  useEffect(() => {
    localStorage.setItem('reminders', JSON.stringify(reminders));
  }, [reminders]);

  useEffect(() => {
    ipcRenderer.invoke('set-layout', layout);
  }, [layout]);

  useEffect(() => {
    localStorage.setItem('sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('interview_title', interviewTitle);
  }, [interviewTitle]);
  
  const [isGenerating, setIsGenerating] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioDataRef = useRef<Float32Array>(new Float32Array(0));
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    ipcRenderer.invoke('get-desktop-sources').then((s: any) => {
      setSources(s);
      if (s.length > 0) setSelectedSource(s[0].id);
    });
    
    // ALWAYS default to Stealth Mode ON every time the app opens for maximum safety
    setStealthMode(true);
    ipcRenderer.invoke('set-stealth', true);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'resume1' | 'resume2' | 'personal') => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (type === 'resume1') setIsUploadingResume(true);
    else if (type === 'resume2') setIsUploadingResume2(true);
    else setIsUploadingPersonalContext(true);

    if (type === 'resume1') setResumeFileName(file.name);
    else if (type === 'resume2') setResumeFileName2(file.name);
    else setPersonalContextFileName(file.name);
    
    try {
      let parsedText = '';
      if (file.name.endsWith('.pdf')) {
        const arrayBuffer = await file.arrayBuffer();
        parsedText = await ipcRenderer.invoke('parse-pdf-buffer', arrayBuffer);
      } else {
        const reader = new FileReader();
        parsedText = await new Promise((resolve) => {
          reader.onload = (ev) => resolve(ev.target?.result as string);
          reader.readAsText(file);
        });
      }
      
      if (parsedText) {
        if (type === 'resume1') setResumeText(parsedText);
        else if (type === 'resume2') setResumeText2(parsedText);
        else setPersonalContextText(parsedText);
      } else {
        alert('Failed to parse file.');
        if (type === 'resume1') setResumeFileName('');
        else if (type === 'resume2') setResumeFileName2('');
        else setPersonalContextFileName('');
      }
    } catch (err: any) {
      alert(`Error parsing file: ${err.message}`);
      if (type === 'resume1') setResumeFileName('');
      else if (type === 'resume2') setResumeFileName2('');
      else setPersonalContextFileName('');
    } finally {
      if (type === 'resume1') setIsUploadingResume(false);
      else if (type === 'resume2') setIsUploadingResume2(false);
      else setIsUploadingPersonalContext(false);
    }
  };

  const handleStartCaptureClick = () => {
    const activeKeys = provider === 'groq' ? groqKeys : geminiKeys;
    const hasActiveKey = activeKeys.some(k => k.trim() !== '');
    const hasGroqKey = groqKeys.some(k => k.trim() !== '');

    if (!hasActiveKey) return alert(`Please enter your ${provider === 'groq' ? 'Groq' : 'Gemini'} API Key first (at least Key 1).`);
    if (!hasGroqKey) return alert('Groq API Key is ALWAYS required for Speech-to-Text transcription. Please enter it.');
    if (!selectedSource) return alert('Please select a screen to capture.');
    
    setSessionNameInput('');
    setCurrentSessionId('');
    setSessionError('');
    setShowSessionPrompt(true);
  };

  const activeAITimeoutRef = useRef<any>(null);

  const startRecording = async () => {
    if (!selectedSource) {
      alert('Screen capture source is missing. Trying to fetch it again... Please wait a moment and try again.');
      ipcRenderer.invoke('get-desktop-sources').then((s: any) => {
        setSources(s);
        if (s.length > 0) setSelectedSource(s[0].id);
      });
      return;
    }

    if (showSessionPrompt) {
      if (!currentSessionId) {
        const name = sessionNameInput.trim();
        if (!name) {
          setSessionError('Please enter a session name.');
          return;
        }
        if (sessions.some(s => s.name.toLowerCase() === name.toLowerCase())) {
          setSessionError('Session name already exists. Please choose a different name.');
          return;
        }
      }
      
      if (currentSessionId) {
         const existing = sessions.find(s => s.id === currentSessionId);
         if (existing) {
             setSessionLog(existing.transcript + `\n\n--- RESUMED ON ${new Date().toLocaleDateString()} AT ${new Date().toLocaleTimeString()} ---\n\n`);
         }
      } else {
         setSessionLog('');
         setCurrentSessionId(Date.now().toString());
      }

      setShowSessionPrompt(false);
      setSessionError('');
    } else if (!currentSessionId) {
      setCurrentSessionId(Date.now().toString());
      setSessionLog('');
    }

    const validGroqKeys = groqKeys.filter(k => k.trim());
    
    initAIClient(provider, groqKeys, geminiKeys);
    setSTTApiKey(validGroqKeys);

    setTranscript('');
    setAiAnswer('');
    
    await initSTT(() => {}); 
    setIsRecording(true);
    setIsPaused(false);
    audioDataRef.current = new Float32Array(0);

    try {
      if (stealthMode) {
        await ipcRenderer.invoke('set-stealth', false);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      const freshSources = await ipcRenderer.invoke('get-desktop-sources');
      let activeSourceId = selectedSource;
      if (freshSources && freshSources.length > 0) {
         const found = freshSources.find((s: any) => s.id === selectedSource);
         if (!found) activeSourceId = freshSources[0].id;
      }
      
      const desktopStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: activeSourceId,
          }
        } as any,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: activeSourceId,
          }
        } as any
      });
      
      if (stealthMode) {
        await ipcRenderer.invoke('set-stealth', true);
      }

      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });

      streamRef.current = new MediaStream([...desktopStream.getTracks(), ...micStream.getTracks()]);

      const audioCtx = new window.AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      const desktopSource = audioCtx.createMediaStreamSource(desktopStream);
      const micSource = audioCtx.createMediaStreamSource(micStream);
      
      const mixer = audioCtx.createGain();
      desktopSource.connect(mixer);
      micSource.connect(mixer);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const newData = new Float32Array(audioDataRef.current.length + inputData.length);
        newData.set(audioDataRef.current);
        newData.set(inputData, audioDataRef.current.length);
        audioDataRef.current = newData;
      };

      mixer.connect(processor);
      const silencer = audioCtx.createGain();
      silencer.gain.value = 0.0001;
      processor.connect(silencer);
      silencer.connect(audioCtx.destination);

      intervalRef.current = setInterval(() => {
        processAudioRef.current();
      }, 600);
    } catch (e) {
      if (stealthMode) ipcRenderer.invoke('set-stealth', true);
      console.error(e);
      alert('Failed to capture audio.');
      setIsRecording(false);
    }
  };

  const processAudioRef = useRef<() => void>(() => {});
  const isProcessingRef = useRef(false);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  
  const processAudio = async () => {
    if (!streamRef.current) return; 
    if (isPausedRef.current) {
      console.log('Paused');
      return;
    }
    if (isProcessingRef.current) return;

    if (audioDataRef.current.length < 16000 * 0.1) {
      console.log('Buffering...');
      return; 
    }

    isProcessingRef.current = true;
    try {
      const currentAudio = audioDataRef.current;
      if (currentAudio.length > 16000 * 30) {
         audioDataRef.current = currentAudio.slice(currentAudio.length - 16000 * 30);
      }

      let maxVal = 0;
      for (let i = 0; i < currentAudio.length; i++) {
        if (Math.abs(currentAudio[i]) > maxVal) maxVal = Math.abs(currentAudio[i]);
      }
      
      if (maxVal < 0.05) {
        // Pure silence or background noise detected. Do not send to API to prevent Whisper hallucinations!
        isProcessingRef.current = false;
        return;
      }
      
      const text = await transcribeAudioChunk(currentAudio, resumeText, '', interviewTitle);
      
      if (text && text.startsWith('ERR:')) {
         console.error('Error during transcription');
      } else if (text) {
        setTranscript(text);
      }

      if (text && !isPausedRef.current) {
        setTranscript(text);
      }
    } finally {
      isProcessingRef.current = false;
    }
  };
  
  processAudioRef.current = processAudio;

  const manualTriggerAI = async () => {
    if (!transcript && !currentSnapshot) return alert('No speech or snapshot detected yet!');
    
    setIsPaused(true);
    setIsGenerating(true);
    setAiAnswer('');
    
    await getInterviewAnswer(
      transcript, 
      resumeText,
      resumeText2,
      resumePriority,
      personalContextText,
      interviewTitle, 
      currentSnapshot || '',
      (chunk) => {
        setAiAnswer(prev => prev + chunk);
      },
      (info) => {
        setActiveAIInfo(info);
        if (activeAITimeoutRef.current) clearTimeout(activeAITimeoutRef.current);
        activeAITimeoutRef.current = setTimeout(() => setActiveAIInfo(null), 5000);
      }
    );
    setIsGenerating(false);
  };

  const handleSnipClick = async () => {
    setIsPaused(true);
    const base64Img = await ipcRenderer.invoke('start-snipping', selectedSource);
    if (!base64Img) {
      setIsPaused(false);
      return; // User cancelled
    }
    
    setTranscript('');
    setAiAnswer('');
    setCurrentSnapshot(base64Img);
  };

  const stopRecording = () => {
    setIsRecording(false);
    setIsPaused(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (processorRef.current) processorRef.current.disconnect();
    if (audioContextRef.current) audioContextRef.current.close();
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    audioDataRef.current = new Float32Array(0);
    console.log('Idle');

    let finalLog = sessionLog;
    if (transcript.trim() || aiAnswer.trim()) {
      finalLog += `\n\n--- QUESTION ---\n${transcript}\n\n--- AI ANSWER ---\n${aiAnswer}\n\n`;
    }

    if (finalLog.trim()) {
      const newSession = {
        id: currentSessionId || Date.now().toString(),
        name: sessionNameInput || 'Untitled Session',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: new Date().toLocaleDateString(),
        transcript: finalLog.trim(),
        aiAnswer: '' 
      };
      setSessions(prev => [newSession, ...prev.filter(s => s.id !== newSession.id)]);
    }
  };

  const deleteSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
  };

  const handleRenameSession = (id: string) => {
    if (editingSessionName.trim()) {
      setSessions(prev => prev.map(s => s.id === id ? { ...s, name: editingSessionName.trim() } : s));
    }
    setEditingSessionId(null);
  };

  const exportSession = (session: any) => {
    const divider = "================================================================================";
    const content = `${divider}
                            ClueAI - INTERVIEW SESSION
${divider}
Session Name : ${session.name}
Date         : ${session.date || new Date().toLocaleDateString()}
Time         : ${session.time}
${session.interviewTitle ? `Interview    : ${session.interviewTitle}` : ''}
${divider}

${session.transcript}

${divider}
                       END OF SESSION - GENERATED BY ClueAI
${divider}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleTranscriptEdit = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setIsPaused(true);
    setTranscript(e.target.value);
  };

  const resumeListening = () => {
    if (transcript.trim() || aiAnswer.trim() || currentSnapshot) {
      setSessionLog(prev => prev + `\n\n--- QUESTION ---\n${transcript}\n\n--- AI ANSWER ---\n${aiAnswer}\n\n`);
    }
    
    if (currentSnapshot) {
      setSnapshotHistory(prev => {
        const newHistory = [...prev, { id: Date.now().toString(), image: currentSnapshot, transcriptContext: transcript }];
        if (newHistory.length > 4) return newHistory.slice(newHistory.length - 4);
        return newHistory;
      });
    }

    audioDataRef.current = new Float32Array(0);
    setTranscript('');
    setAiAnswer('');
    setCurrentSnapshot(null);
    setIsPaused(false);
  };

  const closeApp = () => window.close();
  const minimizeApp = () => {
     ipcRenderer.invoke('minimize-window');
  };

  return (
    <div 
      className="flex flex-col h-screen text-brand-text p-4 font-sans overflow-hidden rounded-xl border border-white/10"
      style={{ backgroundColor: !isRecording ? '#09090b' : 'transparent' }}
    >
      <div 
        className="flex items-center justify-between mb-4 pb-2 border-b border-indigo-500/20"
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-white/5 rounded-md text-white/50 shadow-sm border border-white/5 flex items-center justify-center cursor-move" title="Drag to move window">
            <Move size={16} />
          </div>
          <h1 className="text-xl font-black tracking-tighter flex items-center gap-2 text-brand-accent">
            <img src="./logo.png" alt="Logo" className="w-7 h-7 object-cover rounded-md shadow-sm border border-brand-accent/20" /> ClueAI
          </h1>
        </div>
        
        <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as any}>
          {isRecording ? (
            <>
              <div className="flex items-center gap-3 mr-2 relative">
                <div className="relative group">
                  <select 
                    value={provider} 
                    onChange={e => {
                      const newProvider = e.target.value as 'groq' | 'gemini';
                      setProvider(newProvider);
                      switchProvider(newProvider);
                      setModelChangeMsg(`Switched to ${newProvider === 'groq' ? 'Groq' : 'Gemini'}`);
                      setTimeout(() => setModelChangeMsg(''), 3000);
                    }} 
                    className="appearance-none bg-brand-secondary/50 hover:bg-brand-secondary border border-brand-border/50 hover:border-brand-accent/30 rounded-full pl-8 pr-7 py-1.5 text-xs font-semibold outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent/30 text-white transition-all cursor-pointer shadow-[0_0_10px_rgba(0,0,0,0.2)]"
                  >
                    <option value="groq" className="bg-brand-card">⚡ Groq API</option>
                    <option value="gemini" className="bg-brand-card">🧠 Gemini Flash</option>
                  </select>
                  <Cpu size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-accent pointer-events-none" />
                  <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-subtext pointer-events-none group-hover:text-white transition-colors" />
                  
                  {modelChangeMsg && (
                    <div className="fixed top-16 right-6 z-[100] bg-green-500/15 backdrop-blur-xl border border-green-500/30 text-green-400 text-[10px] uppercase tracking-widest font-black px-4 py-2 rounded-xl animate-in slide-in-from-top-4 fade-in duration-300 whitespace-nowrap shadow-[0_0_30px_rgba(34,197,94,0.3)] pointer-events-none flex items-center gap-2">
                      <CheckCircle2 size={14} /> {modelChangeMsg}
                    </div>
                  )}
                </div>
              </div>
              
              {isPaused ? (
                <button onClick={resumeListening} className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black px-4 py-1.5 rounded-md font-black text-xs transition-all shadow-[0_0_15px_rgba(34,197,94,0.4)]">
                  <Play size={14} fill="currentColor" /> NEXT QUESTION
                </button>
              ) : (
                <button onClick={() => setIsPaused(true)} className="flex items-center gap-1.5 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 border border-yellow-500/30 px-3 py-1.5 rounded-md font-bold text-xs transition-all">
                  <Pause size={14} fill="currentColor" /> Pause
                </button>
              )}
              <button onClick={handleSnipClick} className="flex items-center gap-1.5 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/30 px-3 py-1.5 rounded-md font-bold text-xs transition-all">
                <Crop size={14} /> Snip & Ask AI
              </button>
              <button onClick={() => { 
                if (currentSnapshot) {
                  setSnapshotHistory(prev => {
                    const newHistory = [...prev, { id: Date.now().toString(), image: currentSnapshot, transcriptContext: transcript }];
                    return newHistory.length > 4 ? newHistory.slice(newHistory.length - 4) : newHistory;
                  });
                }
                setTranscript(''); 
                setCurrentSnapshot(null); 
                audioDataRef.current = new Float32Array(0); 
              }} className="flex items-center gap-1.5 bg-slate-500/10 text-brand-subtext hover:bg-slate-500/20 border border-slate-500/30 px-3 py-1.5 rounded-md font-bold text-xs transition-all">
                <Trash2 size={14} fill="currentColor" /> Clear
              </button>
              <button onClick={stopRecording} className="flex items-center gap-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 px-3 py-1.5 rounded-md font-bold text-xs transition-all">
                <Square size={14} fill="currentColor" /> Stop
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setShowSettings(!showSettings)} className={`p-1.5 mr-2 rounded-lg transition-colors ${showSettings ? 'bg-brand-accent text-white' : 'hover:bg-white/10 text-brand-subtext hover:text-white'}`} title="Settings">
                <Settings size={16} />
              </button>
              <button onClick={handleStartCaptureClick} className="flex items-center gap-2 bg-brand-accentSec hover:bg-brand-accentSec text-white px-4 py-1.5 rounded-lg font-bold text-sm transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] border border-cyan-400/30">
                <Play size={14} fill="currentColor" /> Start Interview
              </button>
            </>
          )}

          {/* Minimize / Maximize / Close */}
          <div className="flex items-center gap-1 ml-4 pl-4 border-l border-brand-border">
            <button onClick={() => ipcRenderer.send('toggle-fullscreen')} className="p-1.5 hover:bg-white/10 rounded-lg text-brand-subtext hover:text-white transition-colors" title="Toggle Size">
              <Maximize size={16} />
            </button>
            <button onClick={minimizeApp} className="p-1.5 hover:bg-white/10 rounded-lg text-brand-subtext hover:text-white transition-colors">
              <Minus size={16} />
            </button>
            <button onClick={closeApp} className="p-1.5 hover:bg-rose-500/20 rounded-lg text-brand-subtext hover:text-rose-400 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Full-Screen Settings Modal */}
      {!isRecording && showSettings && (
        <div className="absolute inset-2 z-40 bg-brand-bg/95 backdrop-blur-3xl rounded-2xl border border-brand-border/50 flex flex-col pt-12 p-6 animate-in fade-in duration-200 overflow-y-auto shadow-2xl">
          <div className="max-w-3xl w-full mx-auto space-y-8 pb-10">
            <div className="flex justify-between items-end border-b border-brand-border pb-4">
              <div>
                <h2 className="text-3xl font-black tracking-tight text-white">Settings</h2>
                <p className="text-brand-subtext text-sm">Configure your AI model, screen capture, and interview context.</p>
              </div>
              <button onClick={() => setShowSettings(false)} className="bg-brand-secondary hover:bg-brand-border text-brand-text px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center gap-2">
                Done <X size={16}/>
              </button>
            </div>

            {/* AI Provider & Capture Screen */}
            <section>
              <h3 className="text-sm font-bold text-brand-accentSec uppercase tracking-wider mb-4 flex items-center gap-2"><Settings size={16}/> Provider & Display</h3>
              <div className="grid grid-cols-2 gap-6 bg-brand-card p-5 rounded-2xl border border-brand-border">
                <div>
                  <label className="block text-xs font-bold text-brand-subtext uppercase mb-1.5">Default AI Provider</label>
                  <select value={provider} onChange={e => setProvider(e.target.value as any)} className="w-full bg-brand-secondary border border-brand-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-brand-accentSec text-white transition-all">
                    <option value="groq">Groq (Llama 3 - Default)</option>
                    <option value="gemini">Google Gemini (1.5 Flash)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-brand-subtext uppercase mb-1.5">Capture Screen</label>
                  <select value={selectedSource} onChange={e => setSelectedSource(e.target.value)} className="w-full bg-brand-secondary border border-brand-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-brand-accentSec text-white transition-all">
                    {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-brand-subtext mb-2">Stealth Mode (Hide from Screen Share)</label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className="relative">
                      <input type="checkbox" className="sr-only" checked={stealthMode} onChange={e => {
                        const val = e.target.checked;
                        if (!val) {
                          setShowStealthWarning(true);
                        } else {
                          setStealthMode(true);
                          ipcRenderer.invoke('set-stealth', true);
                        }
                      }} />
                      <div className={`block w-12 h-6 rounded-full transition-colors ${stealthMode ? 'bg-brand-accentSec' : 'bg-brand-border'}`}></div>
                      <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${stealthMode ? 'translate-x-6' : 'translate-x-0'}`}></div>
                    </div>
                    <span className="text-sm text-brand-subtext">
                      {stealthMode ? 'Enabled (May cause crashes on some PCs)' : 'Disabled (App is visible in screen share)'}
                    </span>
                  </label>
                </div>
              </div>
            </section>

            {/* API Keys Configuration */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-brand-accent uppercase tracking-wider flex items-center gap-2"><Cpu size={16}/> API Keys</h3>
                <div className="flex items-center gap-3">
                  {saveMessage && <span className={`${saveMessage.startsWith('Invalid') ? 'text-rose-500' : 'text-green-400'} text-xs font-bold animate-in fade-in`}>{saveMessage}</span>}
                  <button onClick={saveApiKeys} className="flex items-center gap-1.5 bg-brand-accent hover:bg-brand-accentSec text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                    <Save size={14} /> Save API Keys
                  </button>
                </div>
              </div>
              <div className="bg-brand-card rounded-2xl border border-brand-border overflow-hidden">
                {/* Groq Accordion */}
                <div className="border-b border-brand-border last:border-b-0">
                  <button onClick={() => setApiAccordion(apiAccordion === 'groq' ? 'none' : 'groq')} className="w-full flex items-center justify-between p-5 bg-brand-secondary/50 hover:bg-brand-secondary transition-colors text-left">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">Groq Keys</h4>
                      <p className="text-xs text-brand-subtext mt-1">{groqKeys.filter(k=>k.trim()).length} keys loaded (Used for STT & LLM)</p>
                    </div>
                    {apiAccordion === 'groq' ? <ChevronDown size={20} className="text-brand-subtext" /> : <ChevronRight size={20} className="text-brand-subtext" />}
                  </button>
                  
                  {apiAccordion === 'groq' && (
                    <div className="p-5 bg-brand-card space-y-3">
                      {Array.from({ length: 15 }).map((_, i) => (
                        <div key={`groq-${i}`}>
                          <label className="block text-[10px] font-bold text-brand-subtext uppercase mb-1">Key {i + 1} {i === 0 ? '(Mandatory)' : '(Optional)'}</label>
                          <div className="relative">
                            <input 
                              type={showGroqKeys[i] ? "text" : "password"} 
                              value={groqKeys[i]} 
                              onChange={e => {
                                const newKeys = [...groqKeys];
                                newKeys[i] = e.target.value;
                                setGroqKeys(newKeys);
                              }}
                              className="w-full bg-brand-secondary border border-brand-border rounded-lg pl-3 pr-16 py-2 text-sm outline-none focus:border-brand-accent text-white transition-all" 
                              placeholder={`gsk_...`}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                              {groqKeys[i].trim() !== '' && (
                                groqKeys[i].trim().startsWith('gsk_') && groqKeys[i].trim().length === 56 ? (
                                  <CheckCircle2 size={16} className="text-green-500" />
                                ) : (
                                  <XCircle size={16} className="text-rose-500" />
                                )
                              )}
                              <button onClick={() => {
                                const newShow = [...showGroqKeys];
                                newShow[i] = !newShow[i];
                                setShowGroqKeys(newShow);
                              }} className="text-brand-subtext hover:text-white transition-colors" title={showGroqKeys[i] ? "Hide Key" : "Show Key"}>
                                {showGroqKeys[i] ? <Eye size={14} /> : <EyeOff size={14} />}
                              </button>
                              <button onClick={() => {
                                const newKeys = [...groqKeys];
                                newKeys[i] = '';
                                setGroqKeys(newKeys);
                                setDeleteMessage({ provider: 'groq', index: i });
                                setTimeout(() => setDeleteMessage(null), 3000);
                              }} className="text-rose-500 hover:text-rose-400 transition-colors" title="Clear Key">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                          {deleteMessage?.provider === 'groq' && deleteMessage?.index === i && (
                            <p className="text-rose-400 text-[10px] mt-1 font-bold animate-in fade-in">API Key deleted</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Gemini Accordion */}
                <div className="border-b border-brand-border last:border-b-0">
                  <button onClick={() => setApiAccordion(apiAccordion === 'gemini' ? 'none' : 'gemini')} className="w-full flex items-center justify-between p-5 bg-brand-secondary/50 hover:bg-brand-secondary transition-colors text-left">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">Gemini Keys</h4>
                      <p className="text-xs text-brand-subtext mt-1">{geminiKeys.filter(k=>k.trim()).length} keys loaded (Used for LLM)</p>
                    </div>
                    {apiAccordion === 'gemini' ? <ChevronDown size={20} className="text-brand-subtext" /> : <ChevronRight size={20} className="text-brand-subtext" />}
                  </button>
                  
                  {apiAccordion === 'gemini' && (
                    <div className="p-5 bg-brand-card space-y-3">
                      {Array.from({ length: 15 }).map((_, i) => (
                        <div key={`gemini-${i}`}>
                          <label className="block text-[10px] font-bold text-brand-subtext uppercase mb-1">Key {i + 1} {i === 0 ? '(Mandatory)' : '(Optional)'}</label>
                          <div className="relative">
                            <input 
                              type={showGeminiKeys[i] ? "text" : "password"} 
                              value={geminiKeys[i]} 
                              onChange={e => {
                                const newKeys = [...geminiKeys];
                                newKeys[i] = e.target.value;
                                setGeminiKeys(newKeys);
                              }}
                              className="w-full bg-brand-secondary border border-brand-border rounded-lg pl-3 pr-16 py-2 text-sm outline-none focus:border-brand-accent text-white transition-all" 
                              placeholder={`AIza... or AQ...`}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                              {geminiKeys[i].trim() !== '' && (
                                (geminiKeys[i].trim().startsWith('AIza') || geminiKeys[i].trim().startsWith('AQ.')) && geminiKeys[i].trim().length === 39 ? (
                                  <CheckCircle2 size={16} className="text-green-500" />
                                ) : (
                                  <XCircle size={16} className="text-rose-500" />
                                )
                              )}
                              <button onClick={() => {
                                const newShow = [...showGeminiKeys];
                                newShow[i] = !newShow[i];
                                setShowGeminiKeys(newShow);
                              }} className="text-brand-subtext hover:text-white transition-colors" title={showGeminiKeys[i] ? "Hide Key" : "Show Key"}>
                                {showGeminiKeys[i] ? <Eye size={14} /> : <EyeOff size={14} />}
                              </button>
                              <button onClick={() => {
                                const newKeys = [...geminiKeys];
                                newKeys[i] = '';
                                setGeminiKeys(newKeys);
                                setDeleteMessage({ provider: 'gemini', index: i });
                                setTimeout(() => setDeleteMessage(null), 3000);
                              }} className="text-rose-500 hover:text-rose-400 transition-colors" title="Clear Key">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                          {deleteMessage?.provider === 'gemini' && deleteMessage?.index === i && (
                            <p className="text-rose-400 text-[10px] mt-1 font-bold animate-in fade-in">API Key deleted</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Interview Context */}
            <section>
              <h3 className="text-sm font-bold text-brand-accent uppercase tracking-wider mb-4 flex items-center gap-2"><FileText size={16}/> Interview Context</h3>
              <div className="bg-brand-card p-5 rounded-2xl border border-brand-border space-y-6">
                <div>
                  <label className="block text-xs font-bold text-brand-subtext uppercase mb-2">Title of Interview</label>
                  <input 
                    type="text" 
                    value={interviewTitle} 
                    onChange={e => setInterviewTitle(e.target.value)} 
                    className="w-full bg-brand-secondary border border-brand-border rounded-lg px-4 py-2.5 text-sm outline-none focus:border-brand-accent text-white transition-all" 
                    placeholder="e.g. Senior Backend Developer" 
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-brand-subtext uppercase">Resume Context 1 (Optional)</label>
                    <label className="flex items-center gap-1.5 text-xs text-brand-text cursor-pointer">
                      <input type="radio" name="resumePriority" checked={resumePriority === 1} onChange={() => setResumePriority(1)} className="accent-brand-accent cursor-pointer" />
                      <span className={resumePriority === 1 ? 'text-brand-accent font-bold' : ''}>High Priority</span>
                    </label>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 px-5 py-2.5 bg-brand-accent/10 hover:bg-brand-accent/20 border border-brand-accent/30 text-brand-accent rounded-lg cursor-pointer transition-all text-sm font-bold shadow-[0_0_15px_rgba(139,92,246,0.1)]">
                        {isUploadingResume ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} 
                        {isUploadingResume ? 'Analyzing...' : 'Upload PDF/TXT 1'}
                        <input type="file" accept=".pdf,.txt" className="hidden" onChange={(e) => handleFileUpload(e, 'resume1')} disabled={isUploadingResume} />
                      </label>
                      {resumeFileName && !isUploadingResume && (
                        <span className="text-xs text-green-400 flex items-center gap-1.5 truncate max-w-[300px] bg-green-500/10 px-3 py-2 rounded-md border border-green-500/20" title="Parsed successfully">
                          <FileText size={14} className="flex-shrink-0" /> {resumeFileName}
                        </span>
                      )}
                    </div>
                    {resumeText && (
                      <textarea 
                        value={resumeText} 
                        onChange={(e) => setResumeText(e.target.value)} 
                        className="w-full h-32 bg-black/40 border border-brand-border rounded-lg p-3 text-xs text-white/80 font-mono resize-y outline-none custom-scrollbar whitespace-pre-wrap"
                        placeholder="Parsed resume text..."
                      />
                    )}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-brand-subtext uppercase">Resume Context 2 (Optional)</label>
                    <label className="flex items-center gap-1.5 text-xs text-brand-text cursor-pointer">
                      <input type="radio" name="resumePriority" checked={resumePriority === 2} onChange={() => setResumePriority(2)} className="accent-brand-accent cursor-pointer" />
                      <span className={resumePriority === 2 ? 'text-brand-accent font-bold' : ''}>High Priority</span>
                    </label>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 px-5 py-2.5 bg-brand-accent/10 hover:bg-brand-accent/20 border border-brand-accent/30 text-brand-accent rounded-lg cursor-pointer transition-all text-sm font-bold shadow-[0_0_15px_rgba(139,92,246,0.1)]">
                        {isUploadingResume2 ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} 
                        {isUploadingResume2 ? 'Analyzing...' : 'Upload PDF/TXT 2'}
                        <input type="file" accept=".pdf,.txt" className="hidden" onChange={(e) => handleFileUpload(e, 'resume2')} disabled={isUploadingResume2} />
                      </label>
                      {resumeFileName2 && !isUploadingResume2 && (
                        <span className="text-xs text-green-400 flex items-center gap-1.5 truncate max-w-[300px] bg-green-500/10 px-3 py-2 rounded-md border border-green-500/20" title="Parsed successfully">
                          <FileText size={14} className="flex-shrink-0" /> {resumeFileName2}
                        </span>
                      )}
                    </div>
                    {resumeText2 && (
                      <textarea 
                        value={resumeText2} 
                        onChange={(e) => setResumeText2(e.target.value)} 
                        className="w-full h-32 bg-black/40 border border-brand-border rounded-lg p-3 text-xs text-white/80 font-mono resize-y outline-none custom-scrollbar whitespace-pre-wrap"
                        placeholder="Parsed resume text 2..."
                      />
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-brand-subtext uppercase mb-1">Personal Context</label>
                  <p className="text-xs text-brand-subtext/70 mb-2 italic">HIGH PRIORITY: This document is about yourself (strengths, weaknesses, hobbies).</p>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 px-5 py-2.5 bg-brand-accent/10 hover:bg-brand-accent/20 border border-brand-accent/30 text-brand-accent rounded-lg cursor-pointer transition-all text-sm font-bold shadow-[0_0_15px_rgba(139,92,246,0.1)]">
                        {isUploadingPersonalContext ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} 
                        {isUploadingPersonalContext ? 'Analyzing...' : 'Upload PDF/TXT'}
                        <input type="file" accept=".pdf,.txt" className="hidden" onChange={(e) => handleFileUpload(e, 'personal')} disabled={isUploadingPersonalContext} />
                      </label>
                      {personalContextFileName && !isUploadingPersonalContext && (
                        <span className="text-xs text-green-400 flex items-center gap-1.5 truncate max-w-[300px] bg-green-500/10 px-3 py-2 rounded-md border border-green-500/20" title="Parsed successfully">
                          <FileText size={14} className="flex-shrink-0" /> {personalContextFileName}
                        </span>
                      )}
                    </div>
                    {personalContextText && (
                      <textarea 
                        value={personalContextText} 
                        onChange={(e) => setPersonalContextText(e.target.value)} 
                        className="w-full h-32 bg-black/40 border border-brand-border rounded-lg p-3 text-xs text-white/80 font-mono resize-y outline-none custom-scrollbar whitespace-pre-wrap"
                        placeholder="Parsed personal context text..."
                      />
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Display */}
            <section>
              <h3 className="text-sm font-bold text-brand-subtext uppercase tracking-wider mb-4 flex items-center gap-2"><LayoutPanelTop size={16}/> Display Settings</h3>
              <div className="grid grid-cols-2 gap-6 bg-brand-card p-5 rounded-2xl border border-brand-border">
                <div>
                  <label className="block text-xs font-bold text-brand-subtext uppercase mb-3">Window Opacity ({Math.round(opacity * 100)}%)</label>
                  <input type="range" min="0.2" max="1.0" step="0.05" value={opacity} onChange={(e) => setOpacity(parseFloat(e.target.value))} className="w-full accent-brand-accent" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-brand-subtext uppercase mb-3">Layout Style</label>
                  <button onClick={() => setLayout(layout === 'vertical' ? 'horizontal' : 'vertical')} className="w-full bg-brand-secondary border border-brand-border hover:bg-white/10 py-2.5 rounded-lg text-xs font-bold text-brand-text transition-all">Toggle Vertical / Horizontal</button>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Dashboard Empty State */}
      {!isRecording && !showSettings && (
        <div className="flex-1 flex flex-col gap-6 overflow-hidden mt-2 px-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-6 relative overflow-hidden shadow-lg border border-blue-500/30 flex flex-col items-center text-center">
              <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Made by Farhan Khalid</h2>
              <p className="text-blue-100/80 text-sm mb-6 leading-relaxed font-medium">Developer & Engineer<br/><br/>Development driven by real users<br/>Faster iteration on features that matter</p>
              <button onClick={() => { ipcRenderer.invoke('minimize-window'); shell.openExternal('https://farhan-khalid-portfolio.vercel.app/'); }} className="bg-[#FDE047] text-yellow-900 px-6 py-2.5 rounded-full font-bold text-sm shadow-md flex items-center gap-2 hover:bg-yellow-300 transition-colors">🚀 View Portfolio &rarr;</button>
            </div>
            
            <div className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl p-6 relative overflow-hidden shadow-lg border border-blue-300/30 flex flex-col justify-center items-center text-center">
              <h2 className="text-xl font-bold text-white mb-4 tracking-tight">Local Event Reminders</h2>
              <div className="flex w-full gap-2 mb-4">
                <input 
                  type="text" 
                  value={reminderInput}
                  onChange={e => setReminderInput(e.target.value)}
                  placeholder="e.g. Meta Interview Tomorrow..."
                  className="flex-1 bg-[#090909] text-white px-3 py-2 rounded-lg text-sm border border-blue-500/50 outline-none focus:border-white"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && reminderInput.trim()) {
                      setReminders(prev => [{id: Date.now().toString(), text: reminderInput.trim(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, ...prev]);
                      setReminderInput('');
                    }
                  }}
                />
                <button 
                  onClick={() => {
                    if (reminderInput.trim()) {
                      setReminders(prev => [{id: Date.now().toString(), text: reminderInput.trim(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, ...prev]);
                      setReminderInput('');
                    }
                  }}
                  className="bg-white text-blue-600 px-3 py-2 rounded-lg font-bold text-sm hover:bg-blue-50 transition-colors"
                ><Plus size={16}/></button>
              </div>
              <div className="w-full space-y-2 max-h-[100px] overflow-y-auto pr-2">
                {reminders.length === 0 ? (
                  <p className="text-blue-100/50 text-sm italic">No reminders set.</p>
                ) : reminders.map(rem => (
                  <div key={rem.id} className="bg-blue-900/40 rounded-xl p-2.5 backdrop-blur-md flex justify-between items-center w-full border border-blue-400/20 group">
                    <span className="font-bold text-sm text-white truncate max-w-[200px] text-left">{rem.text}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-blue-200 font-medium">{rem.time}</span>
                      <button onClick={() => setReminders(prev => prev.filter(r => r.id !== rem.id))} className="text-blue-300 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"><X size={14}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto mt-4 pb-4">
            <h3 className="text-brand-subtext font-bold mb-3 text-sm px-2">Yesterday</h3>
            <div className="space-y-1">
              {sessions.length === 0 ? (
                <div className="text-brand-subtext text-sm italic px-2 py-4">No sessions saved yet. Start capturing to see history here!</div>
              ) : sessions.map((session) => (
                <div key={session.id} className="flex justify-between items-center py-2.5 px-4 hover:bg-brand-secondary/50 rounded-xl transition-colors border border-transparent hover:border-brand-border group relative">
                  {editingSessionId === session.id ? (
                    <input 
                      type="text" 
                      value={editingSessionName}
                      onChange={(e) => setEditingSessionName(e.target.value)}
                      onBlur={() => handleRenameSession(session.id)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRenameSession(session.id)}
                      autoFocus
                      className="bg-[#090909] text-white px-2 py-1 rounded-md text-sm border border-brand-accent outline-none flex-1 mr-4"
                    />
                  ) : (
                    <span className="text-brand-text font-medium text-sm truncate mr-4">{session.name}</span>
                  )}
                  <div className="flex items-center gap-6 text-brand-subtext text-xs font-mono shrink-0">
                    <span>{session.time}</span>
                    <button onClick={() => setOpenMenuId(openMenuId === session.id ? null : session.id)} className="p-1 hover:bg-white/10 rounded-md transition-colors">
                      <MoreVertical size={16} />
                    </button>
                  </div>
                  
                  {openMenuId === session.id && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)}></div>
                      <div className="absolute right-4 top-10 bg-brand-secondary border border-brand-border rounded-lg shadow-xl z-50 overflow-hidden min-w-[120px]">
                        <button onClick={() => { setEditingSessionId(session.id); setEditingSessionName(session.name); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-sm text-brand-text hover:bg-brand-accentSec flex items-center gap-2 transition-colors">
                          <FileText size={14} /> Rename
                        </button>
                        <button onClick={() => { exportSession(session); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-sm text-brand-text hover:bg-brand-accentSec flex items-center gap-2 transition-colors border-t border-brand-border">
                          <Download size={14} /> Export TXT
                        </button>
                        <button onClick={() => { deleteSession(session.id); setOpenMenuId(null); }} className="w-full text-left px-4 py-2 text-sm text-rose-400 hover:bg-rose-500 hover:text-white flex items-center gap-2 transition-colors border-t border-brand-border">
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main UI */}
      {isRecording && (
        <div className="flex-1 flex flex-col gap-4 min-h-0">
          <div className={`flex-1 flex gap-4 ${layout === 'horizontal' ? 'flex-row' : 'flex-col'} min-h-0`}>
            {/* Left/Top Panel - Transcript */}
        <div 
          className={`flex flex-col rounded-3xl overflow-hidden transition-all duration-200 ${layout === 'horizontal' ? 'flex-1' : 'h-1/2'}`}
          style={{ 
            backgroundColor: `rgba(24, 24, 27, ${opacity * 0.5})`,
            backdropFilter: opacity < 0.05 ? 'none' : `blur(${opacity * 32}px)`,
            borderColor: `rgba(255, 255, 255, ${opacity * 0.1})`,
            borderWidth: '1px',
            boxShadow: opacity < 0.05 ? 'none' : `0 25px 50px -12px rgba(0, 0, 0, ${opacity * 0.5})`
          }}
        >
          <div 
            className="px-5 py-3.5 flex justify-between items-center border-b transition-all duration-200"
            style={{ 
              backgroundColor: `rgba(255, 255, 255, ${opacity * 0.05})`,
              borderColor: `rgba(255, 255, 255, ${opacity * 0.05})`
            }}
          >
            <span className="text-xs font-bold text-white flex items-center gap-2 drop-shadow-md">
              <Mic size={14} className={!isPaused ? "animate-pulse text-cyan-400 drop-shadow-md" : "text-white/50"} />
              Transcript
            </span>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-white/50 font-mono font-bold tracking-wider uppercase drop-shadow-sm">
                {!isRecording ? 'READY' : (isPaused ? 'PAUSED' : 'LISTENING...')}
              </span>
              <button 
                onClick={() => { 
                  navigator.clipboard.writeText(transcript); 
                  setCopiedTranscript(true);
                  setTimeout(() => setCopiedTranscript(false), 2000);
                }}
                className="text-white/40 hover:text-white transition-colors flex items-center gap-1.5"
                title="Copy Transcript"
              >
                {copiedTranscript && <span className="text-xs text-green-400 font-bold animate-in fade-in">Copied!</span>}
                <Copy size={14} className={copiedTranscript ? "text-green-400" : ""} />
              </button>
            </div>
          </div>
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar relative">
            <textarea 
              className={`w-full px-5 py-4 bg-transparent text-[15px] font-semibold text-white outline-none resize-none leading-relaxed placeholder-white/30 drop-shadow-md ${currentSnapshot ? 'min-h-[120px] flex-none' : 'flex-1 h-full'}`}
              value={transcript}
              onChange={handleTranscriptEdit}
              placeholder="Listening to interviewer..."
            />
            {currentSnapshot && (
              <div className="px-5 pb-4 flex-1 min-h-[150px] flex flex-col items-center justify-center relative">
                <div className="relative h-full w-full max-h-[250px] rounded-xl overflow-hidden shadow-[0_0_20px_rgba(6,182,212,0.2)] border border-cyan-500/30 bg-black/50 group">
                  <img src={currentSnapshot} alt="Snapshot" className="w-full h-full object-contain" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                    <button onClick={() => setPreviewSnapshot(currentSnapshot)} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-md transition-colors shadow-lg flex items-center gap-2 font-bold text-sm">
                      <Eye size={16} /> Preview
                    </button>
                    <button onClick={() => setCurrentSnapshot(null)} className="px-4 py-2 bg-rose-500/80 hover:bg-rose-500 text-white rounded-xl backdrop-blur-md transition-colors shadow-lg flex items-center gap-2 font-bold text-sm">
                      <Trash2 size={16} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="px-5 py-2 flex gap-2 flex-wrap bg-transparent border-t border-white/5">
            {['Example', 'Types', 'Explain', 'Pros & Cons', 'Difference'].map(keyword => (
               <button 
                  key={keyword}
                  onClick={() => setTranscript(prev => prev ? `${prev} ${keyword}` : keyword)}
                  className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors border border-white/10 shadow-sm"
               >
                  + {keyword}
               </button>
            ))}
          </div>
          <div 
            className="p-3 border-t transition-all duration-200"
            style={{ 
              backgroundColor: `rgba(255, 255, 255, ${opacity * 0.03})`,
              borderColor: `rgba(255, 255, 255, ${opacity * 0.05})`
            }}
          >
             <button 
                onClick={manualTriggerAI}
                disabled={isGenerating || (!transcript && !currentSnapshot)}
                className="w-full py-2.5 bg-gradient-to-r from-cyan-500/80 to-blue-500/80 hover:from-cyan-400 hover:to-blue-400 text-white font-bold rounded-2xl shadow-[0_0_15px_rgba(6,182,212,0.3)] disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2 transform active:scale-95 text-xs"
             >
                {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} fill="currentColor" />}
                {isGenerating ? 'Analyzing Context...' : 'Generate AI Response'}
             </button>
          </div>
        </div>

        {/* Right/Bottom Panel - Answer */}
        <div 
          className={`flex flex-col rounded-3xl overflow-hidden transition-all duration-200 ${layout === 'horizontal' ? 'flex-1' : 'h-1/2'}`}
          style={{ 
            backgroundColor: `rgba(24, 24, 27, ${opacity * 0.5})`,
            backdropFilter: opacity < 0.05 ? 'none' : `blur(${opacity * 32}px)`,
            borderColor: `rgba(255, 255, 255, ${opacity * 0.1})`,
            borderWidth: '1px',
            boxShadow: opacity < 0.05 ? 'none' : `0 25px 50px -12px rgba(0, 0, 0, ${opacity * 0.5})`
          }}
        >
          <div 
            className="px-5 py-3.5 border-b flex justify-between items-center transition-all duration-200"
            style={{ 
              backgroundColor: `rgba(255, 255, 255, ${opacity * 0.05})`,
              borderColor: `rgba(255, 255, 255, ${opacity * 0.05})`
            }}
          >
            <span className="text-xs font-bold text-white flex items-center gap-2 drop-shadow-md">
              <Cpu size={14} className="text-fuchsia-400 drop-shadow-md" /> 
              AI Output
              {activeAIInfo && (
                <span className="ml-2 px-2 py-0.5 bg-fuchsia-500/20 text-fuchsia-300 rounded-md text-[10px] uppercase tracking-wider border border-fuchsia-500/30">
                  {activeAIInfo.provider} (Key {activeAIInfo.index})
                </span>
              )}
            </span>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => { 
                  navigator.clipboard.writeText(aiAnswer); 
                  setCopiedAnswer(true);
                  setTimeout(() => setCopiedAnswer(false), 2000);
                }}
                className="text-white/40 hover:text-white transition-colors flex items-center gap-1.5"
                title="Copy Answer"
              >
                {copiedAnswer && <span className="text-xs text-green-400 font-bold animate-in fade-in">Copied!</span>}
                <Copy size={14} className={copiedAnswer ? "text-green-400" : ""} />
              </button>
            </div>
          </div>
          <div className="flex-1 p-5 overflow-y-auto relative custom-scrollbar">
            {aiAnswer ? (
              <div className="text-[15px] leading-relaxed text-white whitespace-pre-wrap font-semibold drop-shadow-md">
                {aiAnswer}
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50 text-xs font-bold tracking-wide text-center px-6 drop-shadow-sm">
                <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-fuchsia-400/80 animate-spin mb-3"></div>
                {isGenerating ? 'Drafting response...' : 'Waiting for context...'}
              </div>
            )}
          </div>
        </div>
        </div>
          
          {/* Bottom Snapshot History UI */}
          {snapshotHistory.length > 0 && (
            <div className="relative mt-2">
              <div className="flex justify-between items-center mb-1.5 px-2">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <Crop size={10} /> Snap Records
                </h4>
                <span className="text-[9px] font-bold text-brand-subtext uppercase">Max 4 Snaps (Auto-Rotate)</span>
              </div>
              <div className="h-[80px] shrink-0 bg-[#18181b] rounded-2xl border border-white/5 flex items-center p-2 gap-3 overflow-x-auto shadow-inner transition-all duration-300 relative z-10" style={{ 
                backgroundColor: `rgba(24, 24, 27, ${opacity * 0.95})`,
                borderColor: `rgba(255, 255, 255, ${opacity * 0.1})`
              }}>
                {snapshotHistory.map((snap) => (
                  <div key={snap.id} className="relative h-full aspect-video group flex-shrink-0">
                    <div className="w-full h-full rounded-xl overflow-hidden bg-black/50 border border-white/10">
                      <img src={snap.image} alt="History Snapshot" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                    </div>
                    
                    {/* Hover Overlay */}
                    <div className={`absolute inset-0 bg-black/60 transition-opacity flex items-center justify-center rounded-xl ${menuPos.id === snap.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      <button className="p-1.5 hover:bg-white/20 rounded-md text-white transition-colors" onClick={(e) => {
                        if (menuPos.id === snap.id) {
                          setMenuPos({ x: 0, y: 0, id: null });
                        } else {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setMenuPos({ x: rect.left + rect.width / 2, y: rect.top - 10, id: snap.id });
                        }
                      }}>
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Outside Menu Popup to avoid CSS clipping */}
              {menuPos.id && snapshotHistory.find(s => s.id === menuPos.id) && (() => {
                const snap = snapshotHistory.find(s => s.id === menuPos.id)!;
                return (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuPos({x: 0, y: 0, id: null})}></div>
                    <div style={{ left: menuPos.x, top: menuPos.y - 10, transform: 'translate(-50%, -100%)' }} className="fixed bg-[#09090b] border border-brand-border rounded-xl shadow-[0_0_40px_rgba(0,0,0,0.8)] z-50 overflow-hidden min-w-[200px] animate-in slide-in-from-bottom-2 fade-in duration-200">
                      <div className="text-center px-4 py-3 border-b border-white/5 bg-white/5">
                        <span className="text-[10px] uppercase font-bold text-brand-subtext tracking-widest">Snapshot Options</span>
                      </div>
                      <button onClick={() => { setPreviewSnapshot(snap.image); setMenuPos({x: 0, y: 0, id: null}); }} className="w-full text-left px-4 py-3 text-xs text-white hover:bg-brand-secondary flex items-center gap-3 transition-colors">
                        <Eye size={14} /> Preview Fullscreen
                      </button>
                      <button onClick={() => { 
                        setTranscript(snap.transcriptContext || ''); 
                        setCurrentSnapshot(snap.image); 
                        setMenuPos({x: 0, y: 0, id: null}); 
                      }} className="w-full text-left px-4 py-3 text-xs text-cyan-400 hover:bg-brand-secondary flex items-center gap-3 transition-colors border-t border-brand-border">
                        <Play size={14} fill="currentColor" /> Ask AI Again
                      </button>
                      <button onClick={() => { 
                        setSnapshotHistory(prev => prev.filter(s => s.id !== snap.id)); 
                        setMenuPos({x: 0, y: 0, id: null}); 
                      }} className="w-full text-left px-4 py-3 text-xs text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 flex items-center gap-3 transition-colors border-t border-brand-border">
                        <Trash2 size={14} /> Delete Snapshot
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}
      
      {/* Session Name Prompt Modal Redesign */}
      {showSessionPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4">
          <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-300">
            {/* Glowing Accent Border */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-accent via-cyan-400 to-brand-accent rounded-[2rem] blur opacity-30"></div>
            
            <div className="relative bg-[#09090b]/90 border border-white/10 rounded-[2rem] w-full overflow-hidden shadow-[0_0_80px_rgba(0,0,0,1)]">
              <div className="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                <h3 className="font-black text-xl text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70 tracking-wide">Initialize Session</h3>
                <button onClick={() => setShowSessionPrompt(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-colors"><X size={16}/></button>
              </div>
              
              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-brand-subtext uppercase tracking-[0.2em] mb-3">Resume Existing Session</label>
                  <div className="relative">
                    <select
                      className="w-full bg-[#18181b] border border-white/10 rounded-xl px-5 py-3.5 text-sm text-white outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent transition-all appearance-none cursor-pointer"
                      value={currentSessionId}
                      onChange={e => {
                        setCurrentSessionId(e.target.value);
                        if (e.target.value) {
                           const s = sessions.find(x => x.id === e.target.value);
                           if (s) setSessionNameInput(s.name);
                           setSessionError('');
                        } else {
                           setSessionNameInput('');
                        }
                      }}
                    >
                      <option value="" className="bg-[#09090b] text-white/50">-- Create a New Session Instead --</option>
                      {sessions.map(s => (
                        <option key={s.id} value={s.id} className="bg-[#09090b] text-white">
                          {s.name} ({s.date || 'Old Session'})
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/40">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                  </div>
                </div>

                {!currentSessionId && (
                  <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                    <label className="block text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em] mb-3">New Session Name</label>
                    <input 
                      type="text"
                      autoFocus
                      value={sessionNameInput}
                      onChange={e => { setSessionNameInput(e.target.value); setSessionError(''); }}
                      placeholder="e.g. Meta Final Round"
                      onKeyDown={e => { if(e.key === 'Enter') startRecording(); }}
                      className="w-full bg-[#18181b] border border-cyan-500/30 rounded-xl px-5 py-4 text-sm text-white placeholder-white/20 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all shadow-[0_0_15px_rgba(34,211,238,0.05)]"
                    />
                  </div>
                )}
                
                {sessionError && (
                  <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 animate-in slide-in-from-top-2">
                    <p className="text-rose-400 text-xs font-bold flex items-center gap-2">
                      <X size={14} className="bg-rose-500/20 rounded-full p-0.5" /> {sessionError}
                    </p>
                  </div>
                )}
              </div>
              
              <div className="px-8 py-5 bg-[#18181b]/50 flex justify-end gap-3 border-t border-white/5 backdrop-blur-md">
                <button onClick={() => setShowSessionPrompt(false)} className="px-5 py-2.5 rounded-xl text-xs font-bold text-white/50 hover:text-white hover:bg-white/5 transition-colors">Cancel</button>
                <button onClick={startRecording} className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:shadow-[0_0_30px_rgba(34,211,238,0.5)] flex items-center gap-2 transform active:scale-95">
                  Start AI Interview <Play size={12} fill="currentColor" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Stealth Warning Modal */}
      {showStealthWarning && (
        <div className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-brand-bg border border-rose-500/30 rounded-2xl p-6 max-w-sm w-full shadow-[0_0_40px_rgba(225,29,72,0.2)] animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-rose-400 mb-3 flex items-center gap-2">
              <AlertTriangle size={24} /> Warning!
            </h3>
            <p className="text-brand-subtext text-sm mb-6 leading-relaxed">
              Disabling Stealth Mode will make ClueAI visible to screen sharing software like Zoom, Microsoft Teams, or Google Meet! 
              <br/><br/>
              Only turn this off if you are absolutely sure you want the app to be visible on your screen during a meeting.
            </p>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setShowStealthWarning(false)} 
                className="px-4 py-2 bg-brand-secondary hover:bg-brand-border text-white rounded-lg font-bold text-sm transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  setStealthMode(false);
                  ipcRenderer.invoke('set-stealth', false);
                  setShowStealthWarning(false);
                }} 
                className="px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white rounded-lg font-bold text-sm transition-colors shadow-[0_0_15px_rgba(225,29,72,0.4)]"
              >
                OK, Disable it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Snapshot Fullscreen Preview Modal */}
      {previewSnapshot && (
        <div 
          className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex items-center justify-center p-8 animate-in fade-in duration-200"
          onClick={() => setPreviewSnapshot(null)}
        >
          <button 
            className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md"
            onClick={(e) => { e.stopPropagation(); setPreviewSnapshot(null); }}
          >
            <X size={24} />
          </button>
          <img 
            src={previewSnapshot} 
            alt="Snapshot Preview" 
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-white/10 animate-in zoom-in-95 duration-300" 
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

export default App;
