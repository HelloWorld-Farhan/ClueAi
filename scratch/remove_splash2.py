import os
import re

filepath = 'src/App.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove the useState and useEffect for the splash
old_splash = '''  const [showSplash, setShowSplash] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2800);
    return () => clearTimeout(timer);
  }, []);'''
new_splash = ''''''
content = content.replace(old_splash, new_splash)

# 2. Remove the JSX for the splash
# The JSX starts with {showSplash && ( and ends right before the main container className="flex flex-col h-screen text-brand-text p-4 font-sans overflow-y-auto overflow-x-hidden rounded-3xl select-none animate-in fade-in duration-300 fill-mode-both click-through-bg"
# We can use multi_replace_file_content logic but via Python string replace for safety.

start_str = '''      {showSplash && ('''
end_str = '''          </div>
        )}'''

start_idx = content.find(start_str)
end_idx = content.find(end_str, start_idx) + len(end_str)

if start_idx != -1 and end_idx > len(end_str):
    content = content[:start_idx] + content[end_idx:]

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Removed splash from App.tsx cleanly!")
