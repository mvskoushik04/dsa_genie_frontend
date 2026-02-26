// Create video container if it doesn't exist
function createVideoContainer() {
  let container = document.getElementById('dsagenie-video-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'dsagenie-video-container';
    container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 400px;
      background: #1e1e1e;
      border: 2px solid #e6b84f;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
      display: none;
    `;
    document.body.appendChild(container);
  }
  return container;
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SHOW_VIDEO') {
    const { videoId, title } = message;
    showVideo(videoId, title);
    sendResponse({ success: true });
  } else if (message.type === 'CLOSE_VIDEO') {
    closeVideo();
    sendResponse({ success: true });
  }
  return true;
});

function showVideo(videoId, problemTitle) {
  const container = createVideoContainer();
  
  // Update container content
  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #2d2d30; border-bottom: 1px solid #3c3c3c;">
      <span style="color: #e6b84f; font-weight: 600; font-size: 14px;">📺 DSAGENIE Tutorial</span>
      <button id="close-video-btn" style="background: none; border: none; color: #888; cursor: pointer; font-size: 16px; padding: 0 4px;">✕</button>
    </div>
    <div style="padding: 12px;">
      <div style="color: #e0e0e0; font-size: 13px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #3c3c3c;">
        ${problemTitle || 'Related Tutorial'}
      </div>
      <iframe
        width="100%"
        height="180"
        src="https://www.youtube.com/embed/${videoId}"
        title="YouTube video player"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
        style="border-radius: 4px; border: none;"
      ></iframe>
    </div>
  `;
  
  container.style.display = 'block';
  
  // Add close button functionality
  document.getElementById('close-video-btn').addEventListener('click', closeVideo);
}

function closeVideo() {
  const container = document.getElementById('dsagenie-video-container');
  if (container) {
    container.style.display = 'none';
    container.innerHTML = ''; // Clear iframe to stop video playback
  }
}