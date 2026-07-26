import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_logic_regex = r"    // DYNAMIC FOCUS TRACKING FOR ULTIMATE STEALTH(.*?)ipcRenderer\.invoke\('set-focusable', false\);\n\n      return \(\) => \{\n        window\.removeEventListener\('mouseover', handleMouseOver\);\n        window\.removeEventListener\('mouseout', handleMouseOut\);\n        window\.removeEventListener\('focusin', handleFocus\);\n        window\.removeEventListener\('focusout', handleBlur\);\n      \};\n    \}, \[isRecording\]\);"

new_logic = """    // Dynamically allow focus ONLY when the user needs to type text.
    // When these modals are closed, the app becomes a non-focusable Ghost Overlay to bypass anti-cheat checks.
    useEffect(() => {
      const wantsFocus = showSessionPrompt || showSettings || showUsernamePrompt || showReminderPopup || showVirtualKeyboard || showNotesPopup || (editingSessionId !== null);
      // If stealth mode is ON, the app must NEVER take focus, otherwise anti-cheat will detect it!
      const needsFocus = stealthMode ? false : wantsFocus;
      ipcRenderer.invoke('set-focusable', needsFocus);
      // When focusable, we use normal React key events. When in Ghost Mode, we must hijack them globally!
      // But ONLY hijack them globally if an interview is actually running (isRecording)!
      ipcRenderer.invoke('toggle-global-hotkeys', !needsFocus && isRecording);
    }, [showSessionPrompt, showSettings, showUsernamePrompt, showReminderPopup, showVirtualKeyboard, showNotesPopup, editingSessionId, isRecording, stealthMode]);"""

content = re.sub(old_logic_regex, new_logic, content, flags=re.DOTALL)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Patch applied successfully.")
