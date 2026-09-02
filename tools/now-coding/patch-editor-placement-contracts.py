from pathlib import Path

path = Path("tools/now-coding/client-contract.test.mjs")
text = path.read_text()

old_mobile = '''  assert.match(app, /setTimeout\\(\\(\\)=>activate\\(event\\),120\\)/);\n  assert.match(app, /dist>5/);'''
new_mobile = '''  assert.match(app, /function startTouchExistingBlockDrag\\(event,block\\)/);\n  assert.match(app, /const hold=setTimeout\\(activate,190\\)/);\n  assert.match(app, /completeBlockMove\\(block,target\\.seq,target\\.index\\)/);'''
if old_mobile not in text:
    raise SystemExit("missing legacy mobile tutorial drag contract")
text = text.replace(old_mobile, new_mobile, 1)

old_dirty = '''  assert.match(app, /markDraftChanged\\(\\);renderWorkspace\\(\\);onTutorialAdd/);'''
new_dirty = '''  assert.match(app, /function insertBlock\\([^\\n]+markDraftChanged\\(\\)[^\\n]+renderWorkspace\\([^\\n]+onTutorialAdd\\(block\\)/);'''
if old_dirty not in text:
    raise SystemExit("missing legacy dirty insertion contract")
text = text.replace(old_dirty, new_dirty, 1)

path.write_text(text)
print("editor placement legacy contracts aligned")
