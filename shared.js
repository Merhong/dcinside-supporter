/**
 * 확장 프로그램 전역 설정 상수, 기본값, 유틸리티 함수를 정의하는 공유 모듈
 */
/**
 * @typedef {Record<string, boolean>} ShortcutMap
 */
/**
 * @typedef {{enabled: boolean, ignoreWhenTyping: boolean, refreshCommentsOnD: boolean, shortcuts: ShortcutMap}} ShortcutSettings
 */
(() => {
  'use strict';

  const STORAGE_KEY = 'personalDcShortcutSettings';

  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    ignoreWhenTyping: true,
    refreshCommentsOnD: true,
    shortcuts: Object.freeze({
      W: true,
      C: true,
      D: true,
      R: true,
      F: true,
      G: true,
      A: true,
      S: true,
      Z: true,
      X: true,
    }),
  });

  /**
   * 기본 설정 객체를 깊은 복사해 새로운 설정 인스턴스를 만든다.
   *
   * @returns {ShortcutSettings} 기본 설정과 동일한 구조를 가진 새 객체
   */
  function cloneDefaults() {
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }

  /**
   * 사용자 설정을 기본 설정 구조에 안전하게 병합한다.
   *
   * @param {ShortcutSettings} base 기본값을 보장하는 기준 설정 객체
   * @param {unknown} incoming 저장소에서 읽은 사용자 설정 객체
   * @returns {ShortcutSettings} 기본 구조를 유지하면서 병합된 설정 객체
   */
  function mergeSettings(base, incoming) {
    const result = cloneDefaults();
    const source = typeof incoming === 'object' && incoming !== null ? incoming : {};

    // 저장소 데이터가 비정상이어도 확장 프로그램이 깨지지 않도록, 최상위 옵션은 boolean 값만 선별해 병합한다.
    result.enabled = typeof source.enabled === 'boolean' ? source.enabled : base.enabled;
    result.ignoreWhenTyping =
      typeof source.ignoreWhenTyping === 'boolean'
        ? source.ignoreWhenTyping
        : base.ignoreWhenTyping;
    result.refreshCommentsOnD =
      typeof source.refreshCommentsOnD === 'boolean'
        ? source.refreshCommentsOnD
        : base.refreshCommentsOnD;

    // 단축키 맵도 기본 키 집합을 기준으로 덮어써서, 누락된 키나 예기치 않은 키가 섞여 들어와도 기본값을 보호한다.
    result.shortcuts = { ...base.shortcuts };
    const incomingShortcuts =
      typeof source.shortcuts === 'object' && source.shortcuts !== null ? source.shortcuts : {};

    for (const key of Object.keys(result.shortcuts)) {
      if (typeof incomingShortcuts[key] === 'boolean') {
        result.shortcuts[key] = incomingShortcuts[key];
      }
    }

    return result;
  }

  /**
   * chrome.storage.local에서 값을 읽는다.
   *
   * @param {string|string[]|Object<string, *>} key 조회할 키 또는 기본값 객체
   * @returns {Promise<Object<string, *>>} 조회 결과 객체
   */
  function storageGet(key) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(key, (result) => {
          const error = chrome.runtime?.lastError;
          if (error) {
            reject(error);
            return;
          }
          resolve(result);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * chrome.storage.local에 값을 저장한다.
   *
   * @param {Object<string, *>} value 저장할 키-값 객체
   * @returns {Promise<void>} 저장 완료 시 resolve되는 Promise
   */
  function storageSet(value) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.set(value, () => {
          const error = chrome.runtime?.lastError;
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  window.DCGSShared = {
    STORAGE_KEY,
    DEFAULT_SETTINGS,
    cloneDefaults,
    mergeSettings,
    storageGet,
    storageSet,
  };
})();
