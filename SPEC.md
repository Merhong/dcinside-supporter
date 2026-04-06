# 개인용 DC 단축키 — 프로그램 명세서

## 1. 개요

DC(DCInside) 갤러리에서 키보드 단축키를 제공하는 Chrome MV3 확장 프로그램.
글쓰기, 댓글, 페이지 이동, 게시글 이동, 번호로 글 선택 등 갤러리 탐색에 필요한 동작을 키 하나로 수행한다.

- **대상 사이트:** `gall.dcinside.com` (데스크톱)
- **지원 갤러리:** 일반 갤러리, 마이너 갤러리(`/mgallery/`), 미니 갤러리(`/mini/`), 인물 갤러리(`/person/`)
- **동작 페이지:** 목록(`/board/lists/`), 글 보기(`/board/view/`), 글쓰기(`/board/write/`)

---

## 2. 파일 구조

```
manifest.json    Chrome MV3 매니페스트
shared.js        전역 설정 상수, 기본값, 유틸리티 (window.DCGSShared)
content.js       콘텐츠 스크립트 — 키보드 이벤트 처리 및 액션 실행
popup.html       팝업 설정 UI 마크업
popup.css        팝업 스타일
popup.js         팝업 설정 로직 — 로드/저장/렌더링
```

### 로드 순서

- **콘텐츠 스크립트:** `shared.js` → `content.js` (manifest에서 `document_idle` 시점에 주입)
- **팝업:** `popup.html` → `shared.js` → `popup.js` (script 태그 순서)
- 두 환경 모두 `window.DCGSShared` 전역 객체를 통해 공유 모듈에 접근한다.

### 서비스 워커

없음. 모든 로직이 콘텐츠 스크립트와 팝업에서 처리된다.

---

## 3. 설정 구조

`chrome.storage.local`에 키 `personalDcShortcutSettings`로 저장.

```javascript
{
  enabled: boolean,            // 확장 기능 전체 활성화 (기본: true)
  ignoreWhenTyping: boolean,   // 입력 중 단축키 무시 (기본: true)
  refreshCommentsOnD: boolean, // D 키 댓글 이동 시 새로고침 병행 (기본: true)
  numberNavigation: boolean,   // 숫자 키(1~0) 글 이동 활성화 (기본: true)
  showUserInfo: boolean,       // 작성자 IP/ID 색상 배지 표시 (기본: true)
  shortcuts: {                 // 개별 단축키 on/off
    W: boolean,  // 글쓰기
    C: boolean,  // 댓글 입력창 포커스
    D: boolean,  // 댓글 영역 이동
    R: boolean,  // 새로고침
    F: boolean,  // 전체글 목록
    G: boolean,  // 개념글 목록
    A: boolean,  // 이전 페이지
    S: boolean,  // 다음 페이지
    Z: boolean,  // 이전 글
    X: boolean,  // 다음 글
  }
}
```

### 설정 병합 규칙 (`mergeSettings`)

- 저장소에서 읽은 값을 기본값 구조에 안전하게 병합한다.
- 최상위 옵션은 `boolean` 타입만 수락하고, 나머지는 기본값을 사용한다.
- `shortcuts`는 기본 키 집합을 기준으로 덮어쓴다. 알 수 없는 키는 무시하고, 누락된 키는 기본값을 유지한다.
- 스토리지 API는 MV3 네이티브 Promise(`chrome.storage.local.get/set`)를 사용한다.

---

## 4. 키보드 이벤트 처리

### 이벤트 등록

- `document.addEventListener('keydown', onKeydown, true)` — **캡처 단계**에서 등록
- `chrome.storage.onChanged`로 설정 실시간 반영

### 키 입력 필터링 순서

1. `settings.enabled`가 `false`이면 무시
2. `event.defaultPrevented`이면 무시
3. `event.repeat`(키 반복)이면 무시
4. 수식키(Ctrl/Alt/Meta/Shift)가 눌려있으면 무시
5. 현재 페이지가 목록(`isListPage`) 또는 글 보기(`isViewPage`)가 아니면 무시
6. `event.code`로 액션 매핑 — 매핑 없으면 무시
7. 해당 단축키가 `settings.shortcuts`에서 비활성화면 무시
8. `settings.ignoreWhenTyping`이고 입력 중이면 무시
9. 통과하면 `preventDefault()` + `stopPropagation()` 후 액션 실행

### `event.code` 사용 이유

`event.key` 대신 `event.code`를 사용하여 **키보드 물리 위치 기준**으로 동작한다.
한국어 IME 활성 상태에서도 W/A/S/D 등의 물리 키 위치가 그대로 작동한다.

### 입력 중 판별 (`isTypingTarget`)

다음 요소에 포커스가 있으면 "입력 중"으로 판별하여 단축키를 무시:
- `<textarea>`, `<input>`, `<select>`
- `contenteditable="true"` 요소 및 그 자손
- `role="textbox"`, `role="searchbox"`, `role="combobox"`, `role="spinbutton"` 요소
- 위 요소의 내부에 있는 모든 자손 요소

---

## 5. 키 매핑 및 액션

### 문자 키 (ACTIONS_BY_CODE)

| event.code | 액션 | 동작 | 동작 페이지 |
|------------|------|------|-------------|
| `KeyW` | W | 글쓰기 페이지로 이동 | 목록, 글보기 |
| `KeyC` | C | 댓글 입력창에 포커스 | 글보기 |
| `KeyD` | D | 댓글 영역으로 스크롤 (+ 선택적 새로고침) | 글보기 |
| `KeyR` | R | 페이지 새로고침 (`location.reload()`) | 목록, 글보기 |
| `KeyF` | F | 전체글 목록으로 이동 | 목록, 글보기 |
| `KeyG` | G | 개념글 목록으로 이동 | 목록, 글보기 |
| `KeyA` | A | 이전 페이지 (최신 방향) | 목록 |
| `KeyS` | S | 다음 페이지 | 목록 |
| `KeyZ` | Z | 이전 게시글 | 글보기 |
| `KeyX` | X | 다음 게시글 | 글보기 |

### 숫자 키 (번호 글 이동)

| event.code | 동작 | 동작 페이지 |
|------------|------|-------------|
| `Digit1`~`Digit9` | 현재 페이지 목록의 1~9번째 글로 이동 | 목록, 글보기 |
| `Digit0` | 현재 페이지 목록의 10번째 글로 이동 | 목록, 글보기 |

- `settings.numberNavigation`으로 전체 on/off
- 개별 숫자 키별 토글은 없음 (단일 토글)
- 현재 페이지 기준으로 동작 (3페이지에서 1 → 3페이지 첫 글)
- 대상이 없으면 토스트: `N번째 글이 없습니다.`

---

## 6. 액션 상세 동작

### W — 글쓰기

1. DOM에서 글쓰기 버튼 탐색 (셀렉터 우선순위):
   - `button#btn_write.write`, `a#btn_write.write`, `.btn_box button.write`, `.btn_box a.write`
2. 버튼을 찾으면 `.click()` 호출
3. 못 찾으면 `buildPageUrl('write')`로 URL 생성하여 이동
4. URL도 생성 불가하면 토스트 표시

### C — 댓글 입력창 포커스

1. 댓글 textarea 탐색:
   - `textarea[id^="memo_"]`, `.view_comment textarea`, `.comment_box textarea`, `.cmt_write_box textarea`
2. `.focus()` + `.scrollIntoView({ block: 'center' })`
3. 못 찾으면 토스트

### D — 댓글 영역 이동

1. `settings.refreshCommentsOnD`가 `true`이면 댓글 새로고침 버튼 클릭
   - `button.btn_cmt_refresh`, `.btn_cmt_refresh`
2. 댓글 앵커 요소로 스크롤:
   - `.comment_count`, `#comment`, `.view_comment`, `.comment_box`, `.view_comment_wrap`

### R — 새로고침

`location.reload()` 호출.

### F — 전체글 목록

`buildPageUrl('lists')`로 목록 URL 생성 후 이동. 현재 URL의 검색/정렬 파라미터 보존.

### G — 개념글 목록

`buildPageUrl('lists', { exception_mode: 'recommend' })`로 개념글 URL 생성 후 이동.

### A/S — 이전/다음 페이지

1. `findPagingBox()`로 페이지네이션 박스 탐색
2. 현재 페이지(`<em>`)의 이전/다음 형제 링크를 우선 선택
3. 형제 링크가 없으면 `a.search_prev`/`a.search_next` 화살표 링크로 폴백
4. 링크가 없으면 경계 토스트 (`첫 페이지입니다.` / `마지막 페이지입니다.`)

### Z/X — 이전/다음 게시글

1. **같은 페이지 내 탐색 (우선):** 현재 글 행을 찾고 이전/다음 유효 행으로 이동
2. **다른 페이지 fetch (폴백):** 같은 페이지에 없으면 인접 페이지를 fetch하여 파싱 후 첫/마지막 유효 글로 이동
3. **race condition 방지:** `navigating` 플래그로 동시 요청 차단
4. 경계이면 토스트 (`첫 게시글입니다.` / `마지막 게시글입니다.`)

### 1~0 — N번째 글 이동

1. 현재 페이지의 `table.gall_list tbody tr`에서 유효 행(`isValidPostRow`)만 필터링
2. N번째(0키는 10번째) 유효 행의 제목 링크로 이동
3. 해당 순번의 글이 없으면 토스트 표시

---

## 7. 페이지 컨텍스트 판별

### `getPageContext()`

현재 URL에서 갤러리 정보를 추출한다.

```
pathname 예시:
  /board/lists/?id=programming        → 일반 갤러리 목록
  /mgallery/board/view/?id=test&no=1  → 마이너 갤러리 글보기
  /mini/board/write/?id=example       → 미니 갤러리 글쓰기
```

- **galleryType:** `board`(일반) | `mgallery` | `mini` | `person`
- **galleryId:** URL의 `id` 쿼리 파라미터
- **prefix:** 일반은 빈 문자열, 나머지는 `/{galleryType}`
- **isListPage/isViewPage/isWritePage:** `/board/lists/`, `/board/view/`, `/board/write/` 정규식으로 판별

### `buildPageUrl(pageType, extraParams)`

현재 갤러리 문맥으로 대상 페이지 URL을 구성한다.
현재 URL에서 의미 있는 쿼리 파라미터(`id`, `s_type`, `s_keyword`, `search_head`, `page`)를 보존하여 검색/정렬 문맥을 유지한다.

---

## 8. 게시글 유효성 판별 (`isValidPostRow`)

`table.gall_list tbody tr` 행이 실제 이동 가능한 게시글인지 판별한다.

**유효 조건:**
- `td.gall_num`과 `td.gall_tit` 셀이 모두 존재
- `block-disable`, `list_trend` 클래스가 없고, `display: none`이 아님
- `em.icon_notice` (공지 아이콘)가 없음
- 제목 셀에 유효한 `<a>` 링크가 있음
- 글 번호 셀이 `.sp_img.crt_icon` (현재 글 마커)이거나, 숫자 글번호를 포함
- `AD`, 빈 문자열, 비숫자 텍스트는 제외

---

## 9. 페이지네이션 탐색

### `findPagingBox()`

1. 개념글(추천글) 페이지의 별도 래퍼 `.bottom_paging_wrap.re`를 우선 탐색
2. 일반 목록에서는 `.bottom_paging_wrap` 중 댓글 페이저(`.cmt_paging`, `.comment_paging`, `.view_comment_wrap` 내부)를 제외
3. 남은 래퍼 중 두 번째(하단)를 우선, 하나뿐이면 그것을 사용

---

## 10. 토스트 알림 시스템

- 화면 우하단 고정 위치 (`position: fixed; right: 20px; bottom: 20px`)
- `z-index: 2147483647`, 반투명 다크 배경
- `textContent`로 메시지 설정 (XSS 안전)
- 표시 후 1800ms 뒤 자동 페이드아웃
- 스타일은 `document.documentElement`에 한 번만 주입, 토스트 div는 `document.body`에 생성
- ID: `personal-dc-shortcut-toast`

---

## 11. 팝업 설정 UI

### 구조

- **전체 토글:** 확장 기능 활성화, 입력 중 무시, D키 댓글 새로고침, 번호 키 글 이동, 유저 정보 배지 표시
- **개별 단축키:** W/C/D/R/F/G/A/S/Z/X 각각 체크박스
- **기본값 복원:** 모든 설정을 DEFAULT_SETTINGS로 리셋
- **상태 표시:** 저장/복원 후 1400ms 동안 상태 메시지 표시

### 저장 방식

체크박스 변경 즉시 `chrome.storage.local`에 저장. 콘텐츠 스크립트는 `storage.onChanged`로 실시간 반영.

---

## 12. 유저 정보 표시 기능

### 개요

글 목록, 글보기 헤더, 댓글에서 작성자의 IP/ID를 닉네임 옆에 색상 배지로 표시한다.
같은 IP 또는 ID는 동일한 색상으로 표시되어 동일인 식별이 쉽다.

### 설정

- `showUserInfo: boolean` (기본값: `true`) — 단일 토글로 전체 on/off

### DOM 데이터 소스

모든 위치에서 동일한 패턴:

```html
<!-- 목록 -->
<td class="gall_writer ub-writer" data-nick="닉네임" data-uid="아이디" data-ip="123.456">

<!-- 글보기 헤더 -->
<div class="gall_writer ub-writer" data-nick="닉네임" data-uid="아이디" data-ip="">

<!-- 댓글 -->
<span class="gall_writer ub-writer" data-nick="닉네임" data-uid="아이디" data-ip="">
```

통합 셀렉터: `.gall_writer[data-nick]`

### 유저 타입 판별

| 조건 | 타입 | 닉콘 이미지 |
|------|------|------------|
| `data-ip` 있음, `data-uid` 없음 | 유동 | 없음 |
| `data-uid` 있음 + `nik.gif` 또는 `fix_nik.gif` | 고닉 | 일반 닉콘 |
| `data-uid` 있음 + 닉콘 없음 | 반고닉 | 없음 |
| `fix_managernik.gif` | 갤매니저 | 매니저 닉콘 |
| `fix_sub_managernik.gif` | 부매니저 | 부매니저 닉콘 |

### 표시 방식

닉네임 뒤에 인라인 배지를 삽입한다:

- **유동:** `(IP)` — 이미 표시되어 있으므로 색상 배지만 추가
- **고닉/반고닉:** `[uid]` 배지 추가
- 배지는 작은 `<span>` 요소, `font-size: 11px`, `border-radius: 3px`, `padding: 1px 4px`

### 색상 매핑

IP 또는 uid 문자열을 해시하여 HSL 색상으로 변환한다:

```
해시(문자열) → hue (0~360)
채도: 55% (고정)
밝기: 40% (고정, 배지 텍스트는 흰색)
```

- 같은 문자열 → 항상 같은 색상
- 다른 문자열 → 높은 확률로 다른 색상
- 해시 함수: 간단한 문자열 해시 (djb2 등)

### 적용 범위

- 목록 페이지: `td.gall_writer[data-nick]`
- 글보기 헤더: `.gallview_head .gall_writer[data-nick]`
- 댓글: `li.ub-content .gall_writer[data-nick]`

### 중복 처리

이미 배지가 삽입된 요소는 건너뛴다 (재실행 방지용 마커 클래스 `dc-shortcut-user-badge` 사용).

### 동적 댓글 대응

댓글은 비동기로 로드/새로고침되므로 `MutationObserver`로 대응한다:

- **관찰 대상:** `.view_comment` 또는 `document.body` (안정적 상위 요소)
- **디바운스:** `requestAnimationFrame` 기반, 프레임당 최대 1회 실행
- **자기 mutation 억제:** 배지 삽입(`dc-shortcut-user-badge` 클래스)으로 인한 mutation은 무시
- **설정 off 시:** 기존 배지를 모두 제거하고, 숨겨둔 `span.ip`를 복구

---

## 13. 제약 사항 및 알려진 한계

- **모바일 미지원:** `m.dcinside.com`은 매니페스트 매치 대상이 아님
- **SPA 미대응:** 초기화는 1회 실행. 부분 리렌더링 시 리스너/DOM 가정이 낡을 수 있음
- **DOM 결합:** DCInside DOM 구조(테이블 기반 목록, 특정 클래스명)에 의존. 사이트 업데이트 시 셀렉터 점검 필요
- **키보드 레이아웃:** `event.code` 기반이라 비-QWERTY 레이아웃에서는 물리 키 위치와 문자 의미가 다를 수 있음
