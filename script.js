const popup = document.getElementById('video-popup');
const popupBox = popup ? popup.querySelector('.popup-box') : null;
const video = popup ? popup.querySelector('.popup-video') : null;
const openBtn = document.getElementById('open-popup');
const closeBtn = document.getElementById('close-popup');
const muteBtn = document.getElementById('mute-btn');
const chatBubble = document.getElementById('chat-bubble');
const progressContainer = document.getElementById('story-progress');
const shareBtn = document.getElementById('share-btn');
const stories = [
    { src: 'video/video8.mp4' }

];
 
let currentStoryIndex = 0;
let progressTimer = null;
let progressStartTime = 0;
let progressElapsed = 0;
let isMuted = false;
let isPaused = false;

function resetProgressBar() {
    if (!progressContainer) return;

    progressContainer.innerHTML = stories.map(() => `
        <span class="story-progress__segment">
            <span class="story-progress__fill"></span>
        </span>
    `).join('');
}

function getCurrentStoryDuration() {
    const storyDuration = stories[currentStoryIndex]?.duration;
    const duration = (typeof storyDuration === 'number' && storyDuration > 0) ? storyDuration : (video ? video.duration : 0);
    return (typeof duration === 'number' && duration > 0 && Number.isFinite(duration)) ? duration : 5;
}

function updateProgressBar() {
    if (!progressContainer) return;

    const segments = progressContainer.querySelectorAll('.story-progress__segment');
    const duration = getCurrentStoryDuration();
    const elapsed = Math.min(progressElapsed, duration);
    const percentage = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0;

    segments.forEach((segment, index) => {
        const fill = segment.querySelector('.story-progress__fill');

        if (index < currentStoryIndex) {
            fill.style.width = '100%';
        } else if (index === currentStoryIndex) {
            fill.style.width = `${percentage}%`;
        } else {
            fill.style.width = '0%';
        }
    });
}

function clearStoryTimer() {
    if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
    }
}

function startStoryProgress() {
    clearStoryTimer();
    const duration = getCurrentStoryDuration();
    progressStartTime = performance.now() - (progressElapsed * 1000);
    updateProgressBar();

    progressTimer = setInterval(() => {
        if (isPaused) return;

        progressElapsed = (performance.now() - progressStartTime) / 1000;
        updateProgressBar();

        if (progressElapsed >= duration) {
            clearStoryTimer();
            goToNextStory();
        }
    }, 100);
}

function loadStory(index) {
    currentStoryIndex = index;
    progressElapsed = 0;
    isPaused = false;

    if (!stories[index] || !video) {
        closePopup();
        return;
    }

    video.src = stories[index].src;
    video.load();
    video.currentTime = 0;
    video.muted = isMuted;

    video.play().catch((error) => {
        console.warn('Falha ao reproduzir vídeo automaticamente, tentando com mudo.', error);
        isMuted = true;
        video.muted = true;
        if (muteBtn) {
            muteBtn.textContent = '🔇';
            muteBtn.setAttribute('aria-label', 'Ativar som');
        }
        video.play().catch(() => {});
    });
}

function goToNextStory() {
    clearStoryTimer();

    if (currentStoryIndex < stories.length - 1) {
        loadStory(currentStoryIndex + 1);
        setTimeout(startStoryProgress, 80);
    } else {
        closePopup();
    }
}

function toggleStoryPlayback() {
    if (isPaused) {
        isPaused = false;
        video.play().catch(() => {});
        startStoryProgress();
        return;
    }

    isPaused = true;
    clearStoryTimer();
    progressElapsed = Math.min((performance.now() - progressStartTime) / 1000, getCurrentStoryDuration());
    video.pause();
}

function openPopup() {
    if (!popup || !video) return;

    popup.classList.add('active');
    hideChatBubble();
    document.body.style.overflow = 'hidden';
    resetProgressBar();
    updateProgressBar();
    isMuted = false;
    isPaused = false;
    if (muteBtn) {
        muteBtn.textContent = '🔊';
        muteBtn.setAttribute('aria-label', 'Silenciar');
    }
    loadStory(0);
    setTimeout(startStoryProgress, 120);
}

function closePopup() {
    if (!popup || !video) return;

    popup.classList.remove('active');
    clearStoryTimer();
    video.pause();
    video.currentTime = 0;
    video.removeAttribute('src');
    video.load();
    progressElapsed = 0;
    isMuted = false;
    isPaused = false;
    if (muteBtn) {
        muteBtn.textContent = '🔊';
        muteBtn.setAttribute('aria-label', 'Silenciar');
    }
    document.body.style.overflow = '';
}

if (openBtn) openBtn.addEventListener('click', openPopup);
if (closeBtn) closeBtn.addEventListener('click', closePopup);

if (muteBtn && video) {
    muteBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        isMuted = !isMuted;
        video.muted = isMuted;
        muteBtn.textContent = isMuted ? '🔇' : '🔊';
        muteBtn.setAttribute('aria-label', isMuted ? 'Ativar som' : 'Silenciar');
    });
}

if (popupBox) {
    popupBox.addEventListener('click', (event) => {
        if (event.target.closest('.popup-close') || event.target.closest('.popup-mute')) {
            return;
        }

        const rect = popupBox.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const halfWidth = rect.width / 2;

        if (clickX < halfWidth * 0.8) {
            if (currentStoryIndex > 0) {
                clearStoryTimer();
                loadStory(currentStoryIndex - 1);
                setTimeout(startStoryProgress, 80);
            }
            return;
        }

        if (clickX > halfWidth * 1.2) {
            clearStoryTimer();
            if (currentStoryIndex < stories.length - 1) {
                loadStory(currentStoryIndex + 1);
                setTimeout(startStoryProgress, 80);
            } else {
                closePopup();
            }
            return;
        }

        toggleStoryPlayback();
    });
}

if (video) {
    video.addEventListener('ended', () => {
        goToNextStory();
    });

    video.addEventListener('loadedmetadata', () => {
        if (popup && popup.classList.contains('active')) {
            progressElapsed = 0;
            startStoryProgress();
        }
    });
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && popup && popup.classList.contains('active')) closePopup();
});

// Compartilhar link
if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
        const url = window.location.href;
        if (navigator.share) {
            try { await navigator.share({ url }); } catch (_) {}
        } else {
            try {
                await navigator.clipboard.writeText(url);
                const img = shareBtn.querySelector('img');
                if (img) {
                    img.style.opacity = '.4';
                    setTimeout(() => (img.style.opacity = ''), 1500);
                }
            } catch (_) {}
        }
    });
}

/* ---------- Vídeos em stories: abre no popup e navega entre todos ---------- */
const storiesTrack = document.querySelector('.stories__track');
const storyButtons = Array.from(document.querySelectorAll('.story__btn'));
const videoModal = document.getElementById('video-modal');
const videoModalPlayer = document.getElementById('video-modal-player');
const videoModalClose = document.getElementById('video-modal-close');
const videoModalBars = document.getElementById('video-modal-bars');
const videoPrevBtn = document.getElementById('video-prev');
const videoNextBtn = document.getElementById('video-next');

let currentVideoIndex = -1;

function buildVideoBars() {
    if (!videoModalBars) return;

    videoModalBars.innerHTML = storyButtons
        .map(() => '<span class="video-modal__bar"></span>')
        .join('');
}

function updateVideoBars() {
    if (!videoModalBars) return;

    videoModalBars.querySelectorAll('.video-modal__bar').forEach((bar, index) => {
        bar.classList.toggle('is-seen', index < currentVideoIndex);
        bar.classList.toggle('is-current', index === currentVideoIndex);
    });

    if (videoPrevBtn) videoPrevBtn.disabled = currentVideoIndex <= 0;
    if (videoNextBtn) videoNextBtn.disabled = currentVideoIndex >= storyButtons.length - 1;
}

function closeVideoModal() {
    if (!videoModal) return;

    videoModal.classList.remove('active');
    videoModalPlayer.innerHTML = ''; // remove o iframe = para o vídeo
    currentVideoIndex = -1;
    document.body.style.overflow = '';
}

function playVideoAt(index) {
    if (!videoModal || index < 0 || index >= storyButtons.length) return;

    const videoId = storyButtons[index].dataset.video;
    if (!videoId) return;

    currentVideoIndex = index;

    const params = new URLSearchParams({
        autoplay: '1',
        playsinline: '1',
        rel: '0',              // sem vídeos de outros canais no fim
        modestbranding: '1',   // sem logo do YouTube nos controles
        iv_load_policy: '3',   // sem anotações
        color: 'white'
    });

    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?${params}`;
    iframe.title = 'Vídeo do YouTube';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true;

    videoModalPlayer.innerHTML = ''; // só um vídeo por vez
    videoModalPlayer.appendChild(iframe);

    videoModal.classList.add('active');
    document.body.style.overflow = 'hidden';

    updateVideoBars();
}

function goToVideo(step) {
    const next = currentVideoIndex + step;

    // nas pontas a seta some, então aqui apenas ignoramos
    if (next < 0 || next >= storyButtons.length) return;

    playVideoAt(next);
}

if (storiesTrack) {
    buildVideoBars();

    storiesTrack.addEventListener('click', (event) => {
        const btn = event.target.closest('.story__btn');
        if (!btn) return;

        playVideoAt(storyButtons.indexOf(btn));
    });
}

if (videoPrevBtn) videoPrevBtn.addEventListener('click', () => goToVideo(-1));
if (videoNextBtn) videoNextBtn.addEventListener('click', () => goToVideo(1));
if (videoModalClose) videoModalClose.addEventListener('click', closeVideoModal);

if (videoModal) {
    videoModal.addEventListener('click', (event) => {
        if (event.target === videoModal) closeVideoModal();
    });
}

document.addEventListener('keydown', (e) => {
    if (!videoModal || !videoModal.classList.contains('active')) return;

    if (e.key === 'Escape') closeVideoModal();
    if (e.key === 'ArrowRight') goToVideo(1);
    if (e.key === 'ArrowLeft') goToVideo(-1);
});

/* ---------- Escala do ícone: começa só com a página 100% carregada ---------- */
window.addEventListener('load', () => {
    document.body.classList.add('is-loaded');
});

/* ---------- Balão: chat simulado em tempo real ---------- */
const chatBubbleText = chatBubble ? chatBubble.querySelector('.chat-bubble__text') : null;

const BUBBLE_START = 400;    // tempo até o balão aparecer (já em "digitando")
const BUBBLE_TYPING = 1400;  // duração do "digitando" entre as mensagens
const BUBBLE_READ = 1800;    // tempo que cada mensagem fica na tela

const BUBBLE_MESSAGES = ['Opa!', 'Clique aqui', 'Conheça minha história'];

let bubbleTimers = [];

function scheduleBubble(fn, delay) {
    bubbleTimers.push(setTimeout(fn, delay));
}

function hideChatBubble() {
    bubbleTimers.forEach(clearTimeout);
    bubbleTimers = [];

    if (!chatBubble) return;
    chatBubble.classList.remove('is-visible');
}

function showBubbleMessage(index) {
    chatBubbleText.textContent = BUBBLE_MESSAGES[index];
    chatBubble.classList.add('is-message');

    // reinicia a animação de "pop" a cada mensagem nova
    chatBubble.classList.remove('is-pop');
    void chatBubble.offsetWidth;
    chatBubble.classList.add('is-pop');

    if (index >= BUBBLE_MESSAGES.length - 1) return;

    scheduleBubble(() => {
        chatBubble.classList.remove('is-message'); // volta pro "digitando"
        scheduleBubble(() => showBubbleMessage(index + 1), BUBBLE_TYPING);
    }, BUBBLE_READ);
}

if (chatBubble && chatBubbleText) {
    scheduleBubble(() => {
        chatBubble.classList.add('is-visible'); // entra já em "digitando"
        scheduleBubble(() => showBubbleMessage(0), BUBBLE_TYPING);
    }, BUBBLE_START);

    chatBubble.addEventListener('click', () => {
        hideChatBubble();
        openPopup();
    });
}


