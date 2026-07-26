import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_logic_regex = r"    useEffect\(\(\) => \{\n      const wantsFocus = showSessionPrompt \|\| showSettings \|\| showUsernamePrompt \|\| showReminderPopup \|\| \nshowVirtualKeyboard \|\| showNotesPopup \|\| \(editingSessionId !== null\);\n      // If stealth mode is ON, the app must NEVER take focus, otherwise anti-cheat will detect it!\n      const needsFocus = stealthMode \? false : wantsFocus;\n      ipcRenderer\.invoke\('set-focusable', needsFocus\);\n      // When focusable, we use normal React key events\. When in Ghost Mode, we must hijack them globally!\n      // But ONLY hijack them globally if an interview is actually running \(isRecording\)!\n      ipcRenderer\.invoke\('toggle-global-hotkeys', !needsFocus && isRecording\);\n    \}, \[showSessionPrompt, showSettings, showUsernamePrompt, showReminderPopup, showVirtualKeyboard, showNotesPopup, \neditingSessionId, isRecording, stealthMode\]\);"

new_logic = """    // DYNAMIC FOCUS TRACKING FOR ULTIMATE STEALTH
    // Only allow the window to be focusable if the user is explicitly hovering over or interacting with a text input.
    // This allows clicking buttons (Stop, Settings, Info) WITHOUT stealing focus from the test browser!
    useEffect(() => {
      let isInputHovered = false;
      let isInputFocused = false;

      const updateFocusable = () => {
        const needsFocus = isInputHovered || isInputFocused;
        ipcRenderer.invoke('set-focusable', needsFocus);
      };

      const handleMouseOver = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          if (target.getAttribute('type') !== 'checkbox' && target.getAttribute('type') !== 'radio') {
            isInputHovered = true;
            updateFocusable();
          }
        }
      };

      const handleMouseOut = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          isInputHovered = false;
          updateFocusable();
        }
      };

      const handleFocus = (e: FocusEvent) => {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          isInputFocused = true;
          updateFocusable();
        }
      };

      const handleBlur = (e: FocusEvent) => {
        isInputFocused = false;
        updateFocusable();
      };

      window.addEventListener('mouseover', handleMouseOver);
      window.addEventListener('mouseout', handleMouseOut);
      window.addEventListener('focusin', handleFocus);
      window.addEventListener('focusout', handleBlur);

      // Always manage hotkeys based on recording state, completely independent of focus
      ipcRenderer.invoke('toggle-global-hotkeys', isRecording);

      // Initial state
      ipcRenderer.invoke('set-focusable', false);

      return () => {
        window.removeEventListener('mouseover', handleMouseOver);
        window.removeEventListener('mouseout', handleMouseOut);
        window.removeEventListener('focusin', handleFocus);
        window.removeEventListener('focusout', handleBlur);
      };
    }, [isRecording]);"""

# Replace the block manually without regex to avoid whitespace issues
start_marker = "const wantsFocus = showSessionPrompt || showSettings"
lines = content.split('\n')
start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if start_marker in line:
        start_idx = i - 1 # Include the useEffect line
        break

if start_idx != -1:
    for i in range(start_idx, len(lines)):
        if "stealthMode]);" in lines[i]:
            end_idx = i
            break

if start_idx != -1 and end_idx != -1:
    new_lines = lines[:start_idx] + new_logic.split('\n') + lines[end_idx+1:]
    content = '\n'.join(new_lines)
    with open('src/App.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patch applied successfully.")
else:
    print("Could not find the target block.")
