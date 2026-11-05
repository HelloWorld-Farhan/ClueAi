let groqApiKeys: string[] = [];
let geminiApiKeys: string[] = [];
let currentGroqIndex = 0;
let currentGeminiIndex = 0;

export async function initSTT(onProgress: (info: any) => void) {
  // We no longer need to download a heavy local model!
  // We use cloud STT (Groq Whisper or Gemini Flash) for instant transcription.
  onProgress({ status: 'done' });
  return true;
}

export function setSTTApiKey(keys: string[], geminiKeys: string[] = []) {
  groqApiKeys = keys.filter(k => k.trim());
  geminiApiKeys = geminiKeys.filter(k => k.trim());
  currentGroqIndex = 0;
  currentGeminiIndex = 0;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function getSTTKeyStats() {
  return {
    groqCount: groqApiKeys.length,
    geminiCount: geminiApiKeys.length,
    totalCount: groqApiKeys.length + geminiApiKeys.length
  };
}

async function transcribeWithGemini(wavBlob: Blob): Promise<string> {
  if (geminiApiKeys.length === 0) return '';

  let attempts = 0;
  const maxAttempts = geminiApiKeys.length;

  while (attempts < maxAttempts) {
    const apiKey = geminiApiKeys[currentGeminiIndex];
    currentGeminiIndex = (currentGeminiIndex + 1) % geminiApiKeys.length;
    attempts++;

    try {
      const base64Audio = await blobToBase64(wavBlob);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey.trim()}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: 'audio/wav',
                    data: base64Audio
                  }
                },
                {
                  text: 'Transcribe the spoken audio verbatim into English text. Return ONLY the exact words spoken without quotes, introduction, commentary, or markdown. If there is silence, background noise, or no clear human speech, return empty text.'
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.0,
            maxOutputTokens: 1024
          }
        })
      });

      if (res.status === 429 || res.status === 401 || res.status === 403) {
        console.warn(`[STT Gemini] Key ${currentGeminiIndex} rate limited or invalid (${res.status}), failing over to next key...`);
        continue;
      }

      if (!res.ok) {
        continue;
      }

      const data = await res.json();
      const candidate = data.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text || '';
      return text.trim();
    } catch {
      continue;
    }
  }

  return '';
}

function encodeWAV(samples: Float32Array, sampleRate: number = 16000) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  
  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);
  
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  
  return new Blob([buffer], { type: 'audio/wav' });
}

export async function transcribeAudioChunk(audioData: Float32Array, contextText: string = ''): Promise<string> {
  if (groqApiKeys.length === 0 && geminiApiKeys.length === 0) return '';
  if (audioData.length === 0) return '';

  try {
    const wavBlob = encodeWAV(audioData, 16000);
    let text = '';

    if (groqApiKeys.length > 0) {
      const formData = new FormData();
      formData.append('file', wavBlob, 'audio.wav');
      formData.append('model', 'whisper-large-v3-turbo');
      formData.append('language', 'en'); 
      formData.append('temperature', '0.0');
      
      // Build a targeted prompt using context words to prime Whisper without hallucinations
      let promptString = "JavaScript, React, Node, Python, SQL, REST API, Frontend, Backend, Engineer, Developer";
      if (contextText) {
        const cleanWords = contextText.replace(/[^a-zA-Z0-9 ]/g, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 40).join(', ');
        if (cleanWords) {
          promptString = cleanWords;
        }
      }
      
      formData.append('prompt', promptString);

      // Multi-Key Round Robin with automatic 429/401 failover
      let attempts = 0;
      const maxAttempts = groqApiKeys.length;
      let success = false;

      while (attempts < maxAttempts && !success) {
        const apiKey = groqApiKeys[currentGroqIndex];
        currentGroqIndex = (currentGroqIndex + 1) % groqApiKeys.length;
        attempts++;

        try {
          const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey.trim()}`
            },
            body: formData
          });

          if (res.status === 429 || res.status === 401 || res.status === 403) {
            console.warn(`[STT Groq] Key slot rate limited (${res.status}), instantly rotating to next key...`);
            continue;
          }

          if (!res.ok) {
            continue;
          }

          const data = await res.json();
          text = (data.text || '').trim();
          success = true;
        } catch {
          // Network interruption on this key, rotate to next
          continue;
        }
      }

      if (!success && geminiApiKeys.length > 0) {
        text = await transcribeWithGemini(wavBlob);
      }
    } else if (geminiApiKeys.length > 0) {
      text = await transcribeWithGemini(wavBlob);
      if (text.startsWith('ERR:')) return text;
    }
    
    // Hallucination & Noise Filter
    const lowerText = text.toLowerCase().trim();
    const hallucinations = [
      "thanks for watching", 
      "thank you for watching", 
      "please subscribe",
      "amira", 
      "mbc",
      "bbc",
      "you can support the channel",
      "transcribed by",
      "subtitles by",
      "captions by",
      "silence",
      "you",
      "huh",
      "um",
      "thank you",
      "bye"
    ];
    
    // Check if the string matches a known hallucination
    if (hallucinations.some(h => lowerText === h || (lowerText.includes(h) && text.length < 35))) {
      return '';
    }

    // Check for purely non-alphanumeric or bracketed/asterisk hallucinations (e.g. *sigh*, [music], ., !)
    if (/^[\*\(\[].*[\*\)\]]$/.test(text) || !/[a-zA-Z0-9]/.test(text)) {
      return '';
    }
    
    // If it's a single word and very short, it's often a hallucination when surrounded by silence
    if (text.split(/\s+/).length === 1 && text.length < 3 && !/^[A-Z0-9]+$/.test(text)) {
      return '';
    }

    return text;
  } catch (error: any) {
    console.error('Transcription error:', error);
    return `ERR: ${error.message || error}`;
  }
}
