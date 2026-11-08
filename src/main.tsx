import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { advance, back, choose, enter, fresh, matches, needsExternalPanel, nodeText, presentedNode, position } from './engine';
import { asset, catalog, loadStory, type CatalogItem } from './loader';
import { clearSave, readSave, writeSave } from './storage';
import type { Save, Story } from './types';
import './style.css';
import './cinematic.css';
import './time-transition.css';
import './mobile.css';
import { SceneImage } from './SceneImage';
import { useStoryMusic } from './useStoryMusic';

function App() {
  const [items,setItems] = useState<CatalogItem[]>([]);
  const [selected,setSelected] = useState<CatalogItem>();
  const [story,setStory] = useState<Story>();
  const [save,setSave] = useState<Save>();
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [teacher,setTeacher] = useState(false);
  const [help,setHelp] = useState(false);
  const [confirm,setConfirm] = useState<'restart'|'clear'|null>(null);
  const [warnings,setWarnings] = useState<string[]>([]);
  const [full,setFull] = useState(false);
  const [simple,setSimple] = useState(false);
  const [menu,setMenu] = useState(false);
  const [jump,setJump] = useState('');
  const [transitionStep,setTransitionStep] = useState('');
  const [transitionSimple,setTransitionSimple] = useState(false);
  const shell = useRef<HTMLDivElement>(null);
  const request = useRef(0);
  useEffect(() => { catalog().then(list => { setItems(list); const requested = new URLSearchParams(location.search).get('story'); const item = list.find(i => i.id === requested); if (item) void open(item,true); }).catch(e => setError(e.message)); }, []);
  function library() { ++request.current; setLoading(false); setStory(undefined); setSave(undefined); setError(''); const url = new URL(location.href); url.searchParams.delete('story'); history.replaceState(null,'',url); }
  useEffect(() => { const change = () => setFull(!!document.fullscreenElement); document.addEventListener('fullscreenchange',change); return () => document.removeEventListener('fullscreenchange',change); },[]);
  async function open(item: CatalogItem, resume: boolean) {
    const id = ++request.current; setLoading(true); setError(''); setNotice('');
    try { const result = await loadStory(item); if (id !== request.current) return; const old = resume ? readSave(result.story) : null; setSelected(item); setStory(result.story); setSave(old ?? fresh(result.story)); setWarnings(result.warnings); setTeacher(false); setSimple(false); setJump(result.story.start); const url = new URL(location.href); url.searchParams.set('story',item.id); history.replaceState(null,'',url); }
    catch(e) { if (id === request.current) setError(e instanceof Error ? e.message : 'Ошибка загрузки истории.'); }
    finally { if (id === request.current) setLoading(false); }
  }
  function update(next: Save) { setSimple(false); setSave(next); if (!writeSave(next)) setNotice('Браузер не разрешил сохранить прогресс. Текущий сеанс продолжает работать.'); }
  useEffect(() => { if (save && !writeSave(save)) setNotice('Сохранение недоступно. Разрешите браузеру использовать локальное хранилище.'); },[save]);
  const entry = save?.entries.at(-1);
  const rawNode = story?.nodes.find(n => n.id === entry?.nodeId);
  const node = rawNode && entry ? presentedNode(rawNode,entry.variables) : rawNode;
  const [revealedStep,setRevealedStep] = useState('');
  const stepKey = `${story?.id}:${entry?.nodeId}:${save?.entries.length}:${save?.updatedAt}`;
  const music = useStoryMusic(story?.id,node?.id,()=>{if(story&&save&&entry)guarded(()=>({...save,entries:[...save.entries,enter(story,'ENDING_C_D01',entry.variables)]}));});
  const transitioning = !!node?.transitionAfter && transitionStep === stepKey;
  useEffect(() => {
    if (!transitioning || !node?.transitionAfter || node.transitionAfter.manual || !story || !save || teacher || help || confirm) return;
    const timer=setTimeout(()=>{setTransitionStep('');guarded(()=>advance(story,save));},node.transitionAfter.durationMs);
    return ()=>clearTimeout(timer);
  },[transitioning,stepKey,node?.transitionAfter,story,save,teacher,help,confirm]);
  const delayed = !!node?.textDelayMs && revealedStep !== stepKey;
  useEffect(() => { if (!node?.textDelayMs) return; const timer=setTimeout(()=>setRevealedStep(stepKey),node.textDelayMs);return()=>clearTimeout(timer); },[stepKey,node?.textDelayMs]);
  const choice = node?.choices?.find(c => c.id === entry?.choiceId);
  const scene = story && node ? story.scenes[node.visual ?? node.scene] : undefined;
  const korean = story?.studentLanguage === 'ko';
  const continuation = node?.ending?.kind === 'continuation';
  const priorEntry = save?.entries.at(-2);
  const priorChoice = priorEntry?.choiceId ? story?.nodes.find(n => n.id === priorEntry.nodeId)?.choices?.find(c => c.id === priorEntry.choiceId) : undefined;
  const responseExample = choice?.answer ?? (priorChoice?.reactionNode === node?.id ? priorChoice?.answer : undefined);
  const speakerId = choice?.speaker ?? node?.speaker;
  const speaker = story && speakerId && node?.position !== 'narrator' ? story.characters[speakerId] : undefined;
  const visibleChoices = node?.choices?.filter(c => !c.when || matches(c.when,entry!.variables)) ?? [];
  const choosing = !!node?.choices?.length && !choice;
  function guarded(fn: () => Save) { try { update(fn()); } catch(e) { setError(e instanceof Error ? e.message : 'Ошибка перехода.'); } }
  function next() { if (transitioning && node?.transitionAfter?.manual && story && save && !help && !confirm) { setTransitionStep(''); guarded(() => advance(story,save)); return; } if (story && save && !choosing && !node?.ending && !delayed && !transitioning && !help && !confirm) { if(node?.transitionAfter){setTransitionSimple(false);setTransitionStep(stepKey);}else guarded(() => advance(story,save)); } }
  function previous() { if(transitioning){setTransitionStep('');return;}if (story && save) guarded(() => back(story,save)); }
  useEffect(() => {
    function keydown(e: KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey || (e.target as HTMLElement).closest('button,input,select,textarea,a') || help || confirm || menu || (e.target as HTMLElement).closest('.teacher-panel')) return;
      if (['ArrowRight',' ' ,'Enter'].includes(e.key)) { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); previous(); }
      if (/^[1-4]$/.test(e.key) && choosing && visibleChoices[Number(e.key)-1]) { e.preventDefault(); guarded(() => choose(story!,save!,visibleChoices[Number(e.key)-1].id)); }
    }
    window.addEventListener('keydown',keydown); return () => window.removeEventListener('keydown',keydown);
  });
  async function fullscreen() { try { if (document.fullscreenElement) await document.exitFullscreen(); else if (shell.current?.requestFullscreen) await shell.current.requestFullscreen(); else setNotice('Полноэкранный режим недоступен в этом браузере.'); } catch { setNotice('Браузер не разрешил полноэкранный режим.'); } }
  useEffect(() => { if (!teacher) return; const escape = (e: KeyboardEvent) => { if(e.key === 'Escape') setTeacher(false); }; window.addEventListener('keydown',escape); return () => window.removeEventListener('keydown',escape); },[teacher]);
  const choices = (story && save && node && choosing && <section className="choices-section"><div className="choice-heading"><div><span className="eyebrow">{korean ? 'YOUR TURN' : 'ВАШ ХОД'}</span><h2>{korean ? '뭐라고 말할까요?' : 'Что вы скажете?'}</h2></div><p>{korean ? <>먼저 말해 보세요.<br/>그다음 선택하세요.</> : <>Сначала ответьте вслух,<br/>затем выберите действие.</>}</p></div><div className="choices">{visibleChoices.map((c,i) => <button className="choice-card" key={c.id} onClick={() => guarded(() => choose(story,save,c.id))}><span className="choice-number">0{i+1}</span><span><strong lang={korean && node.choiceLanguage !== 'ru' ? 'ko' : 'ru'}>{korean && node.choiceLanguage !== 'ru' ? c.labelKo : c.label}</strong></span><span className="choice-arrow">↗</span></button>)}</div>{visibleChoices.length===0 && <div className="error">Нет доступных вариантов. Проверьте условия choices на экране {node.id}.</div>}</section>);
  const ending = (node && node.ending && <section className="ending"><span className="eyebrow">{continuation ? 'ДЕМО · ПРОДОЛЖЕНИЕ' : 'ИСТОРИЯ ЗАВЕРШЕНА'}</span><h2>{node.ending.title}</h2><p>{korean && !teacher ? node.ending.descriptionKo ?? node.ending.description : node.ending.description}</p><button className="primary" onClick={() => setConfirm('restart')}>Пройти другой маршрут ↗</button></section>);
  const dialogue = node && entry && !transitioning && !(node.ending && !node.text) && <div style={{visibility:delayed ? 'hidden' : undefined}} aria-hidden={delayed || undefined} className={`dialogue ${scene ? position(scene,node.position) : 'bottom'} ${node.position === 'narrator' ? 'narration' : ''}`}>
    <div className="dialogue-label"><span className="speaker-dot" style={{background:speaker?.color ?? '#b6c4bb'}}/>{speaker?.name ?? (korean ? '이야기' : node.ending ? 'Эпилог · 에필로그' : 'Рассказчик · 이야기')} {teacher && <code>{node.id}</code>}</div>
    <p key={`${node.id}-${entry.choiceId ?? ''}`} lang="ko">{choice?.reaction ?? nodeText(node,entry.variables,simple)}</p>
    <div className="dialogue-controls">{node.simple && node.simple !== (node.original ?? node.text) && <button className="simplify-button" aria-pressed={simple} onClick={() => setSimple(!simple)}>{simple ? 'Оригинал' : 'Проще'}</button>}
    {choosing ? <span className="dialogue-hint">{korean ? '먼저 말해 보세요 ↓' : 'Ваша реплика продолжит историю ↓'}</span> : node.ending ? <span className="dialogue-hint">{continuation ? '다음 이야기에 계속' : '이야기 끝 · Конец истории'}</span> : <button className="dialogue-next" onClick={next}>Дальше <span>→</span></button>}</div>
  </div>;
  return <div className={`app ${story && !error ? 'playing' : ''} ${teacher ? 'teaching' : ''}`} ref={shell}>
    <header><button className="brand" onClick={library} aria-label="Открыть библиотеку"><span className="brand-mark">서</span><span>seoul<span className="brand-light"> stories</span><small>КОРЕЙСКИЙ ЧЕРЕЗ ИСТОРИИ</small></span></button><nav><span className="edition">INTERACTIVE LEARNING / 01</span><button className="icon-button" onClick={() => setHelp(true)} aria-label="Справка">?</button></nav></header>
    <main>
      {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Закрыть уведомление">×</button></div>}
      {error && <section className="error" role="alert"><h2>Не удалось открыть историю</h2><pre>{error}</pre><button onClick={library}>В библиотеку</button></section>}
      {!story && !error && <>
        <div className="library-heading"><div><div className="eyebrow">LEARN A LANGUAGE. LIVE A STORY.</div><h1>У каждой реплики<br/>есть продолжение<span>.</span></h1><p>Говорите по-корейски. Принимайте решения.<br/>Открывайте свою версию истории.</p></div><div className="library-note"><span>작은 선택, 새로운 이야기</span><p>Маленький выбор.<br/>Новая история.</p></div></div>
        <div className="section-heading"><h2>Библиотека историй <span>{String(items.length).padStart(2,'0')}</span></h2><span>ДЛЯ УРОКОВ ОДИН НА ОДИН</span></div>
        <div className="story-grid">{items.map(item => <article className="story-card" key={item.id}><div className="cover"><img src={asset('',item.cover)} alt={item.title} onError={e => { e.currentTarget.style.visibility='hidden'; }}/><span className="cover-tag">{item.level}</span><span className="cover-caption" lang="ko">{item.subtitle}</span></div><div className="card-info"><div className="card-meta"><span>ВИЗУАЛЬНАЯ НОВЕЛЛА</span><span>◷ {item.duration}</span></div><h3>{item.title}</h3><p>{item.description}</p><div className="card-actions"><button className="primary" disabled={loading} onClick={() => open(item,true)}>{loading ? 'Загрузка…' : 'Открыть историю'} <span>↗</span></button></div></div></article>)}<aside className="library-aside"><span className="aside-symbol">말</span><h3>Сначала — ваша реплика</h3><p>Прочитайте сцену, обсудите варианты и ответьте вслух. Здесь нет таймера: история ждёт вас.</p><div className="aside-divider"/><span className="small-label">ДЛЯ ПРЕПОДАВАТЕЛЯ</span><p>Примеры ответов, сюжетные переменные и переход к любой сцене — в режиме преподавателя.</p><button className="text-button" onClick={() => setHelp(true)}>Как играть <span>→</span></button></aside></div>
      </>}
      {story && save && node && scene && selected && entry && !error && <>
        <div className="player-heading"><div><button className="back-library" onClick={library}>← Библиотека</button><h1>{korean ? story.subtitle : story.title} <span lang="ko">{scene.title ?? story.subtitle}</span></h1></div><div className="player-tools">{music.button}<button className="icon-button" onClick={() => setHelp(true)} aria-label="Справка">?</button><div className="player-menu"><button className="icon-button" aria-label="Управление историей" aria-expanded={menu} onClick={() => setMenu(!menu)}>···</button>{menu && <div className="menu-popover">{music.settings}<button onClick={() => {setMenu(false);setConfirm('restart');}}>Начать заново</button><button onClick={() => {setMenu(false);setConfirm('clear');}}>Очистить прогресс</button></div>}</div><button className={teacher ? 'teacher-toggle active' : 'teacher-toggle'} aria-label="Режим преподавателя" aria-pressed={teacher} onClick={() => setTeacher(!teacher)}>◈ <span>Режим преподавателя</span></button><button className="icon-button" onClick={fullscreen} aria-label={full?'Выйти из полноэкранного режима':'Полноэкранный режим'}>⛶</button></div></div>
        <section className="player" aria-label="Проигрыватель истории"><div className={`stage ${choosing ? 'has-choices' : ''} ${node.ending ? 'has-ending' : ''} ${transitioning ? `time-transition-active ${node.transitionAfter?.manual ? 'manual-time-transition-active' : ''}` : ''}`}><SceneImage src={asset(selected.path,scene.src)} scene={scene} instant={!!story.nodes.find(n=>n.id===priorEntry?.nodeId)?.transitionAfter}/><div className="scene-overlay">{dialogue}{choices}{ending}</div>{transitioning && node.transitionAfter && <div className={`time-transition ${node.transitionAfter.manual ? 'manual-time-transition' : ''}`} role="status"><p lang="ko">{transitionSimple ? node.transitionAfter.simple : node.transitionAfter.original}</p>{!node.transitionAfter.manual && <button className="simplify-button" aria-pressed={transitionSimple} onClick={()=>setTransitionSimple(!transitionSimple)}>{transitionSimple ? 'Оригинал' : 'Проще'}</button>}{node.transitionAfter.manual && <button className="time-transition-next" onClick={next}>Дальше <span>→</span></button>}{teacher && <p className="time-transition-translation">{node.transitionAfter.ru}</p>}</div>}</div>
        <div className="player-bottom"><button className="text-button previous" onClick={previous} disabled={!transitioning && save.entries.length === 1 && !choice}>← Назад</button><div className="journey-dots" aria-label={`Пройдено экранов: ${save.entries.length}`}>{save.entries.slice(-7).map((e,i) => <span key={`${i}-${e.nodeId}`} className={i===Math.min(save.entries.length,7)-1?'current':e.choiceId?'decision':''}/>)}</div><span className="autosave">● Автосохранение</span></div></section>
        <div aria-live="polite" className="sr-only">{!delayed && !transitioning && (choice?.reaction ?? nodeText(node,entry.variables,simple))}</div>


        {teacher && <section className="teacher-panel" aria-label="Пульт преподавателя"><button className="drawer-close" onClick={() => setTeacher(false)} aria-label="Закрыть панель преподавателя">×</button><div className="section-heading"><h2>Пульт преподавателя <span>{node.id}</span></h2><span>ВИДНО ТОЛЬКО В ЭТОМ РЕЖИМЕ</span></div>{music.controls}{node.teacher && <div className="teacher-materials">{node.transitionAfter && <p><strong>Титр после узла: </strong><span lang="ko">{node.transitionAfter.original} / {node.transitionAfter.simple}</span> — {node.transitionAfter.ru}</p>}<h3>{scene.teacherTitle ?? 'Материалы урока'}</h3><p><strong>Русский смысл: </strong>{node.teacher.translation}</p>{node.original && <div className="language-variants"><p><strong>Original</strong><br/><span lang="ko">{node.original}</span></p><p><strong>Simple</strong><br/><span lang="ko">{node.simple}</span></p></div>}{!!node.teacher.grammar?.length && <p><strong>Грамматика: </strong>{node.teacher.grammar.join(' · ')}</p>}{!!node.teacher.vocab?.length && <p><strong>Лексика: </strong>{node.teacher.vocab.join(' · ')}</p>}{responseExample && <p className="answer">Пример устной реплики: <span lang="ko">{responseExample}</span></p>}{node.teacher.note && <p><strong>Примечание преподавателю: </strong>{node.teacher.note}</p>}{node.teacher.direction && <p className="muted">{node.teacher.direction}</p>}{scene.temporary && <p className="muted">TEMP · Временный кадр: {scene.src}. Замените файл по этому пути без изменения сценария.</p>}</div>}{node.choices && <div className="teacher-choices">{node.choices.map(c=><div key={c.id}><h3>{c.label}</h3><p>{c.task}</p><p className="answer" lang="ko">{c.answer}</p>{c.answerSimple && <p className="answer" lang="ko">Simple: {c.answerSimple}</p>}</div>)}</div>}<div className="teacher-grid"><div><h3>Переменные</h3>{Object.entries(entry.variables).map(([k,v]) => <div className="variable" key={k}><code>{k}</code><strong>{String(v)}</strong></div>)}<p className="muted">Переход сохраняет текущие значения. Для чистой проверки начните заново.</p><label htmlFor="jump">Перейти к экрану</label><div className="jump"><select id="jump" value={jump} onChange={e=>setJump(e.target.value)}>{story.nodes.map(n=><option key={n.id} value={n.id}>{n.id}{n.ending?.kind === 'continuation' ? ' · продолжение' : n.ending ? ' · концовка' : ''}</option>)}</select><button onClick={() => guarded(() => ({...save,entries:[...save.entries,enter(story,jump,entry.variables)]}))}>Перейти</button></div></div><div><h3>Сделанные выборы</h3>{save.entries.filter(e=>e.choiceId).length===0?<p className="muted">Выборов пока нет.</p>:<ol className="history">{save.entries.filter(e=>e.choiceId).map((e,i)=><li key={i}><code>{e.nodeId}</code><span>{story.nodes.find(n=>n.id===e.nodeId)?.choices?.find(c=>c.id===e.choiceId)?.label}</span></li>)}</ol>}{choice && <div className="answer">Пример ответа: <span lang="ko">{choice.answer}</span></div>}</div></div>{warnings.length>0 && <div className="notice">{warnings.map(w=><p key={w}>{w}</p>)}</div>}</section>}
        <div className="session-footer"><span>{story.level} <span>•</span> {story.duration}</span><div><button onClick={() => setConfirm('restart')}>Начать заново</button><button onClick={() => setConfirm('clear')}>Очистить прогресс</button></div></div>
      </>}
    </main><footer><span>seoul stories <span className="footer-dot">·</span> Пространство для живого языка</span><span>천천히, 한 문장씩. <span className="footer-dot">/</span> По одной фразе.</span></footer>
    {(help || confirm) && <div className="modal-backdrop" onClick={() => {setHelp(false);setConfirm(null);}}><section role="dialog" aria-modal="true" aria-labelledby="modal-title" className="modal" onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape'){setHelp(false);setConfirm(null);} if(e.key==='Tab'){const focusable=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button, a, select, [tabindex="0"]'));const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}}><button autoFocus className="modal-close" onClick={() => {setHelp(false);setConfirm(null);}} aria-label="Закрыть">×</button><span className="eyebrow">SEOUL STORIES</span><h2 id="modal-title">{help?'История начинается с вас':confirm==='clear'?'Очистить прогресс?':'Начать сначала?'}</h2>{help?<><p>Читайте корейский текст, формулируйте ответ вслух и выбирайте действие. После реакции персонажа нажмите «Дальше».</p><p>Режим преподавателя открывает примеры ответов, переменные, журнал и переходы для проверки маршрутов.</p><div className="hotkeys"><span><kbd>→</kbd> <kbd>Пробел</kbd> Продолжить</span><span><kbd>←</kbd> Назад / отменить выбор</span><span><kbd>1</kbd>–<kbd>4</kbd> Выбрать ответ</span></div><p className="muted">Прогресс хранится в этом браузере. Обычный режим не показывает скрытые переменные и ответы.</p></>:<><p>Сделанные выборы и текущие переменные этой истории будут сброшены.</p><button className="primary" onClick={() => {if(story){clearSave(story.id);if(confirm==='restart')update(fresh(story));else{library();}}setConfirm(null);}}> {confirm==='clear'?'Очистить и выйти':'Начать историю'} →</button></>}</section></div>}
  </div>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);





