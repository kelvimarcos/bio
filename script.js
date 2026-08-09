/* ---------- Reprodução HLS (Mux) ----------
   O Mux entrega .m3u8. Safari e iOS tocam nativo; nos demais navegadores
   a hls.js é carregada sob demanda, só quando existe um .m3u8 para tocar.  */
const HLS_CDN = 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js';
let hlsCarregando = null;

function carregarHls() {
    if (window.Hls) return Promise.resolve(window.Hls);

    if (!hlsCarregando) {
        hlsCarregando = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = HLS_CDN;
            script.onload = () => resolve(window.Hls);
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    return hlsCarregando;
}

// Miniatura do próprio Mux, usada como poster enquanto o vídeo carrega
function posterDoMux(src) {
    const achou = /stream\.mux\.com\/([^./?]+)\.m3u8/.exec(src || '');
    return achou ? `https://image.mux.com/${achou[1]}/thumbnail.jpg?time=0` : '';
}

function destruirHls(elemento) {
    if (elemento && elemento._hls) {
        elemento._hls.destroy();
        elemento._hls = null;
    }
}

// Aponta o <video> para a fonte, escolhendo o caminho certo (.m3u8 ou arquivo)
function definirFonteDoVideo(elemento, src) {
    destruirHls(elemento);

    const ehHls = /\.m3u8(\?|$)/i.test(src);

    if (!ehHls) {
        elemento.src = src;
        elemento.load();
        return;
    }

    // Safari e iOS tocam HLS sem biblioteca
    if (elemento.canPlayType('application/vnd.apple.mpegurl')) {
        elemento.src = src;
        elemento.load();
        return;
    }

    carregarHls()
        .then((Hls) => {
            if (!Hls || !Hls.isSupported()) {
                elemento.src = src;
                elemento.load();
                return;
            }

            const hls = new Hls({ enableWorker: true });
            hls.loadSource(src);
            hls.attachMedia(elemento);
            elemento._hls = hls;
        })
        .catch(() => {
            elemento.src = src;
            elemento.load();
        });
}

const popup = document.getElementById('video-popup');
const popupBox = popup ? popup.querySelector('.popup-box') : null;
const video = popup ? popup.querySelector('.popup-video') : null;
const openBtn = document.getElementById('open-popup');
const closeBtn = document.getElementById('close-popup');
const muteBtn = document.getElementById('mute-btn');
const expandBtn = document.getElementById('popup-expand');

// O aviso de som some de vez depois do primeiro clique no botão
let avisoSomVisto = false;
const chatBubble = document.getElementById('chat-bubble');
const progressContainer = document.getElementById('story-progress');
const shareBtn = document.getElementById('share-btn');
/* Vídeos do popup da história (topo).
   Playback ID do Mux vira: https://stream.mux.com/PLAYBACK_ID.m3u8 */
const stories = [
    { src: 'https://stream.mux.com/Bip1E47IJ9GFIdTXvzC4x9heMzkRGPD2TBZpv56xo7E.m3u8' }

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

    const poster = posterDoMux(stories[index].src);
    if (poster) video.poster = poster;

    popup.classList.add('is-loading');
    definirFonteDoVideo(video, stories[index].src);
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
    isMuted = true; // começa sem som; o usuário libera no botão
    isPaused = false;
    if (muteBtn) {
        muteBtn.textContent = '🔇';
        muteBtn.setAttribute('aria-label', 'Ativar som');
    }
    popup.classList.toggle('is-hint', !avisoSomVisto);
    loadStory(0);
    setTimeout(startStoryProgress, 120);
}

function closePopup() {
    if (!popup || !video) return;

    popup.classList.remove('active', 'is-loading');
    clearStoryTimer();
    video.pause();
    video.currentTime = 0;
    destruirHls(video);
    video.removeAttribute('src');
    video.load();
    if (popupBox) popupBox.style.removeProperty('--ratio'); // volta ao padrão do CSS
    progressElapsed = 0;
    isMuted = true;
    isPaused = false;
    if (muteBtn) {
        muteBtn.textContent = '🔇';
        muteBtn.setAttribute('aria-label', 'Ativar som');
    }
    document.body.style.overflow = '';
}

if (openBtn) openBtn.addEventListener('click', openPopup);
if (closeBtn) closeBtn.addEventListener('click', closePopup);

if (expandBtn) {
    expandBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleFullscreen(popupBox, video);
    });
}

if (muteBtn && video) {
    muteBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        isMuted = !isMuted;
        video.muted = isMuted;
        muteBtn.textContent = isMuted ? '🔇' : '🔊';
        muteBtn.setAttribute('aria-label', isMuted ? 'Ativar som' : 'Silenciar');

        avisoSomVisto = true;
        popup.classList.remove('is-hint');
    });
}

/* Toque rápido navega; segurar pausa enquanto o dedo estiver na tela */
if (popupBox) {
    const POPUP_HOLD_DELAY = 220;
    let popupHoldTimer = null;
    let popupHolding = false;

    function ehBotaoDoPopup(target) {
        return target.closest('.popup-close') ||
            target.closest('.popup-mute') ||
            target.closest('.popup-expand');
    }

    function soltarPopup() {
        if (popupHoldTimer) clearTimeout(popupHoldTimer);
        popupHoldTimer = null;

        if (!popupHolding) return false;

        popupHolding = false;
        if (isPaused) toggleStoryPlayback(); // retoma
        return true;
    }

    function voltarPopup() {
        if (currentStoryIndex <= 0) return;

        clearStoryTimer();
        loadStory(currentStoryIndex - 1);
        setTimeout(startStoryProgress, 80);
    }

    function avancarPopup() {
        clearStoryTimer();

        if (currentStoryIndex < stories.length - 1) {
            loadStory(currentStoryIndex + 1);
            setTimeout(startStoryProgress, 80);
        } else {
            closePopup();
        }
    }

    popupBox.addEventListener('pointerdown', (event) => {
        if (ehBotaoDoPopup(event.target)) return;
        if (event.pointerType === 'mouse') return; // no PC a pausa é no clique

        if (popupHoldTimer) clearTimeout(popupHoldTimer);
        popupHolding = false;

        popupHoldTimer = setTimeout(() => {
            popupHolding = true;
            if (!isPaused) toggleStoryPlayback(); // pausa
        }, POPUP_HOLD_DELAY);
    });

    popupBox.addEventListener('pointerup', (event) => {
        if (ehBotaoDoPopup(event.target)) return;

        const noPc = event.pointerType === 'mouse';

        if (!noPc && soltarPopup()) return; // estava segurando

        const rect = popupBox.getBoundingClientRect();
        const x = event.clientX - rect.left;

        // Mobile (Instagram): terço esquerdo volta, todo o resto avança
        if (!noPc) {
            if (x < rect.width * 0.33) voltarPopup();
            else avancarPopup();
            return;
        }

        // PC: laterais navegam, centro pausa
        if (x < rect.width * 0.33) voltarPopup();
        else if (x > rect.width * 0.67) avancarPopup();
        else toggleStoryPlayback();
    });

    popupBox.addEventListener('pointercancel', soltarPopup);
    popupBox.addEventListener('pointerleave', soltarPopup);
    popupBox.addEventListener('contextmenu', (event) => event.preventDefault());
}

if (video) {
    // Indicador de carregamento enquanto o vídeo não tem dados para tocar
    ['playing', 'loadeddata', 'canplay'].forEach((evento) => {
        video.addEventListener(evento, () => popup.classList.remove('is-loading'));
    });

    ['waiting', 'stalled'].forEach((evento) => {
        video.addEventListener(evento, () => popup.classList.add('is-loading'));
    });

    video.addEventListener('ended', () => {
        goToNextStory();
    });

    video.addEventListener('loadedmetadata', () => {
        // A caixa assume a proporção real do vídeo (retrato, quadrado ou paisagem)
        if (popupBox && video.videoWidth && video.videoHeight) {
            popupBox.style.setProperty('--ratio', (video.videoWidth / video.videoHeight).toFixed(4));
        }

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

/* ---------- Stories "Passou por aqui" ----------
   Cada bolinha é um artista independente, com sua própria lista de arquivos.
   Ao terminar os arquivos de um artista aparece o convite para o próximo;
   sem clique, o popup fecha sozinho.                                        */
const storiesTrack = document.querySelector('.stories__track');
const storyButtons = Array.from(document.querySelectorAll('.story__btn'));
const videoModal = document.getElementById('video-modal');
const videoModalPlayer = document.getElementById('video-modal-player');
const videoModalClose = document.getElementById('video-modal-close');
const videoModalBars = document.getElementById('video-modal-bars');
const videoModalBox = videoModal ? videoModal.querySelector('.video-modal__box') : null;
const videoModalMute = document.getElementById('video-modal-mute');
const videoModalExpand = document.getElementById('video-modal-expand');
const videoModalEndBtn = document.getElementById('video-modal-next-group');
const videoModalEndGo = document.getElementById('video-modal-end-go');
const videoModalEndExit = document.getElementById('video-modal-end-exit');
const videoModalEndCover = document.getElementById('video-modal-end-cover');
const videoModalEndName = document.getElementById('video-modal-end-name');
const videoModalCount = document.getElementById('video-modal-count');

const STORY_IMAGE_DURATION = 10000; // imagem fica 10s; vídeo usa a própria duração
const STORY_END_COUNTDOWN = 10;     // segundos até seguir para o próximo artista

// Monta a lista de artistas a partir do data-items de cada bolinha
const storyGroups = storyButtons.map((btn) => ({
    nome: (btn.querySelector('.story__label') || {}).textContent || '',
    capa: (btn.querySelector('.story__cover') || {}).src || '',
    itens: (btn.dataset.items || '')
        .split('|')
        .map((parte) => parte.trim())
        .filter(Boolean)
        .map((parte) => {
            const corte = parte.indexOf(':');
            return {
                tipo: parte.slice(0, corte).trim(),
                src: parte.slice(corte + 1).trim()
            };
        })
        .filter((item) => item.src)
}));

let groupIndex = -1;        // artista atual
let itemIndex = 0;          // arquivo atual dentro do artista
let storyMedia = null;      // <img> ou <video> em exibição
let storyDuration = STORY_IMAGE_DURATION;
let storyElapsed = 0;
let storyLastTick = 0;
let storyRaf = null;
let storyPaused = false;
let storyMuted = true; // começa sem som; o usuário libera no botão
let endTimer = null;

function currentGroup() {
    return storyGroups[groupIndex] || null;
}

function buildStoryBars() {
    if (!videoModalBars) return;

    const total = currentGroup() ? currentGroup().itens.length : 0;

    videoModalBars.innerHTML = Array.from({ length: total })
        .map(() => '<span class="video-modal__bar"><span class="video-modal__fill"></span></span>')
        .join('');
}

function paintStoryBars() {
    if (!videoModalBars) return;

    const percent = storyDuration > 0
        ? Math.min(100, (storyElapsed / storyDuration) * 100)
        : 0;

    videoModalBars.querySelectorAll('.video-modal__fill').forEach((fill, index) => {
        if (index < itemIndex) fill.style.width = '100%';
        else if (index === itemIndex) fill.style.width = `${percent}%`;
        else fill.style.width = '0%';
    });
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

    if (storyElapsed >= storyDuration) goToItem(1);
}

function startStoryLoop() {
    stopStoryLoop();
    storyLastTick = performance.now();
    storyRaf = requestAnimationFrame(storyLoop);
}

function clearStoryMedia() {
    if (storyMedia && storyMedia.tagName === 'VIDEO') {
        storyMedia.pause();
        destruirHls(storyMedia);
        storyMedia.removeAttribute('src');
        storyMedia.load();
    }

    videoModalPlayer.innerHTML = '';
    storyMedia = null;
}

function clearEndCard() {
    if (endTimer) clearInterval(endTimer);
    endTimer = null;
    if (videoModal) videoModal.classList.remove('is-end');
}

function closeStoryModal() {
    if (!videoModal) return;

    stopStoryLoop();
    clearStoryMedia();
    clearEndCard();
    videoModal.classList.remove('active', 'is-paused', 'is-image', 'is-hint', 'is-loading');
    groupIndex = -1;
    itemIndex = 0;
    storyElapsed = 0;
    storyPaused = false;
    document.body.style.overflow = '';
}

// Liga/desliga o som do story
function setStoryMuted(muted) {
    storyMuted = muted;

    if (storyMedia && storyMedia.tagName === 'VIDEO') storyMedia.muted = muted;

    if (videoModalMute) {
        videoModalMute.textContent = muted ? '🔇' : '🔊';
        videoModalMute.setAttribute('aria-label', muted ? 'Ativar som' : 'Silenciar');
    }

    videoModal.classList.toggle('is-hint', muted && !avisoSomVisto);
}

function showItem(index) {
    const grupo = currentGroup();
    if (!grupo || !grupo.itens[index]) return;

    const item = grupo.itens[index];

    stopStoryLoop();
    clearStoryMedia();
    clearEndCard();

    itemIndex = index;
    storyElapsed = 0;
    storyPaused = false;
    videoModal.classList.remove('is-paused');

    const isVideo = item.tipo === 'video';
    videoModal.classList.toggle('is-image', !isVideo);

    if (isVideo) {
        const video = document.createElement('video');
        video.playsInline = true;
        video.autoplay = true;
        video.preload = 'auto';
        video.muted = storyMuted;
        video.setAttribute('playsinline', '');

        const poster = posterDoMux(item.src);
        if (poster) video.poster = poster;

        // Indicador enquanto o vídeo não tem dados suficientes
        videoModal.classList.add('is-loading');
        ['playing', 'loadeddata', 'canplay'].forEach((evento) => {
            video.addEventListener(evento, () => videoModal.classList.remove('is-loading'));
        });
        ['waiting', 'stalled'].forEach((evento) => {
            video.addEventListener(evento, () => videoModal.classList.add('is-loading'));
        });

        definirFonteDoVideo(video, item.src); // aceita .mp4 e .m3u8 do Mux

        video.addEventListener('loadedmetadata', () => {
            storyDuration = (video.duration && Number.isFinite(video.duration))
                ? video.duration * 1000
                : STORY_IMAGE_DURATION;
        });

        video.addEventListener('ended', () => goToItem(1));

        video.play().catch(() => {
            // navegador bloqueou o som: repete mudo
            setStoryMuted(true);
            video.play().catch(() => {});
        });

        storyDuration = STORY_IMAGE_DURATION; // até a duração real chegar
        storyMedia = video;
        videoModalPlayer.appendChild(video);
    } else {
        const img = document.createElement('img');
        img.src = item.src;
        img.alt = '';

        videoModal.classList.remove('is-loading'); // imagem não precisa de espera
        storyDuration = STORY_IMAGE_DURATION;
        storyMedia = img;
        videoModalPlayer.appendChild(img);
    }

    paintStoryBars();
    startStoryLoop();
}

function openGroup(index) {
    if (!videoModal || !storyGroups[index] || !storyGroups[index].itens.length) return;

    groupIndex = index;
    buildStoryBars();
    setStoryMuted(storyMuted); // garante o ícone certo ao abrir

    videoModal.classList.add('active');
    document.body.style.overflow = 'hidden';

    showItem(0);
}

// Fim do artista: convida para o próximo e fecha se ninguém clicar
function showEndCard() {
    const proximo = storyGroups[groupIndex + 1];

    stopStoryLoop();

    if (storyMedia && storyMedia.tagName === 'VIDEO') storyMedia.pause();

    // Era o último artista: fecha direto
    if (!proximo || !proximo.itens.length) {
        closeStoryModal();
        return;
    }

    if (videoModalEndCover) videoModalEndCover.src = proximo.capa;
    if (videoModalEndName) videoModalEndName.textContent = proximo.nome;

    videoModal.classList.add('is-end');

    let restante = STORY_END_COUNTDOWN;
    if (videoModalCount) videoModalCount.textContent = restante;

    if (endTimer) clearInterval(endTimer);
    endTimer = setInterval(() => {
        restante -= 1;
        if (videoModalCount) videoModalCount.textContent = Math.max(0, restante);

        // Acabou o tempo: segue para o próximo artista
        if (restante <= 0) goToNextGroup();
    }, 1000);
}

function goToNextGroup() {
    if (groupIndex < 0) return; // popup já fechado

    const proximo = groupIndex + 1;

    clearEndCard();

    if (!storyGroups[proximo] || !storyGroups[proximo].itens.length) {
        closeStoryModal();
        return;
    }

    openGroup(proximo);
}

// Navega apenas dentro do artista atual
function goToItem(step) {
    const grupo = currentGroup();
    if (!grupo) return;

    const proximo = itemIndex + step;

    if (proximo < 0) return;                       // já está no primeiro
    if (proximo >= grupo.itens.length) {           // acabou o artista
        showEndCard();
        return;
    }

    showItem(proximo);
}

function setStoryPaused(paused) {
    storyPaused = paused;
    videoModal.classList.toggle('is-paused', paused);

    if (!storyMedia || storyMedia.tagName !== 'VIDEO') return;

    if (paused) storyMedia.pause();
    else storyMedia.play().catch(() => {});
}

// Tela cheia do popup (com alternativa para o iOS, que só aceita no vídeo)
function toggleFullscreen(element, media) {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        return;
    }

    if (element.requestFullscreen) {
        element.requestFullscreen().catch(() => {});
    } else if (element.webkitRequestFullscreen) {
        element.webkitRequestFullscreen();
    } else if (media && media.webkitEnterFullscreen) {
        media.webkitEnterFullscreen();
    }
}

if (storiesTrack) {
    storiesTrack.addEventListener('click', (event) => {
        const btn = event.target.closest('.story__btn');
        if (!btn) return;

        openGroup(storyButtons.indexOf(btn));
    });
}

/* Mobile: toque rápido nas laterais navega, segurar pausa enquanto o dedo fica na tela.
   PC: clique padrão — laterais navegam, centro pausa/retoma.                          */
const HOLD_DELAY = 220; // ms para diferenciar toque de "segurar"

let holdTimer = null;
let isHolding = false;

function cancelHold() {
    if (holdTimer) clearTimeout(holdTimer);
    holdTimer = null;
}

function releaseHold() {
    cancelHold();

    if (!isHolding) return false; // era toque rápido

    isHolding = false;
    setStoryPaused(false);
    return true; // era "segurar": não navega
}

if (videoModalPlayer) {
    videoModalPlayer.addEventListener('pointerdown', (event) => {
        if (videoModal.classList.contains('is-end')) return;
        if (event.pointerType === 'mouse') return; // no PC a pausa é no clique

        cancelHold();
        isHolding = false;

        holdTimer = setTimeout(() => {
            isHolding = true;
            setStoryPaused(true);
        }, HOLD_DELAY);
    });

    videoModalPlayer.addEventListener('pointerup', (event) => {
        if (videoModal.classList.contains('is-end')) return;

        const noPc = event.pointerType === 'mouse';

        if (!noPc && releaseHold()) return; // estava segurando: só retoma

        const rect = videoModalPlayer.getBoundingClientRect();
        const x = event.clientX - rect.left;

        // Mobile (Instagram): terço esquerdo volta, todo o resto avança
        if (!noPc) {
            if (x < rect.width * 0.33) goToItem(-1);
            else goToItem(1);
            return;
        }

        // PC: laterais navegam, centro pausa
        if (x < rect.width * 0.33) goToItem(-1);
        else if (x > rect.width * 0.67) goToItem(1);
        else setStoryPaused(!storyPaused);
    });

    // Dedo saiu da área ou o gesto foi cancelado: retoma
    videoModalPlayer.addEventListener('pointercancel', releaseHold);
    videoModalPlayer.addEventListener('pointerleave', releaseHold);

    // Segurar não deve arrastar a imagem nem abrir menu do sistema
    videoModalPlayer.addEventListener('dragstart', (event) => event.preventDefault());
    videoModalPlayer.addEventListener('contextmenu', (event) => event.preventDefault());
}

// Foto do próximo e botão "Avançar" fazem a mesma coisa
if (videoModalEndBtn) videoModalEndBtn.addEventListener('click', goToNextGroup);
if (videoModalEndGo) videoModalEndGo.addEventListener('click', goToNextGroup);
if (videoModalEndExit) videoModalEndExit.addEventListener('click', closeStoryModal);

if (videoModalMute) {
    videoModalMute.addEventListener('click', (event) => {
        event.stopPropagation();
        avisoSomVisto = true;
        setStoryMuted(!storyMuted);
        videoModal.classList.remove('is-hint');
    });
}

if (videoModalExpand) {
    videoModalExpand.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleFullscreen(videoModalBox, storyMedia);
    });
}

if (videoModalClose) videoModalClose.addEventListener('click', closeStoryModal);

if (videoModal) {
    videoModal.addEventListener('click', (event) => {
        if (event.target === videoModal) closeStoryModal();
    });
}

document.addEventListener('keydown', (e) => {
    if (!videoModal || !videoModal.classList.contains('active')) return;

    if (e.key === 'Escape') closeStoryModal();
    if (e.key === 'ArrowRight') goToItem(1);
    if (e.key === 'ArrowLeft') goToItem(-1);
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


