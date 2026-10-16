import json,re,collections,sys
DAYS=['شنبه','یک شنبه','یکشنبه','دوشنبه','سه شنبه','چهارشنبه','پنج شنبه','پنجشنبه','جمعه']
DAY='|'.join(sorted(DAYS,key=len,reverse=True))
START=re.compile(r'(?=(?:درس|حل تمرین|امتحان)\s*\()')
SES=re.compile(r'(?P<kind>درس|حل تمرین)\((?P<tp>[تع])\)\s*:\s*(?:(?P<day>'+DAY+r')|(?P<date>\d{4}/\d{2}/\d{2}))\s+(?P<a>\d{1,2}:\d{2})-(?P<b>\d{1,2}:\d{2})\s*(?P<wk>ف|ز)?(?:\s|$)')
EXM=re.compile(r'امتحان\((?P<d>\d{4}/\d{2}/\d{2})\)\s*ساعت\s*:\s*(?P<a>\d{1,2}:\d{2})(?:-(?P<b>\d{1,2}:\d{2}))?')
def mins(t):h,m=t.split(':');return int(h)*60+int(m)
R=[r for r in json.load(open(sys.argv[1])) if 'error' not in r]
st=collections.Counter(); wk=collections.Counter(); notes=collections.Counter(); odd=[]; unk=collections.Counter(); exdur=collections.Counter()
other=collections.Counter(); drop=collections.Counter()
parsed={}
for r in R:
    blob=' '.join(r['time'])
    parts=[s.strip() for s in START.split(blob) if s.strip()]
    ses=[];ex=None
    for s in parts:
        m=SES.match(s)
        if m:
            st['sessions']+=1
            st['dated' if m['date'] else 'weekly']+=1
            wk[m['wk'] or '-']+=1
            a,b=m['a'],m['b']; start,end=b,a
            if len(start)<5 or len(end)<5 or mins(end)<=mins(start): st['bad_time']+=1; odd.append(s[:70])
            ses.append((m['kind'],m['tp'],m['day'] or m['date'],start,end,m['wk'] or ''))
            continue
        e=EXM.match(s)
        if e:
            st['exams']+=1
            if e['b']: st['exam_range']+=1; exdur[mins(e['a'])-mins(e['b'])]+=1
            ex=(e['d'],e['b'] or e['a'],e['a'] if e['b'] else None)
            continue
        unk[s[:40]]+=1
    parsed[r['code'][0]]={'ses':ses,'ex':ex}
    if r['notes']: notes[' '.join(r['notes'])[:60]]+=1
    other[' '.join(r['other_centers'])]+=1; drop[' '.join(r['emergency_drop'])]+=1
print(len(R),dict(st)); print('week',wk); print('exam durations (min)',sorted(exdur.items()))
print('bad',odd[:5]); print('unk',unk.most_common(8))
print('notes groups',sum(notes.values()),notes.most_common(12))
print('other',other.most_common(4),'drop',drop.most_common(4))
json.dump(parsed,open(sys.argv[2],'w'),ensure_ascii=False)
