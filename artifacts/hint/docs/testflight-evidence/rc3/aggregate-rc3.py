import json, hashlib
from pathlib import Path
from collections import Counter
from datetime import datetime, timezone
base=Path(__file__).parent

def flatten(report):
    result=[]
    def visit(suite, parents=()):
        for spec in suite.get('specs',[]):
            for test in spec['tests']:
                result.append({'file':spec['file'], 'suite':list(parents), 'title':spec['title'], 'project':test['projectName'], 'status':test.get('status'), 'expectedStatus':test['expectedStatus'], 'results':[{'status':r['status'],'retry':r.get('retry'), 'durationMs':r.get('duration'), 'annotations':r.get('annotations',[])} for r in test.get('results',[])]})
        for child in suite.get('suites',[]): visit(child,parents+(suite['title'],))
    for suite in report['suites']: visit(suite)
    return result

def key(row): return row['file'], tuple(row['suite']),row['title'],row['project']
inventory=flatten(json.loads((base/'rc3-all-test-inventory.json').read_text()))
assert len(inventory)==410, len(inventory)
rows=[]
sources=[]
for name in ['main','surface-final','tarot','sharing','motion']:
    file=base/('rc3-main-initial.json' if name=='main' and (base/'rc3-main-initial.json').exists() else f'rc3-{name}.json')
    report=json.loads(file.read_text())
    assert not report['errors'], (name,report['errors'])
    cases=flatten(report)
    selected=[r for r in cases if name!='main' or r['file']!='locale-surface-audit.spec.ts']
    report_name='rc3-main-initial.json' if name=='main' else file.name
    for row in selected: row['report']=report_name
    rows+=selected
    sources.append({'report':report_name,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'rawStats':report['stats'],'usedCases':len(selected)})
assert len(rows)==410, len(rows)
assert len(set(map(key,rows)))==410, 'duplicate scenarios'
assert set(map(key,rows))==set(map(key,inventory)), 'missing or extra scenarios'
counts=Counter(r['results'][-1]['status'] for r in rows)
assert counts=={'passed':390,'skipped':20}, counts
assert all(r['status'] in ('expected','skipped') for r in rows), 'flaky or unexpected'
assert all(len(r['results'])==1 and r['results'][0]['retry']==0 for r in rows), 'reretry'
summary={'recorded':datetime.now(timezone.utc).isoformat(),'runtimeSourceSha256':json.loads((base/'rc3-runtime-manifest.json').read_text())['sha256'],'webAssetManifestSha256':json.loads((base/'rc3-web-assets-manifest.json').read_text())['sha256'],'totalUnique':len(rows),'counts':dict(counts),'flaky':0,'failed':0,'note':'Final evidence uses 208 main cases, all 16 locale-surface cases rerun after a reviewed test-only WebKit-native navigation-diagnostic classifier, 152 Tarot, 26 sharing/touch and 8 standalone motion cases. The raw main run remains preserved: 215 pass, 8 skip, 1 native diagnostic false positive; it is not silently rewritten. App runtime/assets stayed unchanged. Counts are unique scenario/project pairs, not sums of prior candidate runs.','sources':sources,'cases':rows}
(base/'rc3-final-test-registry.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in summary.items() if k not in ('cases','sources')},indent=2))
