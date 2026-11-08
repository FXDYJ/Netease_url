"use strict";

const immersiveStorageKey = "echo-room-immersive-v1";
const immersiveFonts = ["small", "normal", "large"];
const immersiveDelays = new Map();
let immersiveFont = "normal";
let immersiveView = "all";
let immersiveFollow = true;
let immersiveScrollTarget = 0;
let immersiveRenderedTrack;
let immersiveOpener;
let immersiveTabStop;
let immersiveBrowserFullscreen = false;
let immersiveLoop;

function lyricDelaySeconds(id = state.current?.track.id) {
  return (immersiveDelays.get(id) || 0) / 1000;
}

function restoreImmersive() {
  try {
    const saved = JSON.parse(localStorage.getItem(immersiveStorageKey));
    if (immersiveFonts.includes(saved?.font)) immersiveFont = saved.font;
    if (saved?.view === "nearby") immersiveView = "nearby";
    const entries = Array.isArray(saved?.delays) ? saved.delays.slice(-100) : [];
    for (const entry of entries) {
      if (Array.isArray(entry) && typeof entry[0] === "string" && isId(entry[0]) &&
          Number.isInteger(entry[1]) && Math.abs(entry[1]) <= 10000) immersiveDelays.set(...entry);
    }
  } catch { /* Private browsers may disable local preferences. */ }
}

function saveImmersive() {
  try {
    localStorage.setItem(immersiveStorageKey, JSON.stringify({ font: immersiveFont, view: immersiveView, delays: [...immersiveDelays] }));
  } catch { immersiveFeedback("当前浏览器无法保存这项设置。"); }
}

function immersiveFeedback(message) {
  const status = $("immersive-feedback");
  status.textContent = message;
  status.hidden = !message;
}

function renderImmersiveInfo() {
  if (!$("immersive-dialog").open) return;
  const track = state.current?.track;
  $("immersive-name").textContent = track?.name || "尚未播放";
  $("immersive-artist").textContent = track?.artists || (track ? "未知歌手" : "选择一首歌开始收听");
  $("immersive-album").textContent = track?.album || "";
  $("immersive-album").hidden = !track?.album;
  $("immersive-status").textContent = $("play-status").textContent;
  const image = $("immersive-image");
  applyCover(image, track || {}, 520);
  $("immersive-cover").classList.toggle("has-image", !image.hidden);
}

function updateImmersiveControls() {
  if (!$("immersive-dialog").open) return;
  for (const key of ["toggle", "previous", "next", "like", "mode", "mute"]) {
    const original = $(key === "toggle" ? "play-toggle" : key === "like" ? "now-like" : key === "mode" ? "play-mode" : key);
    const control = $("immersive-" + key);
    control.disabled = original.disabled;
    control.querySelector("use").setAttribute("href", original.querySelector("use").getAttribute("href"));
    labelButton(control, original.getAttribute("aria-label"));
    control.classList.toggle("accent", original.classList.contains("accent"));
    if (key === "like") {
      control.classList.toggle("liked", original.classList.contains("liked"));
      control.setAttribute("aria-pressed", original.getAttribute("aria-pressed"));
    }
  }
  $("immersive-volume").value = audio.volume;
  updateImmersiveLyricControls();
}

function currentImmersiveLoop() {
  return immersiveLoop?.id === state.current?.track.id && immersiveLoop &&
    immersiveLoop.a === practiceLoop.a && immersiveLoop.b === practiceLoop.b;
}

function immersiveLineBounds() {
  const line = state.lyrics[state.lyricIndex];
  if (!line || !Number.isFinite(audio.duration)) return null;
  const next = state.lyrics.slice(state.lyricIndex + 1).find((item) => item.time > line.time);
  const delay = lyricDelaySeconds();
  const a = Math.max(0, line.time + delay);
  const b = Math.min(audio.duration, next ? next.time + delay : audio.duration);
  return b - a >= 1 ? { a, b } : null;
}

function updateImmersiveLyricControls() {
  const timed = state.lyrics.length > 0;
  $("immersive-lyric-view").disabled = !timed;
  $("immersive-follow").disabled = !timed;
  $("immersive-follow").checked = immersiveFollow;
  $("immersive-return").hidden = !timed || immersiveFollow;
  $("immersive-translate").hidden = !state.translation;
  $("immersive-translate").setAttribute("aria-pressed", String(state.translated));
  $("immersive-copy").disabled = !state.lyrics[state.lyricIndex];
  const loop = Boolean(currentImmersiveLoop());
  $("immersive-loop").disabled = !loop && !immersiveLineBounds();
  $("immersive-loop").setAttribute("aria-pressed", String(loop));
  const loopLabel = loop ? "停止句循环" : "循环当前句";
  if ($("immersive-loop").textContent !== loopLabel) $("immersive-loop").textContent = loopLabel;
  const delay = lyricDelaySeconds();
  const delayLabel = delay ? Math.abs(delay).toFixed(1) + " 秒" + (delay > 0 ? "延后" : "提前") : "0.0 秒";
  if ($("immersive-offset").textContent !== delayLabel) $("immersive-offset").textContent = delayLabel;
  for (const key of ["earlier", "later", "offset-reset"]) {
    $("immersive-options").querySelector('[data-action="immersive-' + key + '"]').disabled =
      !timed || (key === "offset-reset" ? !delay : key === "earlier" ? delay <= -10 : delay >= 10);
  }
}

function centerImmersiveLine() {
  const panel = $("immersive-lines");
  const line = panel.querySelector('[aria-current="true"]');
  if (line) {
    panel.scrollTop += line.getBoundingClientRect().top - panel.getBoundingClientRect().top -
      (panel.clientHeight - line.offsetHeight) * 0.40;
  }
  immersiveScrollTarget = panel.scrollTop;
}

function highlightImmersiveLine() {
  const panel = $("immersive-lines");
  const previous = panel.querySelector('[aria-current="true"]');
  previous?.removeAttribute("aria-current");
  previous?.classList.remove("active");
  const line = panel.querySelector('[data-index="' + state.lyricIndex + '"]');
  line?.setAttribute("aria-current", "true");
  line?.classList.add("active");
  const focused = document.activeElement?.closest(".lyric-line");
  setImmersiveTabStop(focused && panel.contains(focused) ? focused : line || panel.querySelector(".lyric-line"));
  if (immersiveFollow) centerImmersiveLine();
  updateImmersiveLyricControls();
}

function setImmersiveTabStop(line) {
  if (immersiveTabStop) immersiveTabStop.tabIndex = -1;
  immersiveTabStop = line;
  if (line) line.tabIndex = 0;
}

function renderImmersiveLyrics() {
  if (!$("immersive-dialog").open) return;
  const panel = $("immersive-lines");
  const id = state.current?.track.id;
  const changed = immersiveRenderedTrack !== id;
  const scroll = panel.scrollTop;
  const focused = document.activeElement;
  const focusedIndex = panel.contains(focused) ? focused.dataset.index : undefined;
  immersiveRenderedTrack = id;
  if (changed) {
    immersiveFeedback("");
    $("immersive-copy-value").hidden = true;
  }
  const nearby = immersiveView === "nearby" && state.lyrics.length > 0;
  const start = nearby ? Math.max(0, state.lyricIndex - 2) : 0;
  const end = nearby ? Math.max(3, state.lyricIndex + 3) : state.lyrics.length;
  const placeholder = state.current ? lyricsPlaceholder() : "播放音乐后，歌词会显示在这里。";
  panel.dataset.view = nearby ? "nearby" : "all";
  panel.innerHTML = placeholder ? '<p class="empty-lyrics">' + esc(placeholder) + '</p>' +
    (state.current && !state.current.lyricRequest ? '<button type="button" class="quiet-button" data-action="load-current-lyrics">加载歌词</button>' : '') :
    lyricMarkup(state.lyrics.slice(start, end), state.lrc, true, start);
  for (const button of panel.querySelectorAll(".lyric-line")) button.tabIndex = -1;
  if (!immersiveFollow || changed) panel.scrollTop = changed ? 0 : scroll;
  immersiveScrollTarget = panel.scrollTop;
  highlightImmersiveLine();
  if (focusedIndex !== undefined) {
    const line = changed ? null : panel.querySelector('[data-index="' + focusedIndex + '"]');
    if (line) setImmersiveTabStop(line);
    (line || panel).focus({ preventScroll: true });
  }
}

function syncImmersiveLyric() {
  if (!$("immersive-dialog").open) return;
  if (immersiveView === "nearby") renderImmersiveLyrics();
  else highlightImmersiveLine();
}

function setImmersiveFollow(value) {
  immersiveFollow = value;
  if (value) centerImmersiveLine();
  updateImmersiveLyricControls();
}

function openImmersive(_, opener) {
  if ($("lyrics-dialog").open) {
    $("lyrics-dialog").close();
    opener = $("immersive-open");
  }
  immersiveOpener = opener;
  immersiveFollow = true;
  const dialog = $("immersive-dialog");
  dialog.dataset.font = immersiveFont;
  $("immersive-font").value = immersiveFont;
  $("immersive-lyric-view").value = immersiveView;
  $("immersive-options").open = false;
  immersiveFeedback("");
  $("immersive-copy-value").hidden = true;
  showDialog("immersive-dialog");
  renderImmersiveInfo();
  renderImmersiveLyrics();
  updateImmersiveControls();
  syncTimeline();
  loadCurrentLyrics();
}

function changeImmersiveDelay(step) {
  const id = state.current?.track.id;
  if (!id || !state.lyrics.length) return;
  const old = immersiveDelays.get(id) || 0;
  const value = step === 0 ? 0 : Math.max(-10000, Math.min(10000, old + step));
  immersiveDelays.delete(id);
  if (value) immersiveDelays.set(id, value);
  if (immersiveDelays.size > 100) immersiveDelays.delete(immersiveDelays.keys().next().value);
  if (currentImmersiveLoop()) clearPracticeLoop();
  saveImmersive();
  renderLyrics();
}

function toggleImmersiveLoop() {
  if (currentImmersiveLoop()) {
    immersiveLoop = null;
    clearPracticeLoop();
    immersiveFeedback("已停止句循环。");
  } else {
    const bounds = immersiveLineBounds();
    if (!bounds) return;
    const { a, b } = bounds;
    immersiveLoop = { id: state.current.track.id, a, b };
    practiceLoop = { a, b };
    audio.currentTime = a;
    setImmersiveFollow(true);
    immersiveFeedback("正在循环 " + timeText(a) + " – " + timeText(b));
    if (audio.paused) playAudio();
  }
  updateImmersiveLyricControls();
}

async function copyImmersiveLine() {
  const line = state.lyrics[state.lyricIndex];
  if (!line) return;
  const value = [line.text, state.translated ? line.translation : ""].filter(Boolean).join("\n");
  const field = $("immersive-copy-value");
  try {
    await navigator.clipboard.writeText(value);
    immersiveFeedback("已复制当前句。");
    field.hidden = true;
    return;
  } catch { /* HTTP NAS addresses may need selection-based copying. */ }
  field.value = value;
  field.hidden = false;
  field.select();
  try {
    if (document.execCommand("copy")) {
      field.hidden = true;
      immersiveFeedback("已复制当前句。");
      return;
    }
  } catch { /* Keep the text selected. */ }
  immersiveFeedback("歌词已选中，可以手动复制。");
}

async function toggleImmersiveFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else {
      await document.documentElement.requestFullscreen();
      immersiveBrowserFullscreen = true;
    }
  } catch { $("immersive-status").textContent = "浏览器暂时无法切换全屏。"; }
}

const immersiveActions = {
  immersive: openImmersive,
  "immersive-fullscreen": toggleImmersiveFullscreen,
  "immersive-return": () => { setImmersiveFollow(true); $("immersive-lines").focus({ preventScroll: true }); },
  "immersive-earlier": () => changeImmersiveDelay(-200),
  "immersive-later": () => changeImmersiveDelay(200),
  "immersive-offset-reset": () => changeImmersiveDelay(0),
  "immersive-copy": copyImmersiveLine,
  "immersive-loop": toggleImmersiveLoop,
};

function initImmersive() {
  restoreImmersive();
  const dialog = $("immersive-dialog");
  const panel = $("immersive-lines");
  const fullscreen = $("immersive-fullscreen");
  fullscreen.hidden = !document.fullscreenEnabled || !document.documentElement.requestFullscreen;
  document.addEventListener("fullscreenchange", () => {
    const on = Boolean(document.fullscreenElement);
    if (!on) immersiveBrowserFullscreen = false;
    fullscreen.querySelector("use").setAttribute("href", "/static/studio-icons.svg?v=immersive-1#" + (on ? "collapse" : "expand"));
    labelButton(fullscreen, on ? "退出浏览器全屏" : "浏览器全屏");
  });
  dialog.addEventListener("close", () => {
    if (immersiveBrowserFullscreen && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    immersiveOpener?.focus();
  });
  $("immersive-image").addEventListener("error", () => $("immersive-cover").classList.remove("has-image"));
  $("immersive-font").addEventListener("change", (event) => {
    immersiveFont = event.target.value;
    dialog.dataset.font = immersiveFont;
    if (immersiveFollow) centerImmersiveLine();
    saveImmersive();
  });
  $("immersive-lyric-view").addEventListener("change", (event) => {
    immersiveView = event.target.value;
    renderImmersiveLyrics();
    saveImmersive();
  });
  $("immersive-follow").addEventListener("change", (event) => setImmersiveFollow(event.target.checked));
  $("immersive-seek").addEventListener("input", (event) => seekPlayback(Number(event.target.value)));
  $("immersive-volume").addEventListener("input", (event) => {
    audio.volume = Number(event.target.value);
    audio.muted = false;
  });
  const manualScroll = () => {
    if (immersiveFollow && state.lyrics.length) setImmersiveFollow(false);
  };
  panel.addEventListener("wheel", manualScroll, { passive: true });
  panel.addEventListener("touchmove", manualScroll, { passive: true });
  panel.addEventListener("scroll", () => {
    if (Math.abs(panel.scrollTop - immersiveScrollTarget) > 2) manualScroll();
  });
  panel.addEventListener("keydown", (event) => {
    if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(event.key)) manualScroll();
    if (!event.target.matches(".lyric-line") || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
    const next = event.key === "ArrowDown" ? event.target.nextElementSibling : event.target.previousElementSibling;
    if (!next?.matches(".lyric-line")) return;
    event.preventDefault();
    setImmersiveTabStop(next);
    next.focus();
  });
  panel.addEventListener("click", (event) => {
    if (event.target.closest('[data-action="seek-line"]') && Number.isFinite(audio.duration)) setImmersiveFollow(true);
  });
  dialog.addEventListener("click", (event) => {
    const options = $("immersive-options");
    if (options.open && !options.contains(event.target)) options.open = false;
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.code === "Space" && !event.target.closest("button, a, input, select, textarea, summary")) {
      event.preventDefault();
      togglePlay();
    }
  });
}
