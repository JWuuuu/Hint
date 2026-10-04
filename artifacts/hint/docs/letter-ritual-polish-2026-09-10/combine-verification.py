from pathlib import Path
import re,json,hashlib,collections
base=Path('/tmp/hint-letter-20260910')
listed=json.loads((base/'case-list.json').read_text())
resume=json.loads((base/'resume-e2e.json').read_text())
def specs(suites, parents=()):
 for suite in suites:
  path=parents + ((suite['title'],) if suite.get('line',0) else ())
  for spec in suite.get('specs',[]):
   for test in spec['tests']:
    key='['+test['projectName']+'] › '+spec['file']+' › '+' › '.join(path+(spec['title'],))
    yield key,spec,test
  yield from specs(suite.get('suites',[]),path)
expected={k:{'file':s['file'],'project':t['projectName'],'title':s['title']} for k,s,t in specs(listed['suites'])}
results={}; attempts=[]
for line in (base/'final-e2e.log').read_text().splitlines():
 m=re.match(r'\s*([✓✘-])\s+\d+\s+(\[.*\] › .*)$',line)
 if not m: continue
 key=re.sub(r' \([\d.]+[ms]+\)$','',m[2]).replace('artifacts/hint/e2e/','')
 key=re.sub(r'(\.spec\.ts):\d+:\d+',r'\1',key)
 status={'✓':'passed','✘':'failed','-':'skipped'}[m[1]]
 record={'key':key,'status':status,'evidence':'final-e2e.log (interrupted run, completed individual case)'}
 attempts.append(record); results[key]=record
for key,s,t in specs(resume['suites']):
 actual=t['results'][-1] if t['results'] else {}
 record={'key':key,'status':actual.get('status','unverified'),'evidence':'resume-e2e.json','annotations':t.get('annotations',[])}
 attempts.append(record); results[key]=record
missing=sorted(set(expected)-set(results)); unexpected=sorted(set(results)-set(expected))
counts=collections.Counter(results[k]['status'] for k in expected if k in results)
groups={}
for key,case in expected.items():
 group=groups.setdefault(case['file'],collections.Counter())
 group[results.get(key,{}).get('status','unverified')]+=1
source=json.loads((base/'source-final.json').read_text())
changed=[p for p,h in source.items() if hashlib.sha256(Path(p).read_bytes()).hexdigest()!=h]
report={'method':'Individual completed cases from an interrupted run plus exact remaining cases on identical production source; keyed by project, file, and full title. Original false-assertion failures retained in attempts. No snapshot updates.','expectedCount':len(expected),'counts':dict(counts),'missing':missing,'unexpected':unexpected,'sourceFiles':len(source),'changedSource':changed,'groups':{k:dict(v) for k,v in groups.items()},'cases':[dict(expected[k],**results.get(k,{'key':k,'status':'unverified'})) for k in expected],'attempts':attempts}
(base/'combined-e2e.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:report[k] for k in ['expectedCount','counts','missing','unexpected','sourceFiles','changedSource','groups']},ensure_ascii=False,indent=2))
if missing or unexpected or changed or counts['failed'] or counts['unverified'] or counts['timedOut'] or counts['interrupted']: raise SystemExit(1)
