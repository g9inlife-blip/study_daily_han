(function(){
'use strict';
var bank=null,current=[],stage=0,submitted=false,finalSet=[],finalSubmitted=false,exam=null;
var KEY='study_daily_han_history_round_results_v1',FINAL_KEY='study_daily_han_history_final_results_v1';
function getRows(key){try{return JSON.parse(localStorage.getItem(key)||'[]')}catch(e){return []}}
function saveRows(key,rows){try{localStorage.setItem(key,JSON.stringify(rows))}catch(e){alert('역사 풀이 기록을 저장하지 못했습니다. 저장 공간을 확인해 주세요.');}}
function cycleRows(){var rows=getRows(KEY),start=0;for(var i=rows.length-1;i>=0;i--)if(rows[i].stage===1){start=i;break}return rows.slice(start)}
function latest(s){var a=cycleRows().filter(function(r){return r.stage===s});return a.length?a[a.length-1]:null}
function shuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),v=a[i];a[i]=a[j];a[j]=v}return a}
function loadBank(){if(bank)return Promise.resolve(bank);return fetchText('drafts/question-bank/history/HIS2S2_questions.xml').then(function(t){
 var doc=parseXmlOrThrow(t,'역사 문제은행'),all=[].slice.call(doc.getElementsByTagName('question')),ids={};
 all.forEach(function(q){var id=q.getAttribute('id');if(!id||ids[id])throw Error('문항 ID 중복: '+id);ids[id]=1});
 var main=all.filter(function(q){return q.getAttribute('reserve')!=='true'}),reserve=all.filter(function(q){return q.getAttribute('reserve')==='true'});
 var firstStageCount=main.filter(function(q){return +q.getAttribute('stage')===1}).length;if(firstStageCount<30)throw Error('1차 문항 수가 부족합니다. 현재 '+firstStageCount+'개입니다.');
 bank={doc:doc,all:all,main:main,reserve:reserve,map:ids};return bank;
})}
function renderCards(){var box=el('historyRoundCards');box.innerHTML='';
 for(var s=1;s<=4;s++){var prev=s===1?null:latest(s-1),last=latest(s),locked=s>1&&!prev,card=document.createElement('div');card.className='card';
 card.innerHTML='<b>'+s+'차 학습</b><p class="meta">'+(last?'최근 '+last.score+'점 · '+last.correct+'/30 정답':(s===1?'전 범위 30문항':'직전 회차 오답 + 신규·복습 문항'))+'</p>'+(locked?'<p class="hint">이전 회차를 먼저 제출해 주세요.</p>':'')+'<button class="btn '+(locked?'ghost':'')+'" '+(locked?'disabled':'')+' data-his-round="'+s+'">'+(last?'다시 풀기':'시작')+'</button>';
 box.appendChild(card)}
 if(!box.dataset.bound){box.addEventListener('click',function(e){var b=e.target.closest('[data-his-round]');if(b&&!b.disabled)startRound(+b.dataset.hisRound)});box.dataset.bound='1'}
}
function prepare(s,wrong,b){var chosen=[],used={},map={};b.all.forEach(function(q){map[q.getAttribute('id')]=q});
 (wrong||[]).forEach(function(ref){var q=map[ref.id];if(q&&!used[ref.id]){chosen.push({node:q,sourceStage:ref.stage,sourceId:ref.id});used[ref.id]=1}});
 shuffle(b.main.filter(function(q){return +q.getAttribute('stage')===s&&!used[q.getAttribute('id')]})).forEach(function(q){if(chosen.length<30){chosen.push({node:q,sourceStage:s,sourceId:q.getAttribute('id')});used[q.getAttribute('id')]=1}});
 shuffle(b.reserve).forEach(function(q){if(chosen.length<30&&!used[q.getAttribute('id')]){chosen.push({node:q,sourceStage:0,sourceId:q.getAttribute('id')});used[q.getAttribute('id')]=1}});
 if(chosen.length<30)throw Error('회차 문항이 부족합니다.');return shuffle(chosen.slice(0,30))}
function formatPrompt(text){return esc(text).replace(/\\s+(ㄱ|ㄴ|ㄷ|ㄹ|가|나|다|라)([.)、])/g,'<br><span class="statement-label">$1$2</span> ')}\nfunction render(items,target,mode){target.innerHTML='';items.forEach(function(entry,i){var q=entry.node,d=document.createElement('div'),type=q.getAttribute('type');d.className='final-question';d.dataset.index=i;d.dataset.type=type;d.dataset.id=q.getAttribute('id');if(mode==='round'){d.dataset.sourceStage=entry.sourceStage;d.dataset.sourceId=entry.sourceId}
 var h='<h3>'+(i+1)+'. '+formatPrompt(xmlText(q,'prompt'))+'</h3><div class="hint">'+esc(q.getAttribute('unit')||'')+' · '+esc(q.getAttribute('scopePages')||'')+'쪽 · 난이도 '+esc(q.getAttribute('difficulty')||'')+'</div>';
 if(type==='multiple_choice'){h+='<div class="final-options">';[].slice.call(q.getElementsByTagName('option')).forEach(function(o){var k=o.getAttribute('id');h+='<label class="final-option"><input type="radio" name="his-'+mode+'-'+i+'" value="'+esc(k)+'"><span><b>'+esc(k)+'.</b> '+esc(o.textContent.trim())+'</span></label>'});h+='</div>'}
 else h+='<textarea class="round-short" placeholder="답안을 작성하세요."></textarea>';
 h+='<div class="final-feedback"></div>';d.innerHTML=h;target.appendChild(d)})}
function startRound(s){var prev=s>1?latest(s-1):null;if(s>1&&!prev){alert('먼저 '+(s-1)+'차를 제출해 주세요.');return}
 stage=s;submitted=false;current=[];el('historyRoundArea').style.display='block';el('historyRoundResult').style.display='none';el('historyRoundMeta').textContent='역사 문항을 불러오는 중...';
 loadBank().then(function(b){current=prepare(s,prev?prev.wrongRefs:[],b);render(current,el('historyRoundQuestions'),'round');el('historyRoundMeta').textContent=s+'차 · 30문항 · 직전 회차 오답 '+(prev?prev.wrongRefs.length:0)+'개 반영';el('historyRoundArea').scrollIntoView({behavior:'smooth',block:'start'})}).catch(function(e){el('historyRoundMeta').textContent='문항 로드 오류: '+e.message})}
function grade(items,target,mode){var ds=target.querySelectorAll('.final-question'),missing=[];ds.forEach(function(d){if(d.dataset.type==='multiple_choice'&&!d.querySelector('input:checked'))missing.push(+d.dataset.index+1);else if(d.dataset.type!=='multiple_choice'&&!d.querySelector('.round-short').value.trim())missing.push(+d.dataset.index+1)});
 if(missing.length){alert('답변하지 않은 문항: '+missing.slice(0,8).join(', '));return null}if(!confirm(mode==='round'?stage+'차 답안을 제출할까요?':'역사 FINAL 답안을 제출할까요?'))return null;
 var correct=0,wrong=[],answers={};ds.forEach(function(d,i){var e=items[i],q=e.node,a=xmlText(q,'answer'),pick='',ok=false;
 if(d.dataset.type==='multiple_choice'){pick=d.querySelector('input:checked').value;ok=pick===a;d.querySelectorAll('.final-option').forEach(function(l){var x=l.querySelector('input');if(x.value===a)l.classList.add('selected');if(x.checked&&x.value!==a)l.style.borderColor='var(--bad)'})}
 else{pick=d.querySelector('.round-short').value;ok=norm(pick)===norm(a)}
 if(ok)correct++;else if(mode==='round')wrong.push({stage:e.sourceStage,id:e.sourceId});answers[e.sourceId||q.getAttribute('id')]=pick;d.classList.add('revealed');
 d.querySelector('.final-feedback').innerHTML='<b>'+(ok?'정답':'오답')+'</b> · 정답 '+esc(a)+'<p>'+esc(xmlText(q,'explanation'))+'</p><p><b>심화해설</b><br>'+esc(xmlText(q,'advancedExplanation'))+'</p>';d.querySelectorAll('input,textarea,select').forEach(function(x){x.disabled=true})});
 return {correct:correct,wrongRefs:wrong,answers:answers,score:Math.round(correct/items.length*100),total:items.length}}
function submitRound(){if(submitted||!current.length)return;var rec=grade(current,el('historyRoundQuestions'),'round');if(!rec)return;submitted=true;rec.stage=stage;rec.at=new Date().toISOString();var rows=getRows(KEY);rows.push(rec);saveRows(KEY,rows);
 el('historyRoundResult').style.display='block';el('historyRoundResult').innerHTML='<div class="score">'+rec.score+'점</div><p class="center">'+rec.correct+'/30 정답 · 다음 회차 오답 '+rec.wrongRefs.length+'개 반영</p><button class="btn green" id="historyNext">'+(stage<4?(stage+1)+'차로 이동':'FINAL 시험 보기')+'</button>';
 el('historyNext').onclick=function(){if(stage<4){renderCards();startRound(stage+1)}else{el('historyRoundArea').style.display='none';el('historyFinalIntro').scrollIntoView({behavior:'smooth',block:'start'})}};renderCards()}
function loadFinal(){return Promise.all([loadBank(),fetchText('drafts/question-bank/history/HIS2S2_FINAL_exam.xml')]).then(function(r){var doc=parseXmlOrThrow(r[1],'역사 FINAL 구성'),refs=[].slice.call(doc.getElementsByTagName('item')).map(function(n){return n.getAttribute('questionRef')}),map={};r[0].all.forEach(function(q){map[q.getAttribute('id')]=q});if(refs.length!==26)throw Error('FINAL 문항 수가 26개가 아닙니다.');return refs.map(function(id){if(!map[id])throw Error('FINAL 문항 참조 누락: '+id);return {node:map[id],sourceId:id}})})}
function startFinal(){el('historyStartFinal').disabled=true;loadFinal().then(function(items){finalSet=items;finalSubmitted=false;render(finalSet,el('historyFinalQuestions'),'final');el('historyFinalMeta').textContent='26문항 · 객관식 5지 선다 · 전 범위';el('historyFinalResult').style.display='none';el('historyFinalIntro').style.display='none';el('historyFinalArea').style.display='block';el('historyFinalArea').scrollIntoView({behavior:'smooth',block:'start'})}).catch(function(e){alert('역사 FINAL 로드 오류: '+e.message)}).finally(function(){el('historyStartFinal').disabled=false})}
function submitFinal(){if(finalSubmitted||!finalSet.length)return;var rec=grade(finalSet,el('historyFinalQuestions'),'final');if(!rec)return;finalSubmitted=true;rec.at=new Date().toISOString();var rows=getRows(FINAL_KEY);rows.push(rec);saveRows(FINAL_KEY,rows);el('historyFinalResult').style.display='block';el('historyFinalResult').innerHTML='<div class="score">'+rec.score+'점</div><p class="center">'+rec.correct+'/26 정답</p><button class="btn green" id="historyFinalAgain">FINAL 다시 풀기</button>';el('historyFinalAgain').onclick=startFinal}
function init(){var tabs=el('subjectTabs').querySelectorAll('button[data-subject]'),tab=el('subjectTabs').querySelector('[data-subject="history"]');if(!tab)return;tabs.forEach(function(t){if(t!==tab)t.addEventListener('click',function(){el('subject-history').style.display='none'})});tab.disabled=false;tab.removeAttribute('aria-disabled');tab.title='역사 시험';tab.onclick=function(){tabs.forEach(function(t){t.classList.remove('on');t.setAttribute('aria-selected','false')});tab.classList.add('on');tab.setAttribute('aria-selected','true');['korean','english','math'].forEach(function(s){var p=el('subject-'+s);if(p)p.style.display='none'});el('subject-history').style.display='block';renderCards()};
 el('historySubmitRound').onclick=submitRound;el('historyStartFinal').onclick=startFinal;el('historySubmitFinal').onclick=submitFinal;renderCards()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();