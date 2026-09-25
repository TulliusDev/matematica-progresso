"""New plan checks in an isolated browser, with no real credentials or cloud calls."""
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
origin = f'http://localhost:{server.server_port}'
try:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.route('**/*', lambda route: route.continue_() if route.request.url.startswith(origin) else route.abort())
        page.goto(origin + '/tests/storage-tests.html')
        for name in ['planning-config.js', 'subjects.js', 'planning.js', 'storage.js']:
            page.evaluate((ROOT / name).read_text(encoding='utf-8'))
        source = (ROOT / 'study.js').read_text(encoding='utf-8')
        source = source.replace('window.TrajetoriaStudy = {', 'window.testStudy = { subjectDescriptor, getSettings, pendingBaseTopics, renderTopicSelector, finalizeSegments, setHost: value => host=value, setFlow: value => activeFlow=value, getFlow:()=>activeFlow }; window.TrajetoriaStudy = {')
        page.evaluate(source)
        print(page.evaluate("""() => {
          const S=TrajetoriaStorage,P=TrajetoriaPlanning,C=TRAJETORIA_PLANNING_CONFIG,T=testStudy;
          let checks=0; const check=(ok,name)=>{if(!ok)throw Error(name);checks++};
          const state=S.normalizeState(S.createDefaultState());
          const plan=P.calculate(state,S.allTopics,P.dateFromDayKey('2026-09-23'));
          const expected={matematica:0,portugues:855,ciencias:1170,historia:1230,geografia:1065};
          plan.bySubject.forEach(s=>check(s.remainingMinutes===expected[s.subjectId],s.subjectId));
          check(plan.remainingLoadMinutes===4320,'base total');
          check(C.workload.integrationReserveMinutes===2910 && C.workload.simulationReviewReserveMinutes===240,'reserves');
          check(C.capacity.totalCapacityIncludingSimulationsMinutes===8790 && C.workload.plannedWorkIncludingSimulationsMinutes===8190,'simulation totals');
          ['2026-09','2026-10','2026-11'].forEach((month,i)=>{
            check(C.regularWeekdayCounts[month]*C.dailyTargetsMinutes[month]===[540,3630,3900][i],'monthly capacity');
            check(C.dailyBlocksMinutes[month].reduce((a,b)=>a+b,0)===C.dailyTargetsMinutes[month],'blocks');
          });
          check(plan.estimateStress.every((s,i)=>s.marginMinutes===600-4320*[.05,.10,.15][i]),'stress');
          check(C.capacity.regularCapacityMinutes===8070 && C.workload.plannedRegularWorkMinutes===7470,'capacity/work');
          check(plan.margin.currentMarginMinutes===600,'margin 600');
          check(C.workload.simulationPlanMinutes===720 && C.simulationPlan.length===4,'simulations');
          check(S.allTopics.length===193,'curriculum preserved');
          check(S.allTopics.find(t=>t.id==='pt-o-alienista').budgetMinutes===90,'Alienista');
          check(S.allTopics.filter(t=>t.subject.id==='historia' && t.planActive).length===26,'history list');
          check(S.allTopics.filter(t=>t.subject.id==='geografia' && t.planActive).length===30,'geo list');
          C.stateRebase.correctHistoryTopicIds.forEach(id=>check(state.topics[id].status==='consolidating',id));
          const changed=structuredClone(state); changed.topics['his-egito'].status='mastered';
          check(S.normalizeState(changed).topics['his-egito'].status==='mastered','one-time correction');
          const legacy=structuredClone(state);
          C.stateRebase.correctHistoryTopicIds.forEach(id=>{delete legacy.topics[id].planRebaseVersion;legacy.topics[id].status='mastered'});
          const merged=S.mergeStates(state,legacy);
          check(C.stateRebase.correctHistoryTopicIds.every(id=>merged.topics[id].status==='consolidating'),'old cloud cannot restore false mastery');
          state.study.sessions=[{id:'old',kind:'base',topicId:'his-roma',dayKey:'2026-09-10',effectiveSeconds:10000,createdAt:'2026-09-10T12:00:00Z'},{id:'inactive',kind:'base',topicId:'geo-paisagem',dayKey:'2026-09-23',effectiveSeconds:600,createdAt:'2026-09-23T12:00:00Z'}];
          check(P.calculate(state,S.allTopics,P.dateFromDayKey('2026-09-23')).margin.currentMarginMinutes===600,'rebase/inactive delta');
          state.continuousData={sentinel:'preserve'};
          state.study.adjustments=[{id:'manual-adjustment:2026-09-23',kind:'manual-adjustment',dayKey:'2026-09-23',deltaSeconds:600,updatedAt:'2026-09-23T12:00:00Z'}];
          const restored=S.mergeStates(state,JSON.parse(JSON.stringify(state)));
          check(restored.continuousData.sentinel==='preserve' && restored.study.adjustments.length===1,'backup/merge');
          [['2026-09-29',90],['2026-10-15',165],['2026-11-16',195],['2026-09-27',0]].forEach(([d,m])=>check(P.dailyTargetForDate(P.dateFromDayKey(d),C)===m,d));
          const weekly=[['2026-09-28','portugues','matematica'],['2026-09-29','ciencias','historia'],['2026-09-30','portugues','matematica'],['2026-10-01','ciencias','geografia']];
          weekly.forEach(([d,a,b])=>{const s=TRAJETORIA_DATA.scheduleForDate(P.dateFromDayKey(d));check(s.primary.subjectId===a&&s.secondary.subjectId===b,d)});
          check(TRAJETORIA_DATA.scheduleForDate(P.dateFromDayKey('2026-09-25')).primary.subjectId!==TRAJETORIA_DATA.scheduleForDate(P.dateFromDayKey('2026-10-02')).primary.subjectId,'Friday alternation');
          T.setHost({getState:()=>state,getSubjectTopics:id=>S.allTopics.filter(t=>t.subject.id===id)});
          check(T.subjectDescriptor('matematica',60).topicId==='','math no new base');
          check(T.subjectDescriptor('geografia',60).topicId==='geo-latitude-longitude','skip inactive');
          const flow={phase:'primary',current:{kind:'base',subjectId:'historia',topicId:'his-feudalismo',segments:[],accumulatedMs:120000,runningSince:null}};
          T.setFlow(flow);TrajetoriaStudy.onTopicStatusChanged('his-feudalismo','consolidating');
          check(T.getFlow().current.topicId==='his-renascimento','auto skips excluded topics');
          check(T.getFlow().current.segments[0].effectiveSeconds===120,'segments preserved');
          const pending=T.pendingBaseTopics('ciencias');
          check(pending.length>1 && pending.every(t=>t.planActive!==false),'eligible topics');
          const first=pending[0], next=pending[1];
          state.topics[first.id].status='studying';
          check(T.subjectDescriptor('ciencias',60).topicId===first.id,'studying preferred');
          const timed={phase:'primary',current:{kind:'base',subjectId:'ciencias',topicId:first.id,segments:[],accumulatedMs:120000,runningSince:null}};
          T.setFlow(timed); state.topics[first.id].status='consolidating';
          TrajetoriaStudy.onTopicStatusChanged(first.id,'consolidating');
          check(timed.current.topicId===next.id && timed.current.accumulatedMs===120000,'same subject/no timer reset');
          check(!T.renderTopicSelector(timed.current).includes('value="'+first.id+'"'),'consolidated excluded');
          timed.current.accumulatedMs=180000;
          const segments=T.finalizeSegments(timed.current);
          check(segments[0].effectiveSeconds===120 && segments[1].effectiveSeconds===60,'segmented time');
          const last=pending[pending.length-1];timed.current.topicId=last.id;
          state.topics[last.id].status='mastered';TrajetoriaStudy.onTopicStatusChanged(last.id,'mastered');
          check(timed.current.topicId==='' && T.renderTopicSelector(timed.current).includes('Nenhum tópico pendente'),'no wrap');
          state.study.sessions=[{kind:'integration',dayKey:'2026-09-23',effectiveSeconds:2970*60,topicId:first.id}];
          const integration=P.calculate(state,S.allTopics,P.dateFromDayKey('2026-09-23'));
          check(integration.margin.integrationOverrunMinutes===60 && integration.margin.topicDeltaMinutes===0,'integration isolation');
          return checks+' plan/state/schedule/topic checks passed';
        }"""))
        # Verify public Auth methods with a fake SDK; passwords never enter storage.
        page.evaluate("""() => {
          window.authCalls=[];
          window.supabase={createClient:(url,key,options)=>{
            window.authOptions=options;
            return {auth:{
              getSession:async()=>({data:{session:{user:{id:'test-user'}}}}),
              onAuthStateChange:()=>{},
              signInWithPassword:async(args)=>{authCalls.push({type:'password',args});return {error:null}},
              updateUser:async(args)=>{authCalls.push({type:'update',args});return {error:null}},
              signInWithOtp:async(args)=>{authCalls.push({type:'link',args});return {error:null}}
            },from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})}),insert:async()=>({error:null})})};
          }};
        }""")
        page.evaluate((ROOT / 'cloud-sync.js').read_text(encoding='utf-8'))
        page.evaluate("""async() => {
          const cloud=TrajetoriaCloud.create({getState:()=>({}),mergeStates:a=>a});
          await cloud.initialize();
          await cloud.signInWithPassword('test@example.invalid','SYNTHETIC-password');
          await cloud.updatePassword('SYNTHETIC-new-password');
          await cloud.signIn('test@example.invalid');
          if(authCalls.map(c=>c.type).join(',')!=='password,update,link')throw Error('auth API');
          if(JSON.stringify(localStorage).includes('SYNTHETIC'))throw Error('password persisted');
          if(!authOptions.auth.persistSession)throw Error('session persistence');
        }""")
        print('Auth password/update/magic link and no password storage passed')
        page.evaluate('localStorage.clear()')
        errors=[]
        page.on('pageerror',lambda err:errors.append(str(err)))
        page.goto(origin+'/index.html')
        for width in [390,1366]:
            page.set_viewport_size({'width':width,'height':900})
            assert page.locator('#main-content h1').first.inner_text().startswith('Hoje')
            assert page.locator('.session-plan-summary').is_visible()
            assert not page.locator('#main-content .progress-ring').count()
            assert not page.locator('#main-content .subject-progress-card').count()
            assert not page.locator('[data-continuous-nav]:visible').count()
            assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
        page.get_by_role('button',name='Currículo',exact=True).click()
        page.locator('.subject-progress-card[data-subject-id="geografia"]').click()
        assert page.get_by_text('Paisagem',exact=True).count()
        assert page.get_by_text('Fora do plano atual',exact=True).count()
        page.goto(origin+'/index.html#home')
        page.locator('.session-shortcuts').get_by_role('button',name='Configurações',exact=True).click()
        assert page.get_by_role('button',name='Entrar com e-mail e senha',exact=True).is_visible()
        assert page.get_by_role('button',name='Entrar por e-mail',exact=True).is_visible()
        page.locator('#settings-dialog .dialog-close').click()
        page.locator('.session-choice > summary').click()
        page.locator('#study-extra-subject').select_option('matematica')
        page.locator('#study-extra-kind').select_option('integration')
        page.locator('.session-choice button').click()
        active=page.evaluate('JSON.parse(localStorage.getItem("trajetoria-study-timer-v1"))')
        assert active['current']['kind']=='integration' and active['current']['topicId']==''
        assert not errors,errors
        print('Home desktop/mobile, curriculum, login UI and math integration passed')
        page.add_init_script('localStorage.removeItem("trajetoria-study-timer-v1")')
        page.goto(origin+'/index.html#home')
        page.reload()
        page.locator('.session-choice > summary').click()
        page.locator('#study-extra-kind').select_option('base')
        assert page.locator('.session-choice button').is_disabled()
        assert 'Nenhum tópico de base pendente' in page.locator('#study-extra-topic-field').inner_text()
        page.locator('#study-extra-subject').select_option('ciencias')
        assert page.locator('#study-extra-topic').is_visible()
        assert page.locator('#study-extra-topic option:checked').inner_text()=='Átomos'
        page.locator('#study-extra-topic').select_option(label='Moléculas')
        selected=page.locator('#study-extra-topic').input_value()
        page.locator('#study-extra-subject').select_option('portugues')
        assert page.locator('#study-extra-topic').input_value()!=selected
        page.locator('#study-extra-subject').select_option('ciencias')
        page.locator('#study-extra-kind').select_option('integration')
        assert page.locator('#study-extra-topic-field').is_hidden()
        page.locator('#study-extra-kind').select_option('base')
        page.locator('#study-extra-topic').select_option(label='Moléculas')
        page.locator('.session-choice button').click()
        active=page.evaluate('JSON.parse(localStorage.getItem("trajetoria-study-timer-v1"))')
        assert active['current']['kind']=='base' and active['current']['topicId']==selected
        assert page.locator('#study-session-topic').input_value()==selected
        assert not errors,errors
        print('Base selector, suggestion, subject change, integration and math guards passed')
        # Offline shell smoke test uses only an isolated browser cache.
        page.add_init_script('localStorage.removeItem("trajetoria-study-timer-v1")')
        page.goto(origin+'/index.html')
        page.evaluate('Promise.race([navigator.serviceWorker.ready, new Promise((_,reject)=>setTimeout(()=>reject(Error("Service worker timeout")),15000))])')
        page.reload()
        page.context.set_offline(True)
        page.reload()
        assert page.locator('#main-content h1').first.inner_text().startswith('Hoje')
        assert page.evaluate('TRAJETORIA_PLANNING_CONFIG.dates.planStartDate')=='2026-09-23'
        print('PWA offline shell and new config passed')
        browser.close()
finally:
    server.shutdown()
