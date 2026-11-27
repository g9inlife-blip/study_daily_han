(function(){
'use strict';
var bank=null,current=[],currentStage=0,submitted=false,finalSet=[],finalSubmitted=false;
var KEY='study_daily_han_english_round_results_v1';
function loadBank(){
 if(bank)return Promise.resolve(bank);
 return fetchText('drafts/question-bank/english/ENG2S2_questions.xml').then(function(t){
  var doc=parseXmlOrThrow(t,'영어 문제은행'),all=[].slice.call(doc.getElementsByTagName('question')),ids={};
  all.forEach(function(q){var id=q.getAttribute('id');if(!id||ids[id])throw Error('문항 ID 중복: '+id);ids[id]=1});
  var main=all.filter(function(q){return q.getAttribute('reserve')!=='true'}),reserve=all.filter(function(q){return q.getAttribute('reserve')==='true'});
  for(var s=1;s<=4;s++)if(main.filter(function(q){return +q.getAttribute('stage')===s}).length!==30)throw Error(s+'차 문항 수 오류');
  if(main.length!==120||reserve.length!==30)throw Error('문항은행 수 오류');
  bank={doc:doc,all:all,main:main,reserve:reserve};return bank;
 });
}
function results(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch(e){return []}}
function save(rows){try{localStorage.setItem(KEY,JSON.stringify(rows))}catch(e){alert('영어 풀이 기록을 저장하지 못했습니다.')}}
function latest(stage){
 var rows=results(),start=0;
 if(stage>1){for(var i=rows.length-1;i>=0;i--)if(rows[i].stage===1){start=i;break}}
 var a=rows.slice(start).filter(function(r){return r.stage===stage});
 return a.length?a[a.length-1]:null;
}
function shuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),v=a[i];a[i]=a[j];a[j]=v}return a}
function renderCards(){
 var box=el('englishRoundCards');box.innerHTML='';
 for(var s=1;s<=4;s++){
  var prev=s===1?null:latest(s-1),last=latest(s),locked=s>1&&!prev,card=document.createElement('div');card.className='card';
  card.innerHTML='<b>'+s+'차 학습</b><p class="meta">'+(last?'최근 '+last.score+'점 · '+last.correct+'/30 정답':(s===1?'전체 범위 30문항':'직전 회차 오답 + 신규 문항'))+'</p>'+(locked?'<p class="hint">이전 회차를 먼저 제출해 주세요.</p>':'')+'<button class="btn '+(locked?'ghost':'')+'" '+(locked?'disabled':'')+' data-eng-round="'+s+'">'+(last?'다시 풀기':'시작')+'</button>';
  box.appendChild(card);
 }
 box.querySelectorAll('[data-eng-round]').forEach(function(b){b.onclick=function(){startRound(+b.dataset.engRound)}});
}
function prepare(stage,wrong,loaded){
 var chosen=[],used={},map={};loaded.all.forEach(function(q){map[q.getAttribute('id')]=q});
 (wrong||[]).forEach(function(ref){var q=map[ref.id];if(q&&!used[ref.id]){chosen.push({node:q,sourceStage:ref.stage,sourceId:ref.id});used[ref.id]=1}});
 shuffle(loaded.main.filter(function(q){return +q.getAttribute('stage')===stage&&!used[q.getAttribute('id')]})).forEach(function(q){if(chosen.length<30){chosen.push({node:q,sourceStage:stage,sourceId:q.getAttribute('id')});used[q.getAttribute('id')]=1}});
 if(chosen.length<30)shuffle(loaded.reserve).forEach(function(q){if(chosen.length<30&&!used[q.getAttribute('id')]){chosen.push({node:q,sourceStage:-1,sourceId:q.getAttribute('id')});used[q.getAttribute('id')]=1}});
 if(chosen.length<30)throw Error('회차 문항이 부족합니다.');
 return shuffle(chosen.slice(0,30));
}
function render(items,target,mode){
 target.innerHTML='';var pm={},shown={};
 [].slice.call(bank.doc.getElementsByTagName('passage')).forEach(function(p){pm[p.getAttribute('id')]=p});
 items.forEach(function(e,i){
  var q=e.node,type=q.getAttribute('type'),ref=q.getAttribute('passageRef'),p=pm[ref];
  if(p&&!shown[ref]){var block=document.createElement('div');block.className='final-passage';block.innerHTML='<b>'+esc(p.getAttribute('title')||'7과 지문')+'</b><br>'+esc(xmlText(p,'text'));target.appendChild(block);shown[ref]=1}
  var d=document.createElement('div');d.className='final-question';d.dataset.index=i;d.dataset.type=type;d.dataset.id=q.getAttribute('id');
  if(mode==='round'){d.dataset.sourceStage=e.sourceStage;d.dataset.sourceId=e.sourceId}
  var h='<h3>'+(i+1)+'. '+esc(xmlText(q,'prompt'))+'</h3><div class="hint">'+esc(q.getAttribute('unit')||'')+' · '+esc(q.getAttribute('scopePages')||'')+'쪽 · '+esc(q.getAttribute('difficulty')||'')+'</div>';
  if(type==='multiple_choice'){h+='<div class="final-options">';[].slice.call(q.getElementsByTagName('option')).forEach(function(o){var k=o.getAttribute('id');h+='<label class="final-option"><input type="radio" name="eng-'+mode+'-'+i+'" value="'+esc(k)+'"><span><b>'+esc(k)+'.</b> '+esc(o.textContent.trim())+'</span></label>'});h+='</div>'}
  else h+='<textarea class="round-short" placeholder="답안을 작성하세요."></textarea><div class="final-passage"><b>모범 답안</b><br>'+esc(xmlText(q,'answer'))+'<p><b>채점 기준</b><br>'+esc(xmlText(q,'advancedExplanation'))+'</p></div><select class="final-score-select round-short-grade"><option value="">모범 답안 확인 후 평가</option><option value="1">정답 처리</option><option value="0">오답 처리</option></select>';
  h+='<div class="final-feedback"></div>';d.innerHTML=h;target.appendChild(d);
 });
}
function startRound(stage){
 var prev=stage>1?latest(stage-1):null;if(stage>1&&!prev){alert('먼저 '+(stage-1)+'차를 제출해 주세요.');return}
 currentStage=stage;submitted=false;el('englishRoundArea').style.display='block';el('englishRoundResult').style.display='none';el('englishRoundMeta').textContent='문항 불러오는 중...';
 loadBank().then(function(b){current=prepare(stage,prev?prev.wrongRefs:[],b);render(current,el('englishRoundQuestions'),'round');el('englishRoundMeta').textContent=stage+'차 · 30문항 · 직전 오답 '+(prev?prev.wrongRefs.length:0)+'개 반영';el('englishRoundArea').scrollIntoView({behavior:'smooth',block:'start'})}).catch(function(e){el('englishRoundMeta').textContent='오류: '+e.message});
}
function submitRound(){
 if(submitted||!current.length)return;var ds=el('englishRoundQuestions').querySelectorAll('.final-question'),missing=[];
 ds.forEach(function(d){if(d.dataset.type==='multiple_choice'){if(!d.querySelector('input:checked'))missing.push(+d.dataset.index+1)}else if(!d.querySelector('.round-short').value.trim()||!d.querySelector('.round-short-grade').value)missing.push(+d.dataset.index+1)});
 if(missing.length){alert('답변하지 않은 문항: '+missing.slice(0,8).join(', '));return}if(!confirm(currentStage+'차 답안을 제출할까요?'))return;
 var correct=0,wrong=[],answers={};
 ds.forEach(function(d,i){var e=current[i],q=e.node,a=xmlText(q,'answer'),ok,pick='';
  if(d.dataset.type==='multiple_choice'){pick=d.querySelector('input:checked').value;ok=pick===a;d.querySelectorAll('.final-option').forEach(function(l){var x=l.querySelector('input');if(x.value===a)l.classList.add('selected');if(x.checked&&x.value!==a)l.style.borderColor='var(--bad)'})}
  else{pick=d.querySelector('.round-short').value;ok=d.querySelector('.round-short-grade').value==='1'}
  if(ok)correct++;else wrong.push({stage:e.sourceStage,id:e.sourceId});answers[e.sourceStage+'|'+e.sourceId]=pick;d.classList.add('revealed');
  d.querySelector('.final-feedback').innerHTML='<b>'+(ok?'정답':'오답')+'</b> · 정답 '+esc(a)+'<p>'+esc(xmlText(q,'explanation'))+'</p><p><b>심화해설</b><br>'+esc(xmlText(q,'advancedExplanation'))+'</p>';
  d.querySelectorAll('input,textarea,select').forEach(function(x){x.disabled=true});
 });
 submitted=true;var rows=results(),rec={stage:currentStage,at:new Date().toISOString(),score:Math.round(correct/30*100),correct:correct,total:30,wrongRefs:wrong,answers:answers};rows.push(rec);save(rows);
 el('englishRoundResult').style.display='block';el('englishRoundResult').innerHTML='<div class="score">'+rec.score+'점</div><p class="center">'+correct+'/30 정답 · 다음 회차에 오답 '+wrong.length+'개 반영</p><button class="btn green" id="engNext">'+(currentStage<4?(currentStage+1)+'차로 이동':'FINAL 시험 보기')+'</button>';
 el('engNext').onclick=function(){if(currentStage<4){renderCards();startRound(currentStage+1)}else{el('englishRoundArea').style.display='none';el('englishFinalIntro').scrollIntoView({behavior:'smooth',block:'start'})}};renderCards();
}
function startFinal(){
 loadBank().then(function(b){var mc=shuffle(b.main.filter(function(q){return q.getAttribute('type')==='multiple_choice'})).slice(0,23),sa=shuffle(b.main.filter(function(q){return q.getAttribute('type')==='short_answer'})).slice(0,3);
  finalSet=shuffle(mc.concat(sa)).map(function(q){return {node:q}});finalSubmitted=false;render(finalSet,el('englishFinalQuestions'),'final');el('englishFinalMeta').textContent='26문항 · 객관식 23 · 서술형 3';el('englishFinalResult').style.display='none';el('englishFinalIntro').style.display='none';el('englishFinalArea').style.display='block';el('englishFinalArea').scrollIntoView({behavior:'smooth',block:'start'});
 }).catch(function(e){alert('영어 FINAL 로드 오류: '+e.message)});
}
function submitFinal(){
 if(finalSubmitted||!finalSet.length)return;var ds=el('englishFinalQuestions').querySelectorAll('.final-question'),missing=[];
 ds.forEach(function(d){if(d.dataset.type==='multiple_choice'){if(!d.querySelector('input:checked'))missing.push(+d.dataset.index+1)}else if(!d.querySelector('.round-short').value.trim()||!d.querySelector('.round-short-grade').value)missing.push(+d.dataset.index+1)});
 if(missing.length){alert('답변하지 않은 문항: '+missing.slice(0,8).join(', '));return}if(!confirm('영어 FINAL 답안을 제출할까요?'))return;
 var correct=0;ds.forEach(function(d,i){var q=finalSet[i].node,a=xmlText(q,'answer'),ok;
  if(d.dataset.type==='multiple_choice'){ok=d.querySelector('input:checked').value===a;d.querySelectorAll('.final-option').forEach(function(l){var x=l.querySelector('input');if(x.value===a)l.classList.add('selected');if(x.checked&&x.value!==a)l.style.borderColor='var(--bad)'})}
  else ok=d.querySelector('.round-short-grade').value==='1';
  if(ok)correct++;d.classList.add('revealed');d.querySelector('.final-feedback').innerHTML='<b>'+(ok?'정답':'오답')+'</b> · 정답 '+esc(a)+'<p>'+esc(xmlText(q,'explanation'))+'</p><p><b>심화해설</b><br>'+esc(xmlText(q,'advancedExplanation'))+'</p>';d.querySelectorAll('input,textarea,select').forEach(function(x){x.disabled=true});
 });
 finalSubmitted=true;el('englishFinalResult').style.display='block';el('englishFinalResult').innerHTML='<div class="score">'+Math.round(correct/26*100)+'점</div><p class="center">'+correct+'/26 정답</p><button class="btn green" id="engFinalAgain">새 FINAL 문제 풀기</button>';el('engFinalAgain').onclick=startFinal;
}
function init(){
 var tabs=el('subjectTabs').querySelectorAll('button[data-subject]'),eng=el('subjectTabs').querySelector('[data-subject="english"]'),kor=el('subjectTabs').querySelector('[data-subject="korean"]');
 eng.disabled=false;eng.removeAttribute('aria-disabled');eng.title='영어 시험';
 eng.onclick=function(){tabs.forEach(function(t){t.classList.remove('on');t.setAttribute('aria-selected','false')});eng.classList.add('on');eng.setAttribute('aria-selected','true');el('subject-korean').style.display='none';el('subject-math').style.display='none';el('subject-english').style.display='block';renderCards()};
 kor.onclick=function(){tabs.forEach(function(t){t.classList.remove('on');t.setAttribute('aria-selected','false')});kor.classList.add('on');kor.setAttribute('aria-selected','true');el('subject-english').style.display='none';el('subject-math').style.display='none';el('subject-korean').style.display='block'};
 el('englishSubmitRound').onclick=submitRound;el('englishStartFinal').onclick=startFinal;el('englishSubmitFinal').onclick=submitFinal;renderCards();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
