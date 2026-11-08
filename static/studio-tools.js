"use strict";

// Listening controls and portable music-library tools.
const playbackRates = ["0.5", "0.75", "1", "1.25", "1.5", "2"];
const titleCollator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });
const listeningKey = "echo-room-listening-v1";
const statsPending = new Map();
let lastStatWrite = 0;
let listeningSample;
let practiceLoop = {};
let importRequest;
let importedTracks = [];
let lyricFindIndex = 0;
let lyricToolsTrack = "";

function orderedTracks(tracks = []) {
  const sort = state.trackSort;
  return sort === "original" ? tracks : [...tracks].sort((a, b) =>
    titleCollator.compare(a[sort], b[sort]) || titleCollator.compare(a.name, b.name));
}

function trackMatches(track, query) {
  const haystack = [track.name, track.artists, track.album].join(" ").toLowerCase();
  return query.trim().toLowerCase().split(/\s+/).every((word) => haystack.includes(word));
}

function setPlaybackRate(value, save = true) {
  if (!playbackRates.includes(value)) return;
  state.rate = value;
  audio.defaultPlaybackRate = Number(value);
  audio.playbackRate = Number(value);
  $("playback-rate").value = value;
  if (save) persist();
}

function renderPractice() {
  const ready = Boolean(state.current?.stream && Number.isFinite(audio.duration) && audio.duration >= 1);
  const { a, b } = practiceLoop;
  $("loop-a").disabled = !ready;
  $("loop-b").disabled = !ready || a === undefined || audio.currentTime < a + 1;
  $("loop-clear").disabled = a === undefined;
  const text = b !== undefined ? "循环 " + timeText(a) + " – " + timeText(b) :
    a !== undefined ? "A 点 " + timeText(a) + " · 至少再向后 1 秒设置 B 点" : "在当前曲目上标记起止位置。";
  if ($("loop-status").textContent !== text) $("loop-status").textContent = text;
}

function clearPracticeLoop() {
  practiceLoop = {};
  renderPractice();
}

function setPracticePoint(point) {
  const time = audio.currentTime;
  if (point === "a") {
    if (audio.duration - time < 1) { $("loop-status").textContent = "A 点需离曲末至少 1 秒。"; return; }
    practiceLoop = { a: time };
  } else if (practiceLoop.a !== undefined && time >= practiceLoop.a + 1) {
    practiceLoop.b = time;
  }
  renderPractice();
}

function seekPlayback(time) {
  if (!Number.isFinite(time) || !Number.isFinite(audio.duration)) return;
  if (practiceLoop.b !== undefined && (time < practiceLoop.a || time > practiceLoop.b)) clearPracticeLoop();
  audio.currentTime = Math.min(audio.duration, Math.max(0, time));
}

function enforcePracticeLoop(ended = false) {
  if (practiceLoop.b === undefined || audio.currentTime < practiceLoop.b || (!ended && audio.paused)) return false;
  audio.currentTime = practiceLoop.a;
  if (ended) playAudio();
  return true;
}

function localDateKey(date) {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}

function statsSince(days) {
  const date = new Date();
  date.setDate(date.getDate() - days + 1);
  return localDateKey(date);
}

function storedStats() {
  try {
    const rows = JSON.parse(localStorage.getItem(listeningKey));
    const since = statsSince(30);
    return new Map((Array.isArray(rows) ? rows : []).filter((item) =>
      typeof item?.day === "string" && item.day >= since && isId(item.id) && typeof item.name === "string" &&
      typeof item.artists === "string" && Number.isFinite(item.seconds) && item.seconds > 0)
      .map((item) => [item.day + "/" + item.id, item]));
  } catch { return new Map(); }
}

function currentStats() {
  const rows = storedStats();
  for (const [key, item] of statsPending) {
    rows.set(key, { ...item, seconds: item.seconds + (rows.get(key)?.seconds || 0) });
  }
  return rows;
}

function flushListening(force = false) {
  if (!statsPending.size || (!force && Date.now() - lastStatWrite < 10000)) return;
  lastStatWrite = Date.now();
  try {
    localStorage.setItem(listeningKey, JSON.stringify([...currentStats().values()]));
    statsPending.clear();
  } catch {
    // Keep unsaved samples available in the current tab.
  }
}

function sampleListening() {
  const current = state.current;
  const previous = listeningSample;
  if (!state.statsEnabled || !current?.tracked || audio.paused || audio.seeking) {
    listeningSample = undefined;
    return;
  }
  const now = performance.now();
  const position = audio.currentTime;
  listeningSample = { current, now, position };
  if (previous?.current !== current) return;
  const elapsed = (now - previous.now) / 1000;
  const advanced = (position - previous.position) / audio.playbackRate;
  if (elapsed <= 0 || advanced <= 0 || advanced > elapsed + 0.6) return;
  const { id, name, artists } = current.track;
  const day = localDateKey(new Date());
  const key = day + "/" + id;
  const item = statsPending.get(key) || { day, id, name, artists, seconds: 0 };
  item.seconds += Math.min(elapsed, advanced);
  statsPending.set(key, item);
  flushListening();
}

function listeningTime(seconds) {
  if (seconds < 60) return Math.floor(seconds) + " 秒";
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? minutes + " 分钟" : Math.floor(minutes / 60) + " 小时 " + minutes % 60 + " 分钟";
}

function statsMarkup() {
  const since = statsSince(state.statsDays);
  const tracks = new Map();
  const artists = new Map();
  let total = 0;
  for (const item of currentStats().values()) {
    if (item.day < since) continue;
    total += item.seconds;
    const track = tracks.get(item.id) || { name: item.name, id: item.id, seconds: 0 };
    track.seconds += item.seconds;
    tracks.set(item.id, track);
    const names = item.artists.split(" / ").filter(Boolean);
    for (const name of names) artists.set(name, (artists.get(name) || 0) + item.seconds / names.length);
  }
  const ranks = (items, links) => '<ol class="stats-rank">' + items.sort((a, b) => b.seconds - a.seconds).slice(0, 8).map((item) =>
    '<li><span>' + (links ? '<a href="#song?id=' + item.id + '">' + esc(item.name) + '</a>' : esc(item.name)) +
    '</span><small>' + listeningTime(item.seconds) + '</small></li>').join("") + '</ol>';
  return '<div class="stats-tools"><label>统计范围<select id="stats-days"><option value="7"' + (state.statsDays === 7 ? ' selected' : '') +
    '>最近 7 天</option><option value="30"' + (state.statsDays === 30 ? ' selected' : '') + '>最近 30 天</option></select></label>' +
    '<button type="button" class="quiet-button" data-action="stats-refresh">刷新</button>' +
    '<button type="button" class="quiet-button" data-action="stats-toggle" aria-pressed="' + state.statsEnabled + '">' +
    (state.statsEnabled ? "暂停记录" : "启用记录") + '</button></div>' +
    (total > 0 ? '<p class="stats-summary">共听了 <strong>' + listeningTime(total) + '</strong>，涉及 ' + tracks.size + ' 首歌。</p>' +
      '<div class="stats-columns"><section><h3>听得最多的歌</h3>' + ranks([...tracks.values()], true) +
      '</section><section><h3>听得最多的歌手</h3>' + ranks([...artists].map(([name, seconds]) => ({ name, seconds }))) + '</section></div>' :
      empty("clock", "还没有听歌时长", state.statsEnabled ? "播放几首歌后回来刷新，统计从本版开始累积。" : "启用记录后，播放时间会留在当前浏览器。")) +
    '<p class="radio-privacy">按实际听到的时间计算，快进跳过的部分不计入。数据保存在当前浏览器。</p>' +
    (total > 0 ? '<details><summary>管理统计数据</summary><button type="button" class="quiet-button" data-action="stats-clear">清除本机全部统计</button></details>' : "");
}

function openTrackImport() {
  importedTracks = [];
  $("track-import-input").value = "";
  $("track-import-status").textContent = "最多 300 首，自动去重并保留输入顺序。";
  $("track-import-save").disabled = true;
  showDialog("track-import-dialog");
}

async function identifyTracks(event) {
  event.preventDefault();
  const lines = $("track-import-input").value.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
  const ids = new Set();
  let invalid = 0;
  for (const line of lines) {
    try {
      const { id } = readInput(line, "song");
      if (isId(id)) ids.add(id);
      else invalid++;
    } catch { invalid++; }
  }
  const status = $("track-import-status");
  if (!ids.size || ids.size > 300) {
    status.textContent = ids.size ? "请将清单拆成每批最多 300 首。" : "没有找到有效的完整单曲链接或歌曲 ID。";
    return;
  }
  importRequest?.abort();
  const controller = new AbortController();
  importRequest = controller;
  const ordered = [...ids];
  importedTracks = [];
  $("track-import-input").disabled = true;
  $("track-import-check").disabled = true;
  $("track-import-save").disabled = true;
  try {
    const found = new Map();
    for (let offset = 0; offset < ordered.length; offset += 40) {
      status.textContent = "已处理 " + offset + " / " + ordered.length + " 首…";
      const data = await request("/api/tracks", { ids: ordered.slice(offset, offset + 40).join(",") },
        { signal: controller.signal, timeout: 12000 });
      for (const track of tracksFrom(data)) found.set(track.id, track);
    }
    if (controller.signal.aborted) return;
    importedTracks = ordered.map((id) => found.get(id)).filter(Boolean);
    const skipped = invalid + ordered.length - importedTracks.length;
    status.textContent = "识别出 " + importedTracks.length + " 首" + (skipped ? "，跳过 " + skipped + " 行或未返回的歌曲" : "") +
      (importedTracks.length ? "。首曲「" + importedTracks[0].name + "」。" : "。");
    $("track-import-save").disabled = !importedTracks.length;
  } catch (error) {
    if (!controller.signal.aborted) status.textContent = error.message || "识别失败，请重试。";
  } finally {
    if (importRequest === controller) {
      importRequest = null;
      $("track-import-input").disabled = false;
      $("track-import-check").disabled = false;
    }
  }
}

function exportTrackList() {
  const view = getView();
  const tracks = orderedTracks(view.tracks);
  if (!tracks.length) return;
  const lines = ["# " + view.title.replace(/[\r\n]+/g, " "), ...tracks.flatMap((track) => [
    "# " + [track.name, track.artists].filter(Boolean).join(" — ").replace(/[\r\n]+/g, " "),
    "https://music.163.com/song?id=" + track.id,
  ])];
  saveBlob(new Blob([lines.join("\n") + "\n"], { type: "text/plain;charset=utf-8" }), view.title + ".txt");
}

function syncLyricTools(detail, key) {
  if (key !== lyricToolsTrack) {
    lyricToolsTrack = key;
    $("lyric-query").value = "";
    $("lyric-copy-status").hidden = true;
    $("lyric-copy-value").hidden = true;
    lyricFindIndex = 0;
  }
  $("lyric-search-bar").hidden = !detail.raw;
  $("lyric-copy").hidden = !detail.raw;
  findLyric();
}

function findLyric(move = 0) {
  const query = $("lyric-query").value.trim().toLowerCase();
  const panel = $("mobile-lyrics-content");
  const lines = [...panel.querySelectorAll(".lyric-line, .plain-lyric-line")];
  const hits = query ? lines.filter((line) => line.textContent.toLowerCase().includes(query)) : [];
  for (const line of lines) line.classList.remove("lyric-found");
  const count = hits.length;
  lyricFindIndex = count ? (lyricFindIndex + move + count) % count : 0;
  $("lyric-find-count").textContent = query ? (count ? (lyricFindIndex + 1) + " / " + count : "无匹配") : "";
  for (const action of ["lyric-prev", "lyric-next"]) {
    $("lyric-search-bar").querySelector('[data-action="' + action + '"]').disabled = count < 2;
  }
  const hit = hits[lyricFindIndex];
  if (hit) {
    hit.classList.add("lyric-found");
    panel.scrollTop += hit.getBoundingClientRect().top - panel.getBoundingClientRect().top - panel.clientHeight / 3;
  }
}

async function copyLyricText() {
  const follow = $("lyrics-dialog").dataset.follow === "true";
  const raw = follow ? state.lrc : inspectedLyrics?.raw;
  if (!raw) return;
  const plain = (value) => value.replace(/^(?:\[(?:\d{1,3}:\d{2}(?:[.:]\d{1,3})?|(?:ar|al|ti|by|offset|re|ve|au|length):[^\]\r\n]*)\])+[ \t]*/gim, "")
    .split(/\r?\n/).filter((line) => line.trim()).join("\n");
  const translation = follow ? state.translation : inspectedLyrics?.translation;
  const text = [plain(raw), state.translated && translation ? plain(translation) : ""].filter(Boolean).join("\n\n");
  const status = $("lyric-copy-status");
  const field = $("lyric-copy-value");
  status.hidden = false;
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = "歌词文本已复制。";
    field.hidden = true;
  } catch {
    field.value = text;
    field.hidden = false;
    field.select();
    try {
      if (document.execCommand("copy")) { status.textContent = "歌词文本已复制。"; field.hidden = true; return; }
    } catch { /* Leave the text available for manual copying. */ }
    status.textContent = "歌词已选中，可以手动复制。";
  }
}

const listeningActions = {
  "loop-a": () => setPracticePoint("a"),
  "loop-b": () => setPracticePoint("b"),
  "loop-clear": clearPracticeLoop,
  "open-track-import": openTrackImport,
  "save-imported-tracks": () => {
    if (!importedTracks.length) return;
    $("track-import-dialog").close();
    editCollection(importedTracks);
  },
  "export-track-list": exportTrackList,
  "copy-lyric-text": copyLyricText,
  "lyric-prev": () => findLyric(-1),
  "lyric-next": () => findLyric(1),
  "stats-refresh": () => { renderResults(); $("stats-days").focus(); },
  "stats-toggle": () => {
    if (state.statsEnabled) flushListening(true);
    state.statsEnabled = !state.statsEnabled;
    listeningSample = undefined;
    persist();
    renderResults();
    document.querySelector('[data-action="stats-toggle"]').focus();
  },
  "stats-clear": () => {
    try { localStorage.removeItem(listeningKey); }
    catch { toast("浏览器暂时无法清除统计。"); return; }
    statsPending.clear();
    listeningSample = undefined;
    renderResults();
    $("stats-days").focus();
  },
};

function initListeningTools() {
  $("playback-rate").innerHTML = playbackRates.map((rate) => '<option value="' + rate + '">' + rate + '×</option>').join("");
  setPlaybackRate(state.rate, false);
  $("playback-rate").addEventListener("change", (event) => setPlaybackRate(event.target.value));
  $("track-import-form").addEventListener("submit", identifyTracks);
  $("track-import-input").addEventListener("input", () => {
    importedTracks = [];
    $("track-import-save").disabled = true;
  });
  $("track-import-dialog").addEventListener("close", () => importRequest?.abort());
  $("lyric-query").addEventListener("input", () => { lyricFindIndex = 0; findLyric(); });
  $("lyric-query").addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); findLyric(event.shiftKey ? -1 : 1); }
  });
  for (const name of ["seeking", "waiting", "playing", "pause", "emptied", "ratechange"]) {
    audio.addEventListener(name, () => { listeningSample = undefined; });
  }
  audio.addEventListener("pause", () => flushListening(true));
  window.addEventListener("pagehide", () => flushListening(true));
}
