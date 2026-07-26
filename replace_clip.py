import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace async navigator.clipboard.readText with synchronous clipboard.readText
content = re.sub(r'await navigator\.clipboard\.readText\(\)', 'clipboard.readText()', content)
# We can also remove the async keyword from the onClick if it's there, but it's harmless to leave async on the arrow function.

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done!")
