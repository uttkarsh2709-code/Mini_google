const API_BASE = window.__MINI_GOOGLE_API__ || (
    window.location.port === '8080' || window.location.protocol === 'file:'
        ? 'http://127.0.0.1:8000'
        : ''
);

console.log('🚀 Mini Google AI Loading...');
console.log('📡 API Base:', API_BASE);

// Define login modal functions globally FIRST
window.openLoginModal = function() {
    console.log('🔓 openLoginModal called');
    const loginModalOverlay = document.getElementById('login-modal-overlay');
    if (loginModalOverlay) {
        console.log('✅ Modal found, opening...');
        loginModalOverlay.classList.add('show');
        loginModalOverlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        setTimeout(() => {
            const emailInput = document.querySelector('.email-input');
            if (emailInput) emailInput.focus();
        }, 150);
    } else {
        console.error('❌ Login modal overlay not found!');
    }
};

window.closeLoginModalFunc = function() {
    console.log('🔒 Closing login modal');
    const loginModalOverlay = document.getElementById('login-modal-overlay');
    if (loginModalOverlay) {
        loginModalOverlay.classList.remove('show');
        loginModalOverlay.style.display = 'none';
        document.body.style.overflow = '';
        console.log('✅ Modal closed');
    } else {
        console.error('❌ Modal not found');
    }
};

window.openLoginFromWelcome = function() {
    console.log('📱 Opening login from welcome modal');
    // Close welcome modal first
    const welcomeModalOverlay = document.getElementById('welcome-modal-overlay');
    if (welcomeModalOverlay) {
        welcomeModalOverlay.classList.remove('show');
    }
    // Open login modal
    window.openLoginModal();
};

window.toggleHelpDropdown = function(event) {
    console.log('❓ Help button clicked');
    if (event) event.stopPropagation();
    const helpDropdown = document.getElementById('help-dropdown');
    const attachDropdown = document.getElementById('attach-dropdown');
    
    if (helpDropdown) {
        const isVisible = helpDropdown.classList.contains('show');
        console.log('Current state:', isVisible ? 'visible' : 'hidden');
        
        // Close attach dropdown if open
        if (attachDropdown) attachDropdown.classList.remove('show');
        
        // Toggle help dropdown
        helpDropdown.classList.toggle('show');
        console.log('New state:', helpDropdown.classList.contains('show') ? 'visible' : 'hidden');
    } else {
        console.error('❌ Help dropdown not found');
    }
};

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
    const helpDropdown = document.getElementById('help-dropdown');
    const attachDropdown = document.getElementById('attach-dropdown');
    const helpBtn = document.getElementById('help-btn');
    const attachBtn = document.getElementById('attach-btn');
    
    if (helpDropdown && !helpBtn?.contains(e.target) && !helpDropdown.contains(e.target)) {
        helpDropdown.classList.remove('show');
    }
    if (attachDropdown && !attachBtn?.contains(e.target) && !attachDropdown.contains(e.target)) {
        attachDropdown.classList.remove('show');
    }
});

// Close modals with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const loginModal = document.getElementById('login-modal-overlay');
        const settingsModal = document.getElementById('settings-modal-overlay');
        const reportModal = document.getElementById('report-modal-overlay');
        
        if (loginModal?.classList.contains('show')) {
            window.closeLoginModalFunc();
        } else if (settingsModal?.classList.contains('show')) {
            window.closeSettingsModal();
        } else if (reportModal?.classList.contains('show')) {
            window.closeReportModal();
        }
    }
});

let isAuthModeSignup = false;

window.toggleAuthMode = function() {
    isAuthModeSignup = !isAuthModeSignup;
    const modalTitle = document.getElementById('auth-modal-title');
    const submitBtn = document.getElementById('auth-submit-btn');
    const switchText = document.getElementById('auth-switch-text');
    const switchLink = document.getElementById('auth-switch-link');
    
    if (isAuthModeSignup) {
        modalTitle.textContent = "Create account";
        submitBtn.textContent = "Sign Up";
        switchText.textContent = "Already have an account? ";
        switchLink.textContent = "Log in";
    } else {
        modalTitle.textContent = "Log in";
        submitBtn.textContent = "Log In";
        switchText.textContent = "Don't have an account? ";
        switchLink.textContent = "Create account";
    }
};

window.handleAuthSubmit = async function() {
    console.log('🔐 Auth submit triggered');
    const emailInput = document.getElementById('auth-email');
    const passwordInput = document.getElementById('auth-password');
    const msgLabel = document.getElementById('auth-message');
    const btn = document.getElementById('auth-submit-btn');
    
    const email = emailInput.value;
    const password = passwordInput.value;
    
    if (!email || !password) {
        msgLabel.textContent = "Please enter both email and password.";
        msgLabel.style.display = "block";
        return;
    }

    msgLabel.style.display = "none";
    btn.disabled = true;
    btn.textContent = "Processing...";

    const endpoint = isAuthModeSignup ? '/auth/signup' : '/auth/login';

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('user_email', email);
            showNotification(isAuthModeSignup 
                ? 'Account created! Welcome email sent.' 
                : `Welcome back, ${email}!`, 'success');
            window.closeLoginModalFunc();
            updateUIForLoggedInUser(email);
        } else {
            msgLabel.textContent = data.detail || "Authentication failed";
            msgLabel.style.display = "block";
        }
        
    } catch (e) {
        console.error(e);
        msgLabel.textContent = "Connection error. Is backend running?";
        msgLabel.style.display = "block";
    } finally {
        btn.disabled = false;
        btn.textContent = isAuthModeSignup ? "Sign Up" : "Log In";
    }
};

function updateUIForLoggedInUser(email) {
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        // Create Avatar
        const initial = email.charAt(0).toUpperCase();
        loginBtn.innerHTML = `<button class="user-avatar" title="${email}">${initial}</button>`;
        loginBtn.className = ""; // Remove previous classes like 'header-btn'
        loginBtn.style.background = "none";
        loginBtn.style.border = "none";
        loginBtn.style.padding = "0";
        loginBtn.onclick = () => {
             const doLogout = confirm(`Logged in as ${email}.\nDo you want to log out?`);
             if(doLogout) {
                 localStorage.removeItem('user_email');
                 window.location.reload();
             }
        };
    }
    loadHistoryFromBackend();
}

// Check login status on load
document.addEventListener('DOMContentLoaded', () => {
    const email = localStorage.getItem('user_email');
    if (email) {
        updateUIForLoggedInUser(email);
    }
});

window.handleHelpAction = function(action) {
    console.log('📋 Help action:', action);
    const helpDropdown = document.getElementById('help-dropdown');
    if (helpDropdown) helpDropdown.classList.remove('show');
    
    switch(action) {
        case 'pricing':
            showNotification('💎 Pricing: Free tier available! Pro features: $20/month for unlimited AI chat, image analysis, and priority support.', 'info');
            break;
        case 'help':
            showNotification('📚 Help: Press / to focus search, Ctrl+L for shortcuts, Escape to clear. More help docs coming soon!', 'info');
            break;
        case 'release':
            showNotification('🎉 v1.0 Release: AI chat with Gemini 2.0, Image upload support, Dark theme, Keyboard shortcuts, and more!', 'success');
            break;
        case 'terms':
            showNotification('📜 Terms: Free to use for personal projects. AI responses powered by Gemini. No data collection. Open source project.', 'info');
            break;
        default:
            showNotification('Feature coming soon!', 'info');
    }
};

window.openSettingsFromHelp = function() {
    console.log('⚙️ Opening settings from help menu');
    const helpDropdown = document.getElementById('help-dropdown');
    const settingsModal = document.getElementById('settings-modal-overlay');
    if (helpDropdown) helpDropdown.classList.remove('show');
    if (settingsModal) settingsModal.classList.add('show');
};

window.openReportFromHelp = function() {
    console.log('📝 Opening report from help menu');
    const helpDropdown = document.getElementById('help-dropdown');
    const reportModal = document.getElementById('report-modal-overlay');
    if (helpDropdown) helpDropdown.classList.remove('show');
    if (reportModal) reportModal.classList.add('show');
};

window.closeSettingsModal = function() {
    console.log('⚙️ Closing settings modal');
    const settingsModal = document.getElementById('settings-modal-overlay');
    if (settingsModal) {
        settingsModal.classList.remove('show');
        console.log('✅ Settings modal closed');
    }
};

window.closeReportModal = function() {
    console.log('📝 Closing report modal');
    const reportModal = document.getElementById('report-modal-overlay');
    if (reportModal) {
        reportModal.classList.remove('show');
        console.log('✅ Report modal closed');
    }
};

// Browser Data
let bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
let history = JSON.parse(localStorage.getItem('history') || '[]');
let settings = JSON.parse(localStorage.getItem('settings') || '{"darkMode": true, "resultsLimit": 10}');

// Check if user has visited before
const hasVisited = localStorage.getItem('hasVisited');

const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-query");
const resultsContainer = document.getElementById("results-container");
const settingsBtn = document.getElementById("settings-btn");
const helpBtn = document.getElementById("help-btn");
const heroSection = document.getElementById("hero-section");
const voiceSubmitBtn = document.getElementById('voice-submit-btn');
const searchModeBtn = document.getElementById('search-mode-btn');
const aiModeBtn = document.getElementById('ai-mode-btn');
let isSearchPerformed = false;
let currentMode = 'ai'; // 'search' or 'ai' - default to AI mode
let conversationHistory = [];
let uploadedImage = null; // Store uploaded image data
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let recognition = null;
let isGenerating = false;
let abortController = null;

// Debug helper - call window.checkImage() in console to see status
window.checkImage = function() {
    console.log('=== IMAGE STATUS ===');
    console.log('uploadedImage exists:', uploadedImage ? 'YES' : 'NO');
    if (uploadedImage) {
        console.log('Image size:', Math.round(uploadedImage.length / 1024), 'KB');
        console.log('First 50 chars:', uploadedImage.substring(0, 50));
    }
    console.log('==================');
    return uploadedImage;
};

// Debug helper - force send image test
window.testSendImage = function() {
    console.log('=== FORCE SEND IMAGE TEST ===');
    if (uploadedImage) {
        console.log('Image exists, sending test request...');
        chatWithAI('Describe this image in detail').then(response => {
            console.log('Response:', response);
        }).catch(error => {
            console.error('Error:', error);
        });
    } else {
        console.log('❌ No image uploaded!');
    }
};

// Mode toggle functionality
if (searchModeBtn && aiModeBtn) {
    searchModeBtn.addEventListener('click', () => {
        currentMode = 'search';
        searchModeBtn.classList.add('active');
        aiModeBtn.classList.remove('active');
        searchInput.placeholder = 'Search the web...';
        conversationHistory = []; // Clear conversation when switching modes
        clearSearch();
    });
    
    aiModeBtn.addEventListener('click', () => {
        currentMode = 'ai';
        aiModeBtn.classList.add('active');
        searchModeBtn.classList.remove('active');
        searchInput.placeholder = 'Message Mini Google AI...';
        clearSearch();
    });
    
    // Set AI mode as active by default
    aiModeBtn.classList.add('active');
    searchModeBtn.classList.remove('active');
    searchInput.placeholder = 'Message Mini Google AI...';
}

// Initialize Web Speech API
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    
    recognition.onstart = function() {
        console.log('🎤 Speech recognition started');
        isRecording = true;
        voiceSubmitBtn.classList.add('recording');
        showNotification('🎤 Listening... Speak now', 'info');
    };
    
    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        console.log('📝 Transcript:', transcript);
        searchInput.value = transcript;
        searchInput.dispatchEvent(new Event('input'));
        showNotification('✅ Voice captured: "' + transcript + '"', 'success');
        // Auto-submit after capture
        setTimeout(() => {
            if (currentMode === 'ai') {
                handleAIChat(transcript);
            } else {
                searchForm.dispatchEvent(new Event('submit'));
            }
        }, 500);
    };
    
    recognition.onerror = function(event) {
        console.error('❌ Speech recognition error:', event.error);
        isRecording = false;
        voiceSubmitBtn.classList.remove('recording');
        if (event.error === 'no-speech') {
            showNotification('❌ No speech detected. Please try again.', 'error');
        } else if (event.error === 'not-allowed') {
            showNotification('❌ Microphone access denied. Please enable it in browser settings.', 'error');
        } else {
            showNotification('❌ Speech recognition error: ' + event.error, 'error');
        }
    };
    
    recognition.onend = function() {
        console.log('🎤 Speech recognition ended');
        isRecording = false;
        voiceSubmitBtn.classList.remove('recording');
        // Reset button state after recording ends
        updateButtonState();
    };
}

// Toggle voice/submit/stop button based on input and generation state
if (searchInput && voiceSubmitBtn) {
    searchInput.addEventListener('input', () => {
        updateButtonState();
    });
    
    // Handle button click for voice, submit, or stop
    voiceSubmitBtn.addEventListener('click', async (e) => {
        // Stop generation if currently generating
        if (isGenerating) {
            e.preventDefault();
            stopGeneration();
            return;
        }
        
        if (voiceSubmitBtn.classList.contains('has-input')) {
            // Let the form submit naturally
            console.log('Submit button clicked - form will submit');
        } else {
            // Voice input mode
            e.preventDefault();
            
            if (isRecording) {
                // Stop recording
                if (recognition) {
                    recognition.stop();
                }
                if (mediaRecorder && mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();
                }
                return;
            }
            
            // Start voice recording
            console.log('🎤 Starting voice input...');
            
            // Try Web Speech API first (works best for Chrome)
            if (recognition) {
                try {
                    recognition.start();
                } catch (error) {
                    console.error('Recognition start error:', error);
                    showNotification('❌ Voice recognition not available. Please check microphone permissions.', 'error');
                }
            } else {
                // Fallback: Use MediaRecorder API
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    audioChunks = [];
                    mediaRecorder = new MediaRecorder(stream);
                    
                    mediaRecorder.ondataavailable = (event) => {
                        audioChunks.push(event.data);
                    };
                    
                    mediaRecorder.onstop = async () => {
                        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                        console.log('🎵 Audio recorded:', audioBlob.size, 'bytes');
                        
                        // Convert to base64 and send to API for transcription
                        const reader = new FileReader();
                        reader.onloadend = async () => {
                            const base64Audio = reader.result.split(',')[1];
                            try {
                                showNotification('🔄 Converting speech to text...', 'info');
                                const transcription = await transcribeAudio(base64Audio);
                                searchInput.value = transcription;
                                searchInput.dispatchEvent(new Event('input'));
                                showNotification('✅ Voice captured: "' + transcription + '"', 'success');
                                // Auto-submit
                                setTimeout(() => {
                                    if (currentMode === 'ai') {
                                        handleAIChat(transcription);
                                    } else {
                                        searchForm.dispatchEvent(new Event('submit'));
                                    }
                                }, 500);
                            } catch (error) {
                                console.error('Transcription error:', error);
                                showNotification('❌ Failed to convert speech to text', 'error');
                            }
                        };
                        reader.readAsDataURL(audioBlob);
                        
                        // Stop all tracks
                        stream.getTracks().forEach(track => track.stop());
                        isRecording = false;
                        voiceSubmitBtn.classList.remove('recording');
                    };
                    
                    mediaRecorder.start();
                    isRecording = true;
                    voiceSubmitBtn.classList.add('recording');
                    showNotification('🎤 Recording... Click again to stop', 'info');
                    
                    // Auto-stop after 10 seconds
                    setTimeout(() => {
                        if (mediaRecorder && mediaRecorder.state === 'recording') {
                            mediaRecorder.stop();
                        }
                    }, 10000);
                } catch (error) {
                    console.error('Microphone access error:', error);
                    showNotification('❌ Microphone access denied. Please enable microphone permissions in your browser.', 'error');
                }
            }
        }
    });
} else {
    if (!searchInput) console.error('Search input not found!');
    if (!voiceSubmitBtn) console.error('Voice/Submit button not found!');
}

// Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl+L or /: Focus search bar
    if ((e.ctrlKey && e.key === 'l') || e.key === '/') {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
    }
    
    // Ctrl+K: Open command palette (settings)
    if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        const settingsModal = document.getElementById('settings-modal-overlay');
        if (settingsModal) settingsModal.classList.add('show');
    }
    
    // Ctrl+Shift+N: New conversation
    if (e.ctrlKey && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        clearSearch();
        showNotification('🆕 New conversation started', 'success');
    }
    
    // Ctrl+Shift+S: Stop generation
    if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        if (isGenerating) {
            stopGeneration();
        }
    }
    
    // Ctrl+Enter: Submit query
    if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        if (searchInput.value.trim()) {
            searchForm.requestSubmit();
        }
    }
    
    // Escape: Clear search and return to home
    if (e.key === 'Escape') {
        e.preventDefault();
        clearSearch();
        closeAllPanels();
        const attachDropdown = document.getElementById('attach-dropdown');
        const helpDropdown = document.getElementById('help-dropdown');
        const settingsModal = document.getElementById('settings-modal-overlay');
        const reportModal = document.getElementById('report-modal-overlay');
        const loginModal = document.getElementById('login-modal-overlay');
        const welcomeModal = document.getElementById('welcome-modal-overlay');
        if (attachDropdown) attachDropdown.classList.remove('show');
        if (helpDropdown) helpDropdown.classList.remove('show');
        if (settingsModal) settingsModal.classList.remove('show');
        if (reportModal) reportModal.classList.remove('show');
        if (loginModal) loginModal.classList.remove('show');
        if (welcomeModal) welcomeModal.classList.remove('show');
    }
});

// Panel Management
function togglePanel(panelId) {
    const panel = document.getElementById(panelId);
    const allPanels = document.querySelectorAll('.side-panel');
    
    allPanels.forEach(p => {
        if (p.id !== panelId) p.hidden = true;
    });
    
    panel.hidden = !panel.hidden;
    
    if (!panel.hidden) {
        if (panelId === 'bookmarks-panel') renderBookmarks();
        if (panelId === 'history-panel') renderHistory();
    }
}

function closePanel(panelId) {
    document.getElementById(panelId).hidden = true;
}

// Bookmarks Management
function addBookmark(url, title) {
    if (bookmarks.some(b => b.url === url)) {
        alert('Already bookmarked!');
        return;
    }
    bookmarks.unshift({ url, title, timestamp: Date.now() });
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
    alert('Bookmark added!');
}

function renderBookmarks() {
    const list = document.getElementById('bookmarks-list');
    if (bookmarks.length === 0) {
        list.innerHTML = '<p style="color: rgba(255,204,188,0.6); text-align: center; padding: 2rem;">No bookmarks yet</p>';
        return;
    }
    
    list.innerHTML = bookmarks.map((b, i) => `
        <div class="bookmark-item" onclick="openBookmark('${b.url.replace(/'/g, "\\'")}')">
            <div class="title">${b.title}</div>
            <div class="url">${b.url}</div>
        </div>
    `).join('');
}

function openBookmark(url) {
    window.open(url, '_blank');
    closePanel('bookmarks-panel');
}

// History Management
function addToHistory(query, url, title) {
    const item = { query, url, title, timestamp: Date.now() };
    history.unshift(item);
    if (history.length > 100) history = history.slice(0, 100);
    localStorage.setItem('history', JSON.stringify(history));
    saveHistoryEvent({ event_type: 'search', query, url, title });
}

async function saveHistoryEvent(event) {
    const email = localStorage.getItem('user_email');
    if (!email) return;
    try {
        await fetch(`${API_BASE}/history`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...event, email })
        });
    } catch (error) {
        console.warn('Backend history save unavailable; local history retained.', error);
    }
}

async function loadHistoryFromBackend() {
    const email = localStorage.getItem('user_email');
    if (!email) return;
    try {
        const response = await fetch(`${API_BASE}/history?email=${encodeURIComponent(email)}&limit=100`);
        if (!response.ok) return;
        const data = await response.json();
        history = data.items.filter(item => item.event_type === 'search').map(item => ({
            query: item.query,
            title: item.title || item.query,
            url: item.url || '',
            timestamp: Date.parse(item.created_at) || Date.now()
        }));
        localStorage.setItem('history', JSON.stringify(history));
        renderHistory();
    } catch (error) {
        console.warn('Could not load backend history; using local history.', error);
    }
}

function renderHistory() {
    const list = document.getElementById('history-list');
    if (history.length === 0) {
        list.innerHTML = '<p style="color: rgba(255,204,188,0.6); text-align: center; padding: 2rem;">No history yet</p>';
        return;
    }
    
    list.innerHTML = history.slice(0, 50).map(h => `
        <div class="history-item" onclick="reopenSearch('${h.query.replace(/'/g, "\\'")}')">
            <div class="title">${h.title || h.query}</div>
            <div class="url">${h.url || h.query}</div>
            <div class="timestamp">${new Date(h.timestamp).toLocaleString()}</div>
        </div>
    `).join('');
}

function reopenSearch(query) {
    searchInput.value = query;
    searchForm.requestSubmit();
    closePanel('history-panel');
}

function clearAllData() {
    if (confirm('Clear all bookmarks, history, and settings?')) {
        clearBackendHistory();
        localStorage.clear();
        bookmarks = [];
        history = [];
        settings = {darkMode: true, resultsLimit: 10};
        alert('All data cleared!');
    }
}

async function clearBackendHistory() {
    const email = localStorage.getItem('user_email');
    if (!email) return;
    try {
        await fetch(`${API_BASE}/history?email=${encodeURIComponent(email)}`, { method: 'DELETE' });
    } catch (error) {
        console.warn('Could not clear backend history.', error);
    }
}

// Quick search helper
function quickSearch(query) {
    searchInput.value = query;
    searchForm.requestSubmit();
}

// Update button state based on input and generation status
function updateButtonState() {
    if (!voiceSubmitBtn) return;
    
    if (isGenerating) {
        // Show stop button
        voiceSubmitBtn.classList.add('is-generating');
        voiceSubmitBtn.classList.remove('has-input', 'recording');
        voiceSubmitBtn.setAttribute('type', 'button');
        voiceSubmitBtn.setAttribute('title', 'Stop Generating');
    } else if (searchInput.value.trim().length > 0) {
        // Show send button
        voiceSubmitBtn.classList.add('has-input');
        voiceSubmitBtn.classList.remove('is-generating', 'recording');
        voiceSubmitBtn.setAttribute('type', 'submit');
        voiceSubmitBtn.setAttribute('title', 'Send Message');
    } else {
        // Show voice button
        voiceSubmitBtn.classList.remove('has-input', 'is-generating');
        voiceSubmitBtn.setAttribute('type', 'button');
        voiceSubmitBtn.setAttribute('title', 'Voice Input');
    }
}

// Stop generation function
function stopGeneration() {
    console.log('⏹️ Stopping generation...');
    isGenerating = false;
    
    // Abort the fetch request
    if (abortController) {
        abortController.abort();
        abortController = null;
    }
    
    // Update button state
    updateButtonState();
    
    // Update the loading message to show it was stopped
    const loadingContainers = document.querySelectorAll('.loading-container');
    loadingContainers.forEach(container => {
        if (container.style.display !== 'none') {
            container.innerHTML = '<span style=\"color: var(--text-secondary); font-style: italic;\">Generation stopped by user</span>';
        }
    });
    
    showNotification('⏹️ Generation stopped', 'info');
}

// Clear search and return to home
function clearSearch() {
    searchInput.value = '';
    const chatMessages = document.getElementById('chat-messages');
    const mainContainer = document.querySelector('.container');
    chatMessages.innerHTML = '';
    heroSection.classList.remove('compact');
    isSearchPerformed = false;
    searchInput.blur();
    
    // Reset conversation history in AI mode
    if (currentMode === 'ai') {
        conversationHistory = [];
    }
    
    // Show header again
    const topNav = document.querySelector('.top-nav');
    if (topNav) topNav.classList.remove('hidden');
    if (mainContainer) mainContainer.classList.remove('full-height');
    
    // Scroll container to top smoothly
    mainContainer.scrollTo({ top: 0, behavior: 'smooth' });
}

// Rating & Search Count Logic
let searchCount = parseInt(localStorage.getItem('searchCount') || '0');
let hasRated = localStorage.getItem('hasRated') === 'true';

function checkRatingPrompt() {
    searchCount++;
    localStorage.setItem('searchCount', searchCount);
    
    if (searchCount >= 10 && !hasRated) {
        // Show modal after a short delay
        setTimeout(() => {
            const modal = document.getElementById('rating-modal-overlay');
            if (modal) {
                modal.classList.add('show');
                modal.style.display = 'flex';
            }
        }, 2000);
    }
}

let currentRating = 0;
window.setRating = function(stars) {
    currentRating = stars;
    const starElements = document.querySelectorAll('.star-rating span');
    starElements.forEach((star, index) => {
        star.style.color = index < stars ? '#FFD700' : 'var(--text-secondary)';
    });
};

window.submitRating = async function() {
    const feedback = document.getElementById('rating-feedback').value;
    const email = localStorage.getItem('user_email') || 'anonymous';
    
    try {
        await fetch(`${API_BASE}/rating`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email, stars: currentRating, feedback })
        });
        showNotification('Thank you for your feedback! ⭐', 'success');
    } catch(e) {
        console.error("Rating error", e);
    }
    
    localStorage.setItem('hasRated', 'true');
    window.closeRatingModal();
};

window.closeRatingModal = function() {
    const modal = document.getElementById('rating-modal-overlay');
    if (modal) modal.classList.remove('show');
};

// API Search Function
async function search(query, limit = settings.resultsLimit) {
    checkRatingPrompt(); // Increment counter on search
    
    const params = new URLSearchParams({ query, limit: limit.toString() });
    const response = await fetch(`${API_BASE}/search?${params.toString()}`);
    if (!response.ok) {
        throw new Error("Search request failed");
    }
    return await response.json();
}

// AI Chat API Function
async function chatWithAI(userMessage) {
    conversationHistory.push({
        role: 'user',
        content: userMessage
    });
    
    const requestBody = {
        messages: conversationHistory,
        provider: 'gemini',
        model: 'gemini-3.6-flash',
        temperature: 0.7,
        max_tokens: 2000
    };
    
    // Add image if uploaded
    if (uploadedImage) {
        requestBody.image = uploadedImage;
        console.log('🖼️ Image attached to request (size:', Math.round(uploadedImage.length / 1024), 'KB)');
    } else {
        console.log('📝 Text-only request (no image)');
    }
    
    console.log('📤 Sending request to API...');
    
    // Create new AbortController for this request
    abortController = new AbortController();
    
    try {
        const response = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: abortController.signal
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'AI request failed');
        }
        
        const data = await response.json();
        conversationHistory.push({
            role: 'assistant',
            content: data.response
        });
        
        // Note: Image clearing is now handled in performSearch function
        
        return data;
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('🛑 Request aborted by user');
            throw new Error('Request cancelled');
        }
        throw error;
    }
}

// Transcribe audio using Web Speech API fallback
async function transcribeAudio(base64Audio) {
    // For now, we'll use a simple message since Groq Whisper needs server-side implementation
    // You could enhance this by adding a /transcribe endpoint to your FastAPI backend
    throw new Error('Audio transcription requires server-side implementation. Please use browser\'s built-in speech recognition instead.');
}

// Handle AI Chat directly (for voice input auto-submit)
async function handleAIChat(query) {
    if (!query.trim()) return;
    
    // Trigger the form submission with the query
    searchInput.value = query;
    searchForm.dispatchEvent(new Event('submit'));
}

// Perform Search
async function performSearch(query) {
    if (!query.trim()) return;
    
    // Add to history
    addToHistory(query, '', query);
    
    // Hide hero section
    heroSection.classList.add('compact');
    isSearchPerformed = true;
    
    // Get chat container and main container
    const chatMessages = document.getElementById('chat-messages');
    const mainContainer = document.querySelector('.container');
    
    // Add user message
    const userMessageDiv = document.createElement('div');
    userMessageDiv.className = 'user-message';
    
    // Add image if uploaded
    if (uploadedImage) {
        const imageElement = document.createElement('img');
        imageElement.src = uploadedImage;
        imageElement.className = 'user-uploaded-image';
        imageElement.alt = 'Uploaded image';
        userMessageDiv.appendChild(imageElement);
        
        const textElement = document.createElement('div');
        textElement.className = 'user-message-text';
        textElement.textContent = query;
        userMessageDiv.appendChild(textElement);
    } else {
        userMessageDiv.textContent = query;
    }
    
    chatMessages.appendChild(userMessageDiv);
    
    // Add assistant message container with loading
    const assistantMessageDiv = document.createElement('div');
    assistantMessageDiv.className = 'assistant-message';
    assistantMessageDiv.innerHTML = `
        <div class="assistant-header">
            <div class="assistant-avatar">MG</div>
            <span class="assistant-name">Mini Google</span>
        </div>
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <span>Searching the web...</span>
        </div>
    `;
    chatMessages.appendChild(assistantMessageDiv);
    
    // Scroll container to bottom to see new message
    setTimeout(() => {
        mainContainer.scrollTop = mainContainer.scrollHeight;
    }, 100);
    
    // Clear input and reset button state
    searchInput.value = '';
    updateButtonState();
    
    // Set generation state
    isGenerating = true;
    updateButtonState();
    
    // Store uploaded image temporarily before clearing
    const tempUploadedImage = uploadedImage;
    
    console.log('=== IMAGE FLOW DEBUG ===');
    console.log('Step 1 - Original uploadedImage:', uploadedImage ? `YES (${Math.round(uploadedImage.length / 1024)} KB)` : 'NO');
    console.log('Step 2 - Stored in tempUploadedImage:', tempUploadedImage ? `YES (${Math.round(tempUploadedImage.length / 1024)} KB)` : 'NO');
    
    // Clear uploaded image preview immediately after adding to message
    if (uploadedImage) {
        uploadedImage = null;
        imagePreview.src = '';
        imagePreviewContainer.style.display = 'none';
        imageUploadInput.value = '';
        searchInput.placeholder = 'Message Mini Google AI...';
        console.log('Step 3 - Cleared uploadedImage preview');
    }
    
    console.log('Step 4 - Before restore, uploadedImage:', uploadedImage ? 'YES' : 'NO');
    console.log('Step 4 - Before restore, tempUploadedImage:', tempUploadedImage ? 'YES' : 'NO');
    
    try {
        // Check mode and route accordingly
        if (currentMode === 'ai') {
            // Update loading text for AI
            assistantMessageDiv.querySelector('.loading-container span').textContent = 'Thinking...';
            
            // Restore image temporarily for the API call
            uploadedImage = tempUploadedImage;
            console.log('Step 5 - Restored uploadedImage:', uploadedImage ? `YES (${Math.round(uploadedImage.length / 1024)} KB)` : 'NO');
            const data = await chatWithAI(query);
            uploadedImage = null; // Clear again after API call
            console.log('Step 6 - Cleared uploadedImage after API call');
            displayAIResponse(data.response, assistantMessageDiv, mainContainer);
        } else {
            const data = await search(query);
            displayResults(data, query, assistantMessageDiv, mainContainer);
        }
    } catch (error) {
        assistantMessageDiv.innerHTML = `
            <div class="assistant-header">
                <div class="assistant-avatar">MG</div>
                <span class="assistant-name">Mini Google</span>
            </div>
            <div class="error-container">
                <p>❌ ${currentMode === 'ai' ? 'AI response' : 'Search'} failed: ${error.message}</p>
            </div>
        `;
    } finally {
        // Reset generation state
        isGenerating = false;
        updateButtonState();
    }
}

// Display AI Response
function displayAIResponse(response, assistantMessageDiv, mainContainer) {
    // Process code blocks first and replace with placeholders
    const codeBlocks = [];
    let processedResponse = response.replace(/```(\w+)?\n?([\s\S]*?)```/g, (match, lang, code) => {
        const language = (lang || 'plaintext').toLowerCase().trim();
        const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
        codeBlocks.push({ language, code: code.trim() });
        return placeholder;
    });
    
    // Process output blocks (text that looks like output)
    processedResponse = processedResponse.replace(/Output:\s*\n([\s\S]*?)(?=\n\n|$)/g, (match, output) => {
        const placeholder = `__OUTPUT_BLOCK_${codeBlocks.length}__`;
        codeBlocks.push({ type: 'output', content: output.trim() });
        return placeholder;
    });
    
    // Enhanced markdown formatting
    let formattedResponse = processedResponse
        // Headers (## Header -> <h3>, # Header -> <h2>)
        .replace(/^### (.+)$/gm, '<h4>$1</h4>')
        .replace(/^## (.+)$/gm, '<h3>$1</h3>')
        .replace(/^# (.+)$/gm, '<h2>$1</h2>')
        // Numbered lists
        .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
        // Bullet points
        .replace(/^[•\-\*]\s+(.+)$/gm, '<li>$1</li>')
        // Bold
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Inline code
        .replace(/`(.+?)`/g, '<code>$1</code>');
    
    // Wrap consecutive <li> items in <ul> or <ol>
    formattedResponse = formattedResponse.replace(/(<li>.*?<\/li>)(?:\s*<li>.*?<\/li>)*/g, (match) => {
        return `<ul>${match}</ul>`;
    });
    
    // Restore code blocks with proper formatting
    codeBlocks.forEach((block, index) => {
        if (block.type === 'output') {
            const outputHtml = `
                <div class="code-block-wrapper">
                    <div class="output-header">
                        <span class="output-label">Output</span>
                    </div>
                    <div class="output-block">
                        <div class="output-content">${escapeHtml(block.content)}</div>
                    </div>
                </div>
            `;
            formattedResponse = formattedResponse.replace(`__OUTPUT_BLOCK_${index}__`, outputHtml);
        } else {
            const codeHtml = `
                <div class="code-block-wrapper">
                    <div class="code-header">
                        <span class="code-language">${escapeHtml(block.language)}</span>
                        <button class="code-copy-btn" onclick="copyCodeBlock(this, ${index})">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                            Copy code
                        </button>
                    </div>
                    <pre><code class="language-${escapeHtml(block.language)}">${escapeHtml(block.code)}</code></pre>
                </div>
            `;
            formattedResponse = formattedResponse.replace(`__CODE_BLOCK_${index}__`, codeHtml);
        }
    });
    
    // Store code blocks for copying
    assistantMessageDiv.setAttribute('data-code-blocks', JSON.stringify(codeBlocks));
    
    // Paragraph handling - split by double newlines
    const sections = formattedResponse.split(/\n\n+/);
    formattedResponse = sections.map(section => {
        section = section.trim();
        // Don't wrap if already has block-level tags
        if (section.match(/^<(h[1-6]|ul|ol|pre|div|code-block-wrapper)/)) {
            return section;
        }
        // Replace single newlines with <br>
        return `<p>${section.replace(/\n/g, '<br>')}</p>`;
    }).join('');
    
    assistantMessageDiv.innerHTML = `
        <div class="assistant-header">
            <div class="assistant-avatar">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" opacity="0.9"/>
                    <path d="M2 17L12 22L22 17V12L12 17L2 12V17Z" fill="currentColor" opacity="0.7"/>
                    <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>
                </svg>
            </div>
            <span class="assistant-name">Mini Google AI</span>
        </div>
        <div class="ai-response">
            ${formattedResponse}
        </div>
        <div class="message-actions">
            <button class="action-btn-small" onclick="copyResponse(this)" title="Copy response">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
            </button>
            <button class="action-btn-small" onclick="regenerateResponse()" title="Regenerate response">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="23 4 23 10 17 10"/>
                    <polyline points="1 20 1 14 7 14"/>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
            </button>
            <button class="action-btn-small" onclick="readAloud(this)" title="Read aloud">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                </svg>
            </button>
        </div>
    `;
    
    mainContainer.scrollTop = mainContainer.scrollHeight;
}

// Copy entire response
function copyResponse(button) {
    const messageDiv = button.closest('.assistant-message');
    const responseDiv = messageDiv.querySelector('.ai-response');
    const textToCopy = responseDiv.innerText;
    
    navigator.clipboard.writeText(textToCopy).then(() => {
        const originalTitle = button.title;
        button.title = 'Copied!';
        button.style.color = '#10b981';
        
        setTimeout(() => {
            button.title = originalTitle;
            button.style.color = '';
        }, 2000);
        
        showNotification('✅ Response copied to clipboard', 'success');
    });
}

// Regenerate last response
function regenerateResponse() {
    if (conversationHistory.length >= 2) {
        // Remove last assistant response
        conversationHistory.pop();
        
        // Get the last user message
        const lastUserMessage = conversationHistory[conversationHistory.length - 1];
        if (lastUserMessage && lastUserMessage.role === 'user') {
            // Remove last messages from UI
            const chatMessages = document.getElementById('chat-messages');
            const messages = chatMessages.querySelectorAll('.user-message, .assistant-message');
            if (messages.length >= 2) {
                messages[messages.length - 1].remove(); // Remove assistant
                messages[messages.length - 2].remove(); // Remove user
            }
            
            // Re-submit the query
            performSearch(lastUserMessage.content);
            showNotification('🔄 Regenerating response...', 'info');
        }
    } else {
        showNotification('❌ No previous message to regenerate', 'error');
    }
}

// Read response aloud using Text-to-Speech
function readAloud(button) {
    const messageDiv = button.closest('.assistant-message');
    const responseDiv = messageDiv.querySelector('.ai-response');
    const textToRead = responseDiv.innerText;
    
    if ('speechSynthesis' in window) {
        // Stop any ongoing speech
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(textToRead);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;
        
        // Change button appearance while speaking
        button.style.color = '#3b82f6';
        button.title = 'Speaking...';
        
        utterance.onend = () => {
            button.style.color = '';
            button.title = 'Read aloud';
        };
        
        window.speechSynthesis.speak(utterance);
        showNotification('🔊 Reading response aloud...', 'info');
    } else {
        showNotification('❌ Text-to-speech not supported in this browser', 'error');
    }
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Copy code block function
function copyCodeBlock(button, index) {
    const messageDiv = button.closest('.assistant-message');
    const codeBlocks = JSON.parse(messageDiv.getAttribute('data-code-blocks') || '[]');
    const block = codeBlocks[index];
    
    const textToCopy = block.type === 'output' ? block.content : block.code;
    
    navigator.clipboard.writeText(textToCopy).then(() => {
        const originalHtml = button.innerHTML;
        button.classList.add('copied');
        button.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
            </svg>
            Copied!
        `;
        
        setTimeout(() => {
            button.classList.remove('copied');
            button.innerHTML = originalHtml;
        }, 2000);
    });
}

// Display Search Results
function displayResults(data, query, assistantMessageDiv, mainContainer) {
    if (!data || !data.hits || data.hits.length === 0) {
        assistantMessageDiv.innerHTML = `
            <div class="assistant-header">
                <div class="assistant-avatar">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" opacity="0.9"/>
                        <path d="M2 17L12 22L22 17V12L12 17L2 12V17Z" fill="currentColor" opacity="0.7"/>
                        <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>
                    </svg>
                </div>
                <span class="assistant-name">Mini Google</span>
            </div>
            <div class="no-results">
                <p>No results found for "${query}"</p>
            </div>
        `;
        return;
    }
    
    let resultsHTML = `
        <div class="assistant-header">
            <div class="assistant-avatar">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" opacity="0.9"/>
                    <path d="M2 17L12 22L22 17V12L12 17L2 12V17Z" fill="currentColor" opacity="0.7"/>
                    <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>
                </svg>
            </div>
            <span class="assistant-name">Mini Google</span>
        </div>
    `;
    
    // Check if we should show knowledge panel
    const firstResult = data.hits[0];
    const showKnowledgePanel = firstResult.url.includes('wikipedia.org') || 
                                firstResult.title.toLowerCase() === query.toLowerCase();
    
    if (showKnowledgePanel && (data.featured_image || firstResult.image)) {
        const imageUrl = data.featured_image || firstResult.image;
        resultsHTML += `
            <div class="knowledge-panel">
                <div class="knowledge-header">
                    <h2 class="knowledge-title">${firstResult.title}</h2>
                    <span class="knowledge-source">Featured</span>
                </div>
                <div class="knowledge-content">
                    <div class="knowledge-image-placeholder">
                        ${imageUrl ? `<img src="${imageUrl}" alt="${firstResult.title}" class="knowledge-image" onerror="this.parentElement.innerHTML='<span class=\\'image-icon\\'>🖼️</span><p class=\\'image-text\\'>Image unavailable</p>';" />` : '<span class="image-icon">🖼️</span><p class="image-text">No image</p>'}
                    </div>
                    <div class="knowledge-snippet">
                        <p>${firstResult.snippet}</p>
                    </div>
                </div>
                <div class="knowledge-actions">
                    <a href="${firstResult.url}" target="_blank" class="knowledge-link">Visit Page →</a>
                </div>
            </div>
        `;
    }
    
    // Display search results
    resultsHTML += '<div class="results-list">';
    data.hits.forEach(hit => {
        resultsHTML += `
            <div class="result-card">
                <h3><a href="${hit.url}" target="_blank">${hit.title}</a></h3>
                <div class="url">${hit.url}</div>
                <div class="snippet">${hit.snippet}</div>
            </div>
        `;
    });
    resultsHTML += '</div>';
    
    assistantMessageDiv.innerHTML = resultsHTML;
    
    // Scroll to show new results
    setTimeout(() => {
        assistantMessageDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
}

// Event Listeners
if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (query) {
            console.log('🔍 Search submitted:', query);
            console.log('🖼️ uploadedImage present?', uploadedImage ? 'YES' : 'NO');
            if (uploadedImage) {
                console.log('📏 Image size:', Math.round(uploadedImage.length / 1024), 'KB');
            }
            
            // Keep header visible after search
            const topNav = document.querySelector('.top-nav');
            const mainContainer = document.querySelector('.container');
            // Don't hide the header - keep it visible
            if (mainContainer) mainContainer.classList.add('full-height');
            
            performSearch(query);
        } else {
            console.log('Empty search query');
        }
    });
} else {
    console.error('Search form not found!');
}

// Attach button dropdown toggle
const attachBtn = document.getElementById('attach-btn');
const attachDropdown = document.getElementById('attach-dropdown');

if (attachBtn && attachDropdown) {
    attachBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        attachDropdown.classList.toggle('show');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!attachDropdown.contains(e.target) && e.target !== attachBtn) {
            attachDropdown.classList.remove('show');
        }
    });
}

// Image Upload Functionality with compression
const imageUploadInput = document.getElementById('image-upload-input');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const imageRemoveBtn = document.getElementById('image-remove-btn');

// Compress image to reduce size
function compressImage(base64Str, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            // Calculate new dimensions while maintaining aspect ratio
            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Convert to base64 with compression
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = base64Str;
    });
}

if (imageUploadInput) {
    console.log('✅ Image upload input found and listener attached');
    imageUploadInput.addEventListener('change', async (e) => {
        console.log('🎯 File input changed! Files:', e.target.files.length);
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            console.log('📁 File name:', file.name);
            console.log('📁 Original file size:', Math.round(file.size / 1024), 'KB');
            const reader = new FileReader();
            reader.onload = async (event) => {
                console.log('📖 FileReader loaded');
                // Show loading state
                imagePreviewContainer.style.display = 'block';
                imagePreview.style.opacity = '0.5';
                
                // Compress the image
                const originalImage = event.target.result;
                console.log('🔄 Compressing image...');
                const compressedImage = await compressImage(originalImage, 800, 0.7);
                
                uploadedImage = compressedImage; // Store compressed Base64 string
                imagePreview.src = compressedImage;
                imagePreview.style.opacity = '1';
                
                console.log('✅ Image compressed to:', Math.round(compressedImage.length / 1024), 'KB');
                console.log('💾 Image stored in uploadedImage variable');
                console.log('🔍 Call window.checkImage() to verify');
                
                searchInput.placeholder = 'Describe what you want to know about this image...';
                searchInput.focus();
            };
            reader.readAsDataURL(file);
        } else {
            console.log('❌ Invalid file type:', file?.type);
            showNotification('Please select a valid image file');
        }
    });
} else {
    console.error('❌ Image upload input NOT found!');
}

if (imageRemoveBtn) {
    imageRemoveBtn.addEventListener('click', () => {
        console.log('🗑️ Removing uploaded image');
        uploadedImage = null;
        imagePreview.src = '';
        imagePreviewContainer.style.display = 'none';
        imageUploadInput.value = '';
        searchInput.placeholder = 'Message Mini Google AI...';
    });
}

// Web Search Button - Search mode with web results
const webSearchBtn = document.getElementById('web-search-btn');
if (webSearchBtn) {
    webSearchBtn.addEventListener('click', () => {
        showNotification('🌐 Web Search Mode: Get real-time web results with DuckDuckGo search engine', 'info', 4000);
        searchInput.placeholder = 'Search the web...';
        searchInput.focus();
    });
}

// Study Button - Enhanced learning mode
const studyBtn = document.getElementById('study-btn');
if (studyBtn) {
    studyBtn.addEventListener('click', () => {
        showNotification('📚 Study Mode: AI will explain concepts with examples, analogies, and quizzes', 'info', 4000);
        searchInput.placeholder = 'What would you like to learn today?';
        searchInput.focus();
    });
}

// Export/Import Buttons functionality
const exportBtn = document.getElementById('export-conversations-btn');
const importBtn = document.getElementById('import-conversations-btn');

if (exportBtn) {
    exportBtn.addEventListener('click', () => {
        const exportData = {
            conversations: conversationHistory,
            history: history,
            bookmarks: bookmarks,
            exportDate: new Date().toISOString()
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `mini-google-export-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
        
        showNotification('✅ Conversations exported successfully!', 'success');
    });
}

if (importBtn) {
    importBtn.addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const importData = JSON.parse(event.target.result);
                        
                        if (importData.conversations) {
                            conversationHistory = importData.conversations;
                        }
                        if (importData.history) {
                            history = importData.history;
                            localStorage.setItem('history', JSON.stringify(history));
                        }
                        if (importData.bookmarks) {
                            bookmarks = importData.bookmarks;
                            localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
                        }
                        
                        showNotification('✅ Conversations imported successfully!', 'success');
                    } catch (error) {
                        showNotification('❌ Failed to import: Invalid file format', 'error');
                    }
                };
                reader.readAsText(file);
            }
        };
        fileInput.click();
    });
}

// Theme Selection
const themeSelect = document.getElementById('theme-select');
if (themeSelect) {
    const currentTheme = localStorage.getItem('theme') || 'dark';
    themeSelect.value = currentTheme;
    applyTheme(currentTheme);
    
    themeSelect.addEventListener('change', (e) => {
        const theme = e.target.value;
        localStorage.setItem('theme', theme);
        applyTheme(theme);
        showNotification(`🎨 Theme changed to ${theme}`, 'success');
    });
}

function applyTheme(theme) {
    if (theme === 'light') {
        document.body.classList.remove('dark-mode');
        document.body.classList.add('light-mode');
    } else if (theme === 'dark') {
        document.body.classList.remove('light-mode');
        document.body.classList.add('dark-mode');
    } else if (theme === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
            document.body.classList.remove('light-mode');
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
            document.body.classList.add('light-mode');
        }
    }
}

// Settings button
if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
        const settingsModal = document.getElementById('settings-modal-overlay');
        if (settingsModal) {
            settingsModal.classList.add('show');
        }
    });
}

// Settings modal controls
const settingsModalOverlay = document.getElementById('settings-modal-overlay');
const closeSettingsModal = document.getElementById('close-settings-modal');

if (closeSettingsModal && settingsModalOverlay) {
    // Close button
    closeSettingsModal.addEventListener('click', () => {
        settingsModalOverlay.classList.remove('show');
    });
    
    // Close when clicking overlay
    settingsModalOverlay.addEventListener('click', (e) => {
        if (e.target === settingsModalOverlay) {
            settingsModalOverlay.classList.remove('show');
        }
    });
}

// Report modal controls
const reportModalOverlay = document.getElementById('report-modal-overlay');
const closeReportModal = document.getElementById('close-report-modal');
const reportNextBtn = document.getElementById('report-next-btn');

if (closeReportModal && reportModalOverlay) {
    // Close button
    closeReportModal.addEventListener('click', () => {
        reportModalOverlay.classList.remove('show');
        // Reset form
        const radios = document.querySelectorAll('input[name="report-reason"]');
        radios.forEach(radio => radio.checked = false);
        if (reportNextBtn) reportNextBtn.disabled = true;
    });
    
    // Close when clicking overlay
    reportModalOverlay.addEventListener('click', (e) => {
        if (e.target === reportModalOverlay) {
            reportModalOverlay.classList.remove('show');
            // Reset form
            const radios = document.querySelectorAll('input[name="report-reason"]');
            radios.forEach(radio => radio.checked = false);
            if (reportNextBtn) reportNextBtn.disabled = true;
        }
    });
}

// Enable Next button when a report reason is selected
if (reportNextBtn) {
    const reportRadios = document.querySelectorAll('input[name="report-reason"]');
    reportRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            reportNextBtn.disabled = false;
        });
    });
    
    // Handle Next button click
    reportNextBtn.addEventListener('click', () => {
        const selected = document.querySelector('input[name="report-reason"]:checked');
        if (selected) {
            alert(`Report submitted for: ${selected.value}. Thank you for your feedback.`);
            reportModalOverlay.classList.remove('show');
            // Reset form
            const radios = document.querySelectorAll('input[name="report-reason"]');
            radios.forEach(radio => radio.checked = false);
            reportNextBtn.disabled = true;
        }
    });
}

// Welcome modal controls
window.closeWelcomeModal = function() {
    const welcomeModalOverlay = document.getElementById('welcome-modal-overlay');
    if (welcomeModalOverlay) {
        welcomeModalOverlay.classList.remove('show');
        document.body.style.overflow = '';
        // Mark as visited
        localStorage.setItem('hasVisited', 'true');
    }
};

window.openLoginFromWelcome = function() {
    closeWelcomeModal();
    setTimeout(() => openLoginModal(), 200);
};

window.openSignupFromWelcome = function() {
    closeWelcomeModal();
    setTimeout(() => openLoginModal(), 200);
};

// Login modal controls - Robust version
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== Login Modal Setup Starting ===');
    const loginModalOverlay = document.getElementById('login-modal-overlay');
    const closeLoginModal = document.getElementById('close-login-modal');
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');

    console.log('loginModalOverlay:', loginModalOverlay);
    console.log('loginBtn:', loginBtn);
    console.log('signupBtn:', signupBtn);
    
    // Show welcome modal on first visit
    if (!hasVisited) {
        const welcomeModalOverlay = document.getElementById('welcome-modal-overlay');
        if (welcomeModalOverlay) {
            setTimeout(() => {
                welcomeModalOverlay.classList.add('show');
                document.body.style.overflow = 'hidden';
            }, 500); // Show after 500ms delay
        }
    }

    // Function to open login modal
    window.openLoginModal = function() {
        console.log('openLoginModal called');
        if (loginModalOverlay) {
            console.log('Adding show class to modal');
            loginModalOverlay.classList.add('show');
            loginModalOverlay.style.display = 'flex'; // Force display
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
            // Focus on email input after modal opens
            setTimeout(() => {
                const emailInput = document.querySelector('.email-input');
                if (emailInput) emailInput.focus();
            }, 150);
        } else {
            console.error('loginModalOverlay is null!');
        }
    };

    // Function to close login modal
    window.closeLoginModalFunc = function() {
        console.log('closeLoginModalFunc called');
        if (loginModalOverlay) {
            loginModalOverlay.classList.remove('show');
            loginModalOverlay.style.display = 'none';
            document.body.style.overflow = ''; // Restore scrolling
        }
    };

    if (closeLoginModal && loginModalOverlay) {
        // Close button
        closeLoginModal.addEventListener('click', window.closeLoginModalFunc);
        
        // Close when clicking overlay
        loginModalOverlay.addEventListener('click', (e) => {
            if (e.target === loginModalOverlay) {
                window.closeLoginModalFunc();
            }
        });
        
        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && loginModalOverlay.classList.contains('show')) {
                window.closeLoginModalFunc();
            }
        });
    }

    // Login button handler
    if (loginBtn) {
        console.log('Adding click handler to login button');
        loginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Login button clicked!');
            window.openLoginModal();
        });
    } else {
        console.error('❌ Login button NOT found!');
    }

    // Signup button handler
    if (signupBtn) {
        console.log('Adding click handler to signup button');
        signupBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Signup button clicked!');
            window.openLoginModal();
        });
    } else {
        console.error('❌ Signup button NOT found!');
    }

    console.log('=== Login Modal Setup Complete ===');
});

// Login method buttons - Show friendly message instead of alert
const loginMethodBtns = document.querySelectorAll('.login-btn');
loginMethodBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        const method = btn.querySelector('span').textContent;
        showNotification(`${method} authentication is in development. Please check back later!`);
    });
});

// Email continue button - Show friendly message
const continueBtn = document.querySelector('.continue-btn');
if (continueBtn) {
    continueBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const emailInput = document.querySelector('.email-input');
        if (emailInput && emailInput.value) {
            showNotification('Email authentication is in development. Please check back later!');
        } else {
            emailInput?.focus();
        }
    });
}

// Help dropdown - Settings option
const openSettingsFromHelp = document.getElementById('open-settings');
if (openSettingsFromHelp) {
    openSettingsFromHelp.addEventListener('click', () => {
        const helpDropdown = document.getElementById('help-dropdown');
        const settingsModal = document.getElementById('settings-modal-overlay');
        if (helpDropdown) helpDropdown.classList.remove('show');
        if (settingsModal) settingsModal.classList.add('show');
    });
}
if (helpBtn) {
    const helpDropdown = document.getElementById('help-dropdown');
    
    helpBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        helpDropdown.classList.toggle('show');
        // Close attach dropdown if open
        if (attachDropdown) attachDropdown.classList.remove('show');
    });
    
    // Close help dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (helpDropdown && !helpDropdown.contains(e.target) && e.target !== helpBtn) {
            helpDropdown.classList.remove('show');
        }
    });
    
    // Settings option in help dropdown
    const openSettingsBtn = document.getElementById('open-settings');
    if (openSettingsBtn) {
        openSettingsBtn.addEventListener('click', () => {
            helpDropdown.classList.remove('show');
            const settingsModal = document.getElementById('settings-modal-overlay');
            if (settingsModal) settingsModal.classList.add('show');
        });
    }
    
    // Report conversation option
    const openReportBtn = document.getElementById('open-report');
    if (openReportBtn) {
        openReportBtn.addEventListener('click', () => {
            helpDropdown.classList.remove('show');
            const reportModal = document.getElementById('report-modal-overlay');
            if (reportModal) reportModal.classList.add('show');
        });
    }
    
    // Handle other help dropdown items with data-action
    const helpDropdownItems = helpDropdown.querySelectorAll('[data-action]');
    helpDropdownItems.forEach(item => {
        item.addEventListener('click', () => {
            const action = item.getAttribute('data-action');
            helpDropdown.classList.remove('show');
            
            switch(action) {
                case 'pricing':
                    showNotification('💎 Pricing: Free tier available! Pro features: $20/month for unlimited AI chat, image analysis, and priority support.');
                    break;
                case 'help':
                    showNotification('📚 Help: Press / to focus search, Ctrl+L for shortcuts, Escape to clear. More help docs coming soon!');
                    break;
                case 'release':
                    showNotification('🎉 v1.0 Release: AI chat with Groq, Image upload support, Dark theme, Keyboard shortcuts, and more!');
                    break;
                case 'terms':
                    showNotification('📜 Terms: Free to use for personal projects. AI responses powered by Groq. No data collection. Open source project.');
                    break;
                default:
                    showNotification('Feature coming soon!');
            }
        });
    });
}

// Handle attach dropdown items with data-action
if (attachDropdown) {
    const attachDropdownItems = attachDropdown.querySelectorAll('[data-action]');
    attachDropdownItems.forEach(item => {
        item.addEventListener('click', () => {
            const action = item.getAttribute('data-action');
            attachDropdown.classList.remove('show');
            
            if (action === 'connect-apps' || action === 'documents') {
                showNotification('This feature requires login. Please sign in to continue.');
            }
        });
    });
}

// Notification helper function
function showNotification(message, type = 'info', duration = 3000) {
    const notification = document.createElement('div');
    notification.className = `login-notification notification-${type}`;
    
    let icon = '';
    if (type === 'success') {
        icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
    } else if (type === 'error') {
        icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
    } else {
        icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>';
    }
    
    notification.innerHTML = `${icon}<span>${message}</span>`;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, duration);
}

// Settings
document.getElementById('dark-mode-toggle')?.addEventListener('change', (e) => {
    settings.darkMode = e.target.checked;
    localStorage.setItem('settings', JSON.stringify(settings));
    document.body.classList.toggle('light-mode', !e.target.checked);
});

document.getElementById('results-limit')?.addEventListener('change', (e) => {
    settings.resultsLimit = parseInt(e.target.value);
    localStorage.setItem('settings', JSON.stringify(settings));
});

// Apply saved settings
if (!settings.darkMode) {
    document.body.classList.add('light-mode');
    document.getElementById('dark-mode-toggle').checked = false;
}
if (settings.resultsLimit) {
    document.getElementById('results-limit').value = settings.resultsLimit;
}

// Focus search input on load
window.addEventListener('load', () => {
    searchInput.focus();
});

// ====== ENHANCED FEATURES ======

// AI Provider & Model Management
let aiSettings = JSON.parse(localStorage.getItem('aiSettings') || '{"provider": "gemini", "model": "gemini-3.6-flash", "syntaxHighlighting": true}');
if (aiSettings.model.startsWith('llama-') || aiSettings.model.startsWith('models/')) {
    aiSettings = { ...aiSettings, provider: 'gemini', model: 'gemini-3.6-flash' };
    localStorage.setItem('aiSettings', JSON.stringify(aiSettings));
}

const providerSelect = document.getElementById('ai-provider-select');
const modelSelect = document.getElementById('ai-model-select');
const syntaxToggle = document.getElementById('syntax-highlighting');
let providerModels = {
    gemini: ['gemini-3.6-flash', 'gemini-2.5-pro'],
    groq: ['openai/gpt-oss-120b']
};

// Load saved AI settings
if (providerSelect && modelSelect) {
    providerSelect.value = aiSettings.provider;
    modelSelect.value = aiSettings.model;
    
    // Update models based on provider
    providerSelect.addEventListener('change', (e) => {
        aiSettings.provider = e.target.value;
        updateModelOptions(e.target.value);
        localStorage.setItem('aiSettings', JSON.stringify(aiSettings));
    });
    
    modelSelect.addEventListener('change', (e) => {
        aiSettings.model = e.target.value;
        localStorage.setItem('aiSettings', JSON.stringify(aiSettings));
    });
}

if (syntaxToggle) {
    syntaxToggle.checked = aiSettings.syntaxHighlighting;
    syntaxToggle.addEventListener('change', (e) => {
        aiSettings.syntaxHighlighting = e.target.checked;
        localStorage.setItem('aiSettings', JSON.stringify(aiSettings));
    });
}

function updateModelOptions(provider) {
    const models = (providerModels[provider] || providerModels.gemini).map(value => ({
        value,
        label: value
    }));
    modelSelect.innerHTML = models.map(m => `<option value="${m.value}">${m.label}</option>`).join('');
    modelSelect.value = models[0].value;
    aiSettings.model = models[0].value;
    localStorage.setItem('aiSettings', JSON.stringify(aiSettings));
}

async function loadProviderModels() {
    try {
        const response = await fetch(`${API_BASE}/providers`);
        if (!response.ok) return;
        const data = await response.json();
        providerModels = Object.fromEntries(
            Object.entries(data).map(([provider, info]) => [provider, info.models || []])
        );
        if (providerModels.gemini?.includes('gemini-3.6-flash')) {
            providerModels.gemini = [
                'gemini-3.6-flash',
                ...providerModels.gemini.filter(model => model !== 'gemini-3.6-flash')
            ];
        }
        if (!providerModels[aiSettings.provider]?.length) {
            aiSettings.provider = 'gemini';
        }
        updateModelOptions(aiSettings.provider);
        providerSelect.value = aiSettings.provider;
    } catch (error) {
        console.warn('Could not load provider models:', error);
    }
}

loadProviderModels();

// Conversation Management
let conversations = JSON.parse(localStorage.getItem('conversations') || '[]');
let currentConversationId = null;

// Export Conversations
document.getElementById('export-conversations-btn')?.addEventListener('click', () => {
    const dataStr = JSON.stringify(conversations, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mini-google-conversations-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Conversations exported successfully!');
});

// Import Conversations
document.getElementById('import-conversations-btn')?.addEventListener('click', () => {
    document.getElementById('import-file-input')?.click();
});

document.getElementById('import-file-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const imported = JSON.parse(event.target.result);
            if (Array.isArray(imported)) {
                conversations = [...conversations, ...imported];
                localStorage.setItem('conversations', JSON.stringify(conversations));
                renderConversationList();
                showToast(`Imported ${imported.length} conversation(s)`);
            } else {
                showToast('Invalid file format');
            }
        } catch (error) {
            showToast('Error importing file');
        }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
});

// Conversation Sidebar
const sidebar = document.getElementById('conversation-sidebar');
const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
const sidebarCloseBtn = document.getElementById('sidebar-close-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const conversationList = document.getElementById('conversation-list');

sidebarToggleBtn?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    sidebarToggleBtn.classList.toggle('hidden');
});

sidebarCloseBtn?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    sidebarToggleBtn.classList.remove('hidden');
});

newChatBtn?.addEventListener('click', () => {
    startNewConversation();
});

function startNewConversation() {
    conversationHistory = [];
    currentConversationId = null;
    clearSearch();
    sidebar.classList.remove('open');
    sidebarToggleBtn.classList.remove('hidden');
    searchInput.focus();
}

function saveCurrentConversation() {
    if (conversationHistory.length === 0) return;
    
    const title = conversationHistory[0]?.content?.substring(0, 50) || 'New Conversation';
    const conversation = {
        id: currentConversationId || Date.now(),
        title: title,
        messages: conversationHistory,
        timestamp: new Date().toISOString(),
        mode: currentMode
    };
    
    const index = conversations.findIndex(c => c.id === conversation.id);
    if (index >= 0) {
        conversations[index] = conversation;
    } else {
        conversations.unshift(conversation);
        currentConversationId = conversation.id;
    }
    
    // Keep only last 50 conversations
    if (conversations.length > 50) {
        conversations = conversations.slice(0, 50);
    }
    
    localStorage.setItem('conversations', JSON.stringify(conversations));
    renderConversationList();
}

function loadConversation(id) {
    const conversation = conversations.find(c => c.id === id);
    if (!conversation) return;
    
    currentConversationId = id;
    conversationHistory = conversation.messages;
    currentMode = conversation.mode || 'ai';
    
    // Update mode buttons
    if (currentMode === 'ai') {
        aiModeBtn.classList.add('active');
        searchModeBtn.classList.remove('active');
    } else {
        searchModeBtn.classList.add('active');
        aiModeBtn.classList.remove('active');
    }
    
    // Recreate conversation UI
    clearSearch();
    heroSection.classList.add('compact');
    isSearchPerformed = true;
    
    const chatMessages = document.getElementById('chat-messages');
    const mainContainer = document.querySelector('.container');
    
    conversation.messages.forEach((msg, index) => {
        if (msg.role === 'user') {
            const userDiv = document.createElement('div');
            userDiv.className = 'user-message';
            userDiv.textContent = msg.content;
            chatMessages.appendChild(userDiv);
        } else if (msg.role === 'assistant') {
            const assistantDiv = document.createElement('div');
            assistantDiv.className = 'assistant-message';
            displayAIResponse(msg.content, assistantDiv, mainContainer);
            chatMessages.appendChild(assistantDiv);
        }
    });
    
    sidebar.classList.remove('open');
    sidebarToggleBtn.classList.remove('hidden');
    mainContainer.scrollTop = mainContainer.scrollHeight;
}

function renderConversationList() {
    if (!conversationList) return;
    
    conversationList.innerHTML = '';
    
    if (conversations.length === 0) {
        conversationList.innerHTML = '<div style="padding: 1rem; color: var(--text-secondary); text-align: center;">No conversations yet</div>';
        return;
    }
    
    conversations.forEach(conv => {
        const item = document.createElement('div');
        item.className = 'conversation-item';
        if (conv.id === currentConversationId) {
            item.classList.add('active');
        }
        
        const date = new Date(conv.timestamp);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        item.innerHTML = `
            <div class="conversation-title">${conv.title}</div>
            <div class="conversation-date">${dateStr}</div>
        `;
        
        item.addEventListener('click', () => loadConversation(conv.id));
        conversationList.appendChild(item);
    });
}

// Save conversation after each AI response
const originalChatWithAI = chatWithAI;
chatWithAI = async function(userMessage) {
    const result = await originalChatWithAI.call(this, userMessage);
    saveCurrentConversation();
    return result;
};

// Add action buttons to AI responses
function addResponseActions(assistantMessageDiv) {
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'response-actions';
    actionsDiv.innerHTML = `
        <button class="response-action-btn copy-btn" title="Copy response">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Copy
        </button>
        <button class="response-action-btn regenerate-btn" title="Regenerate response">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
            </svg>
            Regenerate
        </button>
    `;
    
    assistantMessageDiv.appendChild(actionsDiv);
    
    // Copy button functionality
    const copyBtn = actionsDiv.querySelector('.copy-btn');
    copyBtn.addEventListener('click', () => {
        const responseText = assistantMessageDiv.querySelector('.ai-response').innerText;
        navigator.clipboard.writeText(responseText).then(() => {
            copyBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
                Copied!
            `;
            setTimeout(() => {
                copyBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    Copy
                `;
            }, 2000);
        });
    });
    
    // Regenerate button functionality
    const regenerateBtn = actionsDiv.querySelector('.regenerate-btn');
    regenerateBtn.addEventListener('click', async () => {
        if (conversationHistory.length < 2) return;
        
        // Remove last assistant response
        conversationHistory.pop();
        const lastUserMessage = conversationHistory[conversationHistory.length - 1]?.content;
        
        if (lastUserMessage) {
            // Remove last user message too
            conversationHistory.pop();
            
            // Regenerate
            regenerateBtn.disabled = true;
            regenerateBtn.textContent = 'Regenerating...';
            
            try {
                await performSearch(lastUserMessage);
            } catch (error) {
                console.error('Regeneration failed:', error);
            }
        }
    });
}

// Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl+K or Cmd+K - Focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
        showToast('Search focused');
    }
    
    // Ctrl+/ or Cmd+/ - Clear search
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        clearSearch();
        showToast('Search cleared');
    }
    
    // Ctrl+Shift+H - Toggle conversation sidebar
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'H') {
        e.preventDefault();
        sidebar.classList.toggle('open');
        sidebarToggleBtn.classList.toggle('hidden');
    }
    
    // Ctrl+Shift+N - New conversation
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        startNewConversation();
        showToast('New conversation started');
    }
    
    // Escape - Close sidebar
    if (e.key === 'Escape' && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        sidebarToggleBtn.classList.remove('hidden');
    }
});

// Toast notification
function showToast(message) {
    const existingToast = document.querySelector('.shortcut-toast');
    if (existingToast) existingToast.remove();
    
    const toast = document.createElement('div');
    toast.className = 'shortcut-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// Initialize
renderConversationList();

// Update displayAIResponse to use current model and add syntax highlighting
const originalDisplayAIResponse = displayAIResponse;
displayAIResponse = function(response, assistantMessageDiv, mainContainer) {
    originalDisplayAIResponse.call(this, response, assistantMessageDiv, mainContainer);
    
    // Add action buttons
    addResponseActions(assistantMessageDiv);
    
    // Apply syntax highlighting if enabled
    if (aiSettings.syntaxHighlighting && typeof Prism !== 'undefined') {
        assistantMessageDiv.querySelectorAll('pre code').forEach((block) => {
            Prism.highlightElement(block);
        });
    }
};

// Update chatWithAI to use selected model
const originalChatWithAICall = chatWithAI;
chatWithAI = async function(userMessage) {
    conversationHistory.push({
        role: 'user',
        content: userMessage
    });
    
    const requestBody = {
        messages: conversationHistory,
        provider: aiSettings.provider,
        model: aiSettings.model, // Use selected model
        temperature: 0.7,
        max_tokens: 2000
    };
    
    // CRITICAL: Add image if uploaded
    if (uploadedImage) {
        requestBody.image = uploadedImage;
        console.log('🖼️ [Model Selector] Image attached to request (size:', Math.round(uploadedImage.length / 1024), 'KB)');
    } else {
        console.log('📝 [Model Selector] Text-only request (no image)');
    }
    
    console.log('📤 [Model Selector] Sending request to API...');
    const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'AI request failed');
    }
    
    const data = await response.json();
    conversationHistory.push({
        role: 'assistant',
        content: data.response
    });
    saveHistoryEvent({
        event_type: 'chat',
        query: userMessage,
        title: 'AI conversation',
        response: data.response
    });
    
    return data;
};

// ====== FRIENDLY FEATURES ======

// Dynamic Greeting based on time of day
function updateGreeting() {
    const greetingEl = document.getElementById('dynamic-greeting');
    if (!greetingEl) return;
    
    const hour = new Date().getHours();
    let greeting, emoji;
    
    if (hour < 12) {
        greeting = "Good morning!";
        emoji = "☀️";
    } else if (hour < 18) {
        greeting = "Good afternoon!";
        emoji = "🌤️";
    } else {
        greeting = "Good evening!";
        emoji = "🌙";
    }
    
    greetingEl.textContent = `${greeting} ${emoji} How can I help you today?`;
}

// Theme Management
const themeSelect2 = document.getElementById('theme-select');
let currentTheme = localStorage.getItem('theme') || 'dark';

function applyTheme(theme) {
    if (theme === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        theme = prefersDark ? 'dark' : 'light';
    }
    
    document.body.classList.remove('light-theme', 'dark-theme');
    if (theme === 'light') {
        document.body.classList.add('light-theme');
    }
    
    currentTheme = theme;
    localStorage.setItem('theme', theme);
}

if (themeSelect2) {
    themeSelect2.value = localStorage.getItem('theme') || 'dark';
    applyTheme(themeSelect2.value);
    
    themeSelect2.addEventListener('change', (e) => {
        applyTheme(e.target.value);
        showToast(`Theme changed to ${e.target.value}`);
    });
}

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (localStorage.getItem('theme') === 'auto') {
        applyTheme('auto');
    }
});

// Typing Indicator
function showTypingIndicator(container) {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.innerHTML = `
        <div class="assistant-avatar">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" opacity="0.9"/>
                <path d="M2 17L12 22L22 17V12L12 17L2 12V17Z" fill="currentColor" opacity="0.7"/>
                <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>
            </svg>
        </div>
        <div class="typing-dots">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        </div>
        <span>Mini Google is thinking...</span>
    `;
    container.appendChild(typingDiv);
    return typingDiv;
}

// Add Follow-up Questions
function addFollowupQuestions(assistantMessageDiv, topic) {
    const followups = generateFollowupQuestions(topic);
    if (followups.length === 0) return;
    
    const followupDiv = document.createElement('div');
    followupDiv.className = 'followup-questions';
    followupDiv.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 0.5rem;">Related questions:</p>';
    
    followups.forEach(question => {
        const btn = document.createElement('button');
        btn.className = 'followup-question';
        btn.textContent = question;
        btn.addEventListener('click', () => {
            searchInput.value = question;
            searchForm.dispatchEvent(new Event('submit'));
        });
        followupDiv.appendChild(btn);
    });
    
    assistantMessageDiv.appendChild(followupDiv);
}

function generateFollowupQuestions(topic) {
    // Simple follow-up question generation
    const questions = [
        `Can you explain more about ${topic}?`,
        `What are the practical applications?`,
        `Show me an example`,
        `What are the best practices?`
    ];
    return questions.slice(0, 3);
}

// Enhanced Search with Typing Indicator
const originalPerformSearch = performSearch;
performSearch = async function(query) {
    if (!query.trim()) return;
    
    // Hide suggestions after first search
    const suggestionChips = document.getElementById('suggestion-chips');
    if (suggestionChips) {
        suggestionChips.style.display = 'none';
    }
    
    // Add to history
    addToHistory(query, '', query);
    
    // Hide hero section
    heroSection.classList.add('compact');
    isSearchPerformed = true;
    
    // Get chat container and main container
    const chatMessages = document.getElementById('chat-messages');
    const mainContainer = document.querySelector('.container');
    
    // Add user message
    const userMessageDiv = document.createElement('div');
    userMessageDiv.className = 'user-message';
    userMessageDiv.textContent = query;
    chatMessages.appendChild(userMessageDiv);
    
    // Show typing indicator
    const typingIndicator = showTypingIndicator(chatMessages);
    
    // Scroll to show typing indicator
    setTimeout(() => {
        mainContainer.scrollTop = mainContainer.scrollHeight;
    }, 100);
    
    // Clear input
    searchInput.value = '';
    
    try {
        // Check mode and route accordingly
        if (currentMode === 'ai') {
            const data = await chatWithAI(query);
            
            // Remove typing indicator
            typingIndicator.remove();
            
            // Add assistant message container
            const assistantMessageDiv = document.createElement('div');
            assistantMessageDiv.className = 'assistant-message';
            chatMessages.appendChild(assistantMessageDiv);
            
            displayAIResponse(data.response, assistantMessageDiv, mainContainer);
            
            // Add follow-up questions
            const firstWord = query.split(' ')[0].toLowerCase();
            if (['what', 'how', 'why', 'explain'].includes(firstWord)) {
                setTimeout(() => {
                    addFollowupQuestions(assistantMessageDiv, query.substring(firstWord.length).trim());
                }, 500);
            }
        } else {
            const data = await search(query);
            typingIndicator.remove();
            
            const assistantMessageDiv = document.createElement('div');
            assistantMessageDiv.className = 'assistant-message';
            chatMessages.appendChild(assistantMessageDiv);
            
            displayResults(data, query, assistantMessageDiv, mainContainer);
        }
    } catch (error) {
        typingIndicator.remove();
        
        const assistantMessageDiv = document.createElement('div');
        assistantMessageDiv.className = 'assistant-message';
        assistantMessageDiv.innerHTML = `
            <div class="assistant-header">
                <div class="assistant-avatar">MG</div>
                <span class="assistant-name">Mini Google</span>
            </div>
            <div class="error-container">
                <p>❌ ${currentMode === 'ai' ? 'AI response' : 'Search'} failed: ${error.message}</p>
            </div>
        `;
        chatMessages.appendChild(assistantMessageDiv);
    }
};

// Welcome Messages
function showWelcomeMessage() {
    const tips = [
        "💡 Tip: Press Ctrl+K to quickly focus the search box",
        "✨ Try asking questions in natural language",
        "🚀 Use the conversation history sidebar to revisit past chats",
        "⚡ Switch between different AI models in Settings",
        "📋 Click 'Copy' on any code block to copy it instantly"
    ];
    
    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    
    // Show tip after 3 seconds
    setTimeout(() => {
        if (!isSearchPerformed) {
            showToast(randomTip, 5000);
        }
    }, 3000);
}

// Enhanced Toast with Duration
function showToast(message, duration = 2000) {
    const existingToast = document.querySelector('.shortcut-toast');
    if (existingToast) existingToast.remove();
    
    const toast = document.createElement('div');
    toast.className = 'shortcut-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Initialize Friendly Features
console.log('🔧 Initializing features...');
updateGreeting();
showWelcomeMessage();
renderConversationList();

console.log('✅ Mini Google AI Ready!');
console.log('📝 Search form:', searchForm ? 'Found' : 'NOT FOUND');
console.log('🎤 Voice button:', voiceSubmitBtn ? 'Found' : 'NOT FOUND');
console.log('🔤 Search input:', searchInput ? 'Found' : 'NOT FOUND');

// Update greeting every hour
setInterval(updateGreeting, 3600000);

