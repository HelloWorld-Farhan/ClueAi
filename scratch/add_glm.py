import re

filepath_app = 'src/App.tsx'
filepath_ai = 'src/AIClient.ts'

with open(filepath_ai, 'r', encoding='utf-8') as f:
    ai_content = f.read()

# AIClient.ts updates
ai_content = ai_content.replace('''let currentProvider: 'groq' | 'gemini-flash' | 'claude' | 'chatgpt' | 'deepseek' = 'groq';''', '''let currentProvider: 'groq' | 'gemini-flash' | 'claude' | 'chatgpt' | 'deepseek' | 'glm' = 'groq';''')

ai_content = ai_content.replace('''let deepseekClients: OpenAI[] = [];''', '''let deepseekClients: OpenAI[] = [];\nlet glmClients: { client: OpenAI, model: string }[] = [];''')
ai_content = ai_content.replace('''let currentDeepseekIndex = 0;''', '''let currentDeepseekIndex = 0;\nlet currentGlmIndex = 0;''')

ai_content = ai_content.replace(
'''  provider: 'groq' | 'gemini-flash' | 'claude' | 'chatgpt' | 'deepseek',''',
'''  provider: 'groq' | 'gemini-flash' | 'claude' | 'chatgpt' | 'deepseek' | 'glm','''
)
ai_content = ai_content.replace(
'''  deepseekKeys?: TimedApiKey[]
) {''',
'''  deepseekKeys?: TimedApiKey[],
  glmKeys?: TimedApiKey[]
) {'''
)

ai_content = ai_content.replace('''  deepseekClients = (deepseekKeys || []).map(k => k.key.trim()).filter(Boolean).map(key => new OpenAI({
    apiKey: key,
    baseURL: 'https://api.deepseek.com',
    dangerouslyAllowBrowser: true,
  }));
  currentDeepseekIndex = 0;''', '''  deepseekClients = (deepseekKeys || []).map(k => k.key.trim()).filter(Boolean).map(key => new OpenAI({
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
  currentGlmIndex = 0;''')

ai_content = ai_content.replace('''    if (currentProvider === 'deepseek' && deepseekClients.length === 0) return;''', '''    if (currentProvider === 'deepseek' && deepseekClients.length === 0) return;\n    if (currentProvider === 'glm' && glmClients.length === 0) return;''')

# Add GLM execution branch
glm_exec = '''    } else if (currentProvider === 'glm' && glmClients.length > 0) {
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
          max_tokens: 1024
        });
  
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            onChunk(content);
          }
        }
'''
ai_content = ai_content.replace('''    } else if ((currentProvider === 'chatgpt' && chatgptClients.length > 0) || (currentProvider === 'deepseek' && deepseekClients.length > 0)) {''', glm_exec + '''    } else if ((currentProvider === 'chatgpt' && chatgptClients.length > 0) || (currentProvider === 'deepseek' && deepseekClients.length > 0)) {''')

with open(filepath_ai, 'w', encoding='utf-8') as f:
    f.write(ai_content)

print("Updated AIClient.ts")
