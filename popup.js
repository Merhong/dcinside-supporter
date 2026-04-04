/**
 * 확장 프로그램 팝업 설정 UI의 로직. 설정 로드/저장/렌더링 담당
 */
(() => {
  'use strict';

  const shared = window.DCGSShared;
  if (!shared) {
    console.error('[개인용 DC 갤질 단축키] shared.js 로딩 실패');
    return;
  }

  const { STORAGE_KEY, cloneDefaults, mergeSettings, storageGet, storageSet } = shared;

  const STATUS_DURATION_MS = 1400;

  const formElements = {
    enabled: document.getElementById('enabled'),
    ignoreWhenTyping: document.getElementById('ignoreWhenTyping'),
    refreshCommentsOnD: document.getElementById('refreshCommentsOnD'),
    numberNavigation: document.getElementById('numberNavigation'),
    showUserInfo: document.getElementById('showUserInfo'),
    shortcutInputs: Array.from(document.querySelectorAll('[data-shortcut]')),
    reset: document.getElementById('reset'),
    status: document.getElementById('status'),
  };

  let state = cloneDefaults();
  let statusTimer = null;

  init().catch((error) => {
    console.error('[개인용 DC 갤질 단축키] 팝업 초기화 실패:', error);
    showStatus('설정 로드 실패');
  });

  /**
   * 팝업 초기 상태를 읽고 UI를 렌더링한 뒤 이벤트를 바인딩한다.
   *
   * @returns {Promise<void>} 초기화 완료 시 resolve되는 Promise
   */
  async function init() {
    state = await loadSettings();
    render();
    bindEvents();
  }

  /**
   * 저장된 설정을 읽어 기본 구조와 병합한다.
   *
   * @returns {Promise<{enabled: boolean, ignoreWhenTyping: boolean, refreshCommentsOnD: boolean, numberNavigation: boolean, showUserInfo: boolean, shortcuts: Record<string, boolean>}>} 유효한 설정 객체
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

  /**
   * 현재 상태를 저장소에 저장하고 상태 메시지를 표시한다.
   *
   * @returns {Promise<void>} 저장 완료 시 resolve되는 Promise
   */
  async function saveSettings() {
    try {
      await storageSet({ [STORAGE_KEY]: state });
      showStatus('저장됨');
    } catch (error) {
      console.error('[개인용 DC 갤질 단축키] 설정 저장 실패:', error);
      showStatus('저장 실패');
    }
  }

  /**
   * 현재 설정 상태를 폼 요소에 반영한다.
   *
   * @returns {void} 렌더링 후 종료한다
   */
  function render() {
    formElements.enabled.checked = !!state.enabled;
    formElements.ignoreWhenTyping.checked = !!state.ignoreWhenTyping;
    formElements.refreshCommentsOnD.checked = !!state.refreshCommentsOnD;
    formElements.numberNavigation.checked = !!state.numberNavigation;
    formElements.showUserInfo.checked = !!state.showUserInfo;

    for (const input of formElements.shortcutInputs) {
      const key = input.dataset.shortcut;
      input.checked = !!state.shortcuts[key];
    }
  }

  /**
   * 팝업 내 입력 요소들에 저장 이벤트를 연결한다.
   *
   * @returns {void} 이벤트 바인딩 후 종료한다
   */
  function bindEvents() {
    // 최상위 boolean 옵션들: element ID와 state 키가 동일한 점을 활용해 공통 핸들러로 처리
    const booleanOptions = ['enabled', 'ignoreWhenTyping', 'refreshCommentsOnD', 'numberNavigation', 'showUserInfo'];
    for (const key of booleanOptions) {
      formElements[key].addEventListener('change', async () => {
        state[key] = formElements[key].checked;
        await saveSettings();
      });
    }

    for (const input of formElements.shortcutInputs) {
      input.addEventListener('change', onShortcutInputChange);
    }

    formElements.reset.addEventListener('click', onResetClick);
  }

  /**
   * 개별 단축키 체크박스 변경을 저장한다.
   *
   * @param {Event} event 체크박스 변경 이벤트
   * @returns {Promise<void>} 저장 완료 시 resolve되는 Promise
   */
  async function onShortcutInputChange(event) {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const key = input.dataset.shortcut;
    state.shortcuts[key] = input.checked;
    await saveSettings();
  }

  /**
   * 설정을 기본값으로 복원하고 다시 저장한다.
   *
   * @returns {Promise<void>} 복원 저장 완료 시 resolve되는 Promise
   */
  async function onResetClick() {
    state = cloneDefaults();
    render();
    await saveSettings();
    showStatus('기본값 복원 완료');
  }

  /**
   * 팝업 하단 상태 문구를 잠시 표시한다.
   *
   * @param {string} message 사용자에게 보여줄 상태 메시지
   * @returns {void} 표시 예약 후 종료한다
   */
  function showStatus(message) {
    formElements.status.textContent = message;
    if (statusTimer) {
      clearTimeout(statusTimer);
    }
    statusTimer = window.setTimeout(() => {
      formElements.status.textContent = '';
    }, STATUS_DURATION_MS);
  }
})();
