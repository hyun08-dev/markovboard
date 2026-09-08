# 배포

백엔드 없이 브라우저에서 계산하는 **정적 사이트**다. 상태가 43개 규모라 전이행렬
생성부터 정상분포·λ₂·Kac 검증까지 한 번에 100ms 안쪽으로 끝나므로 서버가 필요 없다.
WebAssembly 나 Web Worker 도 두지 않았다 — 과한 구성은 오히려 직접 만들었다는 인상을
해친다. (계획서 §7 · §12)

**GitHub Pages 와 Vercel 어느 쪽으로도 배포할 수 있다.** 둘 다 정적 호스팅이고,
빌드 산출물은 같은 `dist/` 하나다.

## 왜 상대 경로로 빌드하는가

Vercel 은 루트(`/`)에서, GitHub Pages 프로젝트 사이트는 하위 경로
(`/<저장소 이름>/`)에서 서빙한다. 절대 경로로 빌드하면 둘 중 한쪽에서 에셋이 404 가
난다. 그래서 `vite.config.ts` 에 `base: './'` 를 두었다.

이 앱은 **클라이언트 라우팅 없이 쿼리 문자열만** 쓰므로 상대 경로가 어디에 올려도
그대로 동작한다. 파일을 직접 열어도(`file://`) 마찬가지다.

---

## 방법 A — GitHub Pages (워크플로 준비 완료)

`.github/workflows/deploy.yml` 이 이미 들어 있다. **기본 브랜치에 푸시하면 끝난다** —
Pages 활성화까지 워크플로가 스스로 시도한다.

주소는 `https://<계정>.github.io/<저장소 이름>/` 형태이고, 배포가 끝나면 Actions
실행 요약에 링크가 뜬다.

### 워크플로가 하는 일

```
checkout → Pages 활성화 → npm ci → 타입 검사 → 단위 테스트 → 빌드 → Pages 업로드 → 배포
```

**타입 검사와 테스트를 통과해야 배포된다.** 계산이 틀린 채로 올라가는 것을 막는다.

브랜치 이름을 하드코딩하지 않고 `github.ref_name == github.event.repository.default_branch`
조건을 썼다. 지금은 작업 브랜치가 기본 브랜치이고, 나중에 `main` 으로 옮겨도
워크플로를 고칠 필요가 없다.

### Pages 활성화가 자동인 이유와, 자동이 안 될 때

마지막 `deploy-pages` 단계는 파일을 복사하는 것이 아니라 **Pages API 를 호출**한다.
그 API 는 저장소에 (1) Pages 가 켜져 있고 (2) 빌드 방식이 `workflow` 여야 요청을
받아 준다. 그래서 `configure-pages` 단계가 앞에서 둘을 맞춰 준다.

이 단계에는 `continue-on-error: true` 를 달아 두었다. 자동 활성화는 **편의**이지
요구사항이 아니기 때문이다. 조직 정책이나 요금제 때문에 권한이 없을 수 있는데,
그때 빌드까지 멈춰 세우면 손으로 켜는 경로보다 오히려 나빠진다. 실패하면 경고만
남기고 계속 가서, `deploy` 단계가 설정 링크가 담긴 원래 오류를 보여주게 둔다.

**그 경우 손으로 한 번만 켜면 된다.**

1. GitHub 저장소 → **Settings → Pages**
2. **Build and deployment → Source** 를 `GitHub Actions` 로 바꾼다
   (기본값인 "Deploy from a branch" 가 아니다)
3. Actions 탭에서 실패한 실행을 열고 **Re-run jobs**

재실행은 `Re-run failed jobs` 로 충분하지만, **하루가 지났으면 `Re-run all jobs`** 를
써야 한다. `upload-pages-artifact` 의 아티팩트 보관 기간이 기본 1일이라 그 뒤에는
`deploy` 만 다시 돌려도 가져올 것이 없다. 헷갈리면 `Re-run all jobs` 가 항상 안전하다.

### 배포가 실패했을 때 어디를 보는가

`build` 잡은 성공했는데 `deploy` 만 빨간 X 라면 **코드가 아니라 저장소 설정 문제**다.

| 증상 | 원인 |
|---|---|
| HTTP 404, "Ensure GitHub Pages has been enabled" | Pages 가 꺼져 있다 |
| Pages 설정 화면에 주소는 보이는데 배포가 거절됨 | Source 가 `Deploy from a branch` 로 되어 있다. 그 모드에서는 브랜치의 파일만 서빙하고 워크플로가 올린 아티팩트는 쓰지 않는다 |

### 알아 둘 것

- **비공개 저장소**에서 Pages 를 쓰려면 GitHub Pro / Team 이상이 필요하다.
  공개 저장소는 무료다. 요금제가 안 되면 자동 활성화도 실패한다.
- 커스텀 도메인을 쓰려면 Settings → Pages 에서 지정하고 `public/CNAME` 을 추가한다.

---

## 방법 B — Vercel

```
GitHub Repository → Vercel → Production Build → Public Web App
```

1. GitHub 저장소를 Vercel 에 연결한다.
2. 프리셋은 **Vite** 를 고른다. `vercel.json` 이 이미 같은 값을 적어 두었으므로
   자동 감지에 실패해도 그대로 빌드된다.
   - Build Command: `npm run build`
   - Output Directory: `dist`
3. 이후 `git push` 하면 자동으로 갱신된다.

두 방법을 동시에 써도 된다. 같은 `dist/` 를 서로 다른 곳에 올릴 뿐이다.

## 배포 후 확인 목록

- [ ] 다섯 화면(보드 히트맵 · 정상상태 수렴 · 이론값–시뮬레이션 · 유입 경로 · 전이행렬)이 모두 뜬다
- [ ] 설정 패널로 모델을 바꾸면 즉시 다시 계산된다
- [ ] 주소창의 쿼리가 설정을 따라 바뀌고, 그 링크를 새 창에 붙여넣으면 같은 상태로 열린다
- [ ] '시뮬레이션 실행'이 브라우저에서 몇 초 안에 끝난다
- [ ] 어두운 모드에서도 색이 읽힌다

## 로컬에서 프로덕션 빌드 확인

```bash
npm run build
npm run preview
```

**배포 전에 반드시 브라우저에서 직접 조작해 볼 것.** 단위 테스트 126개가 전부
통과하는 상태에서도 화면 쪽 버그 세 개가 나왔다 (툴팁 무한 렌더 루프, 실험 12 데모
설정에서의 예외, 프리셋 없이는 성립하지 않는 주기성 설정). 자세한 내용은
`docs/journal.md` 의 Phase 8-b 참조.

확인할 것: 칸에 **마우스를 올려 보기**(툴팁), 실험 프리셋 여섯 개 모두 눌러 보기,
어두운 모드, 좁은 화면.

## 파일 하나로 합치기

```bash
npm run build && npm run inline   # dist/markovboard.html
```

외부 요청이 전혀 없는 자기완결 HTML 이다. 링크로 공유하거나 오프라인에서 열어 볼 때 쓴다.

## 재현성

시뮬레이션 난수는 씨앗을 받는 mulberry32 를 직접 구현했다. 화면에서 씨앗을 고정할 수
있으므로 **같은 설정 + 같은 씨앗이면 언제 어디서 돌려도 같은 결과**가 나온다.
보고서에 실은 수치는 이 방식으로 재현할 수 있다.
