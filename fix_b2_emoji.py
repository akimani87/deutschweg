#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os, glob

BASE = os.path.dirname(os.path.abspath(__file__))
files = sorted(glob.glob(os.path.join(BASE, 'module-b2-*.html')))

for fpath in files:
    fname = os.path.basename(fpath)
    with open(fpath, 'r', encoding='utf-8') as f:
        html = f.read()
    orig = html

    # Fix emoji: literal JS string '\U0001F4CC ' -> actual 📌 emoji
    html = html.replace("'\\U0001F4CC '", "'\U0001F4CC '")

    # Fix .qfr font
    html = html.replace(
        "font-family:'DM Mono',monospace; }",
        "font-family:'DM Sans',sans-serif; font-weight:600; }"
    )

    if html != orig:
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(html)
        print('OK   ' + fname)
    else:
        print('SKIP ' + fname)

print('Done')
