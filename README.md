# 중2 매일 5문제 (study_daily_han)

아들(중학교 2학년, 입시 목표: 고려대)을 위한 매일 문제 시스템.
월화수목금 돌아가며 하루 5문제(객관식 3개 + 주관식 2개) + 매일 영어 단어 2개·숙어 2개.
11월 말 기준 중2 2학기 마무리 단원, 수능 대비 방향은 유지하되 수준은 중2에 맞췄다.

## 구조

```
study_daily_han/
├── index.html            # 껍데기(쉘) — 문제를 하드코딩하지 않음
├── data/
│   ├── manifest.json     # 날짜·요일·과목·단원 목록 (껍데기가 먼저 읽음)
│   └── days/
│       ├── 2026-11-24.xml   # 날짜별 문제 파일 (평일만)
│       ├── 2026-11-25.xml
│       └── ...
└── README.md
```

- **껍데기와 문제 분리**: `index.html`은 `data/manifest.json`을 읽어 날짜 선택기를 만들고,
  선택한 날짜의 `data/days/YYYY-MM-DD.xml`을 `fetch` + `DOMParser`로 읽어 렌더링한다.
  문제를 바꾸려면 XML만 고치면 되고, 껍데기는 건드릴 필요가 없다.
- **과거 문제 다시 보기**: 날짜 선택기에서 이전 날짜를 누르면 그날 문제를 다시 풀 수 있다.
  다시 풀면 최신 기록으로 갱신되지만 이력은 남고, 재풀이 횟수가 표시된다.

## 요일 로테이션

| 요일 | 과목 |
|------|------|
| 월 | 국어 |
| 화 | 수학 |
| 수 | 과학 |
| 목 | 역사 |
| 금 | 영어 |

매일 영어 단어 2개 + 숙어 2개는 요일과 무관하게 매일 표시된다.

## XML 스키마 (날짜별 통일)

```xml
<daily date="2026-11-24" weekday="화" subject="수학" unit="일차함수·연립방정식·확률">
  <english>
    <word><term>significant</term><pos>형용사</pos>
      <meaning>중요한, 상당한</meaning>
      <example>There was a significant increase in sales.</example></word>
    <!-- 단어 2개 -->
    <idiom><term>take something for granted</term>
      <meaning>~을 당연하게 여기다</meaning>
      <example>Don't take your health for granted.</example></idiom>
    <!-- 숙어 2개 -->
  </english>
  <passage>국어·영어 지문이 있을 때만 사용 (300~500자)</passage>
  <questions>
    <q id="1" type="mcq" difficulty="중">
      <stem>...</stem>
      <choices><choice>...</choice><!-- 4개 --></choices>
      <answer>2</answer><!-- 1-based 번호 -->
      <explanation>...</explanation>
    </q>
    <q id="4" type="short" difficulty="중">
      <stem>...</stem>
      <answer>태양</answer>
      <keywords>태양</keywords><!-- 쉼표로 구분, 키워드 포함 여부로 채점 -->
      <explanation>...</explanation>
    </q>
    <!-- 객관식 3개 + 주관식 2개(단답 1 + 서술 1) = 5개 -->
  </questions>
</daily>
```

- `answer`는 **1-based 번호**(객관식) 또는 단답 정답(주관식)이다. 0-based가 아니다.
- 주관식 서술형은 모범답안(`answer`) + 채점 포인트를 `explanation`에 넣고,
  `keywords` 포함 개수(3개 중 3개=20점, 2개=15점, 1개=10점, 0개=0점)로 부분 채점한다.
- 국어는 `<passage>`에 지문(자체 제작)을 넣고 지문 관련 문제 5개를 낸다.

## 점수 저장 방식

- 브라우저 `localStorage` 키 `study_daily_han_results_v1`에 저장한다.
  날짜·과목·단원·점수(100점 만점, 문제당 20점)·맞은 개수·소요 시간·틀린 문제 번호·재풀이 횟수를 기록한다.
- 서버로 전송되지 않는다. 기기·브라우저를 바꾸면 기록이 안 보인다.
- **내보내기/가져오기**: 결과·추세 탭에서 JSON 다운로드로 백업하고, 가져오기 버튼으로 다른 기기에서 복원할 수 있다.
- **결과 복사**: 날짜·과목·단원·점수·틀린 문제 번호를 텍스트로 복사해 부모에게 보내는 용도다.

## 결과·추세 분석

결과·추세 탭에서 볼 수 있다.

- 최근 점수 꺾은선 그래프(외부 차트 라이브러리 없이 캔버스 직접 그리기)
- 과목별 평균 점수, 최근 5일 평균, 연속 풀이 일수(streak)
- 약한 단원(틀린 문제의 과목·단원) 목록
- 데이터가 없을 때는 빈 상태 문구를 보여준다.

## 새 날짜 추가 방법

1. `data/days/YYYY-MM-DD.xml`을 복사해 새 날짜 파일로 만든다.
   `date`, `weekday`, `subject`, `unit`과 문제 5개, 영어 단어 2개·숙어 2개를 채운다.
2. `data/manifest.json`의 `days` 배열에 한 줄을 추가한다.
   (날짜 순서대로 넣을 것. `file` 경로는 `data/days/YYYY-MM-DD.xml` 형식.)
3. XML이 well-formed인지 확인한다.

```bash
python3 -c "import xml.etree.ElementTree as ET; ET.parse('data/days/2026-12-07.xml')"
```

## 로컬에서 여는 방법

`fetch`는 `file://`에서 막히는 브라우저가 많다. 아래 중 하나로 여는 것을 권장한다.

```bash
# 레포 폴더에서
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000/index.html 접속
```

`file://`로 직접 열면 껍데기가 XHR 폴백을 먼저 시도하고,
그래도 안 되면 로컬 서버로 여는 안내를 띄운다.
GitHub Pages에 올리면 링크만으로 바로 열 수 있다 (Settings → Pages → main 브랜치).

## 검증

```bash
# XML 전수 well-formed 검사 + 문제 수 카운트
python3 - <<'PY'
import xml.etree.ElementTree as ET, glob
for p in sorted(glob.glob('data/days/*.xml')):
    r = ET.parse(p).getroot()
    qs = r.findall('./questions/q')
    mcq = [q for q in qs if q.get('type') == 'mcq']
    short = [q for q in qs if q.get('type') == 'short']
    eng = r.find('english')
    print(p, '문제', len(qs), '객관식', len(mcq), '주관식', len(short),
          '단어', len(eng.findall('word')), '숙어', len(eng.findall('idiom')))
PY
```

기대 결과: 날짜별 문제 5개, 객관식 3개, 주관식 2개, 단어 2개, 숙어 2개.


## GitHub Pages 테스트 배포

- GitHub Pages는 개발·UI 테스트용으로만 사용합니다. 실제 가족 학습 기록과 개인정보는 공개 정적 파일에 저장하지 않습니다.
- 현재 저장소는 **Private**입니다. GitHub Free에서는 Pages를 사용하려면 저장소가 Public이어야 하므로, Private 유지 시 Pages를 지원하는 유료 플랜이 필요할 수 있습니다.
- 저장소를 Public으로 바꾸는 경우 문제 XML의 정답·해설까지 인터넷에 공개된다는 점을 확인하고 진행합니다.
- 저장소의 **Settings → Pages → Build and deployment → Source**에서 **GitHub Actions**를 선택해야 합니다.
- 이후 `main`에 push하면 콘텐츠 검증을 통과한 경우 테스트 사이트가 배포됩니다. Pull request에서는 검증만 실행하고 배포하지 않습니다.
- GitHub Pages는 공개 사이트이므로 URL을 아는 사람은 GitHub 로그인 없이 접속할 수 있습니다.

### 콘텐츠 검증

로컬에서 Python 3으로 실행:

```bash
python tools/validate_content.py
```

manifest와 날짜별 XML의 날짜/요일/과목, 문항 구성(객관식 3 + 주관식 2), 영어 단어·숙어 수, 수학 난이도 구성을 검사합니다. GitHub Actions에서도 push 및 pull request마다 실행됩니다.

추가 운영 문서:
- [배포 및 접근 제어 가이드](docs/DEPLOYMENT_AND_ACCESS_GUIDE.md)
- [월간 문제 배치 생성·검수 운영안](docs/QUESTION_GENERATION_WORKFLOW.md)
- [학습 시스템 설계 청사진](docs/LEARNING_BLUEPRINT.md)
