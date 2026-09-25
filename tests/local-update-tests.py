"""Focused browser checks; isolated profile, no cloud access or project data writes."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
origin = f'http://127.0.0.1:{server.server_port}'
try:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.route('**/*', lambda route: route.continue_() if route.request.url.startswith(origin) else route.abort())
        for suite in ['planning', 'storage']:
            page.goto(f'{origin}/tests/{suite}-tests.html')
            assert page.locator('body').get_attribute('data-failed') == '0', page.locator('#results').inner_text()
            print(suite, page.locator('#results').inner_text().splitlines()[-1])
        source = (ROOT / 'study.js').read_text(encoding='utf-8')
        source = source.replace('window.TrajetoriaStudy = {', 'window.studyTest = { setDayTotal, summarizeDay, renderStudyHistory, setHost: (value) => host = value, setFlow: (value) => activeFlow = value, getFlow: () => activeFlow }; window.TrajetoriaStudy = {')
        page.evaluate(source)
        result = page.evaluate('''() => {
          const S = TrajetoriaStorage, P = TrajetoriaPlanning, T = studyTest;
          let count = 0;
          const check = (value, name) => { if (!value) throw Error(name); count++; };
          const day = '2026-09-23';
          const session = {id:'real', dayKey:day, kind:'base', topicId:'a', effectiveSeconds:1200, createdAt:day+'T12:00:00Z'};
          let state = S.normalizeState({topics:{}, study:{sessions:[session]}});
          const topics = ['a','b','c'].map(id => ({id,name:id,budgetMinutes:60,subject:{id:'mat',name:'Mat'}}));
          state.topics = {a:{status:'studying'},b:{status:'not-started'},c:{status:'not-started'}};
          T.setHost({getState:()=>state, persist:()=>S.saveState(state), getSubjectTopics:()=>topics});
          const original = JSON.stringify(state.study.sessions);
          check(T.setDayTotal(day,3600), 'save');
          check(state.study.adjustments[0].deltaSeconds===2400, '+40');
          check(T.summarizeDay(day,state.study).totalSeconds===3600, 'total60');
          T.setDayTotal(day,2700);
          check(state.study.adjustments.length===1 && state.study.adjustments[0].deltaSeconds===1500, 'replace25');
          check(!T.setDayTotal(day,-1), 'negative rejected');
          check(JSON.stringify(state.study.sessions)===original,'original sessions untouched');
          const before = P.calculate({...state,study:{...state.study,adjustments:[]}},topics,P.dateFromDayKey('2026-09-24'));
          const after = P.calculate(state,topics,P.dateFromDayKey('2026-09-24'));
          check(after.margin.dailyDeltaMinutes-before.margin.dailyDeltaMinutes===25,'daily delta');
          check(after.margin.topicDeltaMinutes===before.margin.topicDeltaMinutes,'topic delta');
          check(P.minutesByTopic(state.study.sessions).a===20,'calibration source');
          check(S.loadState().study.adjustments[0].deltaSeconds===1500,'reload');
          const imported = S.normalizeState(JSON.parse(JSON.stringify({data:state})).data);
          check(imported.study.adjustments[0].deltaSeconds===1500,'backup');
          const remote = structuredClone(state);
          remote.study.adjustments[0].deltaSeconds=1800;
          remote.study.adjustments[0].updatedAt='2099-01-01T00:00:00Z';
          const merged = S.mergeStates(state,remote);
          check(merged.study.adjustments.length===1 && merged.study.adjustments[0].deltaSeconds===1800,'merge latest once');
          state.study.sessions[0].effectiveSeconds=4800;
          T.setDayTotal(day,3600);
          check(state.study.adjustments[0].deltaSeconds===-1200,'negative correction');
          T.setDayTotal(day,5400);
          check(T.summarizeDay(day,state.study).status==='complete','adjusted complete');
          T.setDayTotal(day,0);
          check(T.summarizeDay(day,state.study).status==='empty','adjusted empty');
          const flow = () => ({phase:'primary',current:{kind:'base',subjectId:'mat',topicId:'a',topicName:'a',accumulatedMs:120000,runningSince:null,segmentSeconds:0,segments:[]}});
          for (const done of ['consolidating','mastered']) {
            T.setFlow(flow()); TrajetoriaStudy.onTopicStatusChanged('a',done);
            check(T.getFlow().current.topicId==='b','advance');
            check(T.getFlow().current.segments[0].effectiveSeconds===120,'old segment');
            check(T.getFlow().current.accumulatedMs===120000,'timer preserved');
          }
          state.topics.b.status='mastered';
          T.setFlow(flow()); TrajetoriaStudy.onTopicStatusChanged('a','consolidating');
          check(T.getFlow().current.topicId==='c','skip completed');
          state.topics.c.status='consolidating';
          T.setFlow(flow()); TrajetoriaStudy.onTopicStatusChanged('a','mastered');
          check(T.getFlow().current.topicId==='','no wrap');
          T.setFlow(flow()); TrajetoriaStudy.onTopicStatusChanged('b','mastered');
          check(T.getFlow().current.topicId==='a','other unchanged');
          for (const kind of ['integration','simulation','simulation-review']) {
            const f=flow(); f.current.kind=kind; T.setFlow(f);
            TrajetoriaStudy.onTopicStatusChanged('a','mastered');
            check(T.getFlow().current.topicId==='a',kind+' unchanged');
          }
          state.study.sessions.push({...session,id:'second',dayKey:'2026-09-02',effectiveSeconds:600});
          const html = T.renderStudyHistory(state.study);
          check(html.indexOf('data-day-key="2026-09-23"')<html.indexOf('data-day-key="2026-09-02"'),'history descending');
          return count;
        }''')
        print('focused', result, 'checks passed')
        script = (ROOT / 'script.js').read_text(encoding='utf-8')
        phrase = next(line.strip() for line in script.splitlines() if 'stats.due' in line and 'atenção hoje' in line)
        for n in [1,2,6]:
            actual = page.evaluate('(n) => { const stats={due:n}; '+phrase+' }', n)
            expected = f'{n} revisão merece atenção hoje.' if n == 1 else f'{n} revisões merecem atenção hoje.'
            assert actual == expected, actual
        print('plural 1/2/6 passed')
        page.add_style_tag(content=(ROOT / 'styles.css').read_text(encoding='utf-8'))
        for width in [390,1280]:
            page.set_viewport_size({'width':width,'height':900})
            for percent in [0,2,10,64,100]:
                page.evaluate('''percent => document.body.innerHTML = `<button class="subject-progress-card" style="width: min(100%, 450px)"><span class="subject-card-top"><span>M</span><span><strong>Matemática</strong><small>Em andamento</small></span><b>${percent}%</b></span><span class="progress-track"><span style="width:${percent}%"></span></span></button>`''',percent)
                dims = page.locator('.progress-track').evaluate('(el)=>({h:el.getBoundingClientRect().height,w:el.getBoundingClientRect().width,fill:el.firstElementChild.getBoundingClientRect().width,overflow:document.documentElement.scrollWidth>innerWidth})')
                assert dims['h']==5 and not dims['overflow'] and abs(dims['fill']-dims['w']*percent/100)<1, dims
        print('bars desktop/mobile 0/2/10/64/100 passed')
        page.evaluate('localStorage.clear()')
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(origin + '/index.html')
        page.get_by_role('button', name='Histórico', exact=True).click()
        page.locator('.study-history > summary').click()
        page.locator('#study-history-date').fill('2026-09-23')
        selected = page.locator('#study-history-selected-day')
        selected.get_by_text('Editar tempo total', exact=True).click()
        selected.locator('[name="hours"]').fill('1')
        selected.locator('[name="minutes"]').fill('30')
        selected.get_by_role('button', name='Salvar', exact=True).click()
        saved = page.evaluate('JSON.parse(localStorage.getItem("trajetoria-estudos-v3")).study.adjustments')
        assert saved[0]['deltaSeconds'] == 5400, saved
        page.reload()
        assert page.evaluate('JSON.parse(localStorage.getItem("trajetoria-estudos-v3")).study.adjustments[0].deltaSeconds') == 5400
        assert not errors, errors
        print('UI edit/save/reload with external network blocked passed')
        browser.close()
finally:
    server.shutdown()
