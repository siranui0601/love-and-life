from pathlib import Path
p=Path('tools/trpg-sim/config/player-simulation.v2.json')
s=p.read_text()
s=s.replace('"soloCombatPowerMultiplier": 1.55', '"soloCombatPowerMultiplier": 1.90')
p.write_text(s)
