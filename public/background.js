const BACKEND_URL = 'https://dsa-genie-backend-1.onrender.com';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message || {};

  if (!type || !type.startsWith('DSAGENIE_')) {
    sendResponse({ error: 'Unknown message type' });
    return true;
  }

  const run = async () => {
    try {
      if (type === 'DSAGENIE_GET_PROBLEM') {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab?.id || !tab.url?.includes('leetcode.com/problems/')) {
          return { problemInfo: null };
        }

        const slugMatch = tab.url.match(/leetcode\.com\/problems\/([^/?#]+)/);
        const problemSlug = slugMatch ? slugMatch[1] : null;

        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const titleEl =
              document.querySelector('[data-cy="question-title"]') ||
              document.querySelector('a[href*="/problems/"]');

            const title = titleEl ? titleEl.textContent?.trim() : null;

            const contentEl =
              document.querySelector('[data-cy="question-content"]') ||
              document.querySelector('[class*="questionContent"]') ||
              document.querySelector('[class*="QuestionContent"]') ||
              document.querySelector('.content__u3I1');

            const problemDescription = contentEl
              ? contentEl.innerText?.trim().slice(0, 8000)
              : null;

            return { title, problemDescription };
          },
        });

        const data = results?.[0]?.result;

        return {
          problemInfo: {
            url: tab.url,
            problemSlug,
            title: data?.title ?? null,
            problemDescription: data?.problemDescription ?? null,
          },
        };
      }

      const base = BACKEND_URL.replace(/\/$/, '');

      if (!base) {
        throw new Error('Backend URL not configured.');
      }

      if (type === 'DSAGENIE_EXPLANATION') {
        const res = await fetch(`${base}/api/explanation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload || {}),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to load explanation');
        }

        return { explanation: data.data?.explanation ?? '' };
      }

      if (type === 'DSAGENIE_PSEUDOCODE') {
        const res = await fetch(`${base}/api/pseudocode`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload || {}),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to load pseudocode');
        }

        return { pseudocode: data.data?.pseudocode ?? '' };
      }

      if (type === 'DSAGENIE_CODE') {
        const res = await fetch(`${base}/api/code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload || {}),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to load code');
        }

        return {
          code: data.data?.code ?? '',
          language: data.data?.language,
        };
      }

      if (type === 'DSAGENIE_YOUTUBE') {
        const res = await fetch(`${base}/api/youtube`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload || {}),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to fetch video');
        }

        return { videoId: data.data?.videoId ?? null };
      }

      return { error: 'Unknown action' };
    } catch (err) {
      return { error: err.message || 'Request failed' };
    }
  };

  run().then(sendResponse);
  return true;
});