"""Read-only by default. Pipe over the authorized SSH session; --apply permits safe ff.
Never resets, cleans, stashes, reads credentials or restarts services.
"""
import argparse
import hashlib
import os
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('--apply', action='store_true')
parser.add_argument('--expected-head')
args = parser.parse_args()
os.chdir('/home/ubuntu/apps/judgement-ai')
def git(*argv):
    return subprocess.check_output(['git', *argv])
def status():
    return git('status', '--porcelain=v1', '-z', '--untracked-files=all')
def paths(raw):
    chunks = raw.split(b'\0')
    result = []
    i = 0
    while i < len(chunks):
        chunk = chunks[i]
        i += 1
        if not chunk:
            continue
        kind, name = chunk[:2], os.fsdecode(chunk[3:])
        result.append((kind, name))
        if b'R' in kind or b'C' in kind:
            result.append((kind, os.fsdecode(chunks[i])))
            i += 1
    return result

def dirty_hash():
    digest = hashlib.sha256()
    digest.update(git('diff', '--binary'))
    digest.update(git('diff', '--cached', '--binary'))
    return digest.hexdigest()

before_head = git('rev-parse', 'HEAD').decode().strip()
before_status = status()
before_dirty = dirty_hash()
dirty = paths(before_status)
untracked_metadata = {p: (os.stat(p).st_size, os.stat(p).st_mtime_ns) for kind, p in dirty if kind == b'??'}
subprocess.run(['git', 'fetch', 'origin', 'main'], check=True)
next_head = git('rev-parse', 'origin/main').decode().strip()
if args.expected_head and args.expected_head != next_head:
    raise RuntimeError('origin/main changed; re-review required')
subprocess.run(['git', 'merge-base', '--is-ancestor', 'HEAD', 'origin/main'], check=True)
incoming = [os.fsdecode(p) for p in git('diff', '--name-only', '-z', 'HEAD', 'origin/main').split(b'\0') if p]
conflicts = [(d, p) for _, d in dirty for p in incoming if d == p or d.startswith(p + '/') or p.startswith(d + '/')]
if conflicts:
    raise RuntimeError('Dirty/incoming overlap: ' + repr(conflicts))
if any(not p.startswith(('public/capital-review/', 'docs/', 'test/', 'tools/', '.github/')) for p in incoming):
    raise RuntimeError('Incoming runtime changes require separate deployment review')
print('VPS HEAD', before_head, 'ORIGIN MAIN', next_head)
print('DIRTY TRACKED', [p for kind, p in dirty if kind != b'??'])
print('UNTRACKED FILES', len(untracked_metadata), 'INCOMING', len(incoming), 'OVERLAP', len(conflicts))
print('DIRTY SHA256', before_dirty)
if args.apply and before_head != next_head:
    subprocess.run(['git', 'merge', '--ff-only', 'origin/main'], check=True)
if before_status != status() or before_dirty != dirty_hash():
    raise RuntimeError('Dirty work changed during deployment; inspect without reset/stash')
for p, expected in untracked_metadata.items():
    observed = (os.stat(p).st_size, os.stat(p).st_mtime_ns)
    if observed != expected:
        raise RuntimeError('User untracked file changed: ' + p)
print('PRESERVED dirty work and untracked metadata')
print('FINAL HEAD', git('rev-parse', 'HEAD').decode().strip())
print('STATIC ONLY: no process restart')
