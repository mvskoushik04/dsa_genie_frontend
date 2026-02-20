import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'dsagenieSession';
const BACKEND_MESSAGE = {
  GET_PROBLEM: 'DSAGENIE_GET_PROBLEM',
  EXPLANATION: 'DSAGENIE_EXPLANATION',
  PSEUDOCODE: 'DSAGENIE_PSEUDOCODE',
  CODE: 'DSAGENIE_CODE',
  YOUTUBE: 'DSAGENIE_YOUTUBE',
};

function loadSession() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      resolve(result[STORAGE_KEY] || null);
    });
  });
}

function saveSession(session) {
  chrome.storage.local.set({ [STORAGE_KEY]: session });
}

function clearSession() {
  chrome.storage.local.remove(STORAGE_KEY);
}

export default function App() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [view, setView] = useState('explanation');
  const [language, setLanguage] = useState('cpp');
  const [problemInfo, setProblemInfo] = useState(null);
  const [youtubeVideoId, setYoutubeVideoId] = useState(null);
  const [sessionRestored, setSessionRestored] = useState(false);

  const sendToBackend = useCallback((action, payload = {}) => {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: action, payload }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response?.error) reject(new Error(response.error));
        else resolve(response);
      });
    });
  }, []);

  useEffect(() => {
    loadSession().then((session) => {
      if (session) {
        setContent(session.content ?? '');
        setView(session.view ?? 'explanation');
        setLanguage(session.language ?? 'cpp');
        setYoutubeVideoId(session.youtubeVideoId ?? null);
        setError(session.error ?? null);
      }
      setSessionRestored(true);
    });
  }, []);

  useEffect(() => {
    if (!sessionRestored) return;
    sendToBackend(BACKEND_MESSAGE.GET_PROBLEM)
      .then((res) => setProblemInfo(res?.problemInfo || null))
      .catch(() => setProblemInfo(null));
  }, [sessionRestored, sendToBackend]);

  const persistSession = useCallback((updates) => {
    saveSession({
      content: updates.content !== undefined ? updates.content : content,
      view: updates.view !== undefined ? updates.view : view,
      language: updates.language !== undefined ? updates.language : language,
      youtubeVideoId: updates.youtubeVideoId !== undefined ? updates.youtubeVideoId : youtubeVideoId,
      error: updates.error !== undefined ? updates.error : error,
    });
  }, [content, view, language, youtubeVideoId, error]);

  const loadExplanation = useCallback(() => {
    setView('explanation');
    setError(null);
    setLoading(true);
    sendToBackend(BACKEND_MESSAGE.EXPLANATION, problemInfo || {})
      .then((res) => {
        const text = res?.explanation ?? '';
        setContent(text);
        persistSession({ content: text, view: 'explanation' });
      })
      .catch((e) => {
        const errMsg = e.message || 'Failed to load explanation';
        setError(errMsg);
        persistSession({ error: errMsg });
      })
      .finally(() => setLoading(false));
  }, [problemInfo, sendToBackend, persistSession]);

  const loadPseudocode = useCallback(() => {
    setView('pseudocode');
    setError(null);
    setLoading(true);
    sendToBackend(BACKEND_MESSAGE.PSEUDOCODE, problemInfo || {})
      .then((res) => {
        const text = res?.pseudocode ?? '';
        setContent(text);
        persistSession({ content: text, view: 'pseudocode' });
      })
      .catch((e) => {
        const errMsg = e.message || 'Failed to load pseudocode';
        setError(errMsg);
        persistSession({ error: errMsg });
      })
      .finally(() => setLoading(false));
  }, [problemInfo, sendToBackend, persistSession]);

  const loadCode = useCallback(
    (lang) => {
      setLanguage(lang);
      setView('code');
      setError(null);
      setLoading(true);
      sendToBackend(BACKEND_MESSAGE.CODE, { ...problemInfo, language: lang })
        .then((res) => {
          const text = res?.code ?? '';
          setContent(text);
          persistSession({ content: text, view: 'code', language: lang });
        })
        .catch((e) => {
          const errMsg = e.message || 'Failed to load code';
          setError(errMsg);
          persistSession({ error: errMsg });
        })
        .finally(() => setLoading(false));
    },
    [problemInfo, sendToBackend, persistSession]
  );

  const openYoutube = useCallback(() => {
    setError(null);
    setLoading(true);
    sendToBackend(BACKEND_MESSAGE.YOUTUBE, problemInfo || {})
      .then((res) => {
        console.log('YouTube response:', res);
        const vid = res?.videoId ?? null;
        console.log('Extracted videoId:', vid);
        if (vid) {
          setView('youtube');
          setYoutubeVideoId(vid);
          setContent('');
          persistSession({ view: 'youtube', youtubeVideoId: vid, content: '' });
        } else if (res?.url) {
          console.log('No videoId, opening search URL:', res.url);
          chrome.tabs.create({ url: res.url });
        }
      })
      .catch((e) => {
        const errMsg = e.message || 'Failed to load YouTube';
        console.error('YouTube error:', errMsg);
        setError(errMsg);
        persistSession({ error: errMsg });
      })
      .finally(() => setLoading(false));
  }, [problemInfo, sendToBackend, persistSession]);

  const closeSession = useCallback(() => {
    clearSession();
    setContent('');
    setView('explanation');
    setLanguage('cpp');
    setYoutubeVideoId(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (sessionRestored && problemInfo && view === 'explanation' && !content && !youtubeVideoId && !error) loadExplanation();
  }, [sessionRestored, problemInfo]);

  const showContent = view !== 'youtube' && content;
  const showYoutube = view === 'youtube' && youtubeVideoId;

  return (
    <>
      <header style={styles.header}>
        <h1 style={styles.title}>DSAGENIE</h1>
        <button
          type="button"
          onClick={openYoutube}
          title="Find YouTube video for this problem"
          style={styles.youtubeBtn}
          aria-label="YouTube"
        >
          <YouTubeIcon />
        </button>
      </header>

      <section style={styles.responseArea}>
        {loading && !showContent && !showYoutube && <div style={styles.loading}>Loading...</div>}
        {error && !showContent && !showYoutube && (
          <div style={styles.errorWrap}>
            <p style={styles.error}>{error}</p>
            <button
              type="button"
              onClick={view === 'explanation' ? loadExplanation : view === 'pseudocode' ? loadPseudocode : () => loadCode(language)}
              style={styles.retry}
            >
              Retry
            </button>
          </div>
        )}
        {showYoutube && (
          <div style={styles.embedWrap}>
            <iframe
              title="YouTube"
              src={`https://www.youtube.com/embed/${youtubeVideoId}`}
              style={styles.iframe}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
        {showContent && (
          <pre style={styles.content}>
            {content}
          </pre>
        )}
        {!problemInfo && !loading && !error && !content && !youtubeVideoId && (
          <p style={styles.hint}>Open a LeetCode problem page (e.g. leetcode.com/problems/...) and open this popup again.</p>
        )}
      </section>

      <div style={styles.row}>
        <button type="button" onClick={loadExplanation} style={styles.primaryBtn}>
          <DocIcon /> Explanation
        </button>
        <button type="button" onClick={loadPseudocode} style={styles.primaryBtn}>
          <CodeIcon /> Pseudocode
        </button>
      </div>

      <div style={styles.langRow}>
        <button type="button" onClick={() => loadCode('cpp')} style={styles.langBtn} title="C++" aria-label="C++">
          <CppIcon />
        </button>
        <button type="button" onClick={() => loadCode('java')} style={styles.langBtn} title="Java" aria-label="Java">
          <JavaIcon />
        </button>
        <button type="button" onClick={() => loadCode('python')} style={styles.langBtn} title="Python" aria-label="Python">
          <PythonIcon />
        </button>
      </div>

      <footer style={styles.footer}>
        <button type="button" onClick={closeSession} style={styles.closeBtn}>
          close this session?
        </button>
      </footer>
    </>
  );
}

function YouTubeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"
        fill="#FF0000"
      />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 6, verticalAlign: 'middle' }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2 5 5h-5V4zM8 12h8v2H8v-2zm0 4h8v2H8v-2z" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 6, verticalAlign: 'middle' }}>
      <path d="M8 4l-6 8 6 8 1.5-2.5L5.5 12 9.5 6.5 8 4zm8 0l1.5 2.5L18.5 12 14.5 17.5 16 20l6-8-6-8-1.5 2.5z" />
    </svg>
  );
}

const iconStyle = { display: 'block', margin: '0 auto' };

function CppIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" style={iconStyle} aria-hidden>
      <path d="M10.5 15.97l.41 2.44c-.26.14-.68.27-1.24.39-.57.13-1.24.2-2.01.2-2.21-.04-3.87-.7-4.98-1.96C2.56 15.77 2 14.16 2 12.21c.01-2.15.7-3.95 2.07-5.4C5.32 5.64 6.96 5 8.94 5c.73 0 1.4.07 2.01.2.56.12.98.25 1.24.39l-.58 2.49-.41-2.44c-.19-.02-.39-.03-.61-.03-1.34 0-2.36.44-3.06 1.32-.71.89-1.06 2.06-1.06 3.52 0 1.42.33 2.58 1 3.48.67.9 1.65 1.34 2.93 1.34.23-.01.44-.02.61-.04zM12 15.52c.34.64.78 1.18 1.32 1.63.55.44 1.17.78 1.87 1 .7.23 1.45.34 2.26.34 1.51 0 2.76-.5 3.76-1.5 1-1.01 1.5-2.31 1.5-3.9 0-1.59-.5-2.89-1.5-3.9-1-1-2.25-1.5-3.76-1.5-.81 0-1.56.11-2.26.34-.7.22-1.32.56-1.87 1-.54.45-.98.99-1.32 1.63l1.52 1.52c.37-.62.82-1.15 1.34-1.59.53-.44 1.13-.79 1.8-1.05.67-.27 1.39-.4 2.17-.4 1.12 0 2.05.37 2.79 1.1.74.74 1.11 1.68 1.11 2.83 0 1.15-.37 2.09-1.11 2.83-.74.73-1.67 1.1-2.79 1.1-.78 0-1.5-.13-2.17-.4-.67-.26-1.27-.61-1.8-1.05-.52-.44-.97-.97-1.34-1.59L12 15.52zM19.25 12.75h-1.5v1.5h-1.5v-1.5h-1.5v-1.5h1.5v-1.5h1.5v1.5h1.5v1.5z" />
    </svg>
  );
}

function JavaIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" style={iconStyle} aria-hidden>
      <path d="M8.851 18.56s-.917.534.653.714c1.902.172 2.874.117 4.969-.211 0 0 .552.346 1.321.646-4.699 2.013-10.633-.118-6.943-1.149M8.276 15.933s-1.028.761.542.924c2.032.209 3.636.227 6.413-.308 0 0 .384.389.987.602-5.679 1.661-12.007.17-7.942-1.218M13.116 11.475c1.158 1.333-.304 2.533-.304 2.533s2.939-1.518 1.589-3.418c-1.261-1.772-2.228-2.652 3.007-5.688 0-.001-8.216 2.051-4.292 6.573M19.33 20.504s.679.559-.747.991c-2.712.799-11.288 1.069-14.669.033-1.705-.527.719-.958 1.034-1.062.315-.104.658-.156.658-.156s-.254-.122-.551-.024c-1.238.411-8.277 1.392-6.675-.305 0 0 .691.305 2.098.559 2.712.491 10.401.559 13.369-.156 2.968-.714.683-1.249.683-1.249M9.292 13.21s-4.362 1.036-1.544 1.412c1.189.159 3.561.123 5.77-.062 1.806-.152 3.618-.508 3.618-.508s-.637.322-1.098.508c-4.429 1.787-12.986.734-10.522-.603 0 0 .588.209 2.728-.247M17.116 17.584c4.503-2.34 2.421-4.589.968-4.285-.355.074-.515.138-.515.138s.132-.207.385-.284c2.875-1.011 5.086 2.981-.928 4.728 0-.001.155-.129.09-.297M14.401 0s2.494 2.494-2.365 6.331c-3.896 3.077-.888 4.832-.001 6.836-2.274-2.053-3.943-3.858-2.824-5.539 1.644-2.469 6.197-3.665 5.19-7.628M9.734 23.924c4.322.277 10.959-.154 11.116-2.198 0 0-.302.775-3.572 1.391-3.27.615-8.239.54-10.937.168 0-.001.553.457 3.393.639" />
    </svg>
  );
}

function PythonIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" style={iconStyle} aria-hidden>
      <path d="M14.25.18l.9.2.73.26.59.3.45.32.34.34.25.34.16.33.1.3.04.26.02.2-.01.13V8.5l-.05.63-.13.55-.21.46-.26.38-.31.31-.36.25-.39.19-.42.14-.44.1-.45.06-.44.03-.43-.01-.4-.04-.37-.07-.35-.1-.31-.13-.28-.16-.24-.18-.2-.2-.17-.22-.13-.24-.1-.25-.06-.26-.03-.27.01-.26.04-.25.07-.23.09-.21.11-.19.13-.17.14-.14.15-.12.15-.09.16-.07.15-.04.14-.02H8.83l-.66.05-.59.14-.51.22-.43.27-.36.32-.29.35-.23.37-.17.38-.12.38-.08.37-.04.35-.01.33.03.3.07.28.1.25.12.22.14.2.15.17.15.14.15.12.14.09.13.07.11.04.09.02H.85l-.05-.09-.02-.07V5.94l.03-.16.07-.15.11-.13.15-.1.19-.08.22-.05.26-.02.28.02.26.05.24.08.22.1.2.13.18.15.15.16.13.18.1.2.08.21.05.22.03.23.01.24-.02.25-.04.24-.06.23-.08.21-.1.2-.11.18-.13.16-.14.14-.15.12-.15.09-.16.07-.15.04-.14.02h-.66l-1.27-.05-.3-.06-.28-.1-.25-.13-.22-.16-.19-.19-.16-.21-.13-.23-.1-.25-.06-.26-.03-.28.01-.28.04-.27.07-.25.1-.24.12-.22.14-.2.15-.18.15-.15.14-.12.13-.1.11-.07.09-.05.07-.02.05-.01h2.6l.92.02.76.1.61.17.47.22.35.27.25.3.17.33.1.35.04.35-.01.33-.05.31-.08.28-.1.26-.12.23-.13.2-.13.18-.13.15-.12.13-.1.1-.08.08-.05.06-.02.03-.01V.07l.01-.06.02-.05.03-.04.04-.03.05-.02.06-.01zM21.8 5.94v.09l-.02.07v2.69l.05.16.07.15.11.13.15.1.19.08.22.05.26.02.28-.02.26-.05.24-.08.22-.1.2-.13.18-.15.15-.16.13-.18.1-.2.08-.21.05-.22.03-.23.01-.24-.02-.25-.04-.24-.06-.23-.08-.21-.1-.2-.11-.18-.13-.16-.14-.14-.15-.12-.15-.09-.16-.07-.15-.04-.14-.02h-.66l-1.27-.05-.3-.06-.28-.1-.25-.13-.22-.16-.19-.19-.16-.21-.13-.23-.1-.25-.06-.26-.03-.28.01-.28.04-.27.07-.25.1-.24.12-.22.14-.2.15-.18.15-.15.14-.12.13-.1.11-.07.09-.05.07-.02.05-.01h2.6l.05.01.06.02.05.03.04.04.03.05.02.06.01.07z" />
    </svg>
  );
}

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
    color: '#e6b84f',
    letterSpacing: '0.02em',
  },
  youtubeBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  responseArea: {
    flex: 1,
    minHeight: 180,
    background: '#252526',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    overflow: 'auto',
  },
  loading: {
    color: '#888',
  },
  errorWrap: {
    textAlign: 'center',
    padding: 12,
  },
  error: {
    color: '#f14c4c',
    margin: '0 0 10px 0',
  },
  retry: {
    background: '#c52828',
    color: '#fff',
    border: 'none',
    padding: '8px 16px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
  },
  embedWrap: {
    position: 'relative',
    width: '100%',
    paddingBottom: '56.25%',
    height: 0,
    overflow: 'hidden',
    borderRadius: 6,
  },
  iframe: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    border: 'none',
  },
  content: {
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontSize: 12,
    lineHeight: 1.5,
    fontFamily: 'ui-monospace, monospace',
  },
  hint: {
    color: '#888',
    margin: 0,
    fontSize: 12,
  },
  row: {
    display: 'flex',
    gap: 8,
    marginBottom: 10,
  },
  primaryBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 12px',
    background: '#2d2d30',
    color: '#e0e0e0',
    border: '1px solid #3c3c3c',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
  },
  langRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 12,
  },
  langBtn: {
    flex: 1,
    padding: '8px 12px',
    background: '#2d2d30',
    color: '#e0e0e0',
    border: '1px solid #3c3c3c',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
  },
  footer: {
    textAlign: 'center',
    fontSize: 11,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#666',
    cursor: 'pointer',
    padding: 4,
    fontSize: 11,
  },
};