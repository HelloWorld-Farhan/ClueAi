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
# We need to find the entire {showSplash && ( ... )} block
# Let's use a regex to match it. It starts with {showSplash && ( and ends with )} before the main container

pattern = re.compile(r'\{showSplash && \([\s\S]*? \/\* Loading bar \*\/[\s\S]*?<\/style>\s*<\/div>\s*\)\}', re.MULTILINE)
content = re.sub(pattern, '', content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Removed splash from App.tsx!")
