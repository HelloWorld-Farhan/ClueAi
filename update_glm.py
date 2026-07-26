import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update validation
content = content.replace("return key.length === 69;", "return key.length > 50;")

# 2. Add GLM to model options
content = re.sub(
    r"\{\s*value:\s*'deepseek',\s*label:\s*'DeepSeek Coder'\s*\}\s*\]\}",
    "{ value: 'deepseek', label: 'DeepSeek Coder' }, { value: 'glm', label: 'GLM / NVIDIA' }]}",
    content
)

# 3. Fix flex layout to wrap
content = content.replace('<div className="flex items-center gap-2">', '<div className="flex flex-wrap items-center justify-end gap-2">')

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!")
