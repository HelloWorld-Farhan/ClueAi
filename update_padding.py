import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace pr-16 with pr-[100px] only in the API key input class
target_class = 'className="w-full bg-brand-secondary border border-brand-border rounded-lg pl-3 pr-16 py-2 text-sm outline-none focus:border-brand-accent text-white transition-all"'
new_class = 'className="w-full bg-brand-secondary border border-brand-border rounded-lg pl-3 pr-[100px] py-2 text-sm outline-none focus:border-brand-accent text-white transition-all"'

content = content.replace(target_class, new_class)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!")
