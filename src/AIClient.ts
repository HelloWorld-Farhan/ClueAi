import OpenAI from 'openai';

export interface TimedApiKey { key: string; addedAt: number; }

let groqClients: OpenAI[] = [];
let geminiApiKeys: string[] = [];
let claudeApiKeys: string[] = [];
let chatgptClients: OpenAI[] = [];
let deepseekClients: OpenAI[] = [];
let glmClients: { client: OpenAI, model: string }[] = [];

let currentProvider: 'groq' | 'gemini-flash' | 'claude' | 'chatgpt' | 'deepseek' | 'glm' = 'groq';

let currentGroqIndex = 0;
let currentGeminiIndex = 0;
let currentClaudeIndex = 0;
let currentChatgptIndex = 0;
let currentDeepseekIndex = 0;
let currentGlmIndex = 0;

export function initAIClient(
  provider: 'groq' | 'gemini-flash' | 'claude' | 'chatgpt' | 'deepseek' | 'glm', 
  groqKeys: string[], 
  geminiKeys: string[],
  claudeKeys?: TimedApiKey[],
  chatgptKeys?: TimedApiKey[],
  deepseekKeys?: TimedApiKey[],
  glmKeys?: TimedApiKey[]
) {
  currentProvider = provider;
  
  groqClients = groqKeys.filter(k => k.trim()).map(key => new OpenAI({
    apiKey: key.trim(),
    baseURL: 'https://api.groq.com/openai/v1',
    dangerouslyAllowBrowser: true,
  }));
  currentGroqIndex = 0;

  geminiApiKeys = geminiKeys.filter(k => k.trim());
  currentGeminiIndex = 0;
  
  claudeApiKeys = (claudeKeys || []).map(k => k.key.trim()).filter(Boolean);
  currentClaudeIndex = 0;
  
  chatgptClients = (chatgptKeys || []).map(k => k.key.trim()).filter(Boolean).map(key => new OpenAI({
    apiKey: key,
    dangerouslyAllowBrowser: true,
  }));
  currentChatgptIndex = 0;
  
  deepseekClients = (deepseekKeys || []).map(k => k.key.trim()).filter(Boolean).map(key => new OpenAI({
    apiKey: key,
    baseURL: 'https://api.deepseek.com',
    dangerouslyAllowBrowser: true,
  }));
  currentDeepseekIndex = 0;

  glmClients = (glmKeys || []).map(k => k.key.trim()).filter(Boolean).map(key => {
    const isNvidia = key.startsWith('nvapi-');
    return {
      client: new OpenAI({
        apiKey: key,
        baseURL: isNvidia ? 'https://integrate.api.nvidia.com/v1' : 'https://open.bigmodel.cn/api/paas/v4',
        dangerouslyAllowBrowser: true,
      }),
      model: isNvidia ? 'meta/llama-3.1-70b-instruct' : 'glm-4'
    };
  });
  currentGlmIndex = 0;
}

export function switchProvider(provider: 'groq' | 'gemini-flash' | 'claude' | 'chatgpt' | 'deepseek' | 'glm') {
  currentProvider = provider;
}

export async function getInterviewAnswer(
  transcript: string, 
  resumeText1: string, 
  resumeText2: string,
  resumePriority: number,
  personalContext: string,
  interviewTitle: string, 
  imageArray: string[],
  onChunk: (chunk: string) => void, 
  onStart: (info: {provider: string, index: number}) => void = () => {},
  abortSignal?: AbortSignal,
  preferredCodeLanguage: string = 'Java'
) {
  if (currentProvider === 'groq' && groqClients.length === 0) return;
  if (currentProvider === 'gemini-flash' && geminiApiKeys.length === 0) return;
  if (currentProvider === 'claude' && claudeApiKeys.length === 0) return;
  if (currentProvider === 'chatgpt' && chatgptClients.length === 0) return;
  if (currentProvider === 'deepseek' && deepseekClients.length === 0) return;

  try {
    let contextPrompt = '';
    
    if (personalContext) {
      contextPrompt += `\n\n--- PERSONAL CONTEXT (HIGH PRIORITY) ---\nThis is about the candidate's strengths, weaknesses, hobbies, and personal background. Use this whenever answering behavioral or personal questions:\n${personalContext}`;
    }

    if (resumeText1 || resumeText2) {
      contextPrompt += `\n\n--- RESUME(S) ---\nUse these resumes to answer questions about past experience, projects, and skills.`;
      if (resumePriority === 1) {
        if (resumeText1) contextPrompt += `\n[HIGH PRIORITY RESUME]\n${resumeText1}`;
        if (resumeText2) contextPrompt += `\n[SECONDARY RESUME (Fallback)]\n${resumeText2}`;
      } else {
        if (resumeText2) contextPrompt += `\n[HIGH PRIORITY RESUME]\n${resumeText2}`;
        if (resumeText1) contextPrompt += `\n[SECONDARY RESUME (Fallback)]\n${resumeText1}`;
      }
      contextPrompt += `\nFocus heavily on the high priority resume. Only check the fallback if the information is missing from the high priority resume.`;
    }

    const isShortFormat = currentProvider === 'claude' || currentProvider === 'chatgpt';
    const explanationLength = isShortFormat 
      ? "- Provide a concise, short-to-medium explanation to save time. DO NOT give long, rambling monologues."
      : "- You MUST provide a perfectly human-like, 100% complete, and extremely detailed long answer. Ensure maximum accuracy.";

    const systemPrompt = `You are a job candidate in a live interview${interviewTitle ? ` for the role of ${interviewTitle}` : ''}. 
CRITICAL RULE: You MUST speak EXACTLY like a real, casual human being talking out loud. 100% human-like.
${explanationLength}
- Give direct, conversational answers. DO NOT use robotic filler words like "Certainly!", "Here is...", or "As an AI...".
- DO NOT use conversational filler like "Yeah, this is a pretty standard utility function..." or "Looking at the logic here...". Just provide the direct, correct, and accurate answer immediately.
- CRITICAL PARAGRAPH FORMAT: You MUST write your answer in compact, dense paragraphs of 4-5 lines. Do NOT leave any blank lines between paragraphs. Each paragraph flows directly into the next with only a single line break. This rule applies to ALL responses — no blank lines ever.
- Use Markdown formatting for your output. If you are writing code, ALWAYS wrap it in \`\`\` language blocks.
- **Rule 1 (Lists/Points):** If you are listing points, ALWAYS use standard Markdown bullet points (using the \`-\` symbol). Do NOT use \`>\` or blockquotes. Ensure there are NO blank lines between the bullet points.
- **Rule 2 (Code Questions):** If the question is about code, you MUST output the exact correct code FIRST, wrapped in a standard markdown \`\`\` code block. You MUST provide ALL code examples in ${preferredCodeLanguage}. Even if the interviewer originally asked for a different language in the transcript, YOU MUST NOW USE ${preferredCodeLanguage}. Follow it with your explanation below. All explanations must also reference ${preferredCodeLanguage} by name.
- **Rule 3 (QUIZ/MCQ):** If the image or transcript contains a multiple-choice question or a quiz, you MUST explicitly output ONLY the correct answer(s) FIRST, wrapped exactly like this: \`\`\`exact-answer\n[Your Answer Here]\n\`\`\`. For example: \`\`\`exact-answer\nA - True\n\`\`\`. You MUST ensure 100% accuracy and provide a human-like explanation below it.
- **Rule 4:** If asked for differences or comparisons, you MUST output a short bulleted list. Put both sides of the comparison into the SAME bullet point.
- **Rule 5:** If asked to describe multiple things, you MUST create bold \`## Headlines\` for each item.
- If asked about Strengths and Weaknesses, you MUST explicitly use the keywords "Strength:" and "Weakness:" to divide the answer clearly.
- Do NOT sound like an AI assistant. Use everyday, simple conversational English. DO NOT use complex, robotic vocabulary.

CRITICAL INSTRUCTION FOR ACCURACY: The interview transcript is generated by Speech-to-Text and may contain typos or misheard words. Infer the true technical intent of the interviewer's question using context clues, and give the accurate answer to the INTENDED question.
If the user provides an image (screenshot), analyze the code or diagram in the screenshot to accurately answer the question.

  CRITICAL OUTPUT RULE: YOU MUST OUTPUT *ONLY* THE EXACT WORDS THE CANDIDATE WILL SPEAK ALOUD. DO NOT include any reasoning, internal monologue, or explanation. DO NOT start with "Here's my answer" or "Assuming the interviewer means...". Just start speaking the answer immediately. NEVER describe the image in the first person. NEVER say 'The user wants me to act as a candidate' or 'I see a screenshot of...'. NEVER output <think> tags or thoughts.
  If a screenshot is provided without a clear question in the transcript, ASSUME the interviewer is asking you to explain the code, architecture, or issue shown in the screenshot. Jump straight into explaining it technically as a candidate. DO NOT say "I'm not sure what your question is" or "It seems you're showing me a screenshot". Just confidently explain the technical details shown.

CRITICAL EXPERTISE RULE: YOU ARE AN ABSOLUTE EXPERT. Your answers MUST be technically brilliant and confident. Provide a precise, deep-dive explanation without unnecessary fluff. NEVER say you are "not familiar" or "don't know much" about a technology. If the interviewer asks about a framework or tool (like React), you MUST confidently answer the question as an expert. NEVER diminish your own skills.

CRITICAL CONTEXT RULE: You MUST act as an expert on the provided documents. ONLY draw facts from the uploaded documents. Do not invent outside information if context is provided.
When asked about yourself, ACT AS THIS PERSON. Use the specific name, education, tools, and past projects from the context. Do NOT give a meta-answer.${contextPrompt}`;

    let userPrompt = `Interview transcript so far:\n${transcript}\n\nRespond directly to the interviewer as the candidate. Speak your answer now:`;

    const hasImages = imageArray && imageArray.length > 0;
    const effectiveProvider = currentProvider;

    if (effectiveProvider === 'groq' && groqClients.length > 0) {
      const messages: any[] = [
        { role: 'system', content: systemPrompt },
      ];
      
      if (hasImages) {
        const contentArr: any[] = [{ type: 'text', text: userPrompt }];
        imageArray.forEach(img => {
          contentArr.push({ type: 'image_url', image_url: { url: img } });
        });
        messages.push({ role: 'user', content: contentArr });
      } else {
        messages.push({ role: 'user', content: userPrompt });
      }

      // Prioritize fastest-known working vision models first, then fall back to text models
      const groqVisionModels = [
        'llama-4-scout-17b-16e-instruct',
        'llama-3.2-90b-vision-preview',
      ];
      const groqTextModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemma2-9b-it'];
      
      const modelsToTry = hasImages ? groqVisionModels : groqTextModels;
      let stream: any = null;
      let lastGroqError: any = null;

      const maxKeyAttempts = Math.min(15, groqClients.length);
      
      for (let attempt = 0; attempt < maxKeyAttempts; attempt++) {
        if (abortSignal?.aborted) return;
        const client = groqClients[currentGroqIndex];
        const usedIndex = currentGroqIndex;
        currentGroqIndex = (currentGroqIndex + 1) % groqClients.length;
        
        onStart({ provider: 'Groq', index: usedIndex + 1 });
        let keySuccess = false;

        for (const modelName of modelsToTry) {
          if (abortSignal?.aborted) return;
          try {
            // Add an 8-second per-model timeout for vision requests to fail fast
            const modelSignal = hasImages && abortSignal
              ? AbortSignal.any([abortSignal, AbortSignal.timeout(8000)])
              : abortSignal;
            stream = await client.chat.completions.create({
              model: modelName,
              messages: messages,
              stream: true,
              temperature: 0.5,
              max_tokens: 4096,
            } as any, modelSignal ? { signal: modelSignal } : undefined);
            console.log(`Groq connected: ${modelName} Key #${usedIndex + 1}`);
            keySuccess = true;
            break;
          } catch (err: any) {
            if (abortSignal?.aborted) return;
            lastGroqError = err;
            console.warn(`Groq model ${modelName} Key #${usedIndex + 1} failed.`, err?.message);
            if (err?.status === 429 || err?.message?.includes('429')) {
              console.warn(`Rate limit on Key #${usedIndex + 1}. Rotating...`);
              break; 
            }
          }
        }
        
        if (keySuccess) break;
      }

      if (!stream) {
        throw new Error(`Groq API Error: All keys/models failed. Last error: ${lastGroqError?.message || lastGroqError}`);
      }

      for await (const chunk of stream) {
        if (abortSignal?.aborted) return;
        const content = chunk.choices[0]?.delta?.content || '';
        onChunk(content);
      }
    } else if (effectiveProvider.startsWith('gemini') && geminiApiKeys.length > 0) {
      const geminiContents: any[] = [];
      const geminiParts: any[] = [{ text: userPrompt }];
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
        if (abortSignal?.aborted) return;
        const key = geminiApiKeys[currentGeminiIndex];
        const usedIndex = currentGeminiIndex;
        currentGeminiIndex = (currentGeminiIndex + 1) % geminiApiKeys.length;
        
        onStart({ provider: 'Gemini Flash', index: usedIndex + 1 });
        
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${key.trim()}`;
        
        try {
          const response = await fetch(url, {
            signal: abortSignal,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: geminiContents,
              generationConfig: { temperature: 0.4, maxOutputTokens: 8192 }
            })
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`${response.status} ${errText}`);
          }

          const reader = response.body?.getReader();
          const decoder = new TextDecoder('utf-8');
          let buffer = '';
          
          while (reader) {
            if (abortSignal?.aborted) {
              reader.cancel();
              return;
            }
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            
            let nlIndex;
            while ((nlIndex = buffer.indexOf('\n')) !== -1) {
              const line = buffer.slice(0, nlIndex);
              buffer = buffer.slice(nlIndex + 1);
              
              if (line.startsWith('data: ')) {
                const dataStr = line.slice(6).trim();
                if (dataStr === '[DONE]') continue;
                try {
                  const data = JSON.parse(dataStr);
                  if (data.candidates && data.candidates[0]?.content?.parts) {
                    const text = data.candidates[0].content.parts[0].text;
                    if (text) onChunk(text);
                  }
                } catch (e) {
                  // Ignore partial JSON parse errors during fragmented chunks
                }
              }
            }
          }
          geminiSuccess = true;
          break;
        } catch (err: any) {
          lastGeminiError = err;
          console.warn(`Gemini Key #${usedIndex + 1} failed. Rotating...`, err?.message);
        }
      }

      if (!geminiSuccess) {
        throw new Error(`Gemini API Error: All keys failed. Last error: ${lastGeminiError?.message || lastGeminiError}`);
      }
    } else if (effectiveProvider === 'claude' && claudeApiKeys.length > 0) {
      // Try Claude models in cascade until one works (handles model deprecations)
      const claudeModelsToTry = [
        'claude-sonnet-4-5',
        'claude-3-5-sonnet-20241022',
        'claude-3-haiku-20240307',
      ];

      let claudeSuccess = false;
      let lastClaudeError: any = null;

      for (const claudeModel of claudeModelsToTry) {
        if (abortSignal?.aborted) return;
        const key = claudeApiKeys[currentClaudeIndex];
        const usedIndex = currentClaudeIndex;
        currentClaudeIndex = (currentClaudeIndex + 1) % claudeApiKeys.length;
        onStart({ provider: 'Claude', index: usedIndex + 1 });

        const claudeMessages: any[] = [];
        if (imageArray && imageArray.length > 0) {
          const contentArr: any[] = [{ type: 'text', text: userPrompt }];
          imageArray.forEach(img => {
            const mimeType = img.split(';')[0].split(':')[1] || 'image/jpeg';
            const base64Data = img.split(',')[1] || img;
            contentArr.push({ type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Data } });
          });
          claudeMessages.push({ role: 'user', content: contentArr });
        } else {
          claudeMessages.push({ role: 'user', content: userPrompt });
        }

        try {
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            signal: abortSignal,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': key,
              'anthropic-version': '2023-06-01',
              'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
              model: claudeModel,
              max_tokens: 8192,
              system: systemPrompt,
              messages: claudeMessages,
              stream: true
            })
          });

          if (!response.ok) {
            const errText = await response.text();
            // If 404 (model not found), try next model in cascade
            if (response.status === 404) {
              console.warn(`Claude model ${claudeModel} not found, trying next...`);
              lastClaudeError = new Error(`Claude API Error: ${response.status} ${errText}`);
              continue;
            }
            throw new Error(`Claude API Error: ${response.status} ${errText}`);
          }

          const reader = response.body?.getReader();
          const decoder = new TextDecoder('utf-8');
          let buffer = '';
          
          while (reader) {
            if (abortSignal?.aborted) {
              reader.cancel();
              return;
            }
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            
            let nlIndex;
            while ((nlIndex = buffer.indexOf('\n')) !== -1) {
              const line = buffer.slice(0, nlIndex);
              buffer = buffer.slice(nlIndex + 1);
              
              if (line.startsWith('data: ')) {
                const dataStr = line.slice(6).trim();
                if (dataStr === '[DONE]') continue;
                try {
                  const data = JSON.parse(dataStr);
                  if (data.type === 'content_block_delta' && data.delta?.text) {
                    onChunk(data.delta.text);
                  }
                } catch (e) {}
              }
            }
          }
          claudeSuccess = true;
          break; // Successfully streamed from this model, done
        } catch (err: any) {
          if (err?.name === 'AbortError' || abortSignal?.aborted) return;
          lastClaudeError = err;
          console.warn(`Claude model ${claudeModel} failed:`, err?.message);
        }
      }

      if (!claudeSuccess && lastClaudeError) {
        throw lastClaudeError;
      }
    } else if (effectiveProvider === 'glm' && glmClients.length > 0) {
      if (abortSignal?.aborted) return;
      const clientObj = glmClients[currentGlmIndex];
      const usedIndex = currentGlmIndex;
      currentGlmIndex = (currentGlmIndex + 1) % glmClients.length;
      
      onStart({ provider: clientObj.model === 'glm-4' ? 'GLM-4 (Zhipu)' : 'Llama 3 70B (NVIDIA)', index: usedIndex + 1 });

      const messages: any[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];
      
      if (imageArray && imageArray.length > 0) {
        messages[1].content = [{ type: 'text', text: userPrompt }];
        imageArray.forEach(img => {
          messages[1].content.push({ type: 'image_url', image_url: { url: img } });
        });
      }

      const stream = await clientObj.client.chat.completions.create({
        model: clientObj.model,
        messages,
        stream: true,
        temperature: 0.1,
        max_tokens: 4096
      });

      for await (const chunk of stream) {
        if (abortSignal?.aborted) return;
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) onChunk(content);
      }
    } else if ((effectiveProvider === 'chatgpt' && chatgptClients.length > 0) || (effectiveProvider === 'deepseek' && deepseekClients.length > 0)) {
      if (abortSignal?.aborted) return;
      const isChatGPT = effectiveProvider === 'chatgpt';
      const clients = isChatGPT ? chatgptClients : deepseekClients;
      const currentIndex = isChatGPT ? currentChatgptIndex : currentDeepseekIndex;
      
      const client = clients[currentIndex];
      const usedIndex = currentIndex;
      
      if (isChatGPT) currentChatgptIndex = (currentChatgptIndex + 1) % clients.length;
      else currentDeepseekIndex = (currentDeepseekIndex + 1) % clients.length;
      
      onStart({ provider: isChatGPT ? 'ChatGPT (GPT-4o)' : 'DeepSeek Coder', index: usedIndex + 1 });

      const messages: any[] = [
        { role: 'system', content: systemPrompt },
      ];
      
      if (imageArray && imageArray.length > 0) {
        const contentArr: any[] = [{ type: 'text', text: userPrompt }];
        imageArray.forEach(img => {
          contentArr.push({ type: 'image_url', image_url: { url: img } });
        });
        messages.push({ role: 'user', content: contentArr });
      } else {
        messages.push({ role: 'user', content: userPrompt });
      }
      
      const modelName = isChatGPT ? 'gpt-4o' : 'deepseek-chat';
      
      const stream = await client.chat.completions.create({
        model: modelName,
        messages,
        stream: true,
        temperature: 0.4,
        max_tokens: 4096,
      });
      
      for await (const chunk of stream) {
        if (abortSignal?.aborted) return;
        const content = chunk.choices[0]?.delta?.content || '';
        onChunk(content);
      }
    }
  } catch (error: any) {
    if (error.name === 'AbortError' || abortSignal?.aborted) {
      console.log('AI generation aborted.');
      return;
    }
    console.error('AI Error:', error);
    onChunk(`\n[AI Error: ${error.message || error}]`);
  }
}

export async function streamCodeTranslation(
  codeText: string,
  targetLang: string,
  onChunk: (chunk: string) => void,
  abortSignal?: AbortSignal
) {
  if (currentProvider === 'groq' && groqClients.length === 0) return;
  if (currentProvider === 'gemini-flash' && geminiApiKeys.length === 0) return;
  if (currentProvider === 'claude' && claudeApiKeys.length === 0) return;
  if (currentProvider === 'chatgpt' && chatgptClients.length === 0) return;
  if (currentProvider === 'deepseek' && deepseekClients.length === 0) return;

  try {
    const systemPrompt = `You are an expert programmer. You must translate the following code block to ${targetLang}. 
CRITICAL RULE: You MUST output ONLY the translated code. Do NOT output any explanations, markdown code blocks, or greetings. JUST THE EXACT CODE STRING. DO NOT wrap the code in \`\`\` tags.`;
    const userPrompt = `Translate this code to ${targetLang}:\n\n${codeText}`;

    const effectiveProvider = currentProvider;

    if (effectiveProvider === 'groq' && groqClients.length > 0) {
      const messages: any[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];
      const client = groqClients[currentGroqIndex];
      currentGroqIndex = (currentGroqIndex + 1) % groqClients.length;
      
      const stream = await client.chat.completions.create({
        model: 'llama-3.1-70b-versatile',
        messages,
        stream: true,
        temperature: 0.1,
        max_tokens: 4096
      });
      for await (const chunk of stream) {
        if (abortSignal?.aborted) return;
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) onChunk(content);
      }
    } else if (effectiveProvider === 'gemini-flash' && geminiApiKeys.length > 0) {
      const apiKey = geminiApiKeys[currentGeminiIndex];
      currentGeminiIndex = (currentGeminiIndex + 1) % geminiApiKeys.length;
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }]
        })
      });
      if (!response.ok) throw new Error(`Gemini API Error: ${response.status}`);
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      while (reader) {
        if (abortSignal?.aborted) { reader.cancel(); return; }
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        
        let nlIndex;
        while ((nlIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, nlIndex);
          buffer = buffer.slice(nlIndex + 1);
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') continue;
            try {
              const data = JSON.parse(dataStr);
              if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
                onChunk(data.candidates[0].content.parts[0].text);
              }
            } catch (e) {}
          }
        }
      }
    } else if (effectiveProvider === 'claude' && claudeApiKeys.length > 0) {
      const key = claudeApiKeys[currentClaudeIndex];
      currentClaudeIndex = (currentClaudeIndex + 1) % claudeApiKeys.length;
      
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
          stream: true
        })
      });
      if (!response.ok) throw new Error(`Claude API Error: ${response.status}`);
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      while (reader) {
        if (abortSignal?.aborted) { reader.cancel(); return; }
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        
        let nlIndex;
        while ((nlIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, nlIndex);
          buffer = buffer.slice(nlIndex + 1);
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') continue;
            try {
              const data = JSON.parse(dataStr);
              if (data.type === 'content_block_delta' && data.delta?.text) {
                onChunk(data.delta.text);
              }
            } catch (e) {}
          }
        }
      }
    } else if (effectiveProvider === 'glm' && glmClients.length > 0) {
      const clientObj = glmClients[currentGlmIndex];
      currentGlmIndex = (currentGlmIndex + 1) % glmClients.length;
      
      const stream = await clientObj.client.chat.completions.create({
        model: clientObj.model,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        stream: true,
        temperature: 0.1,
        max_tokens: 4096
      });
      for await (const chunk of stream) {
        if (abortSignal?.aborted) return;
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) onChunk(content);
      }
    } else if ((effectiveProvider === 'chatgpt' && chatgptClients.length > 0) || (effectiveProvider === 'deepseek' && deepseekClients.length > 0)) {
      const isChatGPT = effectiveProvider === 'chatgpt';
      const clients = isChatGPT ? chatgptClients : deepseekClients;
      const currentIndex = isChatGPT ? currentChatgptIndex : currentDeepseekIndex;
      
      const client = clients[currentIndex];
      if (isChatGPT) currentChatgptIndex = (currentChatgptIndex + 1) % clients.length;
      else currentDeepseekIndex = (currentDeepseekIndex + 1) % clients.length;
      
      const modelName = isChatGPT ? 'gpt-4o' : 'deepseek-chat';
      const stream = await client.chat.completions.create({
        model: modelName,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        stream: true,
        temperature: 0.1,
        max_tokens: 4096,
      });
      
      for await (const chunk of stream) {
        if (abortSignal?.aborted) return;
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) onChunk(content);
      }
    }
  } catch (error: any) {
    if (error.name === 'AbortError' || abortSignal?.aborted) return;
    console.error('Translation Error:', error);
  }
}