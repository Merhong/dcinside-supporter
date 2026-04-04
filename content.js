/**
 * DCInside 페이지에 주입되는 콘텐츠 스크립트. 키보드 단축키 감지 및 실행 담당
 */
(() => {
  'use strict';

  /* ─── 초기화 ─── */

  const shared = window.DCGSShared;
  if (!shared) {
    console.error('[개인용 DC 갤질 단축키] shared.js 로딩 실패');
    return;
  }

  const { STORAGE_KEY, cloneDefaults, mergeSettings, storageGet } = shared;

  const ACTIONS_BY_CODE = {
    KeyW: 'W',
    KeyC: 'C',
    KeyD: 'D',
    KeyR: 'R',
    KeyF: 'F',
    KeyG: 'G',
    KeyA: 'A',
    KeyS: 'S',
    KeyZ: 'Z',
    KeyX: 'X',
  };

  const SELECTORS = {
    writeButton: [
      'button#btn_write.write',
      'a#btn_write.write',
      '.btn_box button.write',
      '.btn_box a.write',
    ],
    commentTextarea: [
      'textarea[id^="memo_"]',
      '.view_comment textarea',
      '.comment_box textarea',
      '.cmt_write_box textarea',
    ],
    commentRefreshButton: ['button.btn_cmt_refresh', '.btn_cmt_refresh'],
    commentAnchor: [
      '.comment_count',
      '#comment',
      '.view_comment',
      '.comment_box',
      '.view_comment_wrap',
    ],
    exceptionPagingWrap: '.bottom_paging_wrap.re, .bottom_paging_wrapre',
    pagingWraps: '.bottom_paging_wrap',
    pagingBox: '.bottom_paging_box',
  };

  const BOUNDARY_MESSAGES = {
    page: { prev: '첫 페이지입니다.', next: '마지막 페이지입니다.' },
    post: { prev: '첫 게시글입니다.', next: '마지막 게시글입니다.' },
  };

  const TOAST_DURATION_MS = 1800;
  const TOAST_ID = 'personal-dc-shortcut-toast';
  const STYLE_ID = 'personal-dc-shortcut-style';

  let settings = cloneDefaults();
  let toastTimer = null;

  init().catch((error) => {
    console.error('[개인용 DC 갤질 단축키] 초기화 실패:', error);
  });

  /**
   * 콘텐츠 스크립트를 초기화하고 이벤트를 등록한다.
   *
   * @returns {Promise<void>} 초기화 완료 시 resolve되는 Promise
   */
  async function init() {
    settings = await loadSettings();
    injectStyle();
    document.addEventListener('keydown', onKeydown, true);
    chrome.storage.onChanged.addListener(onStorageChanged);
  }

  /**
   * 저장소 변경 이벤트를 받아 현재 메모리 설정을 갱신한다.
   *
   * @param {Object<string, chrome.storage.StorageChange>} changes 변경된 저장소 항목 맵
   * @param {string} areaName 변경이 발생한 저장소 영역 이름
   * @returns {void} 갱신 후 종료한다
   */
  function onStorageChanged(changes, areaName) {
    if (areaName !== 'local' || !changes[STORAGE_KEY]) {
      return;
    }
    settings = mergeSettings(cloneDefaults(), changes[STORAGE_KEY].newValue);
  }

  /* ─── 설정 로드 ─── */

  /**
   * 저장소에서 설정을 읽고 기본값과 병합한다.
   *
   * @returns {Promise<{enabled: boolean, ignoreWhenTyping: boolean, refreshCommentsOnD: boolean, shortcuts: Record<string, boolean>}>} 유효한 구조로 정리된 설정 객체
   */
  async function loadSettings() {
    try {
      const result = await storageGet(STORAGE_KEY);
      return mergeSettings(cloneDefaults(), result?.[STORAGE_KEY]);
    } catch (error) {
      console.warn('[개인용 DC 갤질 단축키] 설정 로드 실패. 기본값 사용:', error);
      return cloneDefaults();
    }
  }

  /* ─── 키보드 이벤트 처리 ─── */

  /**
   * 키다운 이벤트를 단축키 액션으로 변환한다.
   *
   * @param {KeyboardEvent} event 문서에 등록된 키다운 이벤트
   * @returns {void} 처리 후 즉시 종료한다
   */
  function onKeydown(event) {
    if (!settings.enabled) return;
    if (event.defaultPrevented) return;
    if (event.repeat) return;
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;

    // 목록(/lists/)과 글 보기(/view/) 페이지에서만 단축키 활성화
    const { isListPage, isViewPage } = getPageContext();
    if (!isListPage && !isViewPage) return;

    const action = ACTIONS_BY_CODE[event.code];
    if (!action) return;
    if (!settings.shortcuts[action]) return;

    if (settings.ignoreWhenTyping && isTypingTarget(event.target)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    void executeAction(action);
  }

  /**
   * 현재 이벤트 대상이 입력 중인 요소인지 판별한다.
   *
   * @param {EventTarget|null} target 키 이벤트가 발생한 대상
   * @returns {boolean} 입력 필드 또는 contenteditable이면 true
   */
  function isTypingTarget(target) {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    if (target.closest('[contenteditable="true"]')) return true;
    if (target.closest('textarea')) return true;
    if (target.closest('input')) return true;
    return false;
  }

  /**
   * 단축키 액션 코드를 실제 동작으로 실행한다.
   *
   * @param {string} action 실행할 단축키 액션 코드
   * @returns {Promise<void>} 비동기 액션 완료 시 resolve되는 Promise
   */
  async function executeAction(action) {
    switch (action) {
      case 'W':
        openWritePage();
        return;
      case 'C':
        focusCommentBox();
        return;
      case 'D':
        jumpToComments();
        return;
      case 'R':
        location.reload();
        return;
      case 'F':
        goToListPage();
        return;
      case 'G':
        goToRecommendPage();
        return;
      case 'A':
        goToPage('prev');
        return;
      case 'S':
        goToPage('next');
        return;
      case 'Z':
        await goToAdjacentPost('prev');
        return;
      case 'X':
        await goToAdjacentPost('next');
        return;
      default:
        return;
    }
  }

  /* ─── 페이지 컨텍스트 / URL 유틸 ─── */

  /**
   * 현재 페이지의 갤러리 타입과 URL 문맥을 해석한다.
   *
   * @returns {{url: URL, pathname: string, galleryType: string, galleryId: string, prefix: string, isViewPage: boolean, isListPage: boolean, isWritePage: boolean}} 현재 페이지의 URL, 경로, 갤러리 타입 정보
   */
  function getPageContext() {
    const url = new URL(location.href);
    const pathname = url.pathname;

    let galleryType = 'board';
    if (pathname.startsWith('/mgallery/')) galleryType = 'mgallery';
    else if (pathname.startsWith('/mini/')) galleryType = 'mini';
    else if (pathname.startsWith('/person/')) galleryType = 'person';

    const galleryId = url.searchParams.get('id') || '';
    const prefix = galleryType === 'board' ? '' : `/${galleryType}`;

    return {
      url,
      pathname,
      galleryType,
      galleryId,
      prefix,
      isViewPage: pathname.includes('/view/'),
      isListPage: pathname.includes('/lists/'),
      isWritePage: pathname.includes('/write/'),
    };
  }

  /**
   * 현재 갤러리 문맥을 기준으로 대상 페이지 URL을 만든다.
   *
   * @param {string} pageType 이동할 페이지 타입
   * @param {Object<string, string|number|boolean|null|undefined>} extraParams 추가로 붙일 쿼리 파라미터
   * @returns {string|null} 완성된 URL 문자열 또는 생성 불가 시 null
   */
  function buildPageUrl(pageType, extraParams = {}) {
    const { galleryId, prefix } = getPageContext();
    if (!galleryId) return null;

    const url = new URL(`${location.origin}${prefix}/board/${pageType}/`);
    url.searchParams.set('id', galleryId);

    for (const [key, value] of Object.entries(extraParams)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }

    return url.toString();
  }

  /**
   * 여러 셀렉터를 순서대로 조회해 첫 번째 일치 요소를 반환한다.
   *
   * @param {string[]} selectors 우선순위대로 시도할 CSS 셀렉터 목록
   * @param {ParentNode} root 조회를 수행할 루트 노드
   * @returns {Element|null} 처음 발견한 요소 또는 null
   */
  function queryAny(selectors, root = document) {
    for (const selector of selectors) {
      const element = root.querySelector(selector);
      if (element) return element;
    }
    return null;
  }

  /**
   * 여러 셀렉터로 요소를 찾고, 실패하면 토스트를 표시한다.
   *
   * @param {string[]} selectors 시도할 CSS 셀렉터 목록
   * @param {string} errorMessage 요소를 찾지 못했을 때 표시할 메시지
   * @param {ParentNode} root 조회를 수행할 루트 노드
   * @returns {HTMLElement|null} 찾은 요소 또는 null (토스트 표시 후)
   */
  function findOrWarn(selectors, errorMessage, root = document) {
    const el = queryAny(selectors, root);
    if (el instanceof HTMLElement) return el;
    showToast(errorMessage);
    return null;
  }

  /* ─── 단축키 액션: 글쓰기, 댓글 ─── */

  /**
   * 글쓰기 버튼을 누르거나 글쓰기 페이지로 이동한다.
   *
   * @returns {void} 이동 처리 후 종료한다
   */
  function openWritePage() {
    const button = queryAny(SELECTORS.writeButton);

    if (button instanceof HTMLElement) {
      button.click();
      return;
    }

    const fallbackUrl = buildPageUrl('write');
    if (fallbackUrl) {
      location.href = fallbackUrl;
      return;
    }

    showToast('글쓰기 버튼을 찾지 못했습니다.');
  }

  /**
   * 댓글 입력창에 포커스를 맞추고 화면 중앙으로 스크롤한다.
   *
   * @returns {void} 포커스 이동 후 종료한다
   */
  function focusCommentBox() {
    const textarea = findOrWarn(SELECTORS.commentTextarea, '댓글 입력창을 찾지 못했습니다.');
    if (!textarea) return;

    textarea.focus();
    textarea.scrollIntoView({ behavior: 'auto', block: 'center' });
  }

  /**
   * 댓글 영역으로 이동하고 필요하면 댓글 새로고침을 실행한다.
   *
   * @returns {void} 스크롤 처리 후 종료한다
   */
  function jumpToComments() {
    if (settings.refreshCommentsOnD) {
      const refreshButton = queryAny(SELECTORS.commentRefreshButton);
      if (refreshButton instanceof HTMLElement) {
        refreshButton.click();
      }
    }

    const anchor = findOrWarn(SELECTORS.commentAnchor, '댓글 영역을 찾지 못했습니다.');
    if (!anchor) return;

    anchor.scrollIntoView({ behavior: 'auto', block: 'center' });
  }

  /**
   * 현재 갤러리의 목록 페이지로 이동한다.
   *
   * @returns {void} 이동 처리 후 종료한다
   */
  function goToListPage() {
    const url = buildPageUrl('lists');
    if (!url) {
      showToast('갤러리 목록 페이지를 찾지 못했습니다.');
      return;
    }
    location.href = url;
  }

  /**
   * 현재 갤러리의 개념글 페이지로 이동한다.
   *
   * @returns {void} 이동 처리 후 종료한다
   */
  function goToRecommendPage() {
    const url = buildPageUrl('lists', { exception_mode: 'recommend' });
    if (!url) {
      showToast('개념글 페이지를 찾지 못했습니다.');
      return;
    }
    location.href = url;
  }

  /* ─── 단축키 액션: 페이지 네비게이션 ─── */

  /**
   * 현재 페이지의 페이지네이션 박스를 찾는다.
   * 개념글(추천글) 페이지는 .bottom_paging_wrap.re 래퍼를 우선 사용하고,
   * 일반 목록에서는 하단 페이징 영역을 기준으로 탐색한다.
   *
   * @returns {Element|null} 페이지네이션 박스 요소 또는 null
   */
  function findPagingBox() {
    const exceptionWrap = document.querySelector(SELECTORS.exceptionPagingWrap);
    if (exceptionWrap) {
      return exceptionWrap.querySelector(SELECTORS.pagingBox);
    }
    const wraps = document.querySelectorAll(SELECTORS.pagingWraps);
    const targetWrap = wraps.length > 1 ? wraps[1] : wraps[0];
    return targetWrap?.querySelector(SELECTORS.pagingBox) || null;
  }

  /**
   * 현재 목록 화면의 이전/다음 페이지 링크를 찾는다.
   *
   * @param {('prev'|'next')} direction 찾을 페이지 이동 방향
   * @returns {HTMLAnchorElement|null} 이동 가능한 페이지 링크 또는 null
   */
  function findPaginationLink(direction) {
    const targetPagingBox = findPagingBox();
    if (!targetPagingBox) return null;

    const currentPageElement = targetPagingBox.querySelector('em');
    if (direction === 'prev') {
      // 현재 페이지를 나타내는 em의 바로 이전 형제를 먼저 확인해 숫자 기반 이전 페이지를 우선 선택한다.
      if (currentPageElement) {
        const prevSibling = currentPageElement.previousElementSibling;
        if (prevSibling instanceof HTMLAnchorElement && prevSibling.href) {
          return prevSibling;
        }
      }
      return targetPagingBox.querySelector('a.search_prev[href]');
    }

    // 다음 페이지도 em의 바로 다음 형제를 먼저 찾고, 없을 때만 화살표 링크로 폴백한다.
    if (currentPageElement) {
      const nextSibling = currentPageElement.nextElementSibling;
      if (nextSibling instanceof HTMLAnchorElement && nextSibling.href) {
        return nextSibling;
      }
    }
    return targetPagingBox.querySelector('a.search_next[href]');
  }

  /**
   * 목록의 이전/다음 페이지로 이동한다.
   *
   * @param {('prev'|'next')} direction 이동 방향
   * @returns {void} 이동 처리 후 종료한다
   */
  function goToPage(direction) {
    const link = findPaginationLink(direction);
    if (!(link instanceof HTMLAnchorElement) || !link.href) {
      showToast(BOUNDARY_MESSAGES.page[direction]);
      return;
    }
    location.href = link.href;
  }

  /* ─── 단축키 액션: 게시글 네비게이션 ─── */

  /**
   * URL 문자열에서 게시글 번호(?no=)를 추출한다.
   *
   * @param {string} href 파싱할 URL 문자열
   * @returns {number|null} 파싱된 글 번호 또는 null
   */
  function parsePostNo(href) {
    try {
      const value = new URL(href, location.origin).searchParams.get('no');
      if (!value) return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  /**
   * 현재 URL에서 게시글 번호를 읽는다.
   *
   * @returns {number|null} 현재 글 번호 또는 파싱 실패 시 null
   */
  function getCurrentPostNo() {
    return parsePostNo(location.href);
  }

  /**
   * 현재 보고 있는 게시글에 대응하는 목록 행을 찾는다.
   *
   * @returns {HTMLTableRowElement|null} 현재 글 행 또는 찾지 못했을 때 null
   */
  function findCurrentPostRow() {
    const iconRow = document.querySelector('td.gall_num .sp_img.crt_icon')?.closest('tr');
    if (iconRow instanceof HTMLTableRowElement) {
      return iconRow;
    }

    const currentPostNo = getCurrentPostNo();
    if (!currentPostNo) return null;

    const rows = document.querySelectorAll('table.gall_list tbody tr');
    for (const row of rows) {
      if (!(row instanceof HTMLTableRowElement)) continue;
      const link = row.querySelector('td.gall_tit a:first-child');
      if (!(link instanceof HTMLAnchorElement) || !link.href) continue;
      if (getPostNoFromHref(link.href) === currentPostNo) {
        return row;
      }
    }

    return null;
  }

  /**
   * 게시글 링크에서 글 번호를 추출한다.
   *
   * @param {string} href 게시글 URL 또는 상대 경로
   * @returns {number|null} 파싱된 글 번호 또는 null
   */
  function getPostNoFromHref(href) {
    return parsePostNo(href);
  }

  /**
   * 목록 행이 실제 이동 가능한 일반 게시글인지 판별한다.
   *
   * @param {HTMLTableRowElement|Element|null} row 검사할 목록 행
   * @returns {boolean} 일반 게시글 행이면 true
   */
  function isValidPostRow(row) {
    if (!(row instanceof HTMLTableRowElement)) return false;

    const numCell = row.querySelector('td.gall_num');
    const titleCell = row.querySelector('td.gall_tit');

    if (!numCell || !titleCell) return false;
    if (
      row.classList.contains('block-disable') ||
      row.classList.contains('list_trend') ||
      row.style.display === 'none'
    ) {
      return false;
    }

    // 차단 글, 실시간 베스트/트렌드, 숨김 행처럼 실제 탐색 대상이 아닌 항목은 초기에 제외한다.
    if (titleCell.querySelector('em.icon_notice')) return false;
    // 공지는 em.icon_notice로, 광고/설문 등 비정상 행은 아래 숫자 글번호 검증으로 필터링한다.
    // <b> 태그 존재 여부로 필터링하면 정상 글이 누락될 수 있으므로 사용하지 않는다.

    const link = titleCell.querySelector('a:first-child');
    if (!(link instanceof HTMLAnchorElement) || !link.href) return false;

    if (numCell.querySelector('.sp_img.crt_icon')) {
      return true;
    }

    const numText = (numCell.textContent || '').trim();
    const cleaned = numText.replace(/\[.*?\]\s*/g, '');

    // AD, 공지, 설문처럼 숫자 글번호가 없는 행은 건너뛰고, 정상적인 숫자 글번호만 게시글로 인정한다.
    if (!cleaned || numText === 'AD') return false;
    if (Number.isNaN(Number(cleaned))) return false;

    return true;
  }

  /**
   * 원격 목록 페이지를 가져와 Document로 파싱한다.
   *
   * @param {string} url 가져올 목록 페이지 URL
   * @returns {Promise<{doc: Document, baseUrl: string}>} 파싱된 문서와 기준 URL
   */
  async function fetchDocument(url) {
    const response = await fetch(url, {
      credentials: 'include',
      redirect: 'follow',
      cache: 'no-cache',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return { doc, baseUrl: response.url || url };
  }

  /**
   * 파싱된 목록 문서에서 이동 가능한 게시글 링크만 추출한다.
   *
   * @param {Document} doc fetch로 받아온 목록 문서
   * @param {string} baseUrl 상대 경로 해석에 사용할 기준 URL
   * @returns {string[]} 유효한 게시글 URL 목록
   */
  function getValidPostLinksFromDoc(doc, baseUrl) {
    const rows = Array.from(doc.querySelectorAll('table.gall_list tbody tr'));
    const links = [];

    for (const row of rows) {
      if (!(row instanceof HTMLTableRowElement)) continue;
      if (!isValidPostRow(row)) continue;

      const link = row.querySelector('td.gall_tit a:first-child');
      if (link instanceof HTMLAnchorElement) {
        links.push(new URL(link.getAttribute('href') || link.href, baseUrl).toString());
      }
    }

    return links;
  }

  /**
   * 현재 글 기준으로 이전/다음 게시글로 이동한다.
   *
   * @param {('prev'|'next')} direction 이동 방향
   * @returns {Promise<void>} 이동 처리 완료 시 resolve되는 Promise
   */
  async function goToAdjacentPost(direction) {
    const currentRow = findCurrentPostRow();
    const step = direction === 'prev' ? 'previousElementSibling' : 'nextElementSibling';
    const boundaryMessage = BOUNDARY_MESSAGES.post[direction];
    const loadingErrorMessage = '게시글 이동 중 오류가 발생했습니다.';

    if (currentRow) {
      let row = currentRow[step];
      // 먼저 현재 목록 페이지 안에서 인접 게시글을 찾고, 있으면 즉시 이동해 네트워크 요청을 피한다.
      while (row) {
        if (isValidPostRow(row)) {
          const link = row.querySelector('td.gall_tit a:first-child');
          if (link instanceof HTMLAnchorElement && link.href) {
            location.href = link.href;
            return;
          }
        }
        row = row[step];
      }
    }

    const pageLink = findPaginationLink(direction === 'prev' ? 'prev' : 'next');
    if (!(pageLink instanceof HTMLAnchorElement) || !pageLink.href) {
      showToast(boundaryMessage);
      return;
    }

    try {
      // 현재 페이지에서 못 찾았을 때만 인접 페이지를 fetch하고, 방향에 맞춰 첫 글 또는 마지막 글을 선택한다.
      const { doc, baseUrl } = await fetchDocument(pageLink.href);
      const validLinks = getValidPostLinksFromDoc(doc, baseUrl);
      const targetLink = direction === 'prev' ? validLinks[validLinks.length - 1] : validLinks[0];

      if (!targetLink) {
        showToast(boundaryMessage);
        return;
      }

      location.href = targetLink;
    } catch (error) {
      console.error('[개인용 DC 갤질 단축키] 인접 글 이동 실패:', error);
      showToast(loadingErrorMessage);
    }
  }

  /* ─── 토스트 알림 ─── */

  /**
   * 토스트 스타일을 문서에 한 번만 주입한다.
   *
   * @returns {void} 스타일 주입 후 종료한다
   */
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${TOAST_ID} {
        position: fixed;
        right: 20px;
        bottom: 20px;
        z-index: 2147483647;
        max-width: min(320px, calc(100vw - 32px));
        padding: 10px 14px;
        border-radius: 10px;
        background: rgba(20, 20, 20, 0.92);
        color: #fff;
        font-size: 13px;
        line-height: 1.45;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
        opacity: 0;
        transform: translateY(8px);
        pointer-events: none;
        transition: opacity 0.18s ease, transform 0.18s ease;
        white-space: pre-wrap;
      }
      #${TOAST_ID}.show {
        opacity: 1;
        transform: translateY(0);
      }
    `;
    document.documentElement.appendChild(style);
  }

  /**
   * 토스트 DOM 요소를 가져오고 없으면 생성한다.
   *
   * @returns {HTMLElement} 토스트 표시용 요소
   */
  function getToastElement() {
    let toast = document.getElementById(TOAST_ID);
    if (!toast) {
      toast = document.createElement('div');
      toast.id = TOAST_ID;
      document.body.appendChild(toast);
    }
    return toast;
  }

  /**
   * 토스트 메시지를 잠깐 표시한다.
   *
   * @param {string} message 사용자에게 보여줄 안내 문구
   * @returns {void} 표시 예약 후 종료한다
   */
  function showToast(message) {
    const toast = getToastElement();
    toast.textContent = message;
    toast.classList.add('show');

    if (toastTimer) {
      clearTimeout(toastTimer);
    }

    toastTimer = window.setTimeout(() => {
      toast.classList.remove('show');
    }, TOAST_DURATION_MS);
  }
})();
