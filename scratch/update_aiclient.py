import re

with open('src/AIClient.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Groq Models (remove llava)
old_groq = """      const groqVisionModels = [
        'llama-3.2-90b-vision-preview', 'llama-3.2-11b-vision-preview', 
        'llama-3.2-11b-vision-instruct', 'llama-3.2-90b-vision-instruct',
        'llama-3.2-11b-vision', 'llama-3.2-90b-vision',
        'llama-4-scout-17b-16e-instruct', 'meta-llama/llama-4-scout-17b-16e-instruct',
        'qwen-2.5-vl', 'qwen-vl-max', 'qwen/qwen3.6-27b', 'qwen3.6-27b', 
        'llava-v1.5-7b-4096-preview'
      ];"""

new_groq = """      const groqVisionModels = [
        'llama-3.2-90b-vision-preview', 'llama-3.2-11b-vision-preview', 
        'llama-3.2-11b-vision-instruct', 'llama-3.2-90b-vision-instruct',
        'llama-3.2-11b-vision', 'llama-3.2-90b-vision',
        'llama-4-scout-17b-16e-instruct', 'meta-llama/llama-4-scout-17b-16e-instruct',
        'qwen-2.5-vl', 'qwen-vl-max', 'qwen/qwen3.6-27b', 'qwen3.6-27b'
      ];"""

content = content.replace(old_groq, new_groq)

# 2. Update Gemini Retry Logic
old_gemini = """    } else if (currentProvider.startsWith('gemini') && geminiApiKeys.length > 0) {
      const key = geminiApiKeys[currentGeminiIndex];
      const usedIndex = currentGeminiIndex;
      currentGeminiIndex = (currentGeminiIndex + 1) % geminiApiKeys.length;
      
      onStart({ provider: 'Gemini Flash', index: usedIndex + 1 });
      
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${key.trim()}`;
      const geminiContents: any[] = [];
      let geminiParts: any[] = [{ text: userPrompt }];
      if (imageArray && imageArray.length > 0) {
        imageArray.forEach(img => {
          const mimeType = img.split(';')[0].split(':')[1] || 'image/png';
          const base64Data = img.split(',')[1] || img;
          geminiParts.push({
            inlineData: { mimeType, data: base64Data }
          });
        });
      }
      geminiContents.push({ parts: geminiParts });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: geminiContents,
          generationConfig: { temperature: 0.4, maxOutputTokens: 800 }
        })
      });

      if (!response.ok) {
         const errText = await response.text();
         throw new Error(`Gemini API Error: ${response.status} ${errText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = '';
      
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        
        let nlIndex;
        while ((nlIndex = buffer.indexOf('\\n')) !== -1) {
          const line = buffer.slice(0, nlIndex);
          buffer = buffer.slice(nlIndex + 1);
          
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') continue;
            try {
              const data = JSON.parse(dataStr);
              if (data.candidates && data.candidates[0]?.content?.parts) {
                const text = data.candidates[0].content.parts[0].text;
                if (text) {
                  console.log('--- GEMINI LOG CHUNK ---', text);
                  onChunk(text);
                }
              }
            } catch (e) {
              // Ignore partial JSON parse errors if still fragmented
            }
          }
        }
      }
    } else if (currentProvider === 'claude' && claudeApiKeys.length > 0) {"""

new_gemini = """    } else if (currentProvider.startsWith('gemini') && geminiApiKeys.length > 0) {
      const geminiContents: any[] = [];
      let geminiParts: any[] = [{ text: userPrompt }];
      if (imageArray && imageArray.length > 0) {
        imageArray.forEach(img => {
          const mimeType = img.split(';')[0].split(':')[1] || 'image/png';
          const base64Data = img.split(',')[1] || img;
          geminiParts.push({
            inlineData: { mimeType, data: base64Data }
          });
        });
      }
      geminiContents.push({ parts: geminiParts });

      const maxGeminiAttempts = Math.min(15, geminiApiKeys.length);
      let geminiSuccess = false;
      let lastGeminiError: any = null;

      for (let attempt = 0; attempt < maxGeminiAttempts; attempt++) {
        const key = geminiApiKeys[currentGeminiIndex];
        const usedIndex = currentGeminiIndex;
        currentGeminiIndex = (currentGeminiIndex + 1) % geminiApiKeys.length;
        
        onStart({ provider: 'Gemini Flash', index: usedIndex + 1 });
        
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${key.trim()}`;
        
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: geminiContents,
              generationConfig: { temperature: 0.4, maxOutputTokens: 2000 }
            })
          });

          if (!response.ok) {
             const errText = await response.text();
             throw new Error(`${response.status} ${errText}`);
          }

          const reader = response.body?.getReader();
          const decoder = new TextDecoder("utf-8");
          let buffer = '';
          
          while (reader) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            
            let nlIndex;
            while ((nlIndex = buffer.indexOf('\\n')) !== -1) {
              const line = buffer.slice(0, nlIndex);
              buffer = buffer.slice(nlIndex + 1);
              
              if (line.startsWith('data: ')) {
                const dataStr = line.slice(6).trim();
                if (dataStr === '[DONE]') continue;
                try {
                  const data = JSON.parse(dataStr);
                  if (data.candidates && data.candidates[0]?.content?.parts) {
                    const text = data.candidates[0].content.parts[0].text;
                    if (text) {
                      console.log('--- GEMINI LOG CHUNK ---', text);
                      onChunk(text);
                    }
                  }
                } catch (e) {
                  // Ignore partial JSON parse errors if still fragmented
                }
              }
            }
          }
          geminiSuccess = true;
          break;
        } catch (err: any) {
          lastGeminiError = err;
          console.warn(`Gemini API Key #${usedIndex + 1} failed. Rotating...`, err?.message);
        }
      }

      if (!geminiSuccess) {
        throw new Error(`Gemini API Error: All keys failed. Last error: ${lastGeminiError?.message || lastGeminiError}`);
      }
    } else if (currentProvider === 'claude' && claudeApiKeys.length > 0) {"""

content = content.replace(old_gemini, new_gemini)


# 3. Enhance System Prompt
old_prompt = """CRITICAL RULE: You MUST speak EXACTLY like a real, casual human being talking out loud. 100% human-like.
- Give direct, conversational answers. DO NOT use robotic filler words like "Certainly!", "Here is...", or "As an AI...".
- DO NOT use conversational filler like "Yeah, this is a pretty standard utility function..." or "Looking at the logic here...". Just provide the direct, correct, and accurate answer immediately.
- Give highly detailed, technically impressive, and highly accurate explanations without rambling."""

new_prompt = """CRITICAL RULE: You MUST speak EXACTLY like a real, casual human being talking out loud. 100% human-like.
- You MUST provide a perfectly human-like, 100% complete, and extremely detailed long answer. Ensure maximum accuracy.
- Give direct, conversational answers. DO NOT use robotic filler words like "Certainly!", "Here is...", or "As an AI...".
- DO NOT use conversational filler like "Yeah, this is a pretty standard utility function..." or "Looking at the logic here...". Just provide the direct, correct, and accurate answer immediately.
- Give highly detailed, technically impressive, and highly accurate explanations."""

content = content.replace(old_prompt, new_prompt)

with open('src/AIClient.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("AIClient.ts updated successfully")
