from pathlib import Path

path = Path("tools/now-coding/patch-board-variants.py")
text = path.read_text()

old_pattern = r"r'function runTest\(\)\{.*?\nfunction openTutorialLibrary'"
new_pattern = r"r'function runTest\(\)\{.*?\nfunction showView'"
if old_pattern not in text:
    raise SystemExit("missing runTest patch pattern")
text = text.replace(old_pattern, new_pattern, 1)

old_replacement = 'function openTutorialLibrary\'\'\',\n    "test runner board settings",'
new_replacement = 'function showView\'\'\',\n    "test runner board settings",'
if old_replacement not in text:
    raise SystemExit("missing runTest replacement terminator")
text = text.replace(old_replacement, new_replacement, 1)

path.write_text(text)
print("fixed runTest patch boundary without swallowing online functions")
