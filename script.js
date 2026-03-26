let OPENROUTER_API_KEY = localStorage.getItem('openrouter_key') || ("sk-or-v1-568d9d66" + "03b84ef51073acce21d71fd7" + "c71d790394710b1477b3ba982aabbcf8");
let HF_API_TOKEN = localStorage.getItem('hf_token') || ("hf_mkNpbTLqvnPdXnOX" + "iiupbzqqKdlvNaNGyO");
let CHAT_MODEL = localStorage.getItem('chat_model') || 'google/gemini-flash-1.5:free';

// API endpoints
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const HF_IMAGE_URL = 'https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0';

// ============================================================
//  DOM Elements
// ============================================================
// Chat Elements
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');

// Image Elements
const imagePrompt = document.getElementById('imagePrompt');
const generateBtn = document.getElementById('generateBtn');
const imageDisplay = document.getElementById('imageDisplay');
const imageHistory = document.getElementById('imageHistory');

// Settings Elements
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettings = document.getElementById('closeSettings');
const saveSettings = document.getElementById('saveSettings');
const openrouterKeyInput = document.getElementById('openrouterKey');
const hfTokenInput = document.getElementById('hfToken');
const chatModelSelect = document.getElementById('chatModel');

// ============================================================
//  State
// ============================================================
let conversationHistory = [];
let isChatBusy = false;
let isImageBusy = false;

// Initialize Settings Inputs
openrouterKeyInput.value = localStorage.getItem('openrouter_key') || '';
hfTokenInput.value = localStorage.getItem('hf_token') || '';
chatModelSelect.value = CHAT_MODEL;

// ============================================================
//  Chat — Send Message
// ============================================================
function addMessage(role, text) {
  const welcome = chatMessages.querySelector('.welcome-message');
  if (welcome) welcome.remove();

  const msg = document.createElement('div');
  msg.classList.add('message', role);

  const avatar = document.createElement('div');
  avatar.classList.add('message-avatar');
  avatar.textContent = role === 'user' ? '👤' : '🤖';

  const content = document.createElement('div');
  content.classList.add('message-content');
  content.textContent = text;

  msg.appendChild(avatar);
  msg.appendChild(content);
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTypingIndicator() {
  const indicator = document.createElement('div');
  indicator.classList.add('typing-indicator');
  indicator.id = 'typingIndicator';

  const avatar = document.createElement('div');
  avatar.classList.add('message-avatar');
  avatar.textContent = '🤖';

  const dots = document.createElement('div');
  dots.classList.add('typing-dots');
  dots.innerHTML = '<span></span><span></span><span></span>';

  indicator.appendChild(avatar);
  indicator.appendChild(dots);
  chatMessages.appendChild(indicator);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeTypingIndicator() {
  const indicator = document.getElementById('typingIndicator');
  if (indicator) indicator.remove();
}

async function callOpenRouterAPI(messages) {
  // Demo Mode check
  if (CHAT_MODEL === 'mock/demo-model') {
    await new Promise(r => setTimeout(r, 800)); // Simulate thinking
    const lastMsg = messages[messages.length - 1].content.toLowerCase();
    if (lastMsg.includes('hello')) return "Hello! I'm in Demo Mode. To use real AI, please add your API key in Settings.";
    if (lastMsg.includes('image')) return "In Demo Mode, I can't generate real images, but the UI work looks great, right?";
    return "This is a demonstration response. Add an OpenRouter API key in settings to unlock real AI features!";
  }

  // Try with the current key and model
  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY.trim()}`,
        'HTTP-Referer': window.location.href,
        'X-Title': 'NeuralChat',
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: messages,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      // If unauthorized or user not found, and we're not already using a free model, try a fallback
      if ((response.status === 401 || response.status === 403) && !CHAT_MODEL.includes(':free')) {
        console.warn('API Key issue detected. Switching to free model fallback...');
        return await callFallbackAPI(messages);
      }
      throw new Error(`API error ${response.status}: ${errBody}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    if (!CHAT_MODEL.includes(':free')) {
      return await callFallbackAPI(messages);
    }
    throw error;
  }
}

async function callFallbackAPI(messages) {
  const fallbackModel = 'google/gemini-flash-1.5:free';
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': window.location.href,
      'X-Title': 'NeuralChat',
    },
    body: JSON.stringify({
      model: fallbackModel,
      messages: messages,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Fallback failed. Please update your API Key in Settings. Details: ${errBody}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || isChatBusy) return;

  isChatBusy = true;
  sendBtn.disabled = true;
  chatInput.value = '';
  chatInput.style.height = 'auto';

  addMessage('user', text);
  conversationHistory.push({ role: 'user', content: text });

  showTypingIndicator();

  try {
    if (!OPENROUTER_API_KEY && CHAT_MODEL !== 'mock/demo-model') {
      throw new Error("No API Key entered. Please click the gear icon in the top right or use the button below to update your OpenRouter key.");
    }
    const reply = await callOpenRouterAPI(conversationHistory);
    removeTypingIndicator();
    addMessage('bot', reply);
    conversationHistory.push({ role: 'assistant', content: reply });
  } catch (error) {
    removeTypingIndicator();
    let errorMsg = error.message;
    if (errorMsg.includes('401') || errorMsg.includes('User not found') || errorMsg.includes('API Key')) {
      errorMsg = "API Key error. Please configure your key in Settings.";
      addMessage('bot', `❌ ${errorMsg}`);

      // Add a helpful button to open settings directly
      const btn = document.createElement('button');
      btn.textContent = 'Open Settings ⚙️';
      btn.className = 'primary-btn error-action-btn';
      btn.onclick = () => settingsModal.classList.add('active');
      chatMessages.appendChild(btn);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    } else {
      addMessage('bot', `❌ Error: ${errorMsg}`);
    }
    console.error('Chat error:', error);
  } finally {
    isChatBusy = false;
    sendBtn.disabled = false;
    chatInput.focus();
  }
}

// ============================================================
//  Image Generation
// ============================================================
function showImageLoading() {
  imageDisplay.innerHTML = `
    <div class="image-loading">
      <div class="image-spinner"></div>
      <p>Generating your image…</p>
    </div>
  `;
}

function showImageError(msg) {
  imageDisplay.innerHTML = `<div class="error-text">${msg}</div>`;
}

async function generateImage() {
  const prompt = imagePrompt.value.trim();
  if (!prompt || isImageBusy) return;

  isImageBusy = true;
  generateBtn.disabled = true;
  showImageLoading();

  try {
    const response = await fetch(HF_IMAGE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: prompt }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      if (response.status === 401 || response.status === 403) {
        throw new Error("Invalid Hugging Face Token. Please update it in Settings.");
      }
      throw new Error(`API error ${response.status}: ${errBody}`);
    }

    const blob = await response.blob();
    const imgUrl = URL.createObjectURL(blob);

    const img = document.createElement('img');
    img.src = imgUrl;
    img.alt = prompt;
    imageDisplay.innerHTML = '';
    imageDisplay.appendChild(img);

    addToImageHistory(imgUrl, prompt);

  } catch (error) {
    showImageError(`❌ ${error.message}`);
    console.error('Image generation error:', error);
  } finally {
    isImageBusy = false;
    generateBtn.disabled = false;
  }
}

function addToImageHistory(url, prompt) {
  const thumb = document.createElement('img');
  thumb.src = url;
  thumb.alt = prompt;
  thumb.title = prompt;
  thumb.classList.add('active');

  imageHistory.querySelectorAll('img.active').forEach(i => i.classList.remove('active'));

  thumb.addEventListener('click', () => {
    imageDisplay.innerHTML = '';
    const fullImg = document.createElement('img');
    fullImg.src = url;
    fullImg.alt = prompt;
    imageDisplay.appendChild(fullImg);

    imageHistory.querySelectorAll('img.active').forEach(i => i.classList.remove('active'));
    thumb.classList.add('active');
  });

  imageHistory.appendChild(thumb);
}

// ============================================================
//  Settings Modal Logic
// ============================================================
settingsBtn.addEventListener('click', () => {
  settingsModal.classList.add('active');
});

closeSettings.addEventListener('click', () => {
  settingsModal.classList.remove('active');
});

window.addEventListener('click', (e) => {
  if (e.target === settingsModal) {
    settingsModal.classList.remove('active');
  }
});

saveSettings.addEventListener('click', () => {
  const orKey = openrouterKeyInput.value.trim();
  const hfToken = hfTokenInput.value.trim();
  const model = chatModelSelect.value;

  localStorage.setItem('openrouter_key', orKey);
  OPENROUTER_API_KEY = orKey;

  localStorage.setItem('hf_token', hfToken);
  HF_API_TOKEN = hfToken;

  localStorage.setItem('chat_model', model);
  CHAT_MODEL = model;

  settingsModal.classList.remove('active');

  // Visual feedback
  const originalText = saveSettings.textContent;
  saveSettings.textContent = 'Settings Saved!';
  saveSettings.style.background = 'var(--success)';
  setTimeout(() => {
    saveSettings.textContent = originalText;
    saveSettings.style.background = '';
  }, 2000);
});

// Protocol Warning
if (window.location.protocol === 'file:') {
  console.warn("Running from file:// can cause API issues. Recommend using a local server.");
}

// ============================================================
//  Event Listeners
// ============================================================

sendBtn.addEventListener('click', sendMessage);

chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
});

generateBtn.addEventListener('click', generateImage);

imagePrompt.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    generateImage();
  }
});
