// server.js
// Node >= 18 권장 (fetch/AbortController 내장)

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;
const TIMEOUT_MS = process.env.CLAUDE_TIMEOUT_MS ? Number(process.env.CLAUDE_TIMEOUT_MS) : 90000;
console.log('[ENV] CLAUDE_TIMEOUT_MS:', TIMEOUT_MS);

// ===== 공통 미들웨어 =====
app.use(cors());
// JSON 본문 없을 때 hang 방지를 위해 limit 지정(안전)
app.use(express.json({ limit: '2mb' }));

// 요청 로그 (디버깅용) — 모든 요청에 한 줄 찍기
app.use((req, _res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
});

// 파일 업로드 설정 (PDF 10MB 제한)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ===== Anthropic 초기화 =====
const MODEL_ID = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

// .env 로딩 확인(길이만 출력)
console.log('[ENV] CLAUDE_API_KEY length:', process.env.CLAUDE_API_KEY?.length || 'undefined');
console.log('[ENV] ANTHROPIC_MODEL:', MODEL_ID);

// ===== 가이드라인 상수 =====
const BROADCAST_GUIDELINES = `
🎯 핵심 원칙

1. 방송 구조의 기본 프레임
[표준 60분 구성]
- 카운트다운 (30초)
- 브랜드사 영상 (1분)
- 오프닝 & 구성/혜택 소개 (8-10분)
- 코너 1 (15-25분) *메인 제품
- 중간 구성 소개 + 퀴즈 (5분)
- 코너 2 (12-18분) *서브 제품/비교
- 코너 3 (3-5분) *구매 가이드
- 클로징 (3-5분)

2. 진행자 설정 필수 요소
- 구성: 쇼호스트 + 전문 크리에이터 (2인 체제)
- 역할 분담:
  * 쇼호스트: 진행, 가격 안내, 이벤트 관리, 시간 체크
  * 크리에이터: 제품 전문성, 실사용 후기, 시연 주도, 팁 제공
- 호칭: "○○주부", "○○의 핫IT슈" 등 프로그램명 활용

📝 섹션별 상세 가이드

[오프닝 - 필수 구성]

✅ 구성 순서
1. 30초 카운트다운 (고정)
2. 브랜드사 영상 play (1분)
3. 메인캠 전환 → 자기소개

✅ 도입부 대화 패턴
쇼호스트: "안녕하세요! [시즌/상황 언급]. 오늘 <프로그램명>는 [브랜드]와 함께합니다."
크리에이터: "안녕하세요. [직함]입니다. [일상 고민 제기]"
→ 실제 사용 후기로 자연스럽게 연결
→ 구체적 비용 절감, 시간 절약 등 수치 제시

❌ 피해야 할 것
- 인서트 영상 위주 오프닝
- 제품 스펙 먼저 언급
- "프리미엄", "혁신" 등 추상적 표현

[구성/혜택 소개 - 필수 요소]

✅ 필수 포함 사항
1. [대판] 구성 소개
   - 제품명, 정상가, 라이브가, 최대혜택가(%)
   - 3-5개 제품 테이블 형식

2. [절반배너] 혜택 소개
   - 할인 쿠폰 (알림받기, 카드사 등)
   - 적립 혜택 (기본 1% + 라이브 2% + 멤버십 1%)
   - 구매 증정 사은품
   - 이벤트 안내

3. 구매 방법 시연
   - 휴대폰으로 실제 구매 과정 보여주기
   - 쿠폰 적용 방법 안내

✅ 시간 배분: 8-10분

[코너 구성 - 핵심 패턴]

✅ 코너명 작성 공식
"[상황/시즌] [고민], [브랜드/제품]로 해결!"
- 예: "여름철 음쓰 고민, 루메나로 해결!"
- 예: "새학기 노트북 고민, 갤럭시북으로 해결!"

✅ 코너별 구성 요소

코너 1 (메인 제품) - 15-25분
- 제품 디자인/크기 소구 (A4용지, 팔 벌려 비교 등)
- 핵심 기능 3-4개 시연
- [절반배너] 체크 포인트 (굵은 글씨)
- 실사용 팁 & 관리법

코너 2 (비교/서브) - 12-18분
- 제품 간 비교표 ([대판] 활용)
- Pick 방식: "○○ Pick vs △△ Pick"
- 추천 가이드 (어떤 분께 추천)
- 활용도 시연

코너 3 (구매 가이드) - 3-5분
- [절반배너] 제품 누끼 + 핵심 포인트
- 타겟별 추천 (1인 가구, 신혼, 가족 등)
- 시즌 활용법

[시연 가이드 - 구체성이 생명]

✅ 시연 준비 체크리스트

준비물 명시
- [시연①] ○○ 만들기
  준비물: 정확한 재료명 + 분량
  예) 우유 250ml, 생크림 200ml, 설탕 80g, 바닐라 에센스

특수 장비 활용
- [●부감CAM] 위에서 내려다보는 각도
- [●열화상CAM] 온도 변화 실시간 체크
- [VCR] 사전 제작 영상 삽입

구체적 액션 지시
- "팔 벌려 크기 비교"
- "투명컵에 따라 버블 클로즈업"
- "결과물 핸들링하며 질감 확인"

✅ 리허설 가이드
*리허설 전 미리 준비사항
- 음처기는 리허설 전부터 돌려 물통에 물 차도록
- 아이스크림 한 배치 미리 제조
- 과일/야채는 색감 예쁜 것으로 손질 완료

[중간 구성 - 분위기 전환]

✅ 퀴즈 이벤트 구성
Q. [제품 핵심 정보 관련 4지선다]
① 정답지 1
② 정답지 2  
③ 정답지 3
④ 오답 (정답 표시)

- 카운트다운 후 정답 발표
- 당첨자 10-20명 발표

✅ 구매인증 이벤트
- 1차: 오프닝 후 (5명)
- 2차: 중간 구성 (5명)
- 3차: 클로징 (5-10명)

🎬 VMD & 스튜디오 세팅

라이프스타일 공간 구성
[제품별 추천 세팅]
- 주방가전: 모던 키친 + 다이닝 테이블
- 의류케어: 드레스룸 + 거실 연계
- 수면/건강: 침실 분위기 + 따뜻한 조명
- IT기기: 홈오피스 + 스터디룸

의상 컨셉
[시즌별 추천]
- 여름: 시원한 린넨, 하늘색 톤
- 겨울: 니트 + 따뜻한 톤
- 가전: 깔끔한 앞치마 추가
- IT: 캐주얼 정장 느낌

존 이동 동선
- 메인존 → 제품별 전용존 → 다시 메인존
- 이동 시 "자, 이제 ○○존으로 이동해볼까요?"

📊 이벤트 구성 템플릿

기본 구조
1. 할인/적립 혜택
   - 알림받기 쿠폰 (1-8만원)
   - 카드사 선결제 (5-7%)
   - 적립 포인트 (기본 1% + 라이브 2% + 멤버십 1%)
   - 슈퍼적립 (10%, 선착순)

2. 구매 증정 (전원)
   - 본품 관련 액세서리
   - 소모품 (필터, 세제 등)

3. 구매인증 (추첨)
   - 1등: 고가 사은품
   - 2-10등: 커피 쿠폰 등

4. 퀴즈 이벤트 (10-20명)
   - 제품 관련 4지선다

5. 소통 이벤트 (20-30명)
   - 댓글 활발 참여자

⏰ 시간대별 방송 설정

실제 방송 시간대
- 오전: 11:00-12:00 (주부 타겟)
- 저녁: 19:00-20:00 (직장인 퇴근)
- 밤: 20:00-21:00 (프라임 타임)

시간 배분 원칙
60분 기준:
- 도입부 (10분) - 17%
- 메인 코너 (35분) - 58%
- 마무리 (15분) - 25%

🚫 절대 금지 사항

표현/접근법
❌ "베스트셀러", "혁신", "프리미엄" 등 추상적 표현
❌ 제품 기능 나열식 설명
❌ 개별 제품 소개만 (비교 필수)

구성
❌ 인서트 영상 위주 오프닝
❌ 2인 쇼호스트 구성 (크리에이터 필수)
❌ 임의 시간 설정

시연
❌ "음식물 넣고 시연" 같은 일반적 표현
❌ 준비물, 분량 미표기
❌ 리허설 가이드 누락

✨ 제품군별 특화 포인트

가전제품
- 전기료 계산 (월/년 단위)
- 소음 측정 (dB 수치)
- A/S 기간, 핵심부품 보증
- 에너지 효율 등급

식품/음료 관련
- 정확한 레시피 (재료+분량)
- 영양성분표 비교
- 보관 방법, 유통기한
- 비용 절감 계산

IT/디지털
- 벤치마크 점수
- 배터리 시간
- 호환성 (OS, 앱 등)
- 업그레이드 가능 여부

계절상품
- 전기료 비교 (여름/겨울)
- 보관 방법 (시즌오프)
- 내구성, 수명
- 온도/습도 조절 범위

📌 최종 체크리스트

작성 완료 후 확인사항
- 시간대 실제 방송 시간 반영 (11시/19시/20시)
- 크리에이터 + 쇼호스트 2인 구성
- "○○ 고민, △△로 해결!" 패턴 코너명
- 제품 비교 섹션 포함
- 구체적 준비물/분량 명시
- 리허설 가이드 포함
- 특수 카메라 활용 명시
- 퀴즈 4지선다 구성
- 이벤트 3단계 이상 구성
- VMD/의상 구체적 명시

💡 작성 TIP
1. 도입부는 일상 고민에서 시작
2. 숫자로 말하기: "10만원 절약", "30분 단축"
3. Before/After 명확히: 문제 → 해결
4. 시연 중심: 말보다 보여주기
5. 비교 통해 선택 도움: A vs B 명확히
`;

// ===== 헬스체크 =====
app.get('/ping', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// ===== 사용 가능 모델 리스트 확인(계정/키 진단용) =====
app.get('/api/models', async (_req, res) => {
  try {
    const list = await anthropic.models.list();
    res.json(list);
  } catch (e) {
    console.error('models.list error:', e);
    res.status(500).json({ success: false, error: String(e?.message || e) });
  }
});

// ===== Anthropic 호출 유틸 (타임아웃 래퍼) =====
async function callClaudeWithTimeout(args, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    console.error(`[TIMEOUT] ${timeoutMs}ms elapsed → aborting Anthropic call`);
    controller.abort();
  }, timeoutMs);

  const t0 = Date.now();
  try {
    const resp = await anthropic.messages.create({ ...args }, { signal: controller.signal });
    console.log(`[LATENCY] Anthropic messages.create took ${Date.now() - t0}ms`);
    return resp;
  } finally {
    clearTimeout(timer);
  }
}
// ===== 테스트용(Anthropic 미사용) 즉시 응답 라우트 =====
app.post('/api/test-script-local', (_req, res) => {
  res.json({ success: true, script: '[LOCAL OK] 서버/라우팅 정상' });
});

app.post('/api/test-script', async (_req, res) => {
  const TIMEOUT_MS = process.env.CLAUDE_TIMEOUT_MS ? Number(process.env.CLAUDE_TIMEOUT_MS) : 180000; // 180s
  res.setTimeout(TIMEOUT_MS + 5000, () => {
    console.error('Response timeout: /api/test-script');
    try { res.status(504).json({ success:false, error:'Gateway Timeout' }); } catch {}
  });

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      console.error(`[TIMEOUT] ${TIMEOUT_MS}ms elapsed → aborting Anthropic call (/api/test-script)`);
      controller.abort();
    }, TIMEOUT_MS);

    const testProductInfo = `
      제품명: 브레빌 아이스크림 메이커 BCI600
      가격: 500,000원
      특징: 컴프레서 내장, 사전 냉동 불필요, 20분 완성
      용량: 1.5L

      제품명: 브레빌 탄산수 제조기 인피즈 퓨전 BCA800
      가격: 350,000원
      특징: 과일 인퓨전 가능, 탄산 강도 조절

      제품명: 브레빌 탄산수 제조기 인피즈 아쿠아 BCA600
      가격: 300,000원
      특징: 순수 탄산수 전용, 심플 디자인
    `;

    const response = await anthropic.messages.create(
      {
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
        max_tokens: 2048,                 // ★ 더 낮춤
        temperature: 0.7,
        system: '네이버 라이브 쇼핑 큐시트 작성 전문가. 추상어 금지, 표/리스트 중심, 실행형 문장.',
        messages: [{
          role: 'user',
          content:
`다음 핵심 가이드를 지켜 60분 큐시트를 간결하게 작성해라(필요 섹션만, 표/리스트 위주).

[핵심]
- 오프닝(카운트다운30초→브랜드영상1분→자기소개)
- 구성/혜택 소개(쿠폰/적립/증정/이벤트 + 구매방법 시연)
- 코너1: 메인제품 시연(핵심기능 3~4개, 구체 준비물/분량, 특수CAM/리허설 체크)
- 코너2: 비교/추천(A vs B 표, 타겟 추천)
- 코너3: 구매 가이드(타겟별 포인트)
- 중간 퀴즈(4지선다), 구매인증 이벤트(3회)
- VMD/의상/동선 구체화
- 금지: 추상표현/기능나열/비교 없는 소개

[제품 정보]
${testProductInfo}

[요구사항]
- 방송 시간: 60분, 시간대: 오전 11시, 프로그램명: 가전주부의 핫IT슈
- 반드시 포함: ①30초 카운트다운 ②2인 진행(쇼호스트 서경환/크리에이터 서영)
③"○○ 고민, △△로 해결!" 코너명 ④구체적 시연 준비물/분량
⑤중간 퀴즈(4지선다) ⑥제품 비교 ⑦VMD/의상 설정

섹션별 타임코드/배너문구/준비물표/비교표 포함.`
        }]
      },
      { signal: controller.signal }
    );

    clearTimeout(timer);
    res.json({ success: true, script: response.content?.[0]?.text || '' });
  } catch (error) {
    console.error('Error in /api/test-script:', error);
    res.status(500).json({
      success: false,
      error: '테스트 대본 생성 중 오류가 발생했습니다.',
      details: String(error?.message || error),
    });
  }
});

// ===== 실제 PDF 업로드 버전 =====
app.post('/api/generate-script', upload.single('pdf'), async (req, res) => {
  res.setTimeout(35000, () => {
    console.error('Response timeout: /api/generate-script');
    try {
      res.status(504).json({ success: false, error: 'Gateway Timeout' });
    } catch {}
  });

  try {
    let productInfo = '';

    if (req.file) {
      const pdfData = await pdfParse(req.file.buffer);
      productInfo = pdfData.text || '';
    }

    const response = await callClaudeWithTimeout({
      model: MODEL_ID,
      max_tokens: 8000,
      temperature: 0.7,
      system:
        `당신은 네이버 라이브 쇼핑 방송 대본 작성 전문가입니다.\n\n` +
        `다음 가이드라인을 반드시 준수하여 큐시트를 작성해주세요:\n${BROADCAST_GUIDELINES}\n\n` +
        `위 가이드라인을 엄격히 따라 실제 방송에서 사용 가능한 전문적인 큐시트를 작성해주세요.\n` +
        `반드시 가이드라인의 모든 요소를 포함하여 작성하세요.` +
        `상품의 혜택이나 가격 요소는 (혜택소개), (가격소개) 등으로 생략해줘`,
      messages: [
        {
          role: 'user',
          content:
            `다음 제품 정보를 바탕으로 60분 라이브 방송 큐시트를 작성해주세요:\n\n` +
            `[제품 정보]\n${productInfo}\n\n` +
            `요구사항:\n` +
            `- 방송 시간: 60분\n` +
            `- 시간대: 오전 11시\n` +
            `- 형식: 네이버 라이브 쇼핑\n` +
            `- 프로그램명: 가전주부의 핫IT슈\n\n` +
            `반드시 포함해야 할 요소:\n` +
            `1. 30초 카운트다운으로 시작\n` +
            `2. 쇼호스트(서경환)와 크리에이터(가전주부 서영) 2인 진행\n` +
            `3. "○○ 고민, △△로 해결!" 형식의 코너명\n` +
            `4. 구체적인 시연 준비물과 분량\n` +
            `5. 중간 퀴즈 이벤트 (4지선다)\n` +
            `6. 제품 비교 섹션\n` +
            `7. VMD와 의상 설정\n\n` +
            `가이드라인에 맞춰 완전한 큐시트를 작성해주세요.`,
        },
      ],
    });

    res.json({ success: true, script: response.content?.[0]?.text || '' });
  } catch (error) {
    console.error('Error in /api/generate-script:', error);
    res.status(500).json({
      success: false,
      error: '대본 생성 중 오류가 발생했습니다.',
      details: String(error?.message || error),
    });
  }
});

// 예: 오프닝 전용
app.post('/api/script-opening', async (_req, res) => {
  res.setTimeout(120000);
  try {
    const resp = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      temperature: 0.7,
      system: '네이버 라이브 쇼핑 큐시트 작성 전문가.',
      messages: [{
        role: 'user',
        content:
`[목표] 오프닝 파트만 완성: 카운트다운30초→브랜드영상1분→자기소개→구성/혜택 핵심 예고.
[제약] 추상표현 금지, 멘트/배너문구/타임코드 포함, 표/리스트 환영.`
      }]
    });
    res.json({ success: true, opening: resp.content?.[0]?.text || '' });
  } catch (e) {
    res.status(500).json({ success: false, error: String(e?.message || e) });
  }
});



// ===== 서버 시작 =====
app.listen(PORT, () => {
  console.log(`[BOOT] dotenv loaded. CLAUDE_API_KEY length: ${process.env.CLAUDE_API_KEY?.length || 'undefined'}`);
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`테스트 URL: http://localhost:${PORT}/api/test-script`);
});
