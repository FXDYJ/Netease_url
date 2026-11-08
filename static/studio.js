"use strict";

const $ = (id) => document.getElementById(id);
const audio = $("audio");
const libraryKey = "echo-room-v1";
const lanAccess = isLanHost(location.hostname);
const downloadFormats = {
  auto: "自动选择", direct: "源站直连下载", file: "通过 NAS 下载", json: "仅保存到 NAS",
};
const qualities = {
  standard: "标准音质", exhigh: "极高音质", lossless: "无损音质", hires: "Hi-Res",
  jyeffect: "高清环绕声", sky: "沉浸环绕声", jymaster: "超清母带", dolby: "杜比全景声",
};
const screens = {
  search: ["搜索", "想听什么？", "搜一首歌，或粘贴网易云音乐链接。", "歌曲名、歌手或音乐链接", "搜索"],
  radio: ["心动电台", "顺着喜欢的歌听", "从正在听的歌出发，把熟悉的旋律和新发现混在一起。"],
  song: ["单曲解析", "解析单曲", "查看音源、实际音质和双语歌词。", "输入歌曲 ID 或网易云音乐链接", "解析"],
  playlist: ["歌单解析", "打开歌单", "查看曲目、逐首试听，或一次加入播放队列。", "输入歌单 ID 或链接", "解析"],
  album: ["专辑解析", "打开专辑", "按曲目顺序浏览专辑，保存想听的歌。", "输入专辑 ID 或链接", "解析"],
  download: ["音乐下载", "下载音乐", "选择音质和保存方式，再输入歌曲 ID 或链接。", "输入歌曲 ID 或网易云音乐链接", "下载"],
  favorites: ["收藏", "我的收藏", "收藏保存在当前浏览器。"],
  library: ["我的歌单", "我的歌单", "把喜欢的歌曲整理成几张随时能播放的歌单。"],
  history: ["最近播放", "最近播放", "在当前浏览器里接着听。"],
  settings: ["设置", "偏好设置", "修改后立即生效。局域网地址与外网域名的偏好分别保存。"],
};
const quickTracks = [
  { id: "25706282", name: "夜空中最亮的星", artists: "逃跑计划", album: "世界", pic: "https://p2.music.126.net/625-tE8OzdM-rWO37PgqlQ==/109951168111472442.jpg" },
  { id: "347230", name: "海阔天空", artists: "Beyond", album: "海阔天空", pic: "https://p1.music.126.net/iAwVf8ag_45csIUuh1wSZg==/109951168912558470.jpg" },
  { id: "167876", name: "有何不可", artists: "许嵩", album: "自定义", pic: "https://p2.music.126.net/Zg4XDfsiRi5vawjSWPP8Ng==/109951172899966259.jpg" },
  { id: "210049", name: "布拉格广场", artists: "蔡依林 / 周杰伦", album: "看我72变", pic: "https://p1.music.126.net/8D2Pd7EuvGboMyE2xWc47A==/109951172453712025.jpg" },
];
const orders = [
  ["sequence", "顺序播放", "ordered"], ["repeat-all", "列表循环", "repeat"],
  ["repeat-one", "单曲循环", "repeat-one"], ["shuffle", "随机播放", "shuffle"],
];
const radioModes = { off: "关闭", tail: "播完接续", mix: "穿插推荐" };
const discoveryLevels = { familiar: ["偏熟悉", 3], balanced: ["均衡", 2], explore: ["多探索", 1] };
const sleepModes = { off: "关闭", 15: "15 分钟后", 30: "30 分钟后", 60: "60 分钟后", end: "这首播完后" };
const isId = (value) => /^[1-9]\d{0,19}$/.test(value);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]
));
const icon = (id) => '<svg aria-hidden="true"><use href="/static/studio-icons.svg#' + id + '"></use></svg>';

function isLanHost(value) {
  const host = value.toLowerCase().replace(/^\[|\]$|\.$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host === "::1" ||
      /^(?:f[cd][0-9a-f]{2}|fe[89ab][0-9a-f]):/.test(host)) return true;
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return false;
  const [first, second] = host.split(".").map(Number);
  return first === 10 || first === 127 || (first === 192 && second === 168) ||
    (first === 169 && second === 254) || (first === 172 && second >= 16 && second <= 31);
}

function restore() {
  try { return JSON.parse(localStorage.getItem(libraryKey)) || {}; }
  catch { return {}; }
}

function songRecord(data) {
  const id = String(data?.id ?? "");
  if (!isId(id)) return null;
  const artists = data.ar_name || data.artists || data.artist_string || data.ar || "";
  return {
    id,
    name: String(data.name || "歌曲 " + id),
    artists: Array.isArray(artists) ? artists.map((item) => item?.name || item).join(" / ") : String(artists).replace(/\s*\/\s*/g, " / "),
    album: String(data.al_name || data.album?.name || data.al?.name || data.album || ""),
    pic: String(data.pic || data.picUrl || data.al?.picUrl || data.album?.picUrl || ""),
  };
}

function tracksFrom(value) {
  return Array.isArray(value) ? value.map(songRecord).filter(Boolean) : [];
}

const saved = restore();
const savedProgress = songRecord(saved.resume?.track);
const state = {
  mode: "search",
  views: { search: { title: "快速试听", note: "从这几首开始，或搜索你想听的歌。", tracks: quickTracks } },
  queries: {},
  trackFilter: "",
  favorites: tracksFrom(saved.favorites),
  history: tracksFrom(saved.history),
  queue: tracksFrom(saved.queue),
  priority: Array.isArray(saved.priority) ? saved.priority.filter(isId).slice(0, 50) : [],
  collections: (Array.isArray(saved.collections) ? saved.collections : [])
    .filter((item) => typeof item?.name === "string" && typeof item.id === "string" && /^[a-z0-9-]{1,80}$/.test(item.id))
    .map((item) => ({ id: item.id, name: item.name.slice(0, 48), tracks: tracksFrom(item.tracks) })),
  collectionId: null,
  collectionEdit: null,
  resume: savedProgress && Number.isFinite(saved.resume.time)
    ? { track: savedProgress, time: Math.max(0, saved.resume.time) } : null,
  radioMode: Object.hasOwn(radioModes, saved.radioMode) ? saved.radioMode : "off",
  discovery: Object.hasOwn(discoveryLevels, saved.discovery) ? saved.discovery : "balanced",
  hiddenTracks: tracksFrom(saved.hiddenTracks).slice(0, 200),
  artistTaste: new Map((Array.isArray(saved.artistTaste) ? saved.artistTaste : []).slice(0, 100)
    .filter((pair) => Array.isArray(pair) && typeof pair[0] === "string" && Number.isFinite(pair[1]))),
  trail: [],
  trailIndex: -1,
  radioAnchor: null,
  radioStreak: 0,
  radioPlayed: 0,
  radioStatus: "",
  advance: null,
  sleepMode: "off",
  sleepDeadline: 0,
  sleepTimer: null,
  sleepStopped: false,
  quality: Object.hasOwn(qualities, saved.quality) ? saved.quality : "standard",
  order: orders.some(([id]) => id === saved.order) ? saved.order : "sequence",
  translated: saved.translated !== false,
  downloadFormat: Object.hasOwn(downloadFormats, saved.downloadFormat) ? saved.downloadFormat : "auto",
  playbackRoute: lanAccess && saved.playbackRoute === "nas" ? "nas" : "direct",
  lookup: null,
  playRequest: null,
  current: null,
  lyrics: [],
  lrc: "",
  translation: "",
  lyricIndex: -1,
  downloads: new Set(),
  serviceCheck: 0,
  serviceHealth: null,
  serviceInfo: null,
};

function persist() {
  try {
    const { favorites, history, queue, priority, collections, resume, radioMode, discovery, hiddenTracks,
      artistTaste, quality, order, translated, playbackRoute, downloadFormat } = state;
    localStorage.setItem(libraryKey, JSON.stringify({ favorites, history, queue, priority, collections, resume, radioMode, discovery,
      hiddenTracks, artistTaste: [...artistTaste], quality, order, translated, playbackRoute, downloadFormat, volume: audio.volume }));
    return true;
  } catch {
    return false;
  }
}

function mediaURL(value, coverSize = 0) {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return "";
    const cover = coverSize && /\.music\.126\.net$/.test(url.hostname);
    if (location.protocol === "https:" || cover) url.protocol = "https:";
    if (cover) url.searchParams.set("param", coverSize + "y" + coverSize);
    return url.href;
  } catch { return ""; }
}

function setIcon(button, id) {
  button.querySelector("use").setAttribute("href", "/static/studio-icons.svg#" + id);
}

function labelButton(button, label) {
  button.setAttribute("aria-label", label);
  button.title = label;
}

let toastTimer;
function toast(message) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $("toast").hidden = true; }, 3600);
}

function apiURL(path, params) {
  const url = new URL(path, location.origin);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

async function request(path, params = {}, { signal, timeout = 40000, binary = false, direct = false } = {}) {
  const url = direct ? new URL(path) : apiURL(path, params);
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener("abort", abort, { once: true });
  let expired = false;
  const timer = setTimeout(() => { expired = true; abort(); }, timeout);
  try {
    const response = await fetch(url, {
      signal: controller.signal, cache: "no-store", credentials: direct ? "omit" : "same-origin",
    });
    const contentType = response.headers.get("Content-Type") || "";
    if (contentType.includes("json")) {
      const payload = await response.json();
      if (!response.ok || payload.success === false) throw new Error(payload.message || "接口返回 HTTP " + response.status);
      if (binary) throw new Error("服务没有返回音频文件。");
      return payload.data ?? payload;
    }
    if (!response.ok) throw new Error("服务返回 HTTP " + response.status + "，请稍后重试。");
    if (!binary || !/^(audio\/|application\/octet-stream)/i.test(contentType)) {
      throw new Error("服务返回了意外的内容，请检查 NAS 服务或访问权限。");
    }
    return { blob: await response.blob(), headers: response.headers };
  } catch (error) {
    if (expired) throw new Error("请求超时，请稍后重试。");
    if (error instanceof TypeError) throw new Error(direct ? "浏览器无法直接读取音源。" : "无法连接 NAS 音乐服务，请检查网络。");
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

// Signed URLs and lyrics stay in memory, scoped to this page and quality.
const mediaCache = new Map();
const lyricCache = new Map();
const similarCache = new Map();
const similarRequests = new Map();
const failedRecommendations = new Map();

function remember(cache, key, data, lifetime) {
  cache.delete(key);
  cache.set(key, { data, expires: Date.now() + lifetime });
  if (cache.size > 48) cache.delete(cache.keys().next().value);
}

function recall(cache, key) {
  const entry = cache.get(key);
  if (entry?.expires > Date.now()) return entry.data;
  cache.delete(key);
  return null;
}

function directURL(value) {
  const url = mediaURL(value);
  return url && new URL(url).origin !== location.origin ? url : "";
}

async function resolveMedia(id, quality, signal) {
  const key = id + ":" + quality;
  const data = recall(mediaCache, key) || await request("/song", { id, type: "url", level: quality }, { signal });
  const url = directURL(data.url);
  if (!url) throw new Error("这个音质没有可用的音源，可以尝试切换音质。");
  if (!mediaCache.has(key)) remember(mediaCache, key, data, 60000);
  return { ...data, url };
}

function readInput(raw, mode) {
  if (isId(raw)) return { mode: mode === "search" ? "song" : mode, id: raw };
  const match = raw.match(/https?:\/\/[^\s<>"'，。]+/iu);
  if (match) {
    const url = new URL(match[0].replace(/[)\]，。；,;]+$/u, ""));
    const short = url.hostname === "163cn.tv" || url.hostname.endsWith(".163cn.tv");
    const netease = url.hostname === "music.163.com" || url.hostname.endsWith(".music.163.com");
    if ((!short && !netease) || url.username || url.password || url.port) throw new Error("请粘贴网易云音乐分享链接。");
    if (short) {
      if (mode === "playlist" || mode === "album") throw new Error("请打开短链接，再粘贴完整歌单或专辑链接。");
      return { mode: mode === "download" ? "download" : "song", id: url.href };
    }
    const target = url.hash.startsWith("#/") ? new URL(url.hash.slice(1), url.origin) : url;
    const kind = target.pathname.match(/(?:^|\/)(song|playlist|album)(?:\/|$)/)?.[1];
    const id = target.searchParams.get("id") || target.pathname.match(/\/(\d+)\/?$/)?.[1];
    if (!kind || !isId(id || "")) throw new Error("没有在链接中找到有效的歌曲、歌单或专辑 ID。");
    if (mode !== "search" && kind !== (mode === "download" ? "song" : mode)) {
      throw new Error("当前需要" + { song: "歌曲", playlist: "歌单", album: "专辑", download: "歌曲" }[mode] + "链接。");
    }
    return { mode: mode === "download" ? "download" : kind, id };
  }
  if (mode !== "search") throw new Error("请输入数字 ID 或网易云音乐链接。");
  return { mode, keyword: raw };
}

function displayMode(mode, updateURL = true) {
  if (!Object.hasOwn(screens, mode)) mode = "search";
  if (state.mode !== mode) {
    if (state.lookup?.target !== "download") state.lookup?.controller.abort();
    state.mode = mode;
    state.trackFilter = "";
    if (mode === "download") {
      $("download-format").value = effectiveDownloadFormat();
      updateDownloadNote();
    }
    window.scrollTo(0, 0);
  }
  if (updateURL && location.hash !== "#" + mode) history.pushState(null, "", "#" + mode);
  const [title, heading, description, placeholder, action] = screens[mode];
  $("breadcrumb").textContent = title;
  $("hero-title").textContent = heading;
  $("hero-description").textContent = description;
  $("lookup-form").hidden = !action;
  $("hero").classList.toggle("compact", !action);
  $("query").value = state.queries[mode] || "";
  $("query").placeholder = placeholder || "";
  $("query-label").textContent = title;
  $("submit-search").innerHTML = esc(action) + icon("arrow-right");
  $("suggestions").hidden = mode !== "search";
  $("limit-label").hidden = mode !== "search";
  $("download-format-label").hidden = mode !== "download";
  $("download-route-note").hidden = mode !== "download";
  for (const link of document.querySelectorAll("nav [data-mode]")) {
    if (link.dataset.mode === mode) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  renderResults();
}

function openLocation() {
  const [mode, query] = location.hash.slice(1).split("?", 2);
  if (mode === "main") return;
  displayMode(mode || "search", false);
  const id = new URLSearchParams(query).get("id");
  if (["song", "playlist", "album"].includes(mode) && isId(id || "")) lookup(id, mode);
}

function getView() {
  if (state.mode === "favorites") return { title: "已收藏的歌曲", note: state.favorites.length + " 首", tracks: state.favorites };
  if (state.mode === "history") return { title: "最近播放的歌曲", note: state.history.length + " 首", tracks: state.history };
  if (state.mode === "settings") return { title: "播放与下载", note: lanAccess ? "当前通过局域网访问。" : "当前通过外网访问，播放使用源站直连。" };
  if (state.mode === "radio") return { title: "电台设置" };
  if (state.mode === "library") {
    const collection = state.collections.find((item) => item.id === state.collectionId);
    return collection
      ? { title: collection.name, note: collection.tracks.length + " 首", tracks: collection.tracks, localCollection: collection }
      : { title: "歌单库", note: state.collections.length + " 张 · 保存在当前浏览器" };
  }
  return state.views[state.mode] || { title: "结果", tracks: [] };
}

function settingRow(key, label, note, options, selected) {
  const id = "setting-" + key;
  return '<div class="setting-row"><div><label for="' + id + '">' + esc(label) + '</label><p id="' + id + '-note">' + esc(note) +
    '</p></div><select id="' + id + '" data-setting="' + key + '" aria-describedby="' + id + '-note">' +
    options.map(([value, text]) => '<option value="' + esc(value) + '"' + (value === selected ? " selected" : "") +
      ">" + esc(text) + "</option>").join("") + "</select></div>";
}

function settingsMarkup() {
  const rows = [
    settingRow("downloadFormat", "默认下载方式",
      "自动选择时，外网从源站直连，局域网通过 NAS。外网选择通过 NAS 下载会使用隧道流量。",
      Object.entries(downloadFormats), state.downloadFormat),
    settingRow("quality", "默认音质", "用于播放、解析和下载，实际音质以源站返回为准。",
      Object.entries(qualities), state.quality),
    settingRow("order", "播放顺序", "应用于当前播放队列。", orders, state.order),
    settingRow("radioMode", "心动电台", "可在队列结束后接播，或在顺序播放中穿插推荐。", Object.entries(radioModes), state.radioMode),
    settingRow("sleepMode", "定时停止", sleepDescription(), ["off", "15", "30", "60", "end"].map((value) =>
      [value, sleepModes[value]]), state.sleepMode),
    settingRow("translation", "歌词译文", "在有译文时显示双语歌词。", [["on", "显示"], ["off", "隐藏"]],
      state.translated ? "on" : "off"),
  ];
  if (lanAccess) {
    rows.splice(1, 0, settingRow("playbackRoute", "局域网播放来源",
      "优先使用浏览器直连。设备无法播放源站时可改为通过 NAS。",
      [["direct", "浏览器直连"], ["nas", "通过 NAS"]], state.playbackRoute));
  }
  return '<div class="settings-list">' + rows.join("") + '</div><section class="library-backup"><h3>音乐库备份</h3>' +
    '<p>用 JSON 文件迁移收藏、本机歌单和不再推荐的曲目。重复导入会合并同一歌单。</p><div class="collection-tools">' +
    '<button type="button" class="quiet-button" data-action="export-library">' + icon("download") + '导出备份</button>' +
    '<button type="button" class="quiet-button" data-action="import-library">' + icon("up") + '导入备份</button></div></section>';
}

function favorite(track) {
  return state.favorites.some((item) => item.id === track.id);
}

function cover(track, size = 80) {
  const url = mediaURL(track.pic, size);
  return '<span class="track-cover" aria-hidden="true">' + icon("note") +
    (url ? '<img src="' + esc(url) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : "") + "</span>";
}

function button(action, glyph, label, track, { pressed, disabled, extra = "" } = {}) {
  return '<button class="icon-button ' + extra + '" type="button" data-action="' + action +
    '" aria-label="' + esc(label) + '" title="' + esc(label) + '"' + (track ? ' data-track="' + track.id + '"' : "") +
    (pressed === undefined ? "" : ' aria-pressed="' + pressed + '"') + (disabled ? " disabled" : "") + ">" + icon(glyph) + "</button>";
}

function trackMeta(track, action) {
  return '<button type="button" class="track-meta" data-action="' + action + '" data-track="' + track.id +
    '" title="' + esc(track.name) + '">' + cover(track) + '<span class="ellipsis"><strong>' + esc(track.name) +
    "</strong><small>" + esc(track.artists || "未知歌手") + "</small></span></button>";
}

function trackList(tracks, localCollection = false) {
  const rows = tracks.map((track, index) => {
    const liked = favorite(track);
    const active = state.current?.track.id === track.id;
    const playing = active && !audio.paused;
    return '<div class="track-grid track-row' + (active ? " is-current" : "") + '" data-row="' + track.id + '">' +
      '<span class="track-number">' + String(index + 1).padStart(2, "0") + "</span>" + trackMeta(track, "details") +
      '<span class="track-album" title="' + esc(track.album) + '">' + esc(track.album || "—") + '</span><div class="track-actions">' +
      button("play", playing ? "pause" : "play", (playing ? "暂停 " : "播放 ") + track.name, track, { extra: "play-row" }) +
      button("enqueue", "list-plus", "加入队列 " + track.name, track) +
      button("favorite", "heart", (liked ? "取消收藏 " : "收藏 ") + track.name, track, { pressed: liked, extra: liked ? "liked" : "" }) +
      (localCollection ? button("collection-remove-track", "close", "从歌单移除 " + track.name, track) :
        button("download", "download", "下载 " + track.name, track, { disabled: isDownloading(track.id) })) + "</div></div>";
  });
  return '<div class="track-list"><div class="track-grid track-header" aria-hidden="true"><span>#</span><span>歌曲</span><span>专辑</span><span>操作</span></div>' +
    rows.join("") + "</div>";
}

function empty(glyph, title, message) {
  return '<div class="empty-state">' + icon(glyph) + "<strong>" + esc(title) + "</strong><p>" + esc(message) + "</p></div>";
}

function detailCard(view) {
  if (view.song) {
    const track = view.song;
    const data = view.songData;
    const stream = mediaURL(data.url);
    const actual = data.level ? (qualities[data.level] || data.level) : "";
    const qualityText = stream ? ("音质 " + (actual || "未标注") +
      (data.level && data.level !== view.requested ? " · 请求 " + qualities[view.requested] : "")) :
      "这个音质没有可用的音源。可以换一个音质试试。";
    return '<article class="detail">' + cover(track, 240) + '<div class="detail-body"><h3>' + esc(track.name) + "</h3><p>" +
      esc([track.artists, track.album].filter(Boolean).join(" · ")) + "</p><p>" + esc(qualityText) +
      (stream && data.size ? " · " + esc(data.size) : "") + '</p><div class="detail-actions">' +
      '<button class="primary-button" type="button" data-action="play" data-track="' + track.id + '">' + icon("play") + "试听</button>" +
      '<button class="quiet-button" type="button" data-action="download" data-track="' + track.id + '"' + (isDownloading(track.id) ? " disabled" : "") + ">" + icon("download") + "下载音频</button>" +
      '<button class="quiet-button" type="button" data-action="song-lyrics" data-track="' + track.id + '">' + icon("text") + "查看歌词</button>" +
      (stream ? '<button class="quiet-button" type="button" data-action="copy-link">' + icon("link") + "复制直链</button>" : "") +
      button("favorite", "heart", favorite(track) ? "取消收藏" : "收藏", track, { pressed: favorite(track) }) +
      button("play-next", "list-plus", "下一首播放 " + track.name, track) +
      button("save-track", "folder", "保存歌曲到歌单", track) +
      button("share-page", "share", "分享这首歌的页面") +
      button("seed-radio", "radio", "从这首歌开启相似电台", track) + "</div></div></article>";
  }
  if (view.collection) {
    const data = view.collection;
    const date = Number(data.publishTime) > 0 ? new Date(Number(data.publishTime)).toLocaleDateString("zh-CN") : "";
    const meta = [data.creator || data.artist, date, data.trackCount == null ? "" : data.trackCount + " 首"].filter(Boolean).join(" · ");
    const description = data.description ? '<details><summary>查看简介</summary><p>' + esc(data.description) + "</p></details>" : "";
    return '<article class="detail">' + cover({ pic: data.coverImgUrl }, 240) + '<div class="detail-body"><h3>' + esc(data.name) +
      "</h3><p>" + esc(meta) + "</p>" + description + '<div class="detail-actions"><button type="button" class="quiet-button" data-action="share-page">' +
      icon("share") + "分享页面</button></div></div></article>";
  }
  return "";
}

function renderResults() {
  const view = getView();
  const terms = state.trackFilter.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const tracks = view.tracks || [];
  const visibleTracks = terms.length ? tracks.filter((track) => {
    const text = [track.name, track.artists, track.album].join(" ").toLowerCase();
    return terms.every((term) => text.includes(term));
  }) : tracks;
  const showFilter = Boolean(view.tracks?.length > 6 || view.tracks?.length && terms.length);
  $("track-filter-bar").hidden = !showFilter;
  if ($("track-filter").value !== state.trackFilter) $("track-filter").value = state.trackFilter;
  $("track-filter-count").textContent = showFilter ? "显示 " + visibleTracks.length + " / " + view.tracks.length + " 首" : "";
  const filteredList = view.tracks?.length && !visibleTracks.length
    ? empty("search", "没有匹配的歌曲", "清除筛选，或试试歌名、歌手和专辑里的其他词。") : "";
  renderResume();
  $("results-title").textContent = view.title;
  $("results-note").textContent = view.note || "";
  $("add-all").hidden = !view.tracks?.length;
  $("play-all").hidden = !view.tracks?.length;
  $("save-all").hidden = !view.tracks?.length || Boolean(view.localCollection);
  $("submit-search").disabled = view.kind === "loading";
  const message = $("result-message");
  message.hidden = !view.message;
  message.textContent = view.message || "";
  message.dataset.kind = view.kind || "info";
  const content = $("result-content");
  content.setAttribute("aria-busy", String(view.kind === "loading"));
  if (state.mode === "settings") {
    content.innerHTML = settingsMarkup();
  } else if (state.mode === "radio") {
    content.innerHTML = radioMarkup();
  } else if (state.mode === "library") {
    content.innerHTML = libraryMarkup(view.localCollection, visibleTracks, filteredList);
  } else if (view.kind === "loading") {
    content.innerHTML = '<div class="skeleton-row" aria-hidden="true"><span></span><span></span></div>'.repeat(3);
  } else if (view.kind === "error") {
    content.innerHTML = empty("info", "请调整输入或重试", "连接状态可以在右上角查看。");
  } else if (view.kind === "saved") {
    content.innerHTML = empty("download", view.filename || "文件已处理", view.savedMessage || "下载任务已完成。");
  } else if (view.kind === "direct-link") {
    content.innerHTML = empty("download", "可从源站保存", "如果浏览器打开了播放器，可在播放菜单中选择保存。") +
      '<a class="quiet-button source-link" href="' + esc(view.url) +
      '" target="_blank" rel="noopener noreferrer">' + icon("arrow-up-right") + "打开源站音频</a>";
  } else if (view.song || view.collection || view.tracks?.length) {
    content.innerHTML = detailCard(view) + (view.tracks?.length ? (filteredList || trackList(visibleTracks)) :
      view.collection ? empty("list", "没有返回曲目", "这张歌单或专辑可能没有公开曲目。") : "");
  } else {
    const words = {
      search: ["没有找到歌曲", "试试更短的关键词，或输入完整歌名。"],
      song: ["等待解析单曲", "在上方输入歌曲 ID 或粘贴链接。"],
      playlist: ["等待打开歌单", "在上方输入歌单 ID 或粘贴链接。"],
      album: ["等待打开专辑", "在上方输入专辑 ID 或粘贴链接。"],
      download: ["等待下载", "输入歌曲 ID 或链接，并选择需要的音质。"],
      favorites: ["还没有收藏", "在歌曲列表中点击爱心即可收藏。"],
      history: ["还没有播放记录", "试听过的歌曲会出现在这里。"],
    };
    content.innerHTML = empty("note", ...words[state.mode]);
  }
  $("favorite-count").textContent = state.favorites.length;
}

function renderResume() {
  const card = $("resume-card");
  card.hidden = state.mode !== "search" || !state.resume || Boolean(state.current);
  if (card.hidden) return;
  const { track, time } = state.resume;
  card.querySelector(".resume-meta").innerHTML = cover(track) + '<span class="ellipsis"><strong>' + esc(track.name) +
    "</strong><small>" + esc([track.artists, timeText(time)].filter(Boolean).join(" · ")) + "</small></span>";
}

function libraryMarkup(collection, visibleTracks, filteredList) {
  if (collection) {
    return '<div class="collection-tools"><button type="button" class="quiet-button" data-action="library-back">所有歌单</button>' +
      '<button type="button" class="quiet-button" data-action="rename-collection">重命名</button>' +
      '<button type="button" class="quiet-button" data-action="delete-collection">删除歌单</button></div>' +
      (collection.tracks.length ? (filteredList || trackList(visibleTracks, true)) :
        empty("list", "歌单还是空的", "在搜索、歌曲详情或播放队列里，可以把歌曲保存到这里。"));
  }
  return '<div class="collection-tools"><button type="button" class="quiet-button" data-action="new-collection">' +
    icon("folder") + "新建歌单</button></div>" + (state.collections.length
      ? '<div class="collection-list">' + state.collections.map((item) =>
        '<button type="button" class="collection-link" data-action="open-collection" data-collection="' + item.id + '">' +
        cover(item.tracks[0] || {}) + '<span class="ellipsis"><strong>' + esc(item.name) + "</strong><small>" +
        item.tracks.length + " 首</small></span>" + icon("chevron-right") + "</button>").join("") + "</div>"
      : empty("folder", "还没有自己的歌单", "新建一张空歌单，或把已有歌单和搜索结果保存下来。"));
}

function editCollection(tracks = [], operation = "save") {
  const current = state.collections.find((item) => item.id === state.collectionId);
  const form = $("collection-form");
  const target = $("collection-target");
  const name = $("collection-name");
  const renaming = operation === "rename";
  const deleting = operation === "delete";
  state.collectionEdit = { tracks, operation, id: current?.id };
  $("collection-title").textContent = { save: "保存到歌单", create: "新建歌单", rename: "重命名歌单", delete: "删除歌单" }[operation];
  $("collection-target-label").hidden = operation !== "save" || !state.collections.length;
  target.innerHTML = '<option value="">新建歌单</option>' + state.collections.map((item) =>
    '<option value="' + item.id + '">' + esc(item.name) + "</option>").join("");
  name.value = renaming ? current.name : "";
  $("collection-name-label").hidden = deleting;
  name.required = !deleting;
  $("collection-hint").textContent = deleting ? "删除「" + current.name + "」？歌单中的歌曲可继续搜索和播放。" :
    tracks.length ? "将保存 " + tracks.length + " 首歌曲，重复曲目会合并。" : "";
  form.querySelector('[type="submit"]').textContent = deleting ? "删除歌单" : "保存";
  showDialog("collection-dialog");
  if (!deleting) (target.parentElement.hidden ? name : target).focus();
}

function saveCollection(event) {
  event.preventDefault();
  const edit = state.collectionEdit;
  if (!edit) return;
  const { tracks, operation, id } = edit;
  const name = $("collection-name").value.trim();
  if (operation === "delete") {
    state.collections = state.collections.filter((item) => item.id !== id);
    state.collectionId = null;
  } else {
    let collection = state.collections.find((item) => item.id === (operation === "rename" ? id : $("collection-target").value));
    if (operation === "rename" || !collection) {
      if (!name) { $("collection-hint").textContent = "请输入歌单名称。"; $("collection-name").focus(); return; }
      if (collection) collection.name = name;
      else {
        collection = newCollection(name);
        state.collections.push(collection);
      }
    }
    const known = new Map(collection.tracks.map((track) => [track.id, track]));
    for (const track of tracks) if (!known.has(track.id)) known.set(track.id, track);
    collection.tracks = [...known.values()];
    if (state.mode === "library") state.collectionId = collection.id;
  }
  $("collection-dialog").close();
  state.collectionEdit = null;
  const persisted = persist();
  if (state.mode === "library") {
    renderResults();
    $("main").focus();
  }
  toast(!persisted ? "浏览器存储不可用，歌单变更仅在此页面有效。" : operation === "delete" ? "歌单已删除" : "歌单已保存");
}

function radioMarkup() {
  const seed = state.radioAnchor || state.current?.track || state.favorites[0] || state.history[0];
  const description = seed ? "沿着「" + seed.name + "」发现更多音乐" : "选一首喜欢的歌，电台就有了起点";
  const heading = state.radioMode === "off" ? "电台已关闭" : state.radioStatus || radioModes[state.radioMode] + "已开启";
  const resumeTrack = seed || quickTracks[0];
  return '<div class="radio-feature"><div class="radio-dial" aria-hidden="true">' + icon("radio") + '</div><div class="radio-copy">' +
    '<h3>' + esc(heading) + "</h3><p>" + esc(description) + '</p><div class="radio-actions">' +
    (state.current
      ? '<button type="button" class="primary-button" data-action="' + (state.radioMode === "off" ? "seed-radio" : "radio-next") +
        '">' + icon("radio") + (state.radioMode === "off" ? "从当前歌曲开启" : "听一首推荐") + "</button>"
      : '<button type="button" class="primary-button" data-action="seed-radio" data-track="' + resumeTrack.id + '">' + icon("play") +
        (seed ? "从这首开始" : "试听并开启") + "</button>") +
    '<a href="#search" class="quiet-button" data-mode="search">去搜索</a></div></div></div>' +
    '<div class="settings-list radio-settings">' +
    settingRow("radioMode", "推荐何时播放", "播完接续适合按专辑听。穿插推荐会在顺序播放中保留原队列的顺序。",
      Object.entries(radioModes), state.radioMode) +
    settingRow("discovery", "探索程度", "控制顺序播放中插播的频率和相似歌曲的排序。",
      Object.entries(discoveryLevels).map(([id, [label]]) => [id, label]), state.discovery) +
    '</div><p class="radio-privacy">收藏、听完和快速跳过会影响推荐排序。这些偏好仅保存在当前浏览器。</p>' +
    (state.hiddenTracks.length ? '<details class="radio-hidden"><summary>不再推荐 · ' + state.hiddenTracks.length + " 首</summary>" +
      state.hiddenTracks.map((track) => '<div class="queue-row">' + trackMeta(track, "details") + '<div>' +
        button("unhide-recommendation", "up", "恢复推荐 " + track.name, track) + "</div></div>").join("") + "</details>" : "");
}

async function lookup(raw, mode = state.mode) {
  raw = raw.trim();
  if (!raw) { $("query").focus(); return; }
  let input;
  try { input = readInput(raw, mode); }
  catch (error) {
    state.views[mode] = { title: "输入有误", kind: "error", message: error.message };
    renderResults();
    return;
  }
  const target = input.mode;
  state.trackFilter = "";
  state.queries[target] = raw;
  if (target !== state.mode) displayMode(target);
  if (state.lookup) {
    state.lookup.controller.abort();
    if (state.views[state.lookup.target]?.kind === "loading") delete state.views[state.lookup.target];
  }
  const controller = new AbortController();
  state.lookup = { controller, target };
  state.views[target] = { title: target === "download" ? "正在准备文件…" : "正在读取…", kind: "loading" };
  renderResults();
  const quality = state.quality;
  const signal = controller.signal;
  try {
    let result;
    if (target === "search") {
      const data = await request("/search", { keyword: input.keyword, limit: $("search-limit").value }, { signal });
      const tracks = tracksFrom(data);
      result = { title: "搜索结果", note: "“" + input.keyword + "” · " + tracks.length + " 首", tracks };
    } else if (target === "song") {
      result = await resolveSong(input.id, quality, signal);
    } else if (target === "download") {
      result = await downloadTrack({ id: input.id, name: "" }, $("download-format").value, signal);
    } else {
      const data = await request("/" + target, { id: input.id }, { signal, timeout: 110000 });
      const collection = data[target];
      if (!collection?.name) throw new Error("没有找到这张" + (target === "album" ? "专辑" : "歌单") + "。");
      const tracks = tracksFrom(collection.tracks || collection.songs);
      result = { title: target === "album" ? "专辑详情" : "歌单详情", note: "已读取 " + tracks.length + " 首曲目",
        collection, collectionId: input.id, tracks };
    }
    if (!signal.aborted) state.views[target] = result;
  } catch (error) {
    if (!signal.aborted) state.views[target] = { title: "请求失败", kind: "error", message: error.message };
  } finally {
    if (state.lookup?.controller === controller) {
      state.lookup = null;
      if (signal.aborted && state.views[target]?.kind === "loading") delete state.views[target];
      if (state.mode === target) renderResults();
    }
  }
}

async function resolveSong(id, quality, signal) {
  let data;
  let message;
  try {
    data = await request("/song", { id, type: "json", level: quality }, { signal, timeout: 95000 });
  } catch (error) {
    if (signal.aborted) throw error;
    const metadata = await request("/song", { id, type: "name", level: quality }, { signal });
    data = metadata.songs?.[0];
    message = "完整解析失败，已显示可读取的歌曲资料。";
  }
  const song = songRecord(data);
  if (!song) throw new Error("服务没有返回有效的歌曲信息。");
  if (directURL(data.url)) remember(mediaCache, song.id + ":" + quality, data, 60000);
  if (typeof data.lyric === "string") remember(lyricCache, song.id, { lyric: data.lyric, translation: data.tlyric }, 300000);
  return { title: "单曲详情", note: "网易云音乐 ID " + song.id, song, songData: data, requested: quality, message };
}

function findTrack(id) {
  const view = getView();
  return [view.song, ...(view.tracks || []), state.current?.track, state.radioAnchor, ...state.queue, ...state.favorites,
    ...state.history, ...state.hiddenTracks, ...quickTracks]
    .find((item) => item?.id === id);
}

function uniqueTracks(tracks) {
  return [...new Map(tracks.map((track) => [track.id, track])).values()];
}

function newCollection(name) {
  return { id: Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10), name, tracks: [] };
}

function enqueue(tracks, feedback = true) {
  const known = new Set(state.queue.map((track) => track.id));
  let count = 0;
  for (const track of tracks) {
    if (known.has(track.id)) continue;
    known.add(track.id);
    state.queue.push(track);
    count++;
  }
  persist();
  renderQueue();
  syncPlayer();
  if (feedback) toast(count ? "已加入 " + count + " 首歌曲" : "所选歌曲已在队列中");
}

function playNext(track) {
  if (!track || state.current?.track.id === track.id) return;
  state.queue = state.queue.filter((item) => item.id !== track.id);
  const cursor = state.queue.findIndex((item) => item.id === state.current?.queueCursor);
  state.queue.splice(cursor + 1, 0, track);
  state.priority = [track.id, ...state.priority.filter((id) => id !== track.id)].slice(0, 50);
  persist();
  renderQueue();
  if ($("queue-dialog").open) {
    $("queue-rows").querySelector('[data-action="play"][data-track="' + track.id + '"]')?.focus();
  }
  syncPlayer();
  toast("下一首播放「" + track.name + "」");
}

function renderQueue() {
  $("queue-count").hidden = !state.queue.length;
  $("queue-count").textContent = state.queue.length;
  $("queue-title-count").textContent = state.queue.length ? "· " + state.queue.length + " 首" : "";
  $("clear-queue").disabled = !state.queue.length;
  $("save-queue").disabled = !state.queue.length;
  renderSleep();
  if (!$("queue-dialog").open) return;
  const reason = state.current?.recommendation;
  const current = state.current?.track;
  $("queue-radio").innerHTML = (state.radioMode !== "off" || current)
    ? '<div class="queue-radio-note">' + icon("radio") + '<div><strong>' +
      esc(reason ? reason.reason : "心动电台 · " + radioModes[state.radioMode]) + "</strong><p>" +
      esc(state.radioStatus || "手动安排的下一首先播放。") + "</p></div>" +
      (current ? button("now-like", "heart", favorite(current) ? "取消收藏当前歌曲" : "收藏当前歌曲", null, { pressed: favorite(current) }) : "") +
      (reason ? button("hide-recommendation", "ban", "不再推荐当前歌曲") : "") + "</div>" : "";
  $("queue-rows").innerHTML = state.queue.length ? state.queue.map((track, index) => (
    '<div class="queue-row' + (state.current?.track.id === track.id ? " is-current" : "") + '">' + trackMeta(track, "play") + '<div>' +
    (state.priority.includes(track.id) ? '<small class="queue-priority">接下来</small>' :
      button("play-next", "list-plus", "下一首播放 " + track.name, track, { disabled: state.current?.track.id === track.id })) +
    button("queue-up", "up", "上移 " + track.name, track, { disabled: index === 0 }) +
    button("queue-down", "down", "下移 " + track.name, track, { disabled: index === state.queue.length - 1 }) +
    button("queue-remove", "close", "移出队列 " + track.name, track) + "</div></div>"
  )).join("") : empty("list", "播放队列为空", "点击歌曲旁的加入队列按钮，或加入整张歌单。");
}

function changeQueue(track, action) {
  const index = state.queue.findIndex((item) => item.id === track.id);
  if (index < 0) return;
  if (action === "queue-remove") state.queue.splice(index, 1);
  else {
    const destination = index + (action === "queue-up" ? -1 : 1);
    if (destination < 0 || destination >= state.queue.length) return;
    [state.queue[index], state.queue[destination]] = [state.queue[destination], state.queue[index]];
  }
  state.priority = state.priority.filter((id) => id !== track.id);
  persist();
  renderQueue();
  syncPlayer();
  const controls = [...$("queue-rows").querySelectorAll("button")];
  const preferred = controls.find((control) => control.dataset.track === track.id && control.dataset.action === action && !control.disabled);
  const fallback = controls.find((control) => control.dataset.track === track.id && control.dataset.action === "play");
  (preferred || fallback || controls[0] || $("queue-dialog").querySelector('[data-action="close"]')).focus();
}

function toggleFavorite(track) {
  if (!track) return;
  const liked = favorite(track);
  state.favorites = liked ? state.favorites.filter((item) => item.id !== track.id) : [track, ...state.favorites];
  persist();
  if (state.mode === "favorites") renderResults();
  else $("favorite-count").textContent = state.favorites.length;
  syncPlayer();
  const queueLike = $("queue-radio").querySelector('[data-action="now-like"]');
  if (queueLike && track.id === state.current?.track.id) {
    queueLike.setAttribute("aria-pressed", String(!liked));
    labelButton(queueLike, liked ? "收藏当前歌曲" : "取消收藏当前歌曲");
  }
  toast(liked ? "已取消收藏" : "已收藏");
}

function refreshTrackButtons() {
  for (const row of $("result-content").querySelectorAll("[data-row]")) {
    const active = row.dataset.row === state.current?.track.id;
    row.classList.toggle("is-current", active);
    const play = row.querySelector('[data-action="play"]');
    const title = row.querySelector(".track-meta strong").textContent;
    const playing = active && !audio.paused;
    setIcon(play, playing ? "pause" : "play");
    labelButton(play, (playing ? "暂停 " : "播放 ") + title);
  }
  for (const like of $("result-content").querySelectorAll('[data-action="favorite"]')) {
    const liked = state.favorites.some((track) => track.id === like.dataset.track);
    like.classList.toggle("liked", liked);
    like.setAttribute("aria-pressed", String(liked));
    const title = findTrack(like.dataset.track)?.name || "";
    labelButton(like, (liked ? "取消收藏 " : "收藏 ") + title);
  }
}

function recordPlay(track) {
  if (state.history[0]?.id === track.id) return;
  state.history = [track, ...state.history.filter((item) => item.id !== track.id)].slice(0, 60);
  persist();
  if (state.mode === "history") renderResults();
}

function artistKeys(track) {
  return track.artists.split(" / ").map((name) => name.trim().toLowerCase()).filter(Boolean);
}

function learnFromPlayback(ended) {
  const current = state.current;
  if (!current?.tracked || current.rated) return;
  const ranges = audio.played;
  let seconds = 0;
  for (let index = 0; index < ranges.length; index++) seconds += ranges.end(index) - ranges.start(index);
  const duration = audio.duration || Infinity;
  const value = (ended && seconds >= Math.min(20, duration * 0.6)) ? 2 :
    seconds >= Math.min(60, duration * 0.6) ? 1 : !ended && seconds < Math.min(15, duration * 0.35) ? -1 : 0;
  if (!value) return;
  current.rated = true;
  for (const key of artistKeys(current.track)) {
    const score = state.artistTaste.get(key) || 0;
    state.artistTaste.delete(key);
    state.artistTaste.set(key, Math.max(-8, Math.min(12, score + value)));
  }
  while (state.artistTaste.size > 100) state.artistTaste.delete(state.artistTaste.keys().next().value);
  persist();
}

let lastProgressWrite = 0;
function saveProgress(force = false) {
  const current = state.current;
  if (!current?.tracked || !Number.isFinite(audio.currentTime)) return;
  if (!force && Date.now() - lastProgressWrite < 5000) return;
  lastProgressWrite = Date.now();
  state.resume = { track: current.track, time: audio.ended ? 0 : audio.currentTime };
  persist();
}

function setNowStatus(text, kind = "") {
  $("play-status").textContent = text;
  $("play-status-dot").dataset.state = kind;
}

function applyCover(image, track, size, placeholder) {
  const url = mediaURL(track.pic, size);
  if (url) {
    if (image.getAttribute("src") !== url) image.src = url;
  } else image.removeAttribute("src");
  image.hidden = !url;
  if (placeholder) placeholder.classList.toggle("empty-cover", !url);
}

function displayCurrent(track, recommendation) {
  $("now-name").textContent = track.name;
  $("now-artist").textContent = track.artists || "未知歌手";
  $("mini-name").textContent = track.name;
  $("mini-artist").textContent = [recommendation ? "心动推荐" : "", track.artists || "未知歌手"].filter(Boolean).join(" · ");
  $("radio-reason").hidden = !recommendation;
  $("radio-reason").textContent = recommendation?.reason || "";
  applyCover($("now-image"), track, 520, $("now-cover"));
  applyCover($("mini-image"), track, 100);
  if ("mediaSession" in navigator && typeof MediaMetadata !== "undefined") {
    const art = mediaURL(track.pic, 300);
    navigator.mediaSession.metadata = new MediaMetadata({ title: track.name, artist: track.artists, album: track.album, artwork: art ? [{ src: art }] : [] });
  }
}

async function playAudio(quiet = false) {
  const source = audio.src;
  try {
    await audio.play();
    return true;
  } catch (error) {
    if (error.name !== "AbortError" && audio.src === source) {
      const message = error.name === "NotAllowedError" ? "点击播放按钮继续试听。" : playbackError();
      setNowStatus(message, "error");
      if (!quiet || error.name === "NotAllowedError") toast(message);
    }
    return error.name === "NotAllowedError";
  }
}

function playbackError() {
  if (lanAccess && state.current?.route === "direct") return "直连播放失败，可在设置中切换到 NAS 播放。";
  return "音源播放失败，请尝试切换音质或检查网络。";
}

async function loadTrackLyrics(id, quality, signal) {
  const cached = recall(lyricCache, id);
  if (cached) return cached;
  const data = await request("/song", { id, type: "lyric", level: quality }, { signal });
  const lyrics = { lyric: data.lrc?.lyric || "", translation: data.tlyric?.lyric || "" };
  remember(lyricCache, id, lyrics, 300000);
  return lyrics;
}

async function startTrack(track, { autoPlay = true, seek = 0, keepCurrent = false, recommendation = null,
  queueCursor = track.id, navigation = true, advance = null, automatic = false } = {}) {
  if (state.advance && state.advance !== advance) {
    state.advance.abort();
    state.advance = null;
    state.radioStatus = "";
  }
  state.playRequest?.abort();
  const controller = new AbortController();
  state.playRequest = controller;
  const quality = state.quality;
  const route = state.playbackRoute;
  const signal = controller.signal;
  const abortAdvance = () => controller.abort();
  advance?.signal.addEventListener("abort", abortAdvance, { once: true });
  if (!keepCurrent) {
    if (!automatic && navigation) {
      learnFromPlayback(false);
      state.radioAnchor = track;
      state.radioStreak = 1;
      state.radioStatus = "";
    }
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    state.current = { track, requested: quality, recommendation, queueCursor, navigation };
    setLyrics("", "");
    displayCurrent(track, recommendation);
    renderResume();
    loadTrackLyrics(track.id, quality, signal).then((data) => {
      if (!signal.aborted && state.current?.track.id === track.id) setLyrics(data.lyric, data.translation);
    }).catch(() => {
      if (!signal.aborted && state.current?.track.id === track.id) $("lyrics").textContent = "歌词暂时无法加载。";
    });
  }
  if (!recommendation && navigation && !keepCurrent && !automatic) enqueue([track], false);
  if (!keepCurrent && state.priority.includes(track.id)) {
    state.priority = state.priority.filter((id) => id !== track.id);
    persist();
  }
  renderQueue();
  setNowStatus("正在获取音源…", "loading");
  syncPlayer();
  try {
    const data = route === "nas"
      ? { url: apiURL("/download", { id: track.id, quality, format: "file" }).href }
      : await resolveMedia(track.id, quality, signal);
    if (signal.aborted) return false;
    const stream = data.url;
    state.current = { ...state.current, requested: quality, level: data.level, stream, route };
    audio.src = stream;
    if (seek > 0) {
      audio.addEventListener("loadedmetadata", () => {
        if (audio.src === stream && Number.isFinite(audio.duration)) audio.currentTime = Math.min(seek, Math.max(0, audio.duration - 1));
      }, { once: true });
    }
    setNowStatus("可试听" + qualitySuffix(), "ok");
    return autoPlay ? await playAudio(Boolean(recommendation && advance)) : true;
  } catch (error) {
    if (!signal.aborted) {
      const message = error.message || "暂时无法读取音源。";
      setNowStatus(keepCurrent ? "切换失败，保留原音源" + qualitySuffix() : message, "error");
      if (!recommendation) toast(message);
    }
    return false;
  } finally {
    advance?.signal.removeEventListener("abort", abortAdvance);
    if (state.playRequest === controller) {
      state.playRequest = null;
      updateRadioView();
      syncPlayer();
    }
  }
}

function togglePlay(track = state.current?.track || state.queue[0]) {
  if (!track) return;
  if (state.current?.track.id !== track.id || !audio.getAttribute("src") || audio.error) {
    if (!state.playRequest || state.current?.track.id !== track.id) {
      const current = state.current?.track.id === track.id ? state.current : null;
      startTrack(track, current?.recommendation ? { recommendation: current.recommendation, queueCursor: current.queueCursor } : {});
    }
  } else if (audio.paused) {
    playAudio();
  } else {
    audio.pause();
  }
}

function updateRadioView() {
  if (state.mode !== "radio") return;
  const focused = document.activeElement;
  if ($("result-content").contains(focused) && focused.dataset.setting) {
    const feature = $("result-content").querySelector(".radio-feature");
    const markup = document.createElement("template");
    markup.innerHTML = radioMarkup();
    feature?.replaceWith(markup.content.firstElementChild);
  } else {
    renderResults();
    if (focused?.dataset.action === "radio-next" || focused?.dataset.action === "seed-radio") {
      $("result-content").querySelector(".radio-actions button")?.focus();
    }
  }
}

function setRadioMode(value) {
  if (!Object.hasOwn(radioModes, value)) return;
  state.advance?.abort();
  state.advance = null;
  state.radioMode = value;
  state.radioStatus = "";
  state.radioStreak = 0;
  const setting = $("setting-radioMode");
  if (setting) setting.value = value;
  persist();
  updateRadioView();
  renderQueue();
  syncPlayer();
}

function seedRadio(track) {
  const seed = track || state.current?.track;
  if (!seed) return;
  state.radioAnchor = seed;
  setRadioMode("mix");
  if (state.current?.track.id !== seed.id || !audio.getAttribute("src")) startTrack(seed);
  else {
    prefetchSimilar(seed);
    if (audio.paused) playAudio();
  }
  toast("已开启相似电台");
}

function loadSimilar(seed) {
  const cached = recall(similarCache, seed.id);
  if (cached) return Promise.resolve(cached);
  if (!similarRequests.has(seed.id)) {
    const loading = request("/api/similar", { id: seed.id }, { timeout: 9000 })
      .then((data) => {
        const tracks = tracksFrom(data);
        remember(similarCache, seed.id, tracks, 300000);
        return tracks;
      }).finally(() => similarRequests.delete(seed.id));
    similarRequests.set(seed.id, loading);
  }
  return similarRequests.get(seed.id);
}

function prefetchSimilar(seed) {
  loadSimilar(seed).catch(() => { /* A failed prefetch can be retried when switching tracks. */ });
}

function queueNext() {
  const priority = state.queue.find((track) => track.id === state.priority[0]);
  if (priority) return priority;
  const cursor = state.queue.findIndex((track) => track.id === state.current?.queueCursor);
  if (state.order === "shuffle" && state.queue.length > 1) {
    const previous = state.trail.slice(0, state.trailIndex + 1).reverse().map(({ track }) => track.id);
    const choices = state.queue.filter((track) => track.id !== state.current?.track.id);
    const fresh = choices.filter((track) => !previous.includes(track.id));
    return fresh.length ? fresh[Math.floor(Math.random() * fresh.length)] :
      choices.reduce((oldest, track) => previous.indexOf(track.id) > previous.indexOf(oldest.id) ? track : oldest);
  }
  return state.queue[cursor + 1] || (state.order === "repeat-all" ? state.queue[0] : null);
}

function shouldRecommend(next) {
  return state.radioMode !== "off" && (!next || (state.radioMode === "mix" && state.order === "sequence" &&
    state.radioStreak >= discoveryLevels[state.discovery][1]));
}

function radioSeeds() {
  const anchor = state.radioAnchor || state.current?.track;
  const tasteSeed = state.favorites.find((track) => !state.hiddenTracks.some((item) => item.id === track.id)) ||
    state.history.find((track) => artistKeys(track).some((artist) => state.artistTaste.get(artist) > 1));
  const first = state.radioPlayed % 3 === 2 && tasteSeed ? tasteSeed : anchor;
  return uniqueTracks([first, anchor, state.current?.track, tasteSeed].filter(Boolean)).slice(0, 2);
}

async function recommendations(next, signal) {
  const currentId = state.current?.track.id;
  const seen = new Set(state.trail.slice(-24).map(({ track }) => track.id));
  const blocked = new Set(state.hiddenTracks.map((track) => track.id));
  const queued = new Set(state.queue.map((track) => track.id));
  const recent = new Set(state.history.slice(0, 8).map((track) => track.id));
  const recentArtists = state.history.slice(0, 3).flatMap(artistKeys);
  const favoriteArtists = new Set(state.favorites.slice(0, 25).flatMap(artistKeys));
  const eligible = (track) => track.id !== currentId && !seen.has(track.id) && !blocked.has(track.id) &&
    !recall(failedRecommendations, track.id + ":" + state.quality) && (!queued.has(track.id) || track.id === next?.id);
  const score = (track) => {
    const artists = artistKeys(track);
    const taste = artists.reduce((total, name) => total + (state.artistTaste.get(name) || 0) + (favoriteArtists.has(name) ? 3 : 0), 0);
    const loved = favorite(track) ? 1 : 0;
    const repeats = recentArtists.filter((name) => artists.includes(name)).length;
    if (state.discovery === "explore") return taste * .3 - repeats * 5 - loved * 5 - (recent.has(track.id) ? 12 : 0);
    return taste * .55 + loved * (state.discovery === "familiar" ? 8 : 2) - repeats * 2 - (recent.has(track.id) ? 5 : 0);
  };
  const select = (tracks, reason) => uniqueTracks(tracks).filter(eligible).sort((a, b) => score(b) - score(a))
    .map((track) => ({ track, reason: (queued.has(track.id) ? "队列内 · " : "心动推荐 · ") + reason }));
  const seeds = radioSeeds();
  for (const seed of seeds) {
    if (signal.aborted) return [];
    try {
      const tracks = await loadSimilar(seed);
      const choices = select(tracks, "与「" + seed.name + "」相似");
      if (choices.length) return choices;
    } catch { /* Try a second seed or artist search. */ }
  }
  if (signal.aborted) return [];
  const seed = seeds[0];
  const artist = seed?.artists.split(" / ")[0];
  if (artist) {
    try {
      const found = tracksFrom(await request("/search", { keyword: artist, limit: 12 }, { signal, timeout: 6000 }));
      const choices = select(found.filter((track) => artistKeys(track).includes(artist.toLowerCase())), "同歌手 · " + artist);
      if (choices.length) return choices;
    } catch { /* Saved favorites remain available if discovery is temporarily unreachable. */ }
  }
  return signal.aborted ? [] : select(state.favorites, "来自你的收藏");
}

function previousTrack() {
  if (audio.currentTime >= 3) { audio.currentTime = 0; return; }
  if (state.trailIndex > 0) {
    const { track, recommendation, queueCursor } = state.trail[--state.trailIndex];
    startTrack(track, { recommendation, queueCursor, navigation: false });
    return;
  }
  const cursor = state.queue.findIndex((track) => track.id === state.current?.queueCursor);
  const previous = state.queue[cursor > 0 ? cursor - 1 : state.order === "repeat-all" ? state.queue.length - 1 : -1];
  if (previous) startTrack(previous, { automatic: true });
}

async function nextTrack(ended = false, forceRadio = false) {
  if (state.advance) return;
  learnFromPlayback(ended);
  if (!forceRadio && ended && state.order === "repeat-one" && audio.getAttribute("src")) {
    audio.currentTime = 0;
    playAudio();
    return;
  }
  const next = queueNext();
  const priority = next && state.priority.includes(next.id);
  if (!priority && !forceRadio && state.trailIndex + 1 < state.trail.length) {
    const { track, recommendation, queueCursor } = state.trail[++state.trailIndex];
    startTrack(track, { recommendation, queueCursor, navigation: false });
    return;
  }
  if (!priority && (forceRadio || shouldRecommend(next))) {
    const advance = new AbortController();
    state.advance = advance;
    state.radioStatus = "正在挑选推荐…";
    const queueCursor = state.current?.queueCursor || null;
    updateRadioView();
    renderQueue();
    syncPlayer();
    let found = false;
    try {
      const choices = await recommendations(next, advance.signal);
      for (const choice of choices.slice(0, 3)) {
        if (advance.signal.aborted) break;
        const quality = state.quality;
        found = await startTrack(choice.track, { recommendation: choice,
          queueCursor: choice.track.id === next?.id ? choice.track.id : queueCursor, advance, automatic: true });
        if (found) {
          state.radioStreak = 0;
          state.radioPlayed++;
          break;
        }
        if (!advance.signal.aborted) remember(failedRecommendations, choice.track.id + ":" + quality, true, 120000);
      }
    } finally {
      if (state.advance === advance) {
        state.advance = null;
        state.radioStatus = found ? "" : "暂时没有可用的推荐歌曲";
        updateRadioView();
        renderQueue();
        syncPlayer();
      }
    }
    if (advance.signal.aborted || found) return;
    if (!next) {
      setNowStatus(state.radioStatus, "error");
      toast(state.radioStatus);
      return;
    }
  }
  if (next) {
    state.radioStreak++;
    startTrack(next, { automatic: true });
  } else if (ended) setNowStatus("已播完队列" + qualitySuffix(), "ok");
}

function qualitySuffix() {
  if (!state.current?.stream) return "";
  if (state.current.route === "nas") return " · NAS";
  return " · 直连" + (state.current.level ? " · " + (qualities[state.current.level] || state.current.level) : "");
}

function syncPrevious() {
  const cursor = state.queue.findIndex((track) => track.id === state.current?.queueCursor);
  $("previous").disabled = audio.currentTime < 3 && state.trailIndex < 1 &&
    (!state.queue.length || cursor <= 0 && state.order !== "repeat-all");
}

function syncPlayer() {
  const track = state.current?.track;
  const activeIndex = state.queue.findIndex((item) => item.id === state.current?.queueCursor);
  const wrap = state.order === "repeat-all";
  const toggle = $("play-toggle");
  toggle.disabled = (!track && !state.queue.length) || (!!state.playRequest && !audio.getAttribute("src"));
  const playing = !audio.paused;
  setIcon(toggle, playing ? "pause" : "play");
  labelButton(toggle, playing ? "暂停" : "播放");
  syncPrevious();
  $("next").disabled = Boolean(state.advance) || (!state.priority.length && state.trailIndex + 1 >= state.trail.length &&
    !((track || state.queue.length) && state.radioMode !== "off") &&
    (state.queue.length === 0 || (activeIndex === state.queue.length - 1 && !wrap &&
      (state.order !== "shuffle" || state.queue.length === 1))));
  $("now-panel").querySelector('[data-action="seed-radio"]').disabled = !track;
  $("now-panel").querySelector('[data-action="save-track"]').disabled = !track;
  $("now-panel").querySelector('[data-action="hide-recommendation"]').hidden = !state.current?.recommendation;
  const nowLike = $("now-like");
  nowLike.disabled = !track;
  const liked = track ? favorite(track) : false;
  nowLike.classList.toggle("liked", liked);
  nowLike.setAttribute("aria-pressed", String(liked));
  labelButton(nowLike, liked ? "取消收藏当前歌曲" : "收藏当前歌曲");
  const [, label, glyph] = orders.find(([id]) => id === state.order);
  labelButton($("play-mode"), "播放顺序：" + label);
  setIcon($("play-mode"), glyph);
  $("play-mode").classList.toggle("accent", state.order !== "sequence");
  const muted = audio.muted || audio.volume === 0;
  setIcon($("mute"), muted ? "muted" : "volume");
  labelButton($("mute"), muted ? "取消静音" : "静音");
  refreshTrackButtons();
}

function parseLRC(raw) {
  const lines = [];
  const offset = Number(raw.match(/\[offset:([+-]?\d+)\]/i)?.[1] || 0) / 1000;
  for (const line of raw.split(/\r?\n/)) {
    const stampPattern = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
    const stamps = [...line.matchAll(stampPattern)];
    const text = line.replace(stampPattern, "").trim();
    if (!text) continue;
    for (const [, minutes, seconds, decimals] of stamps) {
      lines.push({ time: Math.max(0, Number(minutes) * 60 + Number(seconds) + Number("0." + (decimals || 0)) + offset), text });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

function matchLyrics(raw, translation) {
  const lines = parseLRC(raw);
  const translated = parseLRC(translation);
  let j = 0;
  for (const line of lines) {
    while (j + 1 < translated.length && Math.abs(translated[j + 1].time - line.time) <= Math.abs(translated[j].time - line.time)) j++;
    if (translated[j] && Math.abs(translated[j].time - line.time) <= 0.45) line.translation = translated[j].text;
  }
  return lines;
}

function setLyrics(raw, translation) {
  state.lrc = typeof raw === "string" ? raw : "";
  state.translation = typeof translation === "string" ? translation : "";
  state.lyrics = matchLyrics(state.lrc, state.translation);
  renderLyrics();
}

function lyricMarkup(lines, raw, seekable = true) {
  if (!lines.length) {
    const text = raw.replace(/^\[[a-z]+:[^\]]*\]\s*/gim, "").trim();
    return '<p class="empty-lyrics">' + (text ? esc(text).replaceAll("\n", "<br>") : "暂无歌词。") + "</p>";
  }
  return lines.map((line, index) => {
    const body = esc(line.text) + (state.translated && line.translation ? "<small>" + esc(line.translation) + "</small>" : "");
    return seekable ? '<button type="button" class="lyric-line" data-action="seek-line" data-index="' + index +
      '" data-time="' + line.time + '">' + body + "</button>" : '<p class="lyric-line">' + body + "</p>";
  }).join("");
}

function renderLyrics() {
  state.lyricIndex = -1;
  $("lyrics").innerHTML = lyricMarkup(state.lyrics, state.lrc);
  if ($("lyrics-dialog").open && $("lyrics-dialog").dataset.follow === "true") renderLyricsDialog();
  $("translate-toggle").disabled = !state.lyrics.some((line) => line.translation);
  $("translate-toggle").setAttribute("aria-pressed", String(state.translated));
  $("lyrics-export").disabled = !state.lrc;
  highlightLyrics();
}

function highlightLyrics() {
  if (!state.lyrics.length) return;
  let first = 0;
  let end = state.lyrics.length;
  while (first < end) {
    const middle = (first + end) >> 1;
    if (state.lyrics[middle].time <= audio.currentTime + 0.05) first = middle + 1;
    else end = middle;
  }
  const index = first - 1;
  if (index === state.lyricIndex) return;
  state.lyricIndex = index;
  const panels = [$("lyrics")];
  if ($("lyrics-dialog").open && $("lyrics-dialog").dataset.follow === "true") panels.push($("mobile-lyrics-content"));
  for (const panel of panels) {
    panel.querySelector(".active")?.classList.remove("active");
    const line = panel.querySelector('[data-index="' + index + '"]');
    if (!line) continue;
    line.classList.add("active");
    if (panel.clientHeight) {
      panel.scrollTop += line.getBoundingClientRect().top - panel.getBoundingClientRect().top - panel.clientHeight * 0.35;
    }
  }
}

function timeText(value) {
  const seconds = Math.max(0, Math.floor(value || 0));
  return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
}

function syncTimeline() {
  const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
  $("seek").max = duration;
  $("seek").disabled = duration <= 0;
  $("seek").value = audio.currentTime || 0;
  $("elapsed").textContent = timeText(audio.currentTime);
  $("duration").textContent = timeText(duration);
  syncPrevious();
  highlightLyrics();
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_");
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

const backupFormat = "echo-room-library";
const maxBackupBytes = 3 * 1024 * 1024;

function exportLibrary() {
  const { favorites, collections, hiddenTracks } = state;
  const file = new Blob([JSON.stringify({ format: backupFormat, version: 1, favorites, collections, hiddenTracks })],
    { type: "application/json" });
  if (file.size > maxBackupBytes) { toast("音乐库超过了单份备份的 3 MB 上限。"); return; }
  saveBlob(file, "echo-room-library-" + new Date().toISOString().slice(0, 10) + ".json");
}

function backupTracks(value) {
  if (!Array.isArray(value)) throw new Error("备份缺少歌曲列表。");
  return value.map((item) => {
    const track = songRecord(item);
    if (!track || typeof item.name !== "string") throw new Error("备份包含无效的歌曲。");
    const picture = mediaURL(track.pic);
    return { ...track, name: track.name.slice(0, 300), artists: track.artists.slice(0, 300), album: track.album.slice(0, 300),
      pic: picture && /\.music\.126\.net$/.test(new URL(picture).hostname) ? picture : "" };
  });
}

async function importLibrary(event) {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  if (file.size > maxBackupBytes) { toast("备份文件须小于 3 MB。"); return; }
  try {
    let data;
    try { data = JSON.parse(await file.text()); }
    catch { throw new Error("文件不是有效的 JSON 备份。"); }
    if (data?.format !== backupFormat || data.version !== 1 || !Array.isArray(data.collections)) {
      throw new Error("请选择由回声导出的音乐库备份。");
    }
    const merge = (existing, incoming) => {
      const known = new Set(existing.map((track) => track.id));
      return [...existing, ...uniqueTracks(incoming).filter((track) => !known.has(track.id))];
    };
    const favorites = merge(state.favorites, backupTracks(data.favorites));
    const hiddenTracks = merge(state.hiddenTracks, backupTracks(data.hiddenTracks)).slice(0, 200);
    const collections = state.collections.map((item) => ({ ...item }));
    for (const item of data.collections) {
      if (typeof item?.name !== "string" || !item.name.trim() || typeof item.id !== "string" || !/^[a-z0-9-]{1,80}$/.test(item.id)) {
        throw new Error("备份包含无效的歌单。");
      }
      const name = item.name.trim().slice(0, 48);
      const tracks = backupTracks(item.tracks);
      let target = collections.find((entry) => entry.id === item.id);
      if (!target) {
        target = { id: item.id, name, tracks: [] };
        collections.push(target);
      }
      target.tracks = merge(target.tracks, tracks);
    }
    const before = { favorites: state.favorites, hiddenTracks: state.hiddenTracks, collections: state.collections };
    Object.assign(state, { favorites, hiddenTracks, collections });
    if (!persist()) {
      Object.assign(state, before);
      throw new Error("浏览器空间不足，未能导入备份。");
    }
    renderResults();
    syncPlayer();
    toast("已合并音乐库备份");
  } catch (error) {
    toast(error.message || "读取备份失败。");
  }
}

function sleepDescription() {
  if (state.sleepMode === "end") return "在本轮歌曲播完后暂停，包括单曲循环和心动电台。";
  if (state.sleepDeadline) return "预计在 " + new Date(state.sleepDeadline).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) + " 暂停播放。";
  return "到点暂停播放。也可以让正在听的这首完整播完。";
}

function renderSleep() {
  const select = $("setting-sleepMode");
  if (select) {
    select.value = state.sleepMode;
    $("setting-sleepMode-note").textContent = sleepDescription();
  }
  $("queue-timer").textContent = state.sleepMode === "off" ? "定时停止" : "定时 · " + sleepModes[state.sleepMode];
}

function stopForSleep() {
  setSleepMode("off");
  state.sleepStopped = true;
  state.advance?.abort();
  state.advance = null;
  state.radioStatus = "";
  state.playRequest?.abort();
  audio.pause();
  saveProgress(true);
  setNowStatus("定时停止已暂停播放" + qualitySuffix(), "ok");
  updateRadioView();
  syncPlayer();
  toast("定时停止已暂停播放");
}

function setSleepMode(value) {
  if (!Object.hasOwn(sleepModes, value)) return;
  clearTimeout(state.sleepTimer);
  state.sleepMode = value;
  const delay = Number(value) * 60000;
  state.sleepDeadline = delay ? Date.now() + delay : 0;
  state.sleepTimer = delay ? setTimeout(stopForSleep, delay) : null;
  renderSleep();
}

function checkSleepDeadline() {
  if (state.sleepDeadline && Date.now() >= state.sleepDeadline) {
    stopForSleep();
    return true;
  }
  return false;
}

function downloadName(headers, track) {
  const encoded = headers.get("X-Download-Filename") ||
    headers.get("Content-Disposition")?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try { return decodeURIComponent(encoded); } catch { /* Try the plain header. */ }
  }
  const plain = headers.get("Content-Disposition")?.match(/filename="?([^";]+)/i)?.[1];
  if (plain) return plain;
  const format = (headers.get("Content-Type") || "").match(/^audio\/([\w-]+)/i)?.[1];
  return (track.name || "网易云音乐") + "." + (format === "mpeg" ? "mp3" : format || "audio");
}

function directDownloadName(headers, track, source) {
  const contentType = (headers.get("Content-Type") || "").match(/^audio\/([\w-]+)/i)?.[1];
  const extension = source.type || contentType || new URL(source.url).pathname.match(/\.([a-z0-9]{2,5})$/i)?.[1];
  const format = String(extension || "").toLowerCase();
  const suffix = { mpeg: "mp3", mp4: "m4a", "x-flac": "flac", "x-wav": "wav" }[format] || format;
  return (track.name || "网易云音乐-" + (source.id || track.id)) + "." + (/^[a-z0-9]{2,5}$/.test(suffix) ? suffix : "audio");
}

function isDownloading(id) {
  return state.downloads.has(id);
}

function syncDownloads(id, disabled) {
  for (const button of $("result-content").querySelectorAll('[data-action="download"]')) {
    if (button.dataset.track === id) button.disabled = disabled;
  }
}

function effectiveDownloadFormat() {
  return state.downloadFormat === "auto" ? (lanAccess ? "file" : "direct") : state.downloadFormat;
}

async function downloadTrack(track, format = effectiveDownloadFormat(), signal) {
  if (isDownloading(track.id)) throw new Error("这首歌正在下载。");
  const quality = state.quality;
  state.downloads.add(track.id);
  syncDownloads(track.id, true);
  if (!signal) toast("正在准备下载 · " + (track.name || "歌曲"));
  try {
    if (format === "direct") {
      const source = await resolveMedia(track.id, quality, signal);
      let result;
      try {
        result = await request(source.url, {}, { signal, binary: true, direct: true, timeout: 240000 });
      } catch (error) {
        if (signal?.aborted) throw error;
        if (!signal) {
          $("direct-download-link").href = source.url;
          showDialog("direct-download-dialog");
        }
        return { title: "源站直连", kind: "direct-link", url: source.url };
      }
      const filename = directDownloadName(result.headers, track, source);
      saveBlob(result.blob, filename);
      toast("已从源站直连下载");
      return { title: "源站直连下载完成", kind: "saved", filename, savedMessage: "可以在浏览器的下载记录中找到该文件。" };
    }
    const result = await request("/download", { id: track.id, quality, format }, {
      signal, binary: format === "file", timeout: 240000,
    });
    if (format === "json") {
      if (!signal) toast("已保存到 NAS");
      return { title: "已保存到服务器", kind: "saved", filename: result.filename, savedMessage: [result.file_size_formatted, result.file_path].filter(Boolean).join(" · ") };
    }
    const filename = downloadName(result.headers, track);
    saveBlob(result.blob, filename);
    toast("浏览器已接收下载");
    return { title: "下载已发送", kind: "saved", filename, savedMessage: "可以在浏览器的下载记录中找到该文件。" };
  } finally {
    state.downloads.delete(track.id);
    syncDownloads(track.id, false);
  }
}

function renderServiceDetails() {
  const health = state.serviceHealth;
  const info = state.serviceInfo;
  const details = [
    ["访问方式", lanAccess ? "局域网访问" : "外网访问 · 默认直连音源"],
    ["服务版本", info?.version || health?.version || "未知"],
    ["Cookie 文件", health ? (health.cookie_status === "valid" ? "已读取" : "未读取到") : "未知"],
    ["API 信息", info ? "可读取" : state.serviceInfoFailed ? "读取失败" : ""],
    ["支持音质", (info?.supported_qualities || []).map((key) => qualities[key] || key).join("、")],
  ];
  $("service-details").innerHTML = details.filter(([, value]) => value).map(([label, value]) => "<dt>" + esc(label) + "</dt><dd>" + esc(value) + "</dd>").join("");
}

let serviceInfoRequest;
function loadServiceInfo(refresh = false) {
  if (serviceInfoRequest || (state.serviceInfo && !refresh)) return;
  serviceInfoRequest = request("/api/info", {}, { timeout: 8000 }).then((data) => {
    state.serviceInfo = data;
    state.serviceInfoFailed = false;
  }).catch(() => {
    state.serviceInfo = null;
    state.serviceInfoFailed = true;
  }).finally(() => {
    serviceInfoRequest = null;
    renderServiceDetails();
  });
}

async function checkService() {
  const check = ++state.serviceCheck;
  const dots = [$("connection-dot"), $("rail-status")];
  dots.forEach((dot) => { dot.dataset.state = "loading"; });
  $("connection-text").textContent = "正在连接";
  $("rail-caption").textContent = "正在连接";
  $("service-message").textContent = "正在检查 NAS API…";
  let health;
  let errorMessage;
  try { health = await request("/health", {}, { timeout: 8000 }); }
  catch (error) { errorMessage = error.message; }
  if (state.serviceCheck !== check) return;
  const running = Boolean(health);
  dots.forEach((dot) => { dot.dataset.state = running ? "ok" : "error"; });
  $("connection-text").textContent = running ? "服务在线" : "服务不可达";
  $("rail-caption").textContent = $("connection-text").textContent;
  $("service-message").textContent = running ? "NAS 音乐服务在线。" : errorMessage;
  state.serviceHealth = health || null;
  renderServiceDetails();
}

function showDialog(id) {
  const dialog = $(id);
  if (!dialog.open) dialog.showModal();
}

function exportLyrics(lrc, name) {
  if (lrc) saveBlob(new Blob([lrc], { type: "text/plain;charset=utf-8" }), name + ".lrc");
}

let inspectedLyrics;
function renderLyricsDialog() {
  const follow = $("lyrics-dialog").dataset.follow === "true";
  const detail = follow
    ? { raw: state.lrc, translation: state.translation, lines: state.lyrics, name: state.current?.track.name || "歌词" }
    : inspectedLyrics;
  const panel = $("mobile-lyrics-content");
  $("lyrics-dialog-title").textContent = detail.name;
  panel.innerHTML = lyricMarkup(detail.lines, detail.raw, follow);
  $("dialog-translation").hidden = !detail.translation;
  $("dialog-translation").setAttribute("aria-pressed", String(state.translated));
  $("dialog-lrc").hidden = !detail.raw;
  $("dialog-lrc-translation").hidden = !detail.translation;
  if (follow) {
    state.lyricIndex = -1;
    highlightLyrics();
  }
}

async function showSongLyrics(track) {
  if (!track) return;
  const data = getView().songData;
  $("lyrics-dialog").dataset.follow = "false";
  inspectedLyrics = { raw: "", translation: "", lines: [], name: track.name };
  showDialog("lyrics-dialog");
  renderLyricsDialog();
  let raw = data?.lyric;
  let translation = data?.tlyric;
  if (raw === undefined) {
    const context = inspectedLyrics;
    $("mobile-lyrics-content").textContent = "正在读取歌词…";
    try {
      const result = await request("/song", { id: track.id, type: "lyric", level: state.quality });
      if (inspectedLyrics !== context || $("lyrics-dialog").dataset.follow === "true") return;
      raw = result.lrc?.lyric;
      translation = result.tlyric?.lyric;
    } catch (error) {
      if (inspectedLyrics === context) $("mobile-lyrics-content").textContent = error.message;
      return;
    }
  }
  inspectedLyrics = { raw: raw || "", translation: translation || "", lines: matchLyrics(raw || "", translation || ""), name: track.name };
  renderLyricsDialog();
}

async function copyLink() {
  const url = mediaURL(getView().songData?.url);
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    toast("音频直链已复制");
  } catch {
    window.prompt("复制音频直链", url);
  }
}

function sharePage() {
  const view = getView();
  const id = view.song?.id || view.collectionId;
  if (!isId(id || "")) return;
  const url = new URL(location.pathname, location.origin);
  url.hash = state.mode + "?id=" + id;
  $("share-url").value = url.href;
  $("share-note").textContent = "能访问当前站点的人可以打开这个链接。";
  showDialog("share-dialog");
  $("share-url").select();
}

async function copyShare() {
  const input = $("share-url");
  try {
    await navigator.clipboard.writeText(input.value);
    $("share-note").textContent = "链接已复制。";
    return;
  } catch {
    // Private HTTP addresses and some browsers require the selection-based copy path.
    input.select();
    try {
      if (document.execCommand("copy")) {
        $("share-note").textContent = "链接已复制。";
        return;
      }
    } catch { /* Leave the address selected for manual copying. */ }
  }
  $("share-note").textContent = "链接已选中，可以手动复制。";
}

const actions = {
  service: () => { showDialog("service-dialog"); loadServiceInfo(); },
  "open-settings": () => { $("service-dialog").close(); displayMode("settings"); $("main").focus(); },
  "refresh-service": () => { checkService(); loadServiceInfo(true); },
  queue: () => { showDialog("queue-dialog"); renderQueue(); },
  "queue-radio": () => { $("queue-dialog").close(); displayMode("radio"); $("main").focus(); },
  "queue-timer": () => { $("queue-dialog").close(); displayMode("settings"); $("setting-sleepMode").focus(); },
  close: (_, button) => button.closest("dialog")?.close(),
  play: (track) => togglePlay(track),
  enqueue: (track) => track && enqueue([track]),
  "play-next": playNext,
  "add-all": () => enqueue(getView().tracks || []),
  "play-all": () => {
    const tracks = uniqueTracks(getView().tracks || []);
    if (!tracks.length) return;
    state.queue = tracks;
    state.priority = [];
    persist();
    startTrack(tracks[0]);
  },
  "save-all": () => editCollection(getView().tracks || []),
  "export-library": exportLibrary,
  "import-library": () => $("import-library").click(),
  "save-queue": () => editCollection(state.queue),
  "save-track": (track = state.current?.track) => track && editCollection([track]),
  "new-collection": () => editCollection([], "create"),
  "rename-collection": () => editCollection([], "rename"),
  "delete-collection": () => editCollection([], "delete"),
  "open-collection": (_, control) => {
    state.collectionId = control.dataset.collection;
    state.trackFilter = "";
    renderResults();
    $("main").focus();
  },
  "library-back": () => {
    state.collectionId = null;
    state.trackFilter = "";
    renderResults();
    $("main").focus();
  },
  "collection-remove-track": (track) => {
    const collection = getView().localCollection;
    if (!collection || !track) return;
    collection.tracks = collection.tracks.filter((item) => item.id !== track.id);
    persist();
    renderResults();
    $("result-content").querySelector('[data-action="collection-remove-track"]')?.focus();
    toast("已从歌单移除");
  },
  resume: () => {
    if (!state.resume) return;
    const { track, time } = state.resume;
    startTrack(track, { seek: time });
  },
  "seed-radio": seedRadio,
  "radio-next": () => nextTrack(false, true),
  "hide-recommendation": () => {
    const current = state.current;
    if (!current?.recommendation) return;
    state.hiddenTracks = [current.track, ...state.hiddenTracks.filter((item) => item.id !== current.track.id)].slice(0, 200);
    persist();
    updateRadioView();
    toast("已设为不再推荐");
    nextTrack();
  },
  "unhide-recommendation": (track) => {
    if (!track) return;
    state.hiddenTracks = state.hiddenTracks.filter((item) => item.id !== track.id);
    persist();
    renderResults();
    $("result-content").querySelector(".radio-hidden summary")?.focus();
    toast("已恢复推荐");
  },
  favorite: toggleFavorite,
  "now-like": () => toggleFavorite(state.current?.track),
  "toggle-play": () => togglePlay(),
  next: () => nextTrack(),
  previous: previousTrack,
  "play-mode": () => {
    const [order, label] = orders[(orders.findIndex(([id]) => id === state.order) + 1) % orders.length];
    state.order = order;
    persist();
    syncPlayer();
    toast(label);
  },
  mute: () => {
    if (!audio.volume) { audio.volume = 0.75; audio.muted = false; }
    else audio.muted = !audio.muted;
  },
  "queue-up": (track) => track && changeQueue(track, "queue-up"),
  "queue-down": (track) => track && changeQueue(track, "queue-down"),
  "queue-remove": (track) => track && changeQueue(track, "queue-remove"),
  "clear-queue": () => {
    state.queue = [];
    state.priority = [];
    persist();
    renderQueue();
    syncPlayer();
    $("queue-dialog").querySelector('[data-action="close"]').focus();
  },
  details: (track) => track && lookup(track.id, "song"),
  download: (track) => track && downloadTrack(track).catch((error) => toast(error.message)),
  "copy-link": copyLink,
  "share-page": sharePage,
  "copy-share": copyShare,
  translate: () => {
    state.translated = !state.translated;
    persist();
    renderLyrics();
    if ($("lyrics-dialog").open && $("lyrics-dialog").dataset.follow === "false") renderLyricsDialog();
  },
  "lyrics-export": () => exportLyrics(state.lrc, state.current?.track.name || "歌词"),
  "mobile-lyrics": () => {
    $("lyrics-dialog").dataset.follow = "true";
    showDialog("lyrics-dialog");
    renderLyricsDialog();
  },
  "song-lyrics": showSongLyrics,
  "dialog-lrc": () => {
    const follow = $("lyrics-dialog").dataset.follow === "true";
    exportLyrics(follow ? state.lrc : inspectedLyrics.raw, (follow ? state.current?.track.name : inspectedLyrics.name) || "歌词");
  },
  "dialog-lrc-translation": () => {
    const follow = $("lyrics-dialog").dataset.follow === "true";
    const name = (follow ? state.current?.track.name : inspectedLyrics.name) || "歌词";
    exportLyrics(follow ? state.translation : inspectedLyrics.translation, name + "（译文）");
  },
  "seek-line": (_, button) => {
    if (audio.getAttribute("src") && Number.isFinite(audio.duration)) audio.currentTime = Math.min(Number(button.dataset.time), audio.duration);
  },
};

document.addEventListener("click", (event) => {
  const control = event.target.closest("[data-mode],[data-action],[data-query]");
  if (!control || control.disabled) return;
  if (control.dataset.mode) {
    event.preventDefault();
    displayMode(control.dataset.mode);
  } else if (control.dataset.query) {
    $("query").value = control.dataset.query;
    lookup(control.dataset.query, "search");
  } else {
    const handler = actions[control.dataset.action];
    if (handler) handler(control.dataset.track ? findTrack(control.dataset.track) : undefined, control);
  }
});

document.addEventListener("error", (event) => {
  if (event.target instanceof HTMLImageElement) {
    event.target.hidden = true;
    if (event.target === $("now-image")) $("now-cover").classList.add("empty-cover");
  }
}, true);

window.addEventListener("hashchange", openLocation);
$("lookup-form").addEventListener("submit", (event) => { event.preventDefault(); lookup($("query").value); });
$("query").addEventListener("input", () => { state.queries[state.mode] = $("query").value; });
$("download-format").value = effectiveDownloadFormat();
function updateDownloadNote() {
  const notes = {
    direct: "浏览器从网易云源站取文件，使用源文件的标签。",
    file: lanAccess ? "NAS 会尝试写入封面和标签，然后通过局域网发送文件。" :
      "音频会经过隧道。普通下载可选「源站直连下载」以节省隧道流量。",
    json: "文件留在 NAS 的下载目录，浏览器只接收完成状态。",
  };
  $("download-route-note").textContent = notes[$("download-format").value];
}
$("download-format").addEventListener("change", updateDownloadNote);
updateDownloadNote();
function setPlaybackRoute(value) {
  state.playbackRoute = lanAccess && value === "nas" ? "nas" : "direct";
  persist();
  if (state.current) {
    const autoPlay = !audio.paused || !!audio.error;
    startTrack(state.current.track, { autoPlay, seek: audio.currentTime, keepCurrent: Boolean(state.current.stream) });
  }
}

function setQuality(value) {
  state.quality = value;
  $("quality").value = value;
  persist();
  if (state.current?.stream) startTrack(state.current.track, { autoPlay: !audio.paused, seek: audio.currentTime, keepCurrent: true });
  else if (state.playRequest && state.current) startTrack(state.current.track);
  if (state.mode === "song" && getView().song) lookup(getView().song.id, "song");
}

const settingsActions = {
  downloadFormat: (value) => { state.downloadFormat = value; persist(); },
  playbackRoute: setPlaybackRoute,
  quality: setQuality,
  order: (value) => { state.order = value; persist(); syncPlayer(); },
  sleepMode: setSleepMode,
  radioMode: setRadioMode,
  discovery: (value) => { state.discovery = value; persist(); },
  translation: (value) => { state.translated = value === "on"; persist(); renderLyrics(); },
};
$("result-content").addEventListener("change", (event) => {
  const update = settingsActions[event.target.dataset.setting];
  if (!update) return;
  update(event.target.value);
  toast("设置已保存");
});

$("collection-form").addEventListener("submit", saveCollection);
$("import-library").addEventListener("change", importLibrary);
$("track-filter").addEventListener("input", (event) => { state.trackFilter = event.target.value; renderResults(); });
$("collection-target").addEventListener("change", (event) => {
  const existing = Boolean(event.target.value);
  $("collection-name-label").hidden = existing;
  $("collection-name").required = !existing;
});

$("quality").innerHTML = Object.entries(qualities).map(([value, label]) => '<option value="' + value + '">' + esc(label) + "</option>").join("");
$("quality").value = state.quality;
$("quality").addEventListener("change", () => setQuality($("quality").value));
const savedVolume = Number(saved.volume);
audio.volume = Number.isFinite(savedVolume) ? Math.min(1, Math.max(0, savedVolume)) : 0.75;
$("volume").value = audio.volume;
$("volume").addEventListener("input", () => { audio.volume = Number($("volume").value); audio.muted = false; });
$("seek").addEventListener("input", () => { audio.currentTime = Number($("seek").value); });

audio.addEventListener("volumechange", () => { $("volume").value = audio.volume; persist(); syncPlayer(); });
audio.addEventListener("playing", () => {
  if (checkSleepDeadline()) return;
  state.sleepStopped = false;
  const current = state.current;
  if (current) {
    if (!current.tracked && current.navigation) {
      const { track, recommendation, queueCursor } = current;
      state.trail = [...state.trail.slice(0, state.trailIndex + 1), { track, recommendation, queueCursor }].slice(-80);
      state.trailIndex = state.trail.length - 1;
    }
    current.tracked = true;
    recordPlay(current.track);
  }
  setNowStatus("正在播放" + qualitySuffix(), "ok");
  syncPlayer();
});
audio.addEventListener("pause", () => {
  if (audio.getAttribute("src")) {
    setNowStatus((state.sleepStopped ? "定时停止已暂停播放" : "已暂停") + qualitySuffix(), "ok");
    saveProgress(true);
  }
  syncPlayer();
});
audio.addEventListener("error", () => {
  if (audio.getAttribute("src")) {
    if (state.current?.route === "direct") mediaCache.delete(state.current.track.id + ":" + state.current.requested);
    setNowStatus(playbackError(), "error");
  }
  syncPlayer();
});
audio.addEventListener("waiting", () => { if (!audio.paused && audio.getAttribute("src")) setNowStatus("正在缓冲…", "loading"); });
audio.addEventListener("ended", () => {
  saveProgress(true);
  if (state.sleepMode === "end") { learnFromPlayback(true); stopForSleep(); }
  else if (!checkSleepDeadline()) nextTrack(true);
});
audio.addEventListener("timeupdate", () => {
  if (checkSleepDeadline()) return;
  saveProgress();
  const current = state.current;
  if (state.radioMode !== "off" && current?.tracked && !current.prefetched && audio.currentTime >= 12) {
    current.prefetched = true;
    if (state.order !== "repeat-one" && shouldRecommend(queueNext())) {
      const [seed] = radioSeeds();
      if (seed) prefetchSimilar(seed);
    }
  }
});
window.addEventListener("pagehide", () => saveProgress(true));
document.addEventListener("visibilitychange", checkSleepDeadline);
for (const name of ["loadedmetadata", "timeupdate", "emptied", "durationchange"]) audio.addEventListener(name, syncTimeline);

document.addEventListener("keydown", (event) => {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || document.querySelector("dialog[open]")) return;
  if (event.target.closest?.("input,select,textarea,[contenteditable]")) return;
  if (event.key === "/") { event.preventDefault(); displayMode("search"); $("query").focus(); }
  if (event.code === "Space" && !event.target.closest?.("button,a") && (state.current || state.queue.length)) {
    event.preventDefault();
    togglePlay();
  }
});

if ("mediaSession" in navigator) {
  for (const [action, handler] of Object.entries({
    play: () => togglePlay(), pause: () => audio.pause(), previoustrack: () => actions.previous(),
    nexttrack: () => nextTrack(), seekto: (details) => {
      if (Number.isFinite(details.seekTime) && Number.isFinite(audio.duration)) audio.currentTime = Math.min(details.seekTime, audio.duration);
    },
  })) {
    try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* This browser does not implement the action. */ }
  }
}

openLocation();
renderQueue();
syncPlayer();
checkService();
