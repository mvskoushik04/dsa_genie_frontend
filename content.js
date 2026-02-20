/**
 * Content script runs on https://leetcode.com/problems/*
 * Can be used by background to get problem title from DOM if needed.
 * Background currently uses scripting.executeScript for one-off title read.
 */
(function () {
  function getProblemInfo() {
    const slugMatch = window.location.pathname.match(/\/problems\/([^/]+)/);
    const slug = slugMatch ? slugMatch[1] : null;
    const titleEl = document.querySelector('[data-cy="question-title"]') ||
      document.querySelector('a[href*="/problems/"]');
    const title = titleEl ? titleEl.textContent?.trim() : null;
    return { problemSlug: slug, title, url: window.location.href };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === 'DSAGENIE_GET_PROBLEM_CONTENT') {
      sendResponse(getProblemInfo());
    }
    return true;
  });
})();
