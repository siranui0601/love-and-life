from pathlib import Path

path = Path("tools/now-coding/patch-board-variants.py")
text = path.read_text()

targets = [
    "seededShuffle",
    "startBattle",
    "stopTest",
    "openCommandHelp",
    "openTutorialLibrary",
    "renderOnlineArea",
    "joinRoom",
]

for target in targets:
    old = rf".*?\n{'async ' if target == 'joinRoom' else ''}function {target}"
    new = rf".*?\}}{'async ' if target == 'joinRoom' else ''}function {target}"
    if old not in text:
        raise SystemExit(f"missing compact separator pattern for {target}")
    text = text.replace(old, new, 1)

path.write_text(text)
print("fixed compact app-v3 function separators")
