import os

path = "src/App.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace all occurrences of replace(/\n{2,}/g, '\n') with replace(/(?:\r?\n)+/g, '\n')
content = content.replace("replace(/\\n{2,}/g, '\\n')", "replace(/(?:\\r?\\n)+/g, '\\n')")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print('patched regex')
