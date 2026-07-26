import os
import re

def patch_ai_client():
    path = "src/AIClient.ts"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # 1. Update signature
    content = content.replace(
        "onStart: (info: {provider: string, index: number}) => void = () => {}",
        "onStart: (info: {provider: string, index: number}) => void = () => {},\n    abortSignal?: AbortSignal"
    )
    
    # 2. Add signal to all fetch calls
    content = re.sub(
        r"(await fetch\([^,]+,\s*\{)",
        r"\1\n        signal: abortSignal,",
        content
    )
    
    # 3. Handle AbortError so it doesn't log spam
    content = content.replace(
        "} catch (error: any) {",
        "} catch (error: any) {\n    if (error.name === 'AbortError') {\n      console.log('AI generation aborted.');\n      return;\n    }"
    )

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
        
def patch_app_tsx():
    path = "src/App.tsx"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Add abort controller ref
    content = content.replace(
        "const timerIntervalRef = useRef<any>(null);",
        "const timerIntervalRef = useRef<any>(null);\n    const aiAbortControllerRef = useRef<AbortController | null>(null);"
    )
    
    # 2. In manualTriggerAI, create new abort controller and pass it
    content = content.replace(
        "const snaps = overrideSnapshots || currentSnapshots;",
        "const snaps = overrideSnapshots || currentSnapshots;\n      if (aiAbortControllerRef.current) {\n        aiAbortControllerRef.current.abort();\n      }\n      aiAbortControllerRef.current = new AbortController();"
    )
    
    content = content.replace(
        "(info) => {\n          currentProviderInfo = ${info.provider.toUpperCase()} (Key );\n          setActiveAIInfo(info);\n          if (activeAITimeoutRef.current) clearTimeout(activeAITimeoutRef.current);\n          activeAITimeoutRef.current = setTimeout(() => setActiveAIInfo(null), 3000);\n        }\n      );",
        "(info) => {\n          currentProviderInfo = ${info.provider.toUpperCase()} (Key );\n          setActiveAIInfo(info);\n          if (activeAITimeoutRef.current) clearTimeout(activeAITimeoutRef.current);\n          activeAITimeoutRef.current = setTimeout(() => setActiveAIInfo(null), 3000);\n        },\n        aiAbortControllerRef.current.signal\n      );"
    )
    
    # 3. Add abort to stopRecording
    content = content.replace(
        "const stopRecording = (isSilentRestart: boolean | any = false) => {",
        "const stopRecording = (isSilentRestart: boolean | any = false) => {\n      if (aiAbortControllerRef.current) aiAbortControllerRef.current.abort();\n      setIsGenerating(false);"
    )
    
    # 4. Add abort to the shortcut z/1 (clear transcript)
    content = content.replace(
        "} else if (key === 'z' || key === '1') {\n          e.preventDefault();\n          if (isAiFullscreen) {",
        "} else if (key === 'z' || key === '1') {\n          e.preventDefault();\n          if (aiAbortControllerRef.current) aiAbortControllerRef.current.abort();\n          setIsGenerating(false);\n          if (isAiFullscreen) {"
    )
    
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

patch_ai_client()
patch_app_tsx()
print('patched')
