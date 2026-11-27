(function(){
'use strict';
var bank=null,current=[],stage=0,submitted=false,finalSet=[],finalSubmitted=false;
var KEY='study_daily_han_math_round_results_v1',FINAL_KEY='study_daily_han_math_final_results_v1';
function loadBank(){
 if(bank)return Promise.resolve(bank);
 return fetchText('drafts/question-bank/math/MATH2S2_questions.xml').then(function(t){
  var doc=parseXmlOrThrow(t,'수학 문제은행'),all=[].slice.call(doc.getElementsByTagName('question')),ids={};
  all.forEach(function(q){var id=q.getAttribute('id');if(!id||ids[id])throw Error('문항 ID 중복: '+id);ids[id]=1});
  var main=all.filter(function(q){return q.getAttribute('reserve')!=='true'}),reserve=all.filter(function(q){return q.getAttribute('reserve')==='true'});
  for(var s=1;s<=4;s++)if(main.filter(function(q){return +q.getAttribute('stage')===s}).length!==30)throw Error(s+'차 문항 수 오류');
  if(main.length!==120||reserve.length!==30)throw Error('문항은행 수 오류');
  bank={doc:doc,all:all,main:main,reserve:reserve};return bank;
 });
}
function getRows(key){try{return JSON.parse(localStorage.getItem(key)||'[]')}catch(e){return []}}
function saveRows(key,rows){try{localStorage.setItem(key,JSON.stringify(rows))}catch(e){alert('수학 풀이 기록을 저장하지 못했습니다.')}}
function latest(s){var rows=getRows(KEY),a=rows.filter(function(r){return r.stage===s});return a.length?a[a.length-1]:null}
function shuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),v=a[i];a[i]=a[j];a[j]=v}return a}
function renderCards(){
 var box=el('mathRoundCards');if(!box)throw Error('mathRoundCards 영역을 찾을 수 없습니다.');box.innerHTML='';
 for(var s=1;s<=4;s++){var prev=s===1?null:latest(s-1),last=latest(s),locked=s>1&&!prev,card=document.createElement('div');card.className='card';
 card.innerHTML='<b>'+s+'차 학습</b><p class="meta">'+(last?'최근 '+last.score+'점 · '+last.correct+'/30 정답':(s===1?'전체 범위 30문항':'직전 회차 오답 + 신규 문항'))+'</p>'+(locked?'<p class="hint">이전 회차를 먼저 제출해 주세요.</p>':'')+'<button class="btn '+(locked?'ghost':'')+'" '+(locked?'disabled':'')+' data-math-round="'+s+'">'+(last?'다시 풀기':'시작')+'</button>';box.appendChild(card)}
 // 동적 버튼은 부모 영역에서 위임 처리하여 재렌더링 후에도 클릭 이벤트가 유지되도록 한다.
 if(!box.dataset.mathClickBound){box.addEventListener('click',function(event){var b=event.target.closest('button[data-math-round]');if(!b||b.disabled)return;startRound(Number(b.dataset.mathRound));});box.dataset.mathClickBound='1';}
}
function prepare(s,wrong,b){
 var chosen=[],used={},map={};b.all.forEach(function(q){map[q.getAttribute('id')]=q});
 (wrong||[]).forEach(function(r){var q=map[r.id];if(q&&!used[r.id]){chosen.push({node:q,sourceStage:r.stage,sourceId:r.id});used[r.id]=1}});
 shuffle(b.main.filter(function(q){return +q.getAttribute('stage')===s&&!used[q.getAttribute('id')]})).forEach(function(q){if(chosen.length<30){chosen.push({node:q,sourceStage:s,sourceId:q.getAttribute('id')});used[q.getAttribute('id')]=1}});
 shuffle(b.reserve).forEach(function(q){if(chosen.length<30&&!used[q.getAttribute('id')]){chosen.push({node:q,sourceStage:0,sourceId:q.getAttribute('id')});used[q.getAttribute('id')]=1}});
 if(chosen.length<30)throw Error('회차 문항이 부족합니다');return shuffle(chosen.slice(0,30));
}
function render(items,target,mode){
 target.innerHTML='';
 items.forEach(function(entry,i){
  var q=entry.node,type=q.getAttribute('type'),d=document.createElement('div');d.className='final-question';d.dataset.index=i;d.dataset.type=type;d.dataset.id=q.getAttribute('id');
  if(mode==='round'){d.dataset.sourceStage=entry.sourceStage;d.dataset.sourceId=entry.sourceId}
  var h='<h3>'+ (i+1)+'. '+esc(xmlText(q,'prompt'))+'</h3><div class="hint">'+esc(q.getAttribute('unit')||'')+' · '+esc(q.getAttribute('scopePages')||'')+'쪽 · '+esc(q.getAttribute('difficulty')||'')+'</div>';
  var diagram=q.getElementsByTagName('diagram')[0];
  if(diagram){var src=diagram.getAttribute('src');if(src){h+='<div class="math-diagram"><img src="'+esc(src)+'" alt="'+esc(diagram.getAttribute('alt')||'수학 도형')+'" loading="lazy"></div>'}}
  if(type==='multiple_choice'){
   h+='<div class="final-options">';[].slice.call(q.getElementsByTagName('option')).forEach(function(o){var k=o.getAttribute('id');h+='<label class="final-option"><input type="radio" name="math-'+mode+'-'+i+'" value="'+esc(k)+'"><span><b>'+['①','②','③','④','⑤'][k.charCodeAt(0)-65]+'.</b> '+esc(o.textContent.trim())+'</span></label>'});h+='</div>';
  }else h+='<textarea class="round-short" placeholder="풀이 과정과 답을 작성하세요."></textarea><div class="final-passage"><b>모범 답안</b><br>'+esc(xmlText(q,'answer'))+'<p><b>채점 기준</b><br>'+esc(xmlText(q,'advancedExplanation'))+'</p></div><select class="final-score-select round-short-grade"><option value="">모범 답안 확인 후 평가</option><option value="1">정답 처리</option><option value="0">오답 처리</option></select>';
  h+='<div class="final-feedback"></div>';d.innerHTML=h;target.appendChild(d);
 });
}
function startRound(s){
 var prev=s>1?latest(s-1):null;if(s>1&&!prev){alert('먼저 '+(s-1)+'차를 제출해 주세요.');return}
 stage=s;submitted=false;current=[];el('mathRoundArea').style.display='block';el('mathRoundResult').style.display='none';el('mathRoundMeta').textContent='문항은행과 도형 자료를 확인하고 있습니다...';el('mathRoundQuestions').innerHTML='';
 loadBank().then(function(b){current=prepare(s,prev?prev.wrongRefs:[],b);render(current,el('mathRoundQuestions'),'round');el('mathRoundMeta').textContent=s+'차 · 30문항 · 직전 오답 '+(prev?prev.wrongRefs.length:0)+'개 반영';el('mathRoundArea').scrollIntoView({behavior:'smooth',block:'start'})}).catch(function(e){current=[];el('mathRoundMeta').textContent='수학 문항 로드 실패: '+(e&&e.message?e.message:String(e));el('mathRoundQuestions').innerHTML='<div class="notice">문항을 불러오지 못했습니다. 화면에 표시된 오류 내용을 알려주세요.</div>';el('mathRoundArea').scrollIntoView({behavior:'smooth',block:'start'});});
}
function grade(items,target,confirmText,mode){
 var ds=target.querySelectorAll('.final-question'),missing=[];
 ds.forEach(function(d){if(d.dataset.type==='multiple_choice'){if(!d.querySelector('input:checked'))missing.push(+d.dataset.index+1)}else if(!d.querySelector('.round-short').value.trim()||!d.querySelector('.round-short-grade').value)missing.push(+d.dataset.index+1)});
 if(missing.length){alert('답변하지 않은 문항: '+missing.slice(0,8).join(', '));return null}
 if(!confirm(confirmText))return null;
 var correct=0,wrong=[],answers={};
 ds.forEach(function(d,i){var entry=items[i],q=entry.node,answer=xmlText(q,'answer'),ok,pick='';
  if(d.dataset.type==='multiple_choice'){pick=d.querySelector('input:checked').value;ok=pick===answer;d.querySelectorAll('.final-option').forEach(function(l){var x=l.querySelector('input');if(x.value===answer)l.classList.add('selected');if(x.checked&&x.value!==answer)l.style.borderColor='var(--bad)'})}
  else{pick=d.querySelector('.round-short').value;ok=d.querySelector('.round-short-grade').value==='1'}
  if(ok)correct++;else if(mode==='round')wrong.push({stage:entry.sourceStage,id:entry.sourceId});
  answers[entry.sourceId||q.getAttribute('id')]=pick;d.classList.add('revealed');
  d.querySelector('.final-feedback').innerHTML='<b>'+(ok?'정답':'오답')+'</b> · 정답 '+esc(answer)+'<p>'+esc(xmlText(q,'explanation'))+'</p><p><b>심화해설</b><br>'+esc(xmlText(q,'advancedExplanation'))+'</p>';
  d.querySelectorAll('input,textarea,select').forEach(function(x){x.disabled=true});
 });
 return {correct:correct,wrongRefs:wrong,answers:answers,score:Math.round(correct/items.length*100),total:items.length};
}
function submitRound(){
 if(submitted||!current.length)return;var rec=grade(current,el('mathRoundQuestions'),stage+'차 답안을 제출할까요?','round');if(!rec)return;
 submitted=true;rec.stage=stage;rec.at=new Date().toISOString();var rows=getRows(KEY);rows.push(rec);saveRows(KEY,rows);
 el('mathRoundResult').style.display='block';el('mathRoundResult').innerHTML='<div class="score">'+rec.score+'점</div><p class="center">'+rec.correct+'/30 정답 · 다음 회차 오답 '+rec.wrongRefs.length+'개 반영</p><button class="btn green" id="mathNext">'+(stage<4?(stage+1)+'차로 이동':'FINAL 시험 보기')+'</button>';
 el('mathNext').onclick=function(){if(stage<4){renderCards();startRound(stage+1)}else{el('mathRoundArea').style.display='none';el('mathFinalIntro').scrollIntoView({behavior:'smooth',block:'start'})}};renderCards();
}
function startFinal(){
 loadBank().then(function(b){var mc=shuffle(b.main.filter(function(q){return q.getAttribute('type')==='multiple_choice'})).slice(0,23),sa=shuffle(b.main.filter(function(q){return q.getAttribute('type')==='short_answer'})).slice(0,3);
 finalSet=shuffle(mc.concat(sa)).map(function(q){return {node:q,sourceId:q.getAttribute('id')}});finalSubmitted=false;render(finalSet,el('mathFinalQuestions'),'final');el('mathFinalMeta').textContent='26문항 · 객관식 23 · 서술형 3';el('mathFinalResult').style.display='none';el('mathFinalIntro').style.display='none';el('mathFinalArea').style.display='block';el('mathFinalArea').scrollIntoView({behavior:'smooth',block:'start'})}).catch(function(e){alert('수학 FINAL 로드 오류: '+e.message)});
}
function submitFinal(){
 if(finalSubmitted||!finalSet.length)return;var rec=grade(finalSet,el('mathFinalQuestions'),'수학 FINAL 답안을 제출할까요?','final');if(!rec)return;finalSubmitted=true;rec.at=new Date().toISOString();var rows=getRows(FINAL_KEY);rows.push(rec);saveRows(FINAL_KEY,rows);
 el('mathFinalResult').style.display='block';el('mathFinalResult').innerHTML='<div class="score">'+rec.score+'점</div><p class="center">'+rec.correct+'/26 정답</p><button class="btn green" id="mathFinalAgain">새 FINAL 문제 풀기</button>';el('mathFinalAgain').onclick=startFinal;
}
function init(){
 var tabs=el('subjectTabs').querySelectorAll('button[data-subject]'),math=el('subjectTabs').querySelector('[data-subject="math"]');
 math.disabled=false;math.removeAttribute('aria-disabled');math.title='수학 시험';
 math.onclick=function(){tabs.forEach(function(t){t.classList.remove('on');t.setAttribute('aria-selected','false')});math.classList.add('on');math.setAttribute('aria-selected','true');el('subject-korean').style.display='none';el('subject-english').style.display='none';el('subject-math').style.display='block';renderCards()};
 el('mathSubmitRound').onclick=submitRound;el('mathStartFinal').onclick=startFinal;el('mathSubmitFinal').onclick=submitFinal;renderCards();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();