import os

filepath = 'src/AIClient.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

old_claude_logic = '''    } else if (currentProvider === 'claude' && claudeApiKeys.length > 0) {
      const key = claudeApiKeys[currentClaudeIndex];
      const usedIndex = currentClaudeIndex;
      currentClaudeIndex = (currentClaudeIndex + 1) % claudeApiKeys.length;
      onStart({ provider: 'Claude 3.5 Sonnet', index: usedIndex + 1 });
      
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

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20240620',
          max_tokens: 1024,
          system: systemPrompt,
          messages: claudeMessages,
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error(\Claude API Error: \ \\);
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
              if (data.type === 'content_block_delta' && data.delta?.text) {
                onChunk(data.delta.text);
              }
            } catch (e) {
              // Ignore partial JSON parse errors
            }
          }
        }
      }
    } else if (currentProvider === 'chatgpt' && chatgptClients.length > 0) {'''

new_claude_logic = '''    } else if (currentProvider === 'claude' && claudeApiKeys.length > 0) {
      const maxClaudeAttempts = Math.min(15, claudeApiKeys.length);
      let claudeSuccess = false;
      let lastClaudeError: any = null;

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

      for (let attempt = 0; attempt < maxClaudeAttempts; attempt++) {
        const key = claudeApiKeys[currentClaudeIndex];
        const usedIndex = currentClaudeIndex;
        currentClaudeIndex = (currentClaudeIndex + 1) % claudeApiKeys.length;
        
        onStart({ provider: 'Claude 3.5 Sonnet', index: usedIndex + 1 });
        
        try {
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': key,
              'anthropic-version': '2023-06-01',
              'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
              model: 'claude-3-5-sonnet-20240620',
              max_tokens: 1024,
              system: systemPrompt,
              messages: claudeMessages,
              stream: true
            })
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(\ \);
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
                  if (data.type === 'content_block_delta' && data.delta?.text) {
                    onChunk(data.delta.text);
                  }
                } catch (e) {
                  // Ignore partial JSON parse errors
                }
              }
            }
          }
          
          claudeSuccess = true;
          break; // Successfully connected and finished streaming
          
        } catch (err: any) {
          lastClaudeError = err;
          console.warn(Claude API Key #\ failed. Rotating..., err?.message);
        }
      }

      if (!claudeSuccess) {
        throw new Error(Claude API Error: All keys failed. Last error: \);
      }

    } else if (currentProvider === 'chatgpt' && chatgptClients.length > 0) {'''

content = content.replace(old_claude_logic, new_claude_logic)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("AIClient updated!")
