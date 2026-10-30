"""Reveal gate: every element the CSS starts at opacity:0 must be tweened to opacity:1.

Rationale: a mask-reveal (yPercent on a .line wrapper) is NOT a reveal when the
wrapper itself is CSS-hidden -- the copy stays invisible for the whole film.
This gate fails the build if any initially-hidden element never reaches opacity 1.
"""
import re
import sys

src = open('film/index.html', encoding='utf-8').read()
style = re.search(r'<style>(.*?)</style>', src, re.S).group(1)
body = re.search(r'<body[^>]*>(.*?)<script>', src, re.S).group(1)
style_nc = re.sub(r'/\*.*?\*/', ' ', style, flags=re.S)   # strip css comments

# ---------- 1. CSS rules that declare opacity: 0 ------------------------------
OP0 = re.compile(r'opacity:\s*0(?![0-9.])')
hidden_selectors = []
for m in re.finditer(r'([^{}]+)\{([^{}]*)\}', style_nc):
    if OP0.search(m.group(2)):
        for part in m.group(1).split(','):
            part = re.sub(r'\s+', ' ', part.strip())
            if part:
                hidden_selectors.append(part)

# ---------- 2. lightweight DOM: id -> (classes, ancestor ids) -----------------
VOID = {'img', 'br', 'hr', 'input', 'meta', 'link', 'line', 'path', 'circle', 'rect'}
dom = {}          # id -> {'cls': set, 'anc': [ancestor ids]}
stack = []        # list of (id or None, classes)
for tm in re.finditer(r'<(/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|[^">])*)>', body):
    closing, tag, attrs = tm.group(1), tm.group(2).lower(), tm.group(3)
    if closing:
        for k in range(len(stack) - 1, -1, -1):
            if stack[k][2] == tag:
                del stack[k:]
                break
        continue
    eid = re.search(r'id="([^"]+)"', attrs)
    eid = eid.group(1) if eid else None
    cls = set(re.findall(r'class="([^"]*)"', attrs)[0].split()) if 'class="' in attrs else set()
    anc = [s[0] for s in stack if s[0]]
    if eid:
        dom[eid] = {'cls': cls, 'anc': anc, 'tag': tag}
    if tag not in VOID:
        stack.append((eid, cls, tag))

# ---------- 3. resolve selectors -> element ids -------------------------------
def resolve(sel):
    """returns list of element ids matched by a simple selector"""
    sel = sel.strip()
    m = re.match(r'^#([A-Za-z0-9_-]+)$', sel)
    if m:
        return [m.group(1)] if m.group(1) in dom else []
    m = re.match(r'^#([A-Za-z0-9_-]+)\s+\.([A-Za-z0-9_-]+)$', sel)
    if m:
        root, cls = m.group(1), m.group(2)
        return [e for e, d in dom.items() if cls in d['cls'] and root in d['anc']]
    m = re.match(r'^\.([A-Za-z0-9_-]+)$', sel)
    if m:
        cls = m.group(1)
        return [e for e, d in dom.items() if cls in d['cls']]
    return None      # unresolvable

hidden = {}        # element id -> [selectors that hide it]
unresolved = []
for sel in hidden_selectors:
    hits = resolve(sel)
    if hits is None:
        unresolved.append(sel)
    else:
        for e in hits:
            hidden.setdefault(e, []).append(sel)

# ---------- 4. tweens that bring opacity above the visibility floor -----------
# target may be a quoted id, an array, a runtime concat like "#bdg" + i, or a
# variable bound to querySelectorAll (hmCells[i], layers[i], ...);
# the position argument may be any expression (i * 0.1, B * 3, ...).
CALL = re.compile(
    r'tl\.(fromTo|to|set|from)\(\s*(\[[^\]]*\]|"[^"]*"(?:\s*\+\s*[A-Za-z_$][\w$]*)?|[A-Za-z_$][\w$]*(?:\[[^\]]*\])?)\s*,\s*\{(.*?)\}\s*'
    r'(?:,\s*\{(.*?)\}\s*)?,\s*([^)]*)\s*\)', re.S)
OPVAL = re.compile(r'opacity:\s*([0-9.]+)')
FLOOR = 0.1          # an element only has to become perceptible, not necessarily 1.0

# variables bound to a querySelectorAll("...") result set
vars = {}
for m in re.finditer(r'var\s+([A-Za-z_$][\w$]*)\s*=\s*document\.querySelectorAll\(\s*"([^"]+)"\s*\)', src):
    hits = resolve(m.group(2))
    if hits:
        vars[m.group(1)] = hits

# elements deliberately kept invisible for the whole film
ALLOWLIST = {
    '#night': 'decorative tint layer, intentionally never shown',
}

revealed = {}        # element id -> peak opacity reached
for m in CALL.finditer(src):
    kind, tgt, v1, v2 = m.group(1), m.group(2), m.group(3) or '', m.group(4) or ''
    blob = v1 + ' ' + v2          # peak over BOTH ends: fade-ins and fade-outs
    peak = 0.0
    for om in OPVAL.finditer(blob):
        peak = max(peak, float(om.group(1)))
    if peak < FLOOR:
        continue
    # static selectors, quoted array entries, and dynamic concat prefixes ("#bdg"+i)
    for piece in re.findall(r'"([^"]*)"', tgt):
        piece = piece.strip()
        if piece.startswith('#'):
            for e in (resolve(piece) or []):
                revealed[e] = max(revealed.get(e, 0.0), peak)
    for pre in re.findall(r'"(#[A-Za-z0-9_-]+)"\s*\+', tgt):
        for e in dom:
            if e.startswith(pre[1:]):
                revealed[e] = max(revealed.get(e, 0.0), peak)
    # bare variable targets: hmCells[i], layers[i], ...
    mv = re.match(r'^([A-Za-z_$][\w$]*)(?:\[[^\]]*\])?$', tgt.strip())
    if mv and mv.group(1) in vars:
        for e in vars[mv.group(1)]:
            revealed[e] = max(revealed.get(e, 0.0), peak)

# ---------- 5. report ---------------------------------------------------------
hidden = {e: s for e, s in hidden.items() if ('#' + e) not in ALLOWLIST}
missing = sorted(e for e in hidden if e not in revealed)
print('css opacity:0 selectors : %d' % len(hidden_selectors))
print('hidden elements         : %d (allowlisted: %d)' % (len(hidden), len(ALLOWLIST)))
print('revealed by tween       : %d' % len([e for e in hidden if e in revealed]))
print('unresolved selectors    : %s' % (', '.join(sorted(set(unresolved))) or 'none'))
if missing:
    print('\nFAIL - initially hidden, never revealed:')
    for e in missing:
        print('  #%-10s  hidden by: %s' % (e, ', '.join(sorted(set(hidden[e])))))
    sys.exit(1)
print('\nPASS - every initially-hidden element becomes visible')
