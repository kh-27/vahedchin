"""Prototype parser v2 for Golestan report 110 PDFs (full-width print).
Column boundaries come from the table's thin vertical border rects on each page.
Throwaway research code; the real parser will be TypeScript + pdf.js."""
import pdfplumber, re, sys, json, unicodedata

AR = re.compile(r'[؀-ۿ]')
DIG = re.compile(r'[0-9:/\-_.]+')
DMAP = {**{0x660 + i: 48 + i for i in range(10)}, **{0x6F0 + i: 48 + i for i in range(10)}}
FIX = str.maketrans({'ي': 'ی', 'ك': 'ک', 'ھ': 'ه', 'ۀ': 'ه', '‌': ' '})


def norm(t):
    return unicodedata.normalize('NFKC', t).translate(DMAP).translate(FIX)


def logical(tok):
    tok = norm(tok)
    if not AR.search(tok):
        return tok
    r = tok[::-1].translate(str.maketrans('()', ')('))
    return DIG.sub(lambda m: m.group(0)[::-1], r)


def text_lines(words, tol=2.5):
    rows = []
    for w in sorted(words, key=lambda w: w['top']):
        for r in rows:
            if abs(r['top'] - w['top']) < tol:
                r['w'].append(w)
                break
        else:
            rows.append({'top': w['top'], 'w': [w]})
    return [' '.join(logical(w['text']) for w in sorted(r['w'], key=lambda w: -w['x1']))
            for r in sorted(rows, key=lambda r: r['top'])]


COLS = ['emergency_drop', 'other_centers', 'notes', 'time', 'teacher', 'gender', 'waitlist',
        'registered', 'capacity', 'practical', 'units', 'name', 'code']
CODE = re.compile(r'^\d{7}_\d{2}$')


def run(path):
    out = []
    with pdfplumber.open(path) as pdf:
        hdr = ''
        for pi, p in enumerate(pdf.pages):
            xs = sorted({round(x) for rc in p.rects if rc['width'] < 2 for x in (rc['x0'],)})
            # merge borders closer than 3pt
            b = []
            for x in xs:
                if not b or x - b[-1] > 3:
                    b.append(x)
            words = p.extract_words(x_tolerance=1.5)
            top_words = [w for w in words if w['top'] < 80]
            if top_words:
                hdr = ' '.join(text_lines(top_words))
            if len(b) != 14:
                out.append({'page': pi + 1, 'error': f'borders={len(b)}'})
                continue
            def col(w):
                c = (w['x0'] + w['x1']) / 2
                for i in range(13):
                    if b[i] <= c < b[i + 1]:
                        return COLS[i]
                return None
            codes = sorted([w for w in words if col(w) == 'code' and CODE.match(norm(w['text']))],
                           key=lambda w: w['top'])
            for i, c in enumerate(codes):
                y0 = c['top'] - 1
                y1 = codes[i + 1]['top'] - 1 if i + 1 < len(codes) else 1e9
                cell = {k: [] for k in COLS}
                for w in words:
                    if y0 <= w['top'] < y1:
                        k = col(w)
                        if k:
                            cell[k].append(w)
                rec = {'page': pi + 1, 'header': hdr}
                for k in COLS:
                    rec[k] = text_lines(cell[k])
                out.append(rec)
    return out


if __name__ == '__main__':
    r = run(sys.argv[1])
    json.dump(r, open(sys.argv[2], 'w'), ensure_ascii=False, indent=1)
    print(len(r), 'records;', sum(1 for x in r if 'error' in x), 'page errors')
