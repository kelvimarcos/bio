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

/* ---------- Stories "Passou por aqui" ---------- */
const storiesTrack = document.querySelector('.stories__track');
const storyButtons = Array.from(document.querySelectorAll('.story__btn'));
const videoModal = document.getElementById('video-modal');
const videoModalPlayer = document.getElementById('video-modal-player');
const videoModalClose = document.getElementById('video-modal-close');
const videoModalBars = document.getElementById('video-modal-bars');
const videoPrevBtn = document.getElementById('video-prev');
const videoNextBtn = document.getElementById('video-next');

const STORY_IMAGE_DURATION = 15000; // imagem fica 15s; vídeo usa a própria duração

let storyIndex = -1;
let storyMedia = null;      // <img> ou <video> em exibição
let storyDuration = STORY_IMAGE_DURATION;
let storyElapsed = 0;       // ms já corridos do story atual
let storyLastTick = 0;
let storyRaf = null;
let storyPaused = false;

function buildStoryBars() {
    if (!videoModalBars) return;

    videoModalBars.innerHTML = storyButtons
        .map(() => '<span class="video-modal__bar"><span class="video-modal__fill"></span></span>')
        .join('');
}

function paintStoryBars() {
    if (!videoModalBars) return;

    const percent = storyDuration > 0
        ? Math.min(100, (storyElapsed / storyDuration) * 100)
        : 0;

    videoModalBars.querySelectorAll('.video-modal__fill').forEach((fill, index) => {
        if (index < storyIndex) fill.style.width = '100%';
        else if (index === storyIndex) fill.style.width = `${percent}%`;
        else fill.style.width = '0%';
    });

    if (videoPrevBtn) videoPrevBtn.disabled = storyIndex <= 0;
    if (videoNextBtn) videoNextBtn.disabled = storyIndex >= storyButtons.length - 1;
}

function stopStoryLoop() {
    if (storyRaf) cancelAnimationFrame(storyRaf);
    storyRaf = null;
}

function storyLoop(now) {
    storyRaf = requestAnimationFrame(storyLoop);

    if (storyPaused) {
        storyLastTick = now;
        return;
    }

    // Vídeo manda no relógio; imagem conta o tempo que passou
    if (storyMedia && storyMedia.tagName === 'VIDEO') {
        if (storyMedia.duration && Number.isFinite(storyMedia.duration)) {
            storyDuration = storyMedia.duration * 1000;
        }
        storyElapsed = storyMedia.currentTime * 1000;
    } else {
        storyElapsed += now - storyLastTick;
    }

    storyLastTick = now;
    paintStoryBars();

    if (storyElapsed >= storyDuration) goToStory(1);
}

function startStoryLoop() {
    stopStoryLoop();
    storyLastTick = performance.now();
    storyRaf = requestAnimationFrame(storyLoop);
}

function clearStoryMedia() {
    if (storyMedia && storyMedia.tagName === 'VIDEO') {
        storyMedia.pause();
        storyMedia.removeAttribute('src');
        storyMedia.load();
    }

    videoModalPlayer.innerHTML = '';
    storyMedia = null;
}

function closeStoryModal() {
    if (!videoModal) return;

    stopStoryLoop();
    clearStoryMedia();
    videoModal.classList.remove('active', 'is-paused');
    storyIndex = -1;
    storyElapsed = 0;
    storyPaused = false;
    document.body.style.overflow = '';
}

function openStoryAt(index) {
    if (!videoModal || index < 0 || index >= storyButtons.length) return;

    const btn = storyButtons[index];
    const src = btn.dataset.src;
    if (!src) return;

    stopStoryLoop();
    clearStoryMedia();

    storyIndex = index;
    storyElapsed = 0;
    storyPaused = false;
    videoModal.classList.remove('is-paused');

    if (btn.dataset.type === 'video') {
        const video = document.createElement('video');
        video.src = src;
        video.playsInline = true;
        video.autoplay = true;
        video.preload = 'auto';
        video.setAttribute('playsinline', '');

        // Só um vídeo por vez e sem estourar o som de cara
        video.addEventListener('loadedmetadata', () => {
            storyDuration = (video.duration && Number.isFinite(video.duration))
                ? video.duration * 1000
                : STORY_IMAGE_DURATION;
        });

        video.addEventListener('ended', () => goToStory(1));

        video.play().catch(() => {
            // navegador bloqueou o som: repete mudo
            video.muted = true;
            video.play().catch(() => {});
        });

        storyDuration = STORY_IMAGE_DURATION; // até a duração real chegar
        storyMedia = video;
        videoModalPlayer.appendChild(video);
    } else {
        const img = document.createElement('img');
        img.src = src;
        img.alt = '';

        storyDuration = STORY_IMAGE_DURATION;
        storyMedia = img;
        videoModalPlayer.appendChild(img);
    }

    videoModal.classList.add('active');
    document.body.style.overflow = 'hidden';

    paintStoryBars();
    startStoryLoop();
}

function goToStory(step) {
    const next = storyIndex + step;

    if (next < 0) return;

    // passou do último: fecha, como nos stories
    if (next >= storyButtons.length) {
        closeStoryModal();
        return;
    }

    openStoryAt(next);
}

function toggleStoryPause() {
    storyPaused = !storyPaused;
    videoModal.classList.toggle('is-paused', storyPaused);

    if (!storyMedia || storyMedia.tagName !== 'VIDEO') return;

    if (storyPaused) storyMedia.pause();
    else storyMedia.play().catch(() => {});
}

if (storiesTrack) {
    buildStoryBars();

    storiesTrack.addEventListener('click', (event) => {
        const btn = event.target.closest('.story__btn');
        if (!btn) return;

        openStoryAt(storyButtons.indexOf(btn));
    });
}

if (videoModalPlayer) {
    videoModalPlayer.addEventListener('click', toggleStoryPause);
}

if (videoPrevBtn) videoPrevBtn.addEventListener('click', () => goToStory(-1));
if (videoNextBtn) videoNextBtn.addEventListener('click', () => goToStory(1));
if (videoModalClose) videoModalClose.addEventListener('click', closeStoryModal);

if (videoModal) {
    videoModal.addEventListener('click', (event) => {
        if (event.target === videoModal) closeStoryModal();
    });
}

document.addEventListener('keydown', (e) => {
    if (!videoModal || !videoModal.classList.contains('active')) return;

    if (e.key === 'Escape') closeStoryModal();
    if (e.key === 'ArrowRight') goToStory(1);
    if (e.key === 'ArrowLeft') goToStory(-1);
});

/* ---------- Escala do ícone: começa só com a página 100% carregada ---------- */
window.addEventListener('load', () => {
    document.body.classList.add('is-loaded');
});

/* ---------- Balão: chat simulado em tempo real ---------- */
const chatBubbleText = chatBubble ? chatBubble.querySelector('.chat-bubble__text') : null;

const BUBBLE_START = 400;    // tempo até o balão aparecer (já em "digitando")

// O \n é a quebra de linha do balão
const BUBBLE_MESSAGES = [
    'Oopa! 👋',
    'Conheça um pouco\nda minha trajetória.',
    'Clique aqui'
];

// Quanto tempo o "digitando" roda antes de cada mensagem (mesma ordem acima)
const BUBBLE_TYPING = [900, 2000, 1000];

// Quanto tempo cada mensagem fica na tela (a última fica fixa)
const BUBBLE_READ = [1800, 5000, null];

// Sobra para mensagens novas sem tempo definido: calcula pelo tamanho do texto
const TYPING_PER_CHAR = 45;  // ms por caractere
const TYPING_MIN = 900;
const TYPING_MAX = 2400;

function typingTimeFor(index) {
    if (typeof BUBBLE_TYPING[index] === 'number') return BUBBLE_TYPING[index];

    const length = (BUBBLE_MESSAGES[index] || '').replace(/\s+/g, ' ').trim().length;
    return Math.min(TYPING_MAX, Math.max(TYPING_MIN, length * TYPING_PER_CHAR));
}

let bubbleTimers = [];

function scheduleBubble(fn, delay) {
    bubbleTimers.push(setTimeout(fn, delay));
}

function hideChatBubble() {
    bubbleTimers.forEach(clearTimeout);
    bubbleTimers = [];

    if (!chatBubble) return;
    chatBubble.classList.remove('is-visible');
    setBubbleTyping(false);
}

// Liga/desliga o estado "digitando" no balão
function setBubbleTyping(typing) {
    if (!chatBubble) return;

    chatBubble.classList.toggle('is-typing', typing);
}

function showBubbleMessage(index) {
    setBubbleTyping(false);

    chatBubbleText.textContent = BUBBLE_MESSAGES[index];
    chatBubble.classList.add('is-message');

    // reinicia a animação de "pop" a cada mensagem nova
    chatBubble.classList.remove('is-pop');
    void chatBubble.offsetWidth;
    chatBubble.classList.add('is-pop');

    if (index >= BUBBLE_MESSAGES.length - 1) return;

    scheduleBubble(() => {
        chatBubble.classList.remove('is-message'); // volta pro "digitando"
        setBubbleTyping(true);
        scheduleBubble(() => showBubbleMessage(index + 1), typingTimeFor(index + 1));
    }, BUBBLE_READ[index] ?? 1800);
}

if (chatBubble && chatBubbleText) {
    scheduleBubble(() => {
        chatBubble.classList.add('is-visible'); // entra já em "digitando"
        setBubbleTyping(true);
        scheduleBubble(() => showBubbleMessage(0), typingTimeFor(0));
    }, BUBBLE_START);

    chatBubble.addEventListener('click', () => {
        hideChatBubble();
        openPopup();
    });
}


