import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'dsagenieSession';
const BACKEND_MESSAGE = {
  GET_PROBLEM: 'DSAGENIE_GET_PROBLEM',
  EXPLANATION: 'DSAGENIE_EXPLANATION',
  PSEUDOCODE: 'DSAGENIE_PSEUDOCODE',
  CODE: 'DSAGENIE_CODE',
  YOUTUBE: 'DSAGENIE_YOUTUBE'
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
  const [sessionRestored, setSessionRestored] = useState(false);
  const [videoId, setVideoId] = useState(null);

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
        setError(session.error ?? null);
        setVideoId(session.videoId ?? null);
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
      videoId: updates.videoId !== undefined ? updates.videoId : videoId,
      error: updates.error !== undefined ? updates.error : error,
    });
  }, [content, view, language, videoId, error]);

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

  const loadVideo = useCallback(() => {
    if (!problemInfo) return;

    setLoading(true);
    setError(null);

    // First, get the video ID from backend
    sendToBackend(BACKEND_MESSAGE.YOUTUBE, problemInfo)
      .then((res) => {
        const id = res?.videoId || null;
        if (!id) {
          setError('No video found for this problem');
          setLoading(false);
          return;
        }
        
        setVideoId(id);
        persistSession({ videoId: id });
        
        // Function to attempt sending message with retries
        const sendMessageWithRetry = (tabId, retries = 5, delay = 300) => {
          return new Promise((resolve, reject) => {
            const attempt = (attemptCount) => {
              chrome.tabs.sendMessage(tabId, {
                type: 'SHOW_VIDEO',
                videoId: id,
                title: problemInfo.title || problemInfo.problemSlug
              }, (response) => {
                if (chrome.runtime.lastError) {
                  console.log(`Attempt ${attemptCount} failed:`, chrome.runtime.lastError);
                  
                  if (attemptCount < retries) {
                    // Retry with exponential backoff
                    setTimeout(() => attempt(attemptCount + 1), delay * Math.pow(1.5, attemptCount - 1));
                  } else {
                    // All retries failed, try injecting the script
                    injectAndSend(tabId);
                  }
                } else {
                  resolve(response);
                }
              });
            };
            
            attempt(1);
          });
        };
        
        // Function to inject script if content script isn't loaded
        const injectAndSend = (tabId) => {
          chrome.scripting.executeScript({
            target: { tabId },
            files: ['content.js']
          }).then(() => {
            chrome.scripting.insertCSS({
              target: { tabId },
              files: ['content.css']
            }).then(() => {
              // Wait a moment for scripts to initialize
              setTimeout(() => {
                chrome.tabs.sendMessage(tabId, {
                  type: 'SHOW_VIDEO',
                  videoId: id,
                  title: problemInfo.title || problemInfo.problemSlug
                }, (finalResponse) => {
                  if (chrome.runtime.lastError) {
                    setError('Could not load video player. Please refresh the page and try again.');
                  } else {
                    window.close();
                  }
                  setLoading(false);
                });
              }, 200);
            });
          }).catch((err) => {
            setError('Could not inject video player. Please refresh the page.');
            setLoading(false);
          });
        };
        
        // Get the active tab and try to send message
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (!tabs[0]?.id) {
            setError('Could not find active tab');
            setLoading(false);
            return;
          }
          
          sendMessageWithRetry(tabs[0].id)
            .then(() => {
              window.close();
              setLoading(false);
            })
            .catch(() => {
              // Error already handled in retry logic
              setLoading(false);
            });
        });
      })
      .catch((e) => {
        setError(e.message || 'Failed to load video');
        setLoading(false);
      });
  }, [problemInfo, sendToBackend, persistSession]);

  const closeSession = useCallback(() => {
    clearSession();
    setContent('');
    setView('explanation');
    setLanguage('cpp');
    setError(null);
    setVideoId(null);
  }, []);

  useEffect(() => {
    if (sessionRestored && problemInfo && view === 'explanation' && !content && !error) loadExplanation();
  }, [sessionRestored, problemInfo]);

  const showContent = !!content;

  return (
    <>
      <header style={styles.header}>
        <h1 style={styles.title}>DSAGENIE</h1>
        <button 
          type="button" 
          onClick={loadVideo} 
          style={styles.youtubeBtn}
          title="Show tutorial video"
          disabled={!problemInfo || loading}
        >
          <YoutubeIcon />
        </button>
      </header>

      <section style={styles.responseArea}>
        {loading && !showContent && <div style={styles.loading}>Loading...</div>}
        
        {error && !showContent && (
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
        
        {showContent && (
          <pre style={styles.content}>
            {content}
          </pre>
        )}
        
        {!problemInfo && !loading && !error && !content && (
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

function YoutubeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="#FF0000">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

const iconStyle = { display: 'block', margin: '0 auto', width: '22px', height: '22px' };

function CppIcon() {
  return (
    <img 
      src="https://img.icons8.com/?size=100&id=40669&format=png&color=000000" 
      alt="C++" 
      style={iconStyle}
      aria-hidden="true"
    />
  );
}

function JavaIcon() {
  return (
    <img 
      src="https://img.icons8.com/?size=100&id=13679&format=png&color=000000" 
      alt="Java" 
      style={iconStyle}
      aria-hidden="true"
    />
  );
}

function PythonIcon() {
  return (
    <img 
      src="https://img.icons8.com/?size=100&id=13441&format=png&color=000000" 
      alt="Python" 
      style={iconStyle}
      aria-hidden="true"
    />
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
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 1,
    ':disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
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