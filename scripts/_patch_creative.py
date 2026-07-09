import sys
from pathlib import Path
p = r"D:/AIproject/省心投BI/backend/routes/reports/app_market.py"
data = Path(p).read_bytes()
if data[:3] == b"\xef\xbb\xbf":
    data = data[3:]
t = data.decode("utf-8")
crlf = chr(13) + chr(10)
old1 = "@bp.route(\x27/filter-options\x27, methods=[\x27GET\x27])\n@handle_exceptions\ndef app_market_filter_options():\n    markets = [r[0] for r in db.session.query(FactConvAppmarket.\u5e94\u7528\u5e02\u573a).distinct().all() if r[0]]\n    markets_sorted = sorted(markets, key=lambda x: (\x27a\x27 if x.isascii() else \x27z\x27) + x)\n    types = [r[0] for r in db.session.query(FactConvAppmarket.\u6e20\u9053\u7c7b\u578b).distinct().all() if r[0]]\n    return jsonify({\n        \x27success\x27: True,\n        \x27data\x27: {\n            \x27app_markets\x27: markets_sorted,\n            \x27channel_types\x27: sorted(types),\n        },\n        \x27meta\x27: _META,\n    })".replace(chr(10), crlf)
new1_lines = [
    "@bp.route(\x27/filter-options\x27, methods=[\x27GET\x27])",
    "@handle_exceptions",
    "def app_market_filter_options():",
    "    markets = [r[0] for r in db.session.query(FactConvAppmarket.\u5e94\u7528\u5e02\u573a).distinct().all() if r[0]]",
    "    markets_sorted = sorted(markets, key=lambda x: (\x27a\x27 if x.isascii() else \x27z\x27) + x)",
    "    types = [r[0] for r in db.session.query(FactConvAppmarket.\u6e20\u9053\u7c7b\u578b).distinct().all() if r[0]]",
    "    return jsonify({",
    "        \x27success\x27: True,",
    "        \x27data\x27: {",
    "            \x27app_markets\x27: markets_sorted,",
    "            \x27channel_types\x27: sorted(types),",
    "        },",
    "        \x27meta\x27: _META,",
    "    })",
    "",
    "",
    "@bp.route(\x27/creative\x27, methods=[\x27POST\x27])",
    "@handle_exceptions",
    "def app_market_creative():",
    "    """+chr(34)*3+"\u5e7f\u544a\u521b\u610f\u6548\u679c\uff08\u6309 \u5e7f\u544a\u8ba1\u5212ID \u805a\u5408\uff09"+chr(34)*3,
    "    data = request.get_json() or {}",
    "    filters = data.get(\x27filters\x27) or {}",
    "    q = _apply_filters(db.session.query(",
    "        FactConvAppmarket.\u5e7f\u544a\u8ba1\u5212ID,",
    "        FactConvAppmarket.\u5e94\u7528\u5e02\u573a,",
    "        FactConvAppmarket.\u6e20\u9053\u7c7b\u578b,",
    "        func.coalesce(func.sum(case((FactConvAppmarket.\u662f\u5426\u6fc0\u6d3bAPP == 1, 1), else_=0)), 0).label(\x27\u6fc0\u6d3bAPP\x27),",
    "        func.coalesce(func.sum(case((FactConvAppmarket.\u662f\u5426\u5f00\u6237\u6210\u529f == 1, 1), else_=0)), 0).label(\x27\u5f00\u6237\u6210\u529f\x27),",
    "        func.coalesce(func.sum(case((FactConvAppmarket.\u662f\u5426\u5165\u91d1 == 1, 1), else_=0)), 0).label(\x27\u5165\u91d1\x27),",
    "        func.coalesce(func.sum(case((FactConvAppmarket.\u662f\u5426\u6709\u6548\u6237 == 1, 1), else_=0)), 0).label(\x27\u6709\u6548\u6237\x27),",
    "    ), filters)",
    "    rows = q.group_by(FactConvAppmarket.\u5e7f\u544a\u8ba1\u5212ID, FactConvAppmarket.\u5e94\u7528\u5e02\u573a, FactConvAppmarket.\u6e20\u9053\u7c7b\u578b).all()",
    "    items = []",
    "    for r in rows:",
    "        activate = _i(r.\u6fc0\u6d3bAPP)",
    "        opened = _i(r.\u5f00\u6237\u6210\u529f)",
    "        valid = _i(r.\u6709\u6548\u6237)",
    "        items.append({",
    "            \x27\u5e7f\u544a\u8ba1\u5212ID\x27: r.\u5e7f\u544a\u8ba1\u5212ID if r.\u5e7f\u544a\u8ba1\u5212ID is not None else \x27-\x27,",
    "            \x27\u5e94\u7528\u5e02\u573a\x27: r.\u5e94\u7528\u5e02\u573a or \x27-\x27,",
    "            \x27\u6e20\u9053\u7c7b\u578b\x27: r.\u6e20\u9053\u7c7b\u578b or \x27-\x27,",
    "            \x27\u6fc0\u6d3bAPP\x27: activate,",
    "            \x27\u5f00\u6237\u6210\u529f\x27: opened,",
    "            \x27\u5165\u91d1\x27: _i(r.\u5165\u91d1),",
    "            \x27\u6709\u6548\u6237\x27: valid,",
    "            \x27\u5f00\u6237\u7387\x27: round(opened / activate * 100, 2) if activate > 0 else 0,",
    "            \x27\u6709\u6548\u7387\x27: round(valid / activate * 100, 2) if activate > 0 else 0,",
    "        })",
    "    items.sort(key=lambda x: x[\x27\u5f00\u6237\u6210\u529f\x27], reverse=True)",
    "    return jsonify({\x27success\x27: True, \x27data\x27: {\x27items\x27: items, \x27total\x27: len(items)}, \x27meta\x27: _META})"
]
new1 = crlf.join(new1_lines)
assert old1 in t, "old1 not found"
t = t.replace(old1, new1, 1)
Path(p).write_bytes(b"\xef\xbb\xbf" + t.encode("utf-8"))
print("Bug 3 (creative) fixed, new size:", len(t))

