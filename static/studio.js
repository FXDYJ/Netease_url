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
  search: ["搜索", "想听什么？", "找歌曲、歌手、专辑或歌单，也可以粘贴网易云音乐链接。", "搜索歌曲或粘贴链接", "搜索"],
  discover: ["发现", "今天听点什么？", "看看网易云榜单，或按曲风和场景挑张歌单。"],
  artist: ["歌手", "歌手作品", "从热门歌曲听起，再翻翻专辑。"],
  radio: ["心动电台", "顺着喜欢的歌听", "从正在听的歌出发，把熟悉的旋律和新发现混在一起。"],
  song: ["单曲解析", "解析单曲", "查看音源、实际音质和双语歌词。", "输入歌曲 ID 或网易云音乐链接", "解析"],
  playlist: ["歌单解析", "打开歌单", "查看曲目、逐首试听，或一次加入播放队列。", "输入歌单 ID 或链接", "解析"],
  album: ["专辑解析", "打开专辑", "按曲目顺序浏览专辑，保存想听的歌。", "输入专辑 ID 或链接", "解析"],
  download: ["音乐下载", "下载音乐", "选择音质和保存方式，再输入歌曲 ID 或链接。", "输入歌曲 ID 或网易云音乐链接", "下载"],
  favorites: ["收藏", "我的收藏", "收藏保存在当前浏览器。"],
  library: ["音乐库", "我的音乐库", "整理自己的歌单，也可以收藏喜欢的歌手、专辑和公开歌单。"],
  history: ["最近播放", "最近播放", "在当前浏览器里接着听。"],
  stats: ["听歌统计", "听歌统计", "看看最近听了多久，哪些歌反复出现在你的播放里。"],
  settings: ["设置", "偏好设置", "修改后立即生效。局域网地址与外网域名的偏好分别保存。"],
};
const searchTypes = { song: "歌曲", artist: "歌手", album: "专辑", playlist: "歌单", lyric: "歌词" };
const categories = ["charts", "华语", "流行", "民谣", "轻音乐", "摇滚", "电子", "学习", "工作", "睡眠", "运动"];
const initialSearch = { title: "快速试听", note: "从这几首开始，或搜索你想听的歌。", tracks: [] };
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
  const artistId = String(data.artistId || data.ar?.[0]?.id || (Array.isArray(artists) ? artists[0]?.id : "") || "");
  return {
    id,
    name: String(data.name || "歌曲 " + id),
    artists: Array.isArray(artists) ? artists.map((item) => item?.name || item).join(" / ") : String(artists).replace(/\s*\/\s*/g, " / "),
    album: String(data.al_name || data.album?.name || data.al?.name || data.album || ""),
    pic: String(data.pic || data.picUrl || data.al?.picUrl || data.album?.picUrl || ""),
    ...(isId(artistId) ? { artistId } : {}),
  };
}

function tracksFrom(value) {
  return Array.isArray(value) ? value.map(songRecord).filter(Boolean) : [];
}

function bookmarkFrom(item) {
  const kind = item?.kind;
  const id = String(item?.id ?? "");
  if (!["artist", "album", "playlist"].includes(kind) || !isId(id) || typeof item.name !== "string" || !item.name.trim()) return null;
  const pic = mediaURL(item.pic);
  return { kind, id, name: item.name.slice(0, 160), pic: pic && /\.music\.126\.net$/.test(new URL(pic).hostname) ? pic : "" };
}

const saved = restore();
const savedProgress = songRecord(saved.resume?.track);
const savedQueue = tracksFrom(saved.queue);
const savedById = new Map(savedQueue.map((track) => [track.id, track]));
const restoredIds = (values) => new Set(Array.isArray(values) ? values.filter((id) => savedById.has(id)) : []);
const savedQueries = (Array.isArray(saved.queryHistory) ? saved.queryHistory : [])
  .map((value) => typeof value === "string" ? { keyword: value, type: "song" } : value)
  .filter((value) => typeof value?.keyword === "string" && value.keyword.length <= 100 && Object.hasOwn(searchTypes, value.type))
  .slice(0, 6);
const state = {
  mode: "search",
  views: { search: { ...initialSearch, tracks: quickTracks } },
  queries: {},
  searchType: "song",
  queryHistory: savedQueries,
  category: "charts",
  batch: false,
  selected: new Set(),
  trackFilter: "",
  trackSort: "original",
  reordering: false,
  rate: playbackRates.includes(saved.rate) ? saved.rate : "1",
  dataSaver: saved.dataSaver === true,
  statsEnabled: saved.statsEnabled !== false,
  statsDays: 7,
  favorites: tracksFrom(saved.favorites),
  history: tracksFrom(saved.history),
  bookmarks: Array.isArray(saved.bookmarks) ? saved.bookmarks.map(bookmarkFrom).filter(Boolean).slice(0, 200) : [],
  queue: savedQueue,
  nextUp: uniqueTracks(Array.isArray(saved.nextUp) ? tracksFrom(saved.nextUp) :
    Array.isArray(saved.priority) ? saved.priority.map((id) => savedById.get(id)).filter(Boolean) : []).slice(0, 50),
  playedEarly: restoredIds(saved.playedEarly),
  shuffled: restoredIds(saved.shuffled),
  queueUndo: null,
  collections: (Array.isArray(saved.collections) ? saved.collections : [])
    .filter((item) => typeof item?.name === "string" && typeof item.id === "string" && /^[a-z0-9-]{1,80}$/.test(item.id))
    .map((item) => ({ id: item.id, name: item.name.slice(0, 48), tracks: tracksFrom(item.tracks) })),
  collectionId: null,
  collectionEdit: null,
  resume: savedProgress && Number.isFinite(saved.resume.time)
    ? { track: savedProgress, time: Math.max(0, saved.resume.time),
      queueCursor: saved.resume.queueCursor === null ? null : savedById.has(saved.resume.queueCursor) ? saved.resume.queueCursor : savedProgress.id,
      inserted: saved.resume.inserted === true,
      reason: typeof saved.resume.reason === "string" ? saved.resume.reason.slice(0, 200) : "" } : null,
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
    const { favorites, history, bookmarks, queue, nextUp, playedEarly, shuffled, collections, resume, radioMode, discovery, hiddenTracks, queryHistory,
      artistTaste, quality, order, translated, playbackRoute, downloadFormat, rate, dataSaver, statsEnabled } = state;
    localStorage.setItem(libraryKey, JSON.stringify({ favorites, history, bookmarks, queue, nextUp, playedEarly: [...playedEarly],
      shuffled: [...shuffled], collections, resume, radioMode, discovery,
      hiddenTracks, queryHistory, artistTaste: [...artistTaste], quality, order, translated, playbackRoute, downloadFormat,
      rate, dataSaver, statsEnabled, volume: audio.volume }));
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
      if (["playlist", "album", "artist"].includes(mode)) throw new Error("请打开短链接，再粘贴完整链接。");
      return { mode: mode === "download" ? "download" : "song", id: url.href };
    }
    const target = url.hash.startsWith("#/") ? new URL(url.hash.slice(1), url.origin) : url;
    const kind = target.pathname.match(/(?:^|\/)(song|playlist|album|artist)(?:\/|$)/)?.[1];
    const id = target.searchParams.get("id") || target.pathname.match(/\/(\d+)\/?$/)?.[1];
    if (!kind || !isId(id || "")) throw new Error("没有在链接中找到有效的音乐 ID。");
    if (mode !== "search" && kind !== (mode === "download" ? "song" : mode)) {
      throw new Error("当前需要" + (searchTypes[mode] || "歌曲") + "链接。");
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
    state.trackSort = "original";
    state.reordering = false;
    resetBatch();
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
  $("query").placeholder = mode === "search" ? "搜索" + searchTypes[state.searchType] + "或粘贴链接" : placeholder || "";
  $("query-label").textContent = title;
  $("submit-search").innerHTML = esc(action) + icon("arrow-right");
  $("suggestions").hidden = mode !== "search";
  $("search-types").hidden = mode !== "search";
  $("limit-label").hidden = mode !== "search" || state.searchType !== "song";
  $("browse-categories").hidden = mode !== "discover";
  $("download-format-label").hidden = mode !== "download";
  $("download-route-note").hidden = mode !== "download";
  for (const link of document.querySelectorAll("nav [data-mode]")) {
    if (link.dataset.mode === mode) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  renderResults();
  if (mode === "discover" && !state.views.discover && state.lookup?.target !== "discover") lookup(state.category, "discover");
}

function openLocation() {
  const [mode, query] = location.hash.slice(1).split("?", 2);
  if (mode === "main") return;
  displayMode(mode || "search", false);
  const id = new URLSearchParams(query).get("id");
  if (["song", "playlist", "album", "artist"].includes(mode) && isId(id || "")) lookup(id, mode);
}

function getView() {
  if (state.mode === "favorites") return { title: "已收藏的歌曲", note: state.favorites.length + " 首", tracks: state.favorites };
  if (state.mode === "history") return { title: "最近播放的歌曲", note: state.history.length + " 首", tracks: state.history };
  if (state.mode === "stats") return { title: "本机播放记录" };
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
    settingRow("dataSaver", "低流量模式", "停用远程封面及推荐预取，歌词在打开播放面板或主动查看时加载。",
      [["off", "关闭"], ["on", "开启"]], state.dataSaver ? "on" : "off"),
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

function bookmarkButton(id) {
  const saved = state.bookmarks.some((item) => item.kind === state.mode && item.id === id);
  return '<button type="button" class="quiet-button bookmark-button" data-action="bookmark-page" aria-pressed="' + saved + '">' +
    icon("heart") + (saved ? "已收藏" : "收藏" + searchTypes[state.mode]) + "</button>";
}

function cover(track, size = 80) {
  const url = state.dataSaver ? "" : mediaURL(track.pic, size);
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

function trackList(tracks, localCollection = false, lyricMatches = {}) {
  const rows = tracks.map((track, index) => {
    const liked = favorite(track);
    const active = state.current?.track.id === track.id;
    const playing = active && !audio.paused;
    const match = lyricMatches[track.id];
    const reorder = localCollection && state.reordering;
    return '<div class="track-grid track-row' + (active ? " is-current" : "") + '" data-row="' + track.id + '">' +
      (state.batch ? '<input class="track-check" type="checkbox" data-select-track="' + track.id + '" aria-label="选择 ' + esc(track.name) + '"' +
        (state.selected.has(track.id) ? " checked" : "") + ">" :
        '<span class="track-number">' + String(index + 1).padStart(2, "0") + "</span>") +
      (match ? '<div class="lyric-result">' + trackMeta(track, "details") +
        '<button type="button" class="lyric-match" data-action="song-lyrics" data-track="' + track.id +
        '" title="查看匹配歌词">' + icon("text") + '<span>' + esc(match) + "</span></button></div>" : trackMeta(track, "details")) +
      '<span class="track-album" title="' + esc(track.album) + '">' + esc(track.album || "—") + '</span><div class="track-actions">' +
      (reorder ? button("collection-up", "up", "上移 " + track.name, track, { disabled: index === 0 }) +
        button("collection-down", "down", "下移 " + track.name, track, { disabled: index === tracks.length - 1 }) :
      button("play", playing ? "pause" : "play", (playing ? "暂停 " : "播放 ") + track.name, track, { extra: "play-row" }) +
      button("enqueue", "list-plus", "加入队列 " + track.name, track) +
      button("favorite", "heart", (liked ? "取消收藏 " : "收藏 ") + track.name, track, { pressed: liked, extra: liked ? "liked" : "" }) +
      (localCollection ? button("collection-remove-track", "close", "从歌单移除 " + track.name, track) :
        button("download", "download", "下载 " + track.name, track, { disabled: isDownloading(track.id) }))) + "</div></div>";
  });
  return '<div class="track-list"><div class="track-grid track-header" aria-hidden="true"><span>' + (state.batch ? "选" : "#") +
    '</span><span>歌曲</span><span>专辑</span><span>操作</span></div>' +
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
      (track.artists ? '<button type="button" class="artist-link" data-action="find-artist" data-track="' + track.id + '">' +
        esc(track.artists) + "</button>" : "") + (track.album ? esc((track.artists ? " · " : "") + track.album) : "") +
      "</p><p>" + esc(qualityText) +
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
      icon("share") + "分享页面</button>" + bookmarkButton(view.collectionId) + "</div></div></article>";
  }
  return "";
}

function renderResults() {
  const view = getView();
  const tracks = orderedTracks(view.tracks);
  const visibleTracks = state.trackFilter.trim() ? tracks.filter((track) => trackMatches(track, state.trackFilter)) : tracks;
  const showFilter = (tracks.length > 1 || tracks.length && state.trackFilter.trim()) && !state.reordering;
  $("track-filter-bar").hidden = !showFilter;
  $("track-sort").value = state.trackSort;
  if ($("track-filter").value !== state.trackFilter) $("track-filter").value = state.trackFilter;
  $("track-filter-count").textContent = showFilter ? "显示 " + visibleTracks.length + " / " + view.tracks.length + " 首" : "";
  const filteredList = view.tracks?.length && !visibleTracks.length
    ? empty("search", "没有匹配的歌曲", "清除筛选，或试试歌名、歌手和专辑里的其他词。") : "";
  renderResume();
  renderCatalogControls();
  $("results-title").textContent = view.title;
  $("results-note").textContent = view.note || "";
  const listTools = tracks.length && !state.batch && !state.reordering;
  $("add-all").hidden = !listTools;
  $("play-all").hidden = !listTools;
  $("shuffle-list").hidden = !listTools || tracks.length < 2;
  $("save-all").hidden = !listTools || Boolean(view.localCollection);
  $("batch-toggle").hidden = !tracks.length || state.reordering;
  $("batch-toggle").textContent = state.batch ? "完成" : "多选";
  $("batch-toggle").setAttribute("aria-pressed", String(state.batch));
  $("batch-tools").hidden = !state.batch || !view.tracks?.length;
  syncBatch();
  $("submit-search").disabled = view.kind === "loading";
  const message = $("result-message");
  message.hidden = !view.message;
  message.textContent = view.message || "";
  message.dataset.kind = view.kind || "info";
  const content = $("result-content");
  content.setAttribute("aria-busy", String(view.kind === "loading"));
  if (state.mode === "settings") {
    content.innerHTML = settingsMarkup();
  } else if (state.mode === "stats") {
    content.innerHTML = statsMarkup();
  } else if (state.mode === "radio") {
    content.innerHTML = radioMarkup();
  } else if (state.mode === "library") {
    content.innerHTML = libraryMarkup(view.localCollection, visibleTracks, filteredList);
  } else if (view.kind === "loading") {
    content.innerHTML = '<div class="skeleton-row" aria-hidden="true"><span></span><span></span></div>'.repeat(3);
  } else if (view.kind === "error") {
    content.innerHTML = empty("info", "请调整输入或重试", "连接状态可以在右上角查看。") +
      (view.retry ? '<button type="button" class="quiet-button source-link" data-action="retry-lookup">重新加载</button>' : "");
  } else if (view.kind === "saved") {
    content.innerHTML = empty("download", view.filename || "文件已处理", view.savedMessage || "下载任务已完成。");
  } else if (view.kind === "direct-link") {
    content.innerHTML = empty("download", "可从源站保存", "如果浏览器打开了播放器，可在播放菜单中选择保存。") +
      '<a class="quiet-button source-link" href="' + esc(view.url) +
      '" target="_blank" rel="noopener noreferrer">' + icon("arrow-up-right") + "打开源站音频</a>";
  } else if (view.artist || view.entries || view.lyricMatches) {
    content.innerHTML = catalogMarkup(view, visibleTracks, filteredList);
  } else if (view.song || view.collection || view.tracks?.length) {
    content.innerHTML = detailCard(view) + (view.tracks?.length ? (filteredList || trackList(visibleTracks)) :
      view.collection ? empty("list", "没有返回曲目", "这张歌单或专辑可能没有公开曲目。") : "");
  } else {
    const words = {
      search: ["没有找到歌曲", "试试更短的关键词，或输入完整歌名。"],
      discover: ["发现列表暂未加载", "选择上方的分类，查看对应榜单和歌单。"],
      artist: ["打开一位歌手", "在搜索中切换到歌手，再选择你想听的名字。"],
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

function renderCatalogControls() {
  if (state.mode === "search") {
    const suggestions = $("suggestions");
    const previous = state.queryHistory;
    const words = previous.length ? previous : state.searchType === "lyric"
      ? [{ keyword: "夜空中最亮的星 能否听清", type: "lyric" }]
      : ["孙燕姿", "房东的猫", "陈奕迅"].map((keyword) => ({ keyword, type: state.searchType }));
    const markup = "<span>" + (previous.length ? "最近搜索" : "试试") + "</span>" +
      words.map(({ keyword, type }) => '<button type="button" data-query="' + esc(keyword) + '" data-query-type="' + type +
        '" title="' + esc(searchTypes[type] + " · " + keyword) + '">' + esc(keyword) + "</button>").join("") +
      (previous.length ? '<button type="button" class="clear-search" data-action="clear-search">清除</button>' : "");
    if (suggestions.innerHTML !== markup) suggestions.innerHTML = markup;
    for (const button of $("search-types").querySelectorAll("button")) {
      button.setAttribute("aria-pressed", String(button.dataset.searchType === state.searchType));
    }
  } else if (state.mode === "discover") {
    for (const button of $("browse-categories").querySelectorAll("button")) {
      button.setAttribute("aria-pressed", String(button.dataset.category === state.category));
    }
  }
}

function catalogMarkup(view, tracks, filteredList) {
  const artist = view.artist;
  const tabs = artist ? '<div class="segments artist-sections" role="group" aria-label="歌手作品">' +
    [["songs", "热门歌曲"], ["albums", "专辑"]].map(([id, label]) =>
      '<button type="button" data-action="artist-section" data-section="' + id + '" aria-pressed="' +
      String(view.section === id) + '">' + label + "</button>").join("") + "</div>" : "";
  const header = artist ? '<article class="detail artist-detail">' + cover(artist, 240) + '<div class="detail-body"><h3>' +
    esc(artist.name) + "</h3>" + (artist.description ? '<details><summary>查看歌手简介</summary><p>' +
      esc(artist.description) + "</p></details>" : "") +
    '<div class="detail-actions"><button type="button" class="quiet-button" data-action="share-page">' + icon("share") +
    "分享页面</button>" + bookmarkButton(view.collectionId) + "</div></div></article>" : "";
  const links = (view.entries || []).filter((entry) => isId(String(entry.id))).map((entry) => {
    const type = view.entryType;
    const count = Number(entry.count);
    const date = Number(entry.date) > 0 ? new Date(Number(entry.date)).getFullYear() : "";
    const meta = [entry.subtitle, date, entry.update || (count > 0 ? count + " 首" : "")].filter(Boolean).join(" · ");
    return '<a class="catalog-entry" href="#' + type + "?id=" + entry.id + '">' + cover(entry, 240) +
      '<span class="ellipsis"><strong>' + esc(entry.name || searchTypes[type]) + "</strong><small>" +
      esc(meta || searchTypes[type]) + "</small></span></a>";
  });
  const body = view.tracks?.length ? filteredList || trackList(tracks, false, view.lyricMatches) : links.length
    ? '<div class="catalog-grid">' + links.join("") + "</div>"
    : !view.raw && state.mode === "search" ? empty("search", "等待搜索", "在上方输入想找的" + searchTypes[state.searchType] + "。")
      : empty("search", "没有返回作品", "可以试试其他分类或更短的关键词。");
  const page = view.page || 0;
  const pagination = view.more || page > 0 ? '<div class="catalog-pages" aria-label="结果分页">' +
    '<button type="button" class="quiet-button" data-action="catalog-page" data-page="' + (page - 1) + '"' + (!page ? " disabled" : "") +
    '>上一页</button><span>第 ' + (page + 1) + ' 页</span><button type="button" class="quiet-button" data-action="catalog-page" data-page="' +
    (page + 1) + '"' + (!view.more ? " disabled" : "") + ">下一页</button></div>" : "";
  return header + tabs + body + pagination;
}

function resetBatch() {
  state.batch = false;
  state.selected.clear();
}

function selectedTracks() {
  return orderedTracks(getView().tracks).filter((track) => state.selected.has(track.id));
}

function syncBatch() {
  $("batch-count").textContent = "已选 " + state.selected.size + " 首";
  for (const action of ["batch-queue", "batch-next", "batch-save", "batch-library"]) {
    $("batch-tools").querySelector('[data-action="' + action + '"]').disabled = !state.selected.size;
  }
  $("batch-library").textContent = getView().localCollection ? "移出歌单" : state.mode === "favorites" ? "取消收藏" : "收藏";
}

function batchLibrary() {
  const tracks = selectedTracks();
  const collection = getView().localCollection;
  if (collection) collection.tracks = collection.tracks.filter((track) => !state.selected.has(track.id));
  else if (state.mode === "favorites") state.favorites = state.favorites.filter((track) => !state.selected.has(track.id));
  else state.favorites = uniqueTracks([...tracks, ...state.favorites]);
  const count = tracks.length;
  state.selected.clear();
  persist();
  renderResults();
  syncPlayer();
  $("batch-toggle").focus();
  toast("已处理 " + count + " 首歌曲");
}

function renderResume() {
  const card = $("resume-card");
  card.hidden = state.mode !== "search" || !state.resume || Boolean(state.current);
  if (card.hidden) return;
  const { track, time } = state.resume;
  const queued = state.queue.length || state.nextUp.length;
  card.querySelector(".resume-meta").innerHTML = cover(track) + '<span class="ellipsis"><strong>' + esc(track.name) +
    "</strong><small>" + esc([track.artists, timeText(time), queued ? "续接上次队列" : ""].filter(Boolean).join(" · ")) + "</small></span>";
}

function libraryMarkup(collection, visibleTracks, filteredList) {
  if (collection) {
    return '<div class="collection-tools"><button type="button" class="quiet-button" data-action="library-back">所有歌单</button>' +
      '<button type="button" class="quiet-button" data-action="rename-collection">重命名</button>' +
      (collection.tracks.length > 1 ? '<button type="button" class="quiet-button" data-action="collection-reorder" aria-pressed="' + state.reordering +
        '">' + (state.reordering ? "完成排序" : "手动排序") + '</button>' : '') +
      (collection.tracks.length ? '<button type="button" class="quiet-button" data-action="export-track-list">导出歌曲链接</button>' : '') +
      '<button type="button" class="quiet-button" data-action="delete-collection">删除歌单</button></div>' +
      (collection.tracks.length ? (filteredList || trackList(visibleTracks, true)) :
        empty("list", "歌单还是空的", "在搜索、歌曲详情或播放队列里，可以把歌曲保存到这里。"));
  }
  const bookmarks = state.bookmarks.length ? '<section class="bookmarks"><h3>已收藏的作品</h3>' + state.bookmarks.map((item) =>
    '<div class="bookmark-row"><a class="collection-link" href="#' + item.kind + '?id=' + item.id + '">' + cover(item) +
    '<span class="ellipsis"><strong>' + esc(item.name) + "</strong><small>" + searchTypes[item.kind] +
    '</small></span></a><button type="button" class="icon-button" data-action="remove-bookmark" data-kind="' + item.kind +
    '" data-id="' + item.id + '" aria-label="取消收藏 ' + esc(item.name) + '">' + icon("close") + "</button></div>").join("") + "</section>" : "";
  return '<div class="collection-tools"><button type="button" class="quiet-button" data-action="new-collection">' +
    icon("folder") + '新建歌单</button><button type="button" class="quiet-button" data-action="open-track-import">导入歌曲清单</button></div>' + (state.collections.length
      ? '<div class="collection-list">' + state.collections.map((item) =>
        '<button type="button" class="collection-link" data-action="open-collection" data-collection="' + item.id + '">' +
        cover(item.tracks[0] || {}) + '<span class="ellipsis"><strong>' + esc(item.name) + "</strong><small>" +
        item.tracks.length + " 首</small></span>" + icon("chevron-right") + "</button>").join("") + "</div>"
      : empty("folder", "还没有自己的歌单", "新建一张空歌单，或把已有歌单和搜索结果保存下来。")) + bookmarks;
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

async function lookup(raw, mode = state.mode, { page = 0, section = "songs" } = {}) {
  raw = raw.trim();
  if (!raw) { $("query").focus(); return; }
  let input;
  try { input = mode === "discover" ? { mode } : readInput(raw, mode); }
  catch (error) {
    state.views[mode] = { title: "输入有误", kind: "error", message: error.message };
    renderResults();
    return;
  }
  const target = input.mode;
  state.trackFilter = "";
  state.trackSort = "original";
  state.reordering = false;
  resetBatch();
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
  const metadataOptions = { signal, timeout: 12000 };
  const searchType = state.searchType;
  try {
    let result;
    if (target === "search" && searchType === "song") {
      const data = await request("/search", { keyword: input.keyword, limit: $("search-limit").value }, { signal });
      const tracks = tracksFrom(data);
      result = { title: "搜索结果", note: "“" + input.keyword + "” · " + tracks.length + " 首", tracks };
    } else if (target === "search" && searchType === "lyric") {
      const data = await request("/api/catalog", { kind: "lyric", q: input.keyword, page }, metadataOptions);
      result = { title: "歌词搜索结果", note: "“" + input.keyword + "” · 点击匹配片段查看完整歌词",
        tracks: tracksFrom(data.tracks), lyricMatches: data.matches || {}, more: page < 9 && data.more };
    } else if (target === "search") {
      const data = await request("/api/catalog", { kind: searchType, q: input.keyword, page }, metadataOptions);
      result = { title: searchTypes[searchType] + "搜索结果", note: "“" + input.keyword + "”",
        entries: data.entries, entryType: searchType, more: page < 9 && data.more };
    } else if (target === "discover") {
      const data = await request("/api/discover", { category: raw, page }, metadataOptions);
      result = { title: raw === "charts" ? "网易云排行榜" : raw + "歌单", note: raw === "charts" ? "选择榜单，查看曲目" : "按源站热度排列",
        entries: data.entries, entryType: "playlist", more: page < 9 && data.more };
    } else if (target === "artist") {
      const data = await request("/api/artist", { id: input.id, section, page }, metadataOptions);
      result = { title: "歌手作品", artist: data.artist, collectionId: input.id, tracks: tracksFrom(data.tracks),
        entries: data.entries, entryType: "album", section, more: page < 9 && data.more };
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
    if (!signal.aborted) {
      state.views[target] = { ...result, raw, page, section };
      if (target === "search" && input.keyword.length <= 100) {
        state.queryHistory = [{ keyword: input.keyword, type: searchType }, ...state.queryHistory.filter((item) =>
          item.keyword !== input.keyword)].slice(0, 6);
        persist();
      }
    }
  } catch (error) {
    if (!signal.aborted) state.views[target] = { title: "请求失败", kind: "error", message: error.message,
      retry: target !== "download" ? () => lookup(raw, mode, { page, section }) : null };
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
  return [view.song, ...(view.tracks || []), state.current?.track, state.radioAnchor, ...state.nextUp, ...state.queue, ...state.favorites,
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
  if (count) state.queueUndo = null;
  persist();
  renderQueue();
  syncPlayer();
  if (feedback) toast(count ? "已加入 " + count + " 首歌曲" : "所选歌曲已在队列中");
}

function playNext(track) {
  if (track) scheduleNext([track]);
}

function scheduleNext(tracks) {
  const selection = uniqueTracks(tracks).filter((track) => track.id !== state.current?.track.id);
  if (!selection.length) { toast("请选择当前曲目之外的歌曲。"); return; }
  const ids = new Set(selection.map((track) => track.id));
  const next = [...selection, ...state.nextUp.filter((item) => !ids.has(item.id))];
  if (next.length > 50) {
    toast("优先播放已排满，请先整理队列。");
    return;
  }
  state.nextUp = next;
  state.queueUndo = null;
  const advancing = Boolean(state.advance);
  if (state.advance) {
    state.advance.abort();
    state.advance = null;
    state.radioStatus = "";
  }
  persist();
  renderQueue();
  if ($("queue-dialog").open) {
    $("queue-rows").querySelector('[data-action="play-queued-next"][data-track="' + selection[0].id + '"]')?.focus();
  }
  syncPlayer();
  toast(selection.length === 1 ? "下一首播放「" + selection[0].name + "」" : "已安排 " + selection.length + " 首优先播放");
  if (advancing) nextTrack();
}

function queueSection(title, list, type) {
  return '<section class="queue-section" data-list="' + type + '"><h3>' + title + '<small>' + list.length + ' 首</small></h3>' +
    list.map((track, index) => '<div data-queue-track="' + track.id + '" class="queue-row' + (state.current?.track.id === track.id ? " is-current" : "") + '">' +
      trackMeta(track, type === "next" ? "play-queued-next" : "play") + '<div>' +
      (type === "next" ? '<small class="queue-priority">' + (index === 0 ? "接下来" : "优先") + '</small>' :
        state.nextUp.some((item) => item.id === track.id) ? '<small class="queue-priority">已安排</small>' :
        button("play-next", "list-plus", "下一首播放 " + track.name, track, { disabled: state.current?.track.id === track.id })) +
      button("queue-up", "up", "上移 " + track.name, track, { disabled: index === 0 }) +
      button("queue-down", "down", "下移 " + track.name, track, { disabled: index === list.length - 1 }) +
      button("queue-remove", "close", "移出队列 " + track.name, track) + "</div></div>").join("") + "</section>";
}

function playList(tracks, first = tracks[0]) {
  if (!first) return;
  state.queue = uniqueTracks(tracks);
  state.queueUndo = null;
  state.playedEarly.clear();
  state.shuffled.clear();
  state.trail = state.trail.slice(0, state.trailIndex + 1);
  startTrack(first);
}

function renderQueue() {
  const count = uniqueTracks([...state.nextUp, ...state.queue]).length;
  $("queue-count").hidden = !count;
  $("queue-count").textContent = count;
  $("queue-title-count").textContent = count ? "· " + count + " 首" : "";
  $("clear-queue").disabled = !count;
  $("save-queue").disabled = !count;
  $("restore-queue").hidden = !state.queueUndo;
  renderResume();
  renderSleep();
  if (!$("queue-dialog").open) return;
  const reason = state.current?.recommendation;
  const current = state.current?.track;
  $("queue-radio").innerHTML = (state.radioMode !== "off" || current)
    ? '<div class="queue-radio-note">' + icon("radio") + '<div><strong>' +
      esc(reason ? reason.reason : current ? "当前曲目 · " + current.name : "心动电台 · " + radioModes[state.radioMode]) + "</strong><p>" +
      esc(state.radioStatus || (state.nextUp.length ? "优先曲目播完后，接回主队列。" : "手动安排的下一首先播放。")) + "</p></div>" +
      (current ? button("now-like", "heart", favorite(current) ? "取消收藏当前歌曲" : "收藏当前歌曲", null, { pressed: favorite(current) }) : "") +
      (reason ? button("hide-recommendation", "ban", "不再推荐当前歌曲") : "") + "</div>" : "";
  $("queue-rows").innerHTML = count ?
    (state.nextUp.length ? queueSection("优先播放", state.nextUp, "next") : "") +
    (state.queue.length ? queueSection("主队列", state.queue, "main") : "") :
    empty("list", "播放队列为空", "点击歌曲旁的加入队列按钮，或加入整张歌单。");
  $("queue-filter-label").hidden = !count;
  filterQueueRows();
}

function filterQueueRows() {
  const query = $("queue-filter").value.trim();
  const tracks = new Map([...state.queue, ...state.nextUp].map((track) => [track.id, track]));
  const rows = [...$("queue-rows").querySelectorAll("[data-queue-track]")];
  for (const row of rows) row.hidden = Boolean(query && !trackMatches(tracks.get(row.dataset.queueTrack), query));
  for (const section of $("queue-rows").querySelectorAll(".queue-section")) {
    section.hidden = !section.querySelector("[data-queue-track]:not([hidden])");
  }
  $("queue-filter-empty").hidden = !query || !rows.length || rows.some((row) => !row.hidden);
}

function changeQueue(track, control) {
  const action = control.dataset.action;
  const section = control.closest(".queue-section")?.dataset.list;
  const list = section === "next" ? state.nextUp : state.queue;
  const index = list.findIndex((item) => item.id === track.id);
  if (index < 0) return;
  if (action === "queue-remove") {
    list.splice(index, 1);
    if (section === "main") {
      state.playedEarly.delete(track.id);
      state.shuffled.delete(track.id);
      if (state.current?.queueCursor === track.id) state.current.queueCursor = list[index - 1]?.id || null;
      if (state.resume?.queueCursor === track.id) state.resume.queueCursor = list[index - 1]?.id || null;
    }
  } else {
    const destination = index + (action === "queue-up" ? -1 : 1);
    if (destination < 0 || destination >= list.length) return;
    [list[index], list[destination]] = [list[destination], list[index]];
  }
  state.queueUndo = null;
  persist();
  renderQueue();
  syncPlayer();
  const controls = [...$("queue-rows").querySelectorAll('[data-list="' + section + '"] .queue-row:not([hidden]) button')];
  const preferred = controls.find((control) => control.dataset.track === track.id && control.dataset.action === action && !control.disabled);
  const fallback = controls.find((control) => control.dataset.track === track.id && control.classList.contains("track-meta"));
  (preferred || fallback || controls[0] || (!$("queue-filter-label").hidden ? $("queue-filter") :
    $("queue-dialog").querySelector('[data-action="close"]'))).focus();
}

function toggleFavorite(track) {
  if (!track) return;
  const liked = favorite(track);
  if (liked && state.mode === "favorites") state.selected.delete(track.id);
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
    if (!play) continue;
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
  state.resume = { track: current.track, time: audio.ended ? 0 : audio.currentTime,
    queueCursor: current.queueCursor, inserted: current.inserted, reason: current.recommendation?.reason || "" };
  persist();
}

function setNowStatus(text, kind = "") {
  $("play-status").textContent = text;
  $("expanded-status").textContent = text;
  if ($("immersive-dialog").open) $("immersive-status").textContent = text;
  $("play-status-dot").dataset.state = kind;
}

function applyCover(image, track, size, placeholder) {
  const url = state.dataSaver ? "" : mediaURL(track.pic, size);
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
  $("expanded-name").textContent = track.name;
  $("expanded-artist").textContent = $("mini-artist").textContent;
  $("radio-reason").hidden = !recommendation;
  $("radio-reason").textContent = recommendation?.reason || "";
  applyCover($("now-image"), track, 520, $("now-cover"));
  applyCover($("mini-image"), track, 100);
  applyCover($("expanded-image"), track, 100);
  renderImmersiveInfo();
  if ("mediaSession" in navigator && typeof MediaMetadata !== "undefined") {
    const art = state.dataSaver ? "" : mediaURL(track.pic, 300);
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

async function loadCurrentLyrics() {
  const current = state.current;
  if (!current || current.lyricsReady || current.lyricRequest) return;
  const controller = new AbortController();
  current.lyricRequest = controller;
  current.lyricError = false;
  renderLyrics();
  try {
    const data = await loadTrackLyrics(current.track.id, state.quality, controller.signal);
    if (state.current !== current || controller.signal.aborted) return;
    current.lyricsReady = true;
    setLyrics(data.lyric, data.translation);
  } catch {
    if (!controller.signal.aborted) current.lyricError = true;
  } finally {
    current.lyricRequest = null;
    if (state.current === current) renderLyrics();
  }
}

function lyricsPlaceholder() {
  if (!state.current || state.current.lyricsReady) return "";
  if (state.current.lyricRequest) return "正在读取歌词…";
  if (state.current.lyricError) return "歌词暂时无法加载。";
  return state.dataSaver ? "低流量模式下可按需加载歌词。" : "";
}

async function startTrack(track, { autoPlay = true, seek = 0, keepCurrent = false, recommendation = null,
  queueCursor = track.id, navigation = true, advance = null, automatic = false, inserted = false } = {}) {
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
    saveProgress(true);
    state.current?.lyricRequest?.abort();
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    state.current = { track, requested: quality, recommendation, queueCursor, navigation, inserted };
    clearPracticeLoop();
    setLyrics("", "");
    displayCurrent(track, recommendation);
    renderResume();
    if (!state.dataSaver || $("immersive-dialog").open ||
        ($("lyrics-dialog").open && $("lyrics-dialog").dataset.follow === "true")) loadCurrentLyrics();
  }
  if (!recommendation && navigation && !keepCurrent && !automatic && !inserted) enqueue([track], false);
  if (!keepCurrent) {
    state.nextUp = state.nextUp.filter((item) => item.id !== track.id);
    if (state.queue.some((item) => item.id === track.id)) {
      if (inserted) state.playedEarly.add(track.id);
      if (state.order === "shuffle") state.shuffled.add(track.id);
    }
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
    Object.assign(state.current, { requested: quality, level: data.level, stream, route });
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

function togglePlay(track = state.current?.track) {
  if (!track && state.nextUp.length) { nextTrack(); return; }
  track ||= state.queue[0];
  if (!track) return;
  if (state.current?.track.id !== track.id || !audio.getAttribute("src") || audio.error) {
    if (!state.playRequest || state.current?.track.id !== track.id) {
      const current = state.current?.track.id === track.id ? state.current : null;
      startTrack(track, current ? { recommendation: current.recommendation, queueCursor: current.queueCursor,
        inserted: current.inserted, automatic: current.inserted } : {});
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
  if (state.dataSaver) return;
  loadSimilar(seed).catch(() => { /* A failed prefetch can be retried when switching tracks. */ });
}

function queueStep() {
  const cursor = state.queue.findIndex((track) => track.id === state.current?.queueCursor);
  if (state.order === "shuffle" && state.queue.length > 1) {
    const fresh = state.queue.filter((track) => !state.shuffled.has(track.id) && track.id !== state.current?.track.id);
    const choices = fresh.length ? fresh : state.queue.filter((track) => track.id !== state.current?.track.id);
    return { track: choices[Math.floor(Math.random() * choices.length)], resetShuffle: !fresh.length };
  }
  const track = state.queue.find((item, index) => index > cursor && !state.playedEarly.has(item.id));
  return track ? { track } : { track: state.order === "repeat-all" ? state.queue[0] : undefined, wrap: true };
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
    const { track, recommendation, queueCursor, inserted } = state.trail[--state.trailIndex];
    startTrack(track, { recommendation, queueCursor, inserted, navigation: false });
    return;
  }
  const previous = previousQueueTrack();
  if (previous) startTrack(previous, { automatic: true });
}

function previousQueueTrack() {
  const cursor = state.queue.findIndex((track) => track.id === state.current?.queueCursor);
  if (cursor >= 0 && state.current.track.id !== state.current.queueCursor) return state.queue[cursor];
  return state.queue[cursor > 0 ? cursor - 1 : state.order === "repeat-all" ? state.queue.length - 1 : -1];
}

function playQueuedNext(track) {
  if (!track) return;
  state.radioStreak++;
  startTrack(track, { inserted: true, automatic: true, queueCursor: state.current?.queueCursor ?? null });
}

async function nextTrack(ended = false, forceRadio = false) {
  if (state.advance) return;
  learnFromPlayback(ended);
  if (!forceRadio && ended && state.order === "repeat-one" && audio.getAttribute("src")) {
    audio.currentTime = 0;
    playAudio();
    return;
  }
  const priority = state.nextUp[0];
  if (priority) {
    playQueuedNext(priority);
    return;
  }
  const step = queueStep();
  const next = step.track;
  if (!forceRadio && state.trailIndex + 1 < state.trail.length) {
    const { track, recommendation, queueCursor, inserted } = state.trail[++state.trailIndex];
    startTrack(track, { recommendation, queueCursor, inserted, navigation: false });
    return;
  }
  if (forceRadio || shouldRecommend(next)) {
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
    if (step.wrap) state.playedEarly.clear();
    if (step.resetShuffle) state.shuffled.clear();
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
  $("previous").disabled = audio.currentTime < 3 && state.trailIndex < 1 && !previousQueueTrack();
  $("expanded-previous").disabled = $("previous").disabled;
  $("immersive-previous").disabled = $("previous").disabled;
}

function syncPlayer() {
  const track = state.current?.track;
  const toggle = $("play-toggle");
  toggle.disabled = (!track && !state.queue.length && !state.nextUp.length) || (!!state.playRequest && !audio.getAttribute("src"));
  const playing = !audio.paused;
  setIcon(toggle, playing ? "pause" : "play");
  labelButton(toggle, playing ? "暂停" : "播放");
  const expandedToggle = $("expanded-toggle");
  expandedToggle.disabled = toggle.disabled;
  setIcon(expandedToggle, playing ? "pause" : "play");
  labelButton(expandedToggle, playing ? "暂停" : "播放");
  syncPrevious();
  $("next").disabled = Boolean(state.advance) || (!state.nextUp.length && !queueStep().track &&
    state.trailIndex + 1 >= state.trail.length && !((track || state.queue.length) && state.radioMode !== "off"));
  $("expanded-next").disabled = $("next").disabled;
  for (const id of ["now-panel", "expanded-player"]) {
    $(id).querySelector('[data-action="seed-radio"]').disabled = !track;
    $(id).querySelector('[data-action="save-track"]').disabled = !track;
    $(id).querySelector('[data-action="find-artist"]').disabled = !track?.artists;
  }
  $("now-panel").querySelector('[data-action="hide-recommendation"]').hidden = !state.current?.recommendation;
  const nowLike = $("now-like");
  nowLike.disabled = !track;
  const liked = track ? favorite(track) : false;
  nowLike.classList.toggle("liked", liked);
  nowLike.setAttribute("aria-pressed", String(liked));
  labelButton(nowLike, liked ? "取消收藏当前歌曲" : "收藏当前歌曲");
  const expandedLike = $("expanded-like");
  expandedLike.disabled = !track;
  expandedLike.classList.toggle("liked", liked);
  expandedLike.setAttribute("aria-pressed", String(liked));
  labelButton(expandedLike, liked ? "取消收藏当前歌曲" : "收藏当前歌曲");
  const [, label, glyph] = orders.find(([id]) => id === state.order);
  labelButton($("play-mode"), "播放顺序：" + label);
  setIcon($("play-mode"), glyph);
  $("play-mode").classList.toggle("accent", state.order !== "sequence");
  const muted = audio.muted || audio.volume === 0;
  setIcon($("mute"), muted ? "muted" : "volume");
  labelButton($("mute"), muted ? "取消静音" : "静音");
  updateImmersiveControls();
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

function lyricMarkup(lines, raw, seekable = true, startIndex = 0) {
  if (!lines.length) {
    const text = raw.replace(/^\[[a-z]+:[^\]]*\]\s*/gim, "").trim();
    return text ? '<div class="empty-lyrics">' + text.split(/\r?\n/).map((line) => '<p class="plain-lyric-line">' + esc(line) + '</p>').join("") + '</div>' :
      '<p class="empty-lyrics">暂无歌词。</p>';
  }
  return lines.map((line, index) => {
    const body = esc(line.text) + (state.translated && line.translation ? "<small>" + esc(line.translation) + "</small>" : "");
    return seekable ? '<button type="button" class="lyric-line" data-action="seek-line" data-index="' + (startIndex + index) +
      '" data-time="' + line.time + '">' + body + "</button>" : '<p class="lyric-line">' + body + "</p>";
  }).join("");
}

function renderLyrics() {
  state.lyricIndex = -1;
  const placeholder = lyricsPlaceholder();
  $("lyrics").innerHTML = placeholder ? '<p class="empty-lyrics">' + esc(placeholder) + '</p>' +
    (!state.current?.lyricRequest ? '<button type="button" class="quiet-button" data-action="load-current-lyrics">加载歌词</button>' : '') :
    lyricMarkup(state.lyrics, state.lrc);
  if ($("lyrics-dialog").open && $("lyrics-dialog").dataset.follow === "true") renderLyricsDialog();
  renderImmersiveLyrics();
  $("translate-toggle").disabled = !state.lyrics.some((line) => line.translation);
  $("translate-toggle").setAttribute("aria-pressed", String(state.translated));
  $("lyrics-export").disabled = !state.lrc;
  highlightLyrics();
}

function highlightLyrics() {
  if (!state.lyrics.length) return;
  let first = 0;
  let end = state.lyrics.length;
  const lyricTime = audio.currentTime + 0.05 - lyricDelaySeconds();
  while (first < end) {
    const middle = (first + end) >> 1;
    if (state.lyrics[middle].time <= lyricTime) first = middle + 1;
    else end = middle;
  }
  const index = first - 1;
  if (index === state.lyricIndex) return;
  state.lyricIndex = index;
  syncImmersiveLyric();
  const panels = [$("lyrics")];
  if ($("lyrics-dialog").open && $("lyrics-dialog").dataset.follow === "true") panels.push($("mobile-lyrics-content"));
  for (const panel of panels) {
    panel.querySelector(".active")?.classList.remove("active");
    const line = panel.querySelector('[data-index="' + index + '"]');
    if (!line) continue;
    line.classList.add("active");
    if (panel.clientHeight && (panel !== $("mobile-lyrics-content") || !$("lyric-query").value.trim())) {
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
  const immersiveOpen = $("immersive-dialog").open;
  for (const prefix of immersiveOpen ? ["", "expanded-", "immersive-"] : ["", "expanded-"]) {
    const seek = $(prefix + "seek");
    seek.max = duration;
    seek.disabled = duration <= 0;
    seek.value = audio.currentTime || 0;
    $(prefix + "elapsed").textContent = timeText(audio.currentTime);
    $(prefix + "duration").textContent = timeText(duration);
  }
  syncPrevious();
  if (immersiveOpen) updateImmersiveLyricControls();
  if ($("lyrics-dialog").open && $("lyrics-dialog").dataset.follow === "true") renderPractice();
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
  const { favorites, collections, hiddenTracks, bookmarks } = state;
  const file = new Blob([JSON.stringify({ format: backupFormat, version: 1, favorites, collections, hiddenTracks, bookmarks })],
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
    const bookmarks = new Map(state.bookmarks.map((item) => [item.kind + item.id, item]));
    if (Array.isArray(data.bookmarks)) for (const value of data.bookmarks) {
      const item = bookmarkFrom(value);
      if (!item) throw new Error("备份包含无效的作品收藏。");
      if (!bookmarks.has(item.kind + item.id)) bookmarks.set(item.kind + item.id, item);
    }
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
    const before = { favorites: state.favorites, hiddenTracks: state.hiddenTracks, collections: state.collections, bookmarks: state.bookmarks };
    Object.assign(state, { favorites, hiddenTracks, collections, bookmarks: [...bookmarks.values()].slice(0, 200) });
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
  $("lyrics-dialog-title").textContent = follow ? "正在播放" : detail.name;
  $("expanded-player").hidden = !follow;
  const placeholder = follow ? lyricsPlaceholder() : "";
  panel.innerHTML = placeholder ? '<p class="empty-lyrics">' + esc(placeholder) + '</p>' +
    (!state.current?.lyricRequest ? '<button type="button" class="quiet-button" data-action="load-current-lyrics">加载歌词</button>' : '') :
    lyricMarkup(detail.lines, detail.raw, follow);
  $("dialog-translation").hidden = !detail.translation;
  $("dialog-translation").setAttribute("aria-pressed", String(state.translated));
  $("dialog-lrc").hidden = !detail.raw;
  $("dialog-lrc-translation").hidden = !detail.translation;
  $("dialog-play-match").hidden = true;
  if (follow) {
    state.lyricIndex = -1;
    highlightLyrics();
    renderPractice();
  } else if (detail.match) {
    const normalize = (text) => text.normalize("NFKC").toLowerCase().replace(/[\p{P}\p{S}\s]/gu, "");
    const needle = normalize(detail.match);
    const lines = [...panel.querySelectorAll(".lyric-line")];
    const index = needle ? lines.findIndex((line) => {
      const text = normalize(line.firstChild?.textContent || "");
      return text && (text.includes(needle) || needle.includes(text) && text.length >= 4);
    }) : -1;
    if (index >= 0) {
      lines[index].classList.add("active");
      lines[index].scrollIntoView({ block: "center" });
      detail.matchedTime = detail.lines[index]?.time;
      $("dialog-play-match").hidden = !Number.isFinite(detail.matchedTime);
    }
  }
  syncLyricTools(detail, (follow ? "current-" + (state.current?.track.id || "") : "inspect-" + (detail.track?.id || "")));
}

async function showSongLyrics(track) {
  if (!track) return;
  const view = getView();
  const data = view.songData;
  const match = view.lyricMatches?.[track.id] || "";
  $("lyrics-dialog").dataset.follow = "false";
  inspectedLyrics = { raw: "", translation: "", lines: [], name: track.name, track };
  showDialog("lyrics-dialog");
  renderLyricsDialog();
  let raw = data?.lyric;
  let translation = data?.tlyric;
  if (raw === undefined) {
    const context = inspectedLyrics;
    $("mobile-lyrics-content").textContent = "正在读取歌词…";
    try {
      const result = await loadTrackLyrics(track.id, state.quality);
      if (inspectedLyrics !== context || $("lyrics-dialog").dataset.follow === "true") return;
      raw = result.lyric;
      translation = result.translation;
    } catch (error) {
      if (inspectedLyrics === context) $("mobile-lyrics-content").textContent = error.message;
      return;
    }
  }
  inspectedLyrics = { raw: raw || "", translation: translation || "", lines: matchLyrics(raw || "", translation || ""), name: track.name, match, track };
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

function changeSearchType(type) {
  if (!Object.hasOwn(searchTypes, type) || type === state.searchType) return;
  state.searchType = type;
  const query = $("query").value.trim();
  displayMode("search");
  if (query) lookup(query, "search");
  else {
    if (state.lookup?.target === "search") state.lookup.controller.abort();
    state.views.search = type === "song" ? { ...initialSearch, tracks: quickTracks } : {
      title: "搜索" + searchTypes[type], note: "在上方输入关键词。", entries: [], entryType: type,
    };
    renderResults();
  }
}

function findArtist(track = state.current?.track) {
  if (!track?.artists) return;
  if ($("lyrics-dialog").open) $("lyrics-dialog").close();
  if (track.artistId) {
    location.hash = "artist?id=" + track.artistId;
  } else {
    state.searchType = "artist";
    lookup(track.artists.split(" / ")[0], "search");
    $("query").value = state.queries.search;
    $("query").placeholder = "搜索歌手或粘贴链接";
    $("limit-label").hidden = true;
  }
}

function turnCatalogPage(_, control) {
  const view = getView();
  lookup(view.raw, state.mode, { page: Number(control.dataset.page), section: view.section });
  $("results-title").scrollIntoView({ block: "start" });
  $("results-title").focus({ preventScroll: true });
}

function toggleBookmark(_, control) {
  const view = getView();
  const item = bookmarkFrom({ kind: state.mode, id: view.collectionId, name: view.artist?.name || view.collection?.name,
    pic: view.artist?.pic || view.collection?.coverImgUrl });
  if (!item) return;
  const exists = state.bookmarks.some((entry) => entry.kind === item.kind && entry.id === item.id);
  if (exists) state.bookmarks = state.bookmarks.filter((entry) => entry.kind !== item.kind || entry.id !== item.id);
  else if (state.bookmarks.length < 200) state.bookmarks.unshift(item);
  else { toast("作品收藏已满，请先在音乐库整理。"); return; }
  persist();
  control.setAttribute("aria-pressed", String(!exists));
  control.innerHTML = icon("heart") + (exists ? "收藏" + searchTypes[item.kind] : "已收藏");
}

const actions = {
  ...listeningActions,
  ...immersiveActions,
  service: () => { showDialog("service-dialog"); loadServiceInfo(); },
  "open-settings": () => { $("service-dialog").close(); displayMode("settings"); $("main").focus(); },
  "refresh-service": () => { checkService(); loadServiceInfo(true); },
  queue: () => { $("queue-filter").value = ""; showDialog("queue-dialog"); renderQueue(); },
  "expanded-queue": () => { $("lyrics-dialog").close(); actions.queue(); },
  "queue-radio": () => { $("queue-dialog").close(); displayMode("radio"); $("main").focus(); },
  "queue-timer": () => { $("queue-dialog").close(); displayMode("settings"); $("setting-sleepMode").focus(); },
  close: (_, button) => button.closest("dialog")?.close(),
  play: (track, control) => {
    const view = getView();
    if (track && control.closest(".track-row") && (view.collection || view.artist || view.localCollection) &&
        (state.current?.track.id !== track.id || !audio.getAttribute("src"))) playList(orderedTracks(view.tracks), track);
    else togglePlay(track);
  },
  enqueue: (track) => track && enqueue([track]),
  "play-next": playNext,
  "add-all": () => enqueue(orderedTracks(getView().tracks)),
  "play-all": () => playList(orderedTracks(getView().tracks)),
  "shuffle-list": () => {
    const tracks = orderedTracks(getView().tracks);
    if (tracks.length < 2) return;
    state.order = "shuffle";
    playList(tracks, tracks[Math.floor(Math.random() * tracks.length)]);
  },
  "save-all": () => editCollection(orderedTracks(getView().tracks)),
  "batch-toggle": () => { state.batch ? resetBatch() : state.batch = true; renderResults(); },
  "batch-select": () => {
    const inputs = [...$("result-content").querySelectorAll("[data-select-track]")];
    const select = inputs.some((input) => !input.checked);
    for (const input of inputs) {
      input.checked = select;
      if (select) state.selected.add(input.dataset.selectTrack);
      else state.selected.delete(input.dataset.selectTrack);
    }
    syncBatch();
  },
  "batch-queue": () => enqueue(selectedTracks()),
  "batch-next": () => scheduleNext(selectedTracks()),
  "batch-save": () => editCollection(selectedTracks()),
  "batch-library": batchLibrary,
  "export-library": exportLibrary,
  "import-library": () => $("import-library").click(),
  "save-queue": () => editCollection(uniqueTracks([...state.nextUp, ...state.queue])),
  "save-track": (track = state.current?.track) => track && editCollection([track]),
  "new-collection": () => editCollection([], "create"),
  "rename-collection": () => editCollection([], "rename"),
  "delete-collection": () => editCollection([], "delete"),
  "open-collection": (_, control) => {
    state.collectionId = control.dataset.collection;
    state.trackFilter = "";
    state.trackSort = "original";
    state.reordering = false;
    resetBatch();
    renderResults();
    $("main").focus();
  },
  "library-back": () => {
    state.collectionId = null;
    state.trackFilter = "";
    state.trackSort = "original";
    state.reordering = false;
    resetBatch();
    renderResults();
    $("main").focus();
  },
  "collection-reorder": () => {
    state.reordering = !state.reordering;
    state.trackSort = "original";
    state.trackFilter = "";
    resetBatch();
    renderResults();
    $("result-content").querySelector('[data-action="collection-reorder"]')?.focus();
  },
  "collection-up": (track, control) => moveCollectionTrack(track, -1, control.dataset.action),
  "collection-down": (track, control) => moveCollectionTrack(track, 1, control.dataset.action),
  "collection-remove-track": (track) => {
    const collection = getView().localCollection;
    if (!collection || !track) return;
    collection.tracks = collection.tracks.filter((item) => item.id !== track.id);
    state.selected.delete(track.id);
    persist();
    renderResults();
    $("result-content").querySelector('[data-action="collection-remove-track"]')?.focus();
    toast("已从歌单移除");
  },
  resume: () => {
    if (!state.resume) return;
    const { track, time, queueCursor, inserted, reason } = state.resume;
    const recommendation = reason ? { reason } : null;
    startTrack(track, { seek: time, queueCursor, inserted, recommendation, automatic: inserted || Boolean(reason) });
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
  "queue-up": (track, control) => track && changeQueue(track, control),
  "queue-down": (track, control) => track && changeQueue(track, control),
  "queue-remove": (track, control) => track && changeQueue(track, control),
  "play-queued-next": playQueuedNext,
  "clear-queue": () => {
    state.queueUndo = { queue: state.queue, nextUp: state.nextUp, playedEarly: state.playedEarly, shuffled: state.shuffled };
    state.queue = [];
    state.nextUp = [];
    state.playedEarly = new Set();
    state.shuffled = new Set();
    state.trail = state.trail.slice(0, state.trailIndex + 1);
    persist();
    renderQueue();
    syncPlayer();
    $("restore-queue").focus();
  },
  "restore-queue": () => {
    if (!state.queueUndo) return;
    Object.assign(state, state.queueUndo);
    state.queueUndo = null;
    persist();
    renderQueue();
    syncPlayer();
    $("clear-queue").focus();
  },
  details: (track) => track && lookup(track.id, "song"),
  download: (track) => track && downloadTrack(track).catch((error) => toast(error.message)),
  "copy-link": copyLink,
  "share-page": sharePage,
  "copy-share": copyShare,
  "bookmark-page": toggleBookmark,
  "remove-bookmark": (_, control) => {
    state.bookmarks = state.bookmarks.filter((item) => item.kind !== control.dataset.kind || item.id !== control.dataset.id);
    persist();
    renderResults();
    ($("result-content").querySelector('[data-action="remove-bookmark"]') || $("results-title")).focus();
  },
  "find-artist": findArtist,
  "clear-search": () => { state.queryHistory = []; persist(); renderCatalogControls(); $("query").focus(); },
  "catalog-page": turnCatalogPage,
  "artist-section": (_, control) => {
    const view = getView();
    if (view.section !== control.dataset.section) lookup(view.raw, "artist", { section: control.dataset.section });
  },
  "retry-lookup": () => getView().retry?.(),
  translate: () => {
    state.translated = !state.translated;
    persist();
    renderLyrics();
    if ($("lyrics-dialog").open && $("lyrics-dialog").dataset.follow === "false") renderLyricsDialog();
  },
  "lyrics-export": () => exportLyrics(state.lrc, state.current?.track.name || "歌词"),
  "load-current-lyrics": loadCurrentLyrics,
  "mobile-lyrics": () => {
    $("lyrics-dialog").dataset.follow = "true";
    showDialog("lyrics-dialog");
    renderLyricsDialog();
    loadCurrentLyrics();
  },
  "song-lyrics": showSongLyrics,
  "play-lyric-match": () => {
    const { track, matchedTime } = inspectedLyrics || {};
    if (!track || !Number.isFinite(matchedTime)) return;
    $("lyrics-dialog").close();
    const seek = Math.max(0, matchedTime + lyricDelaySeconds(track.id));
    if (state.current?.track.id === track.id && Number.isFinite(audio.duration) && !audio.error) {
      seekPlayback(Math.min(seek, Math.max(0, audio.duration - 1)));
      playAudio();
    } else startTrack(track, { seek });
  },
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
    if (audio.getAttribute("src") && Number.isFinite(audio.duration)) {
      seekPlayback(Math.min(Number(button.dataset.time) + lyricDelaySeconds(), Math.max(0, audio.duration - 0.1)));
    }
  },
};

function moveCollectionTrack(track, step, action) {
  const tracks = getView().localCollection?.tracks;
  if (!track || !tracks) return;
  const index = tracks.findIndex((item) => item.id === track.id);
  const target = index + step;
  if (index < 0 || target < 0 || target >= tracks.length) return;
  [tracks[index], tracks[target]] = [tracks[target], tracks[index]];
  persist();
  renderResults();
  const controls = [...$("result-content").querySelectorAll('[data-row="' + track.id + '"] button')];
  (controls.find((button) => button.dataset.action === action && !button.disabled) ||
    controls.find((button) => !button.disabled && /collection-(?:up|down)/.test(button.dataset.action)))?.focus();
}

document.addEventListener("click", (event) => {
  const more = $("mobile-more");
  if (more.open && !more.contains(event.target)) more.open = false;
  const control = event.target.closest("[data-mode],[data-action],[data-query],[data-search-type],[data-category]");
  if (!control || control.disabled) return;
  if (control.dataset.mode) {
    event.preventDefault();
    displayMode(control.dataset.mode);
    if (more.contains(control)) { more.open = false; $("main").focus(); }
  } else if (control.dataset.searchType) {
    changeSearchType(control.dataset.searchType);
  } else if (control.dataset.category) {
    if (state.category === control.dataset.category && state.views.discover?.entries) return;
    state.category = control.dataset.category;
    lookup(state.category, "discover");
  } else if (control.dataset.query) {
    const { query, queryType } = control.dataset;
    if (Object.hasOwn(searchTypes, queryType) && queryType !== state.searchType) {
      state.searchType = queryType;
      state.queries.search = query;
      displayMode("search");
    }
    $("query").value = query;
    lookup(query, "search");
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
  dataSaver: (value) => {
    state.dataSaver = value === "on";
    const current = state.current;
    if (current) displayCurrent(current.track, current.recommendation);
    if (!state.dataSaver) loadCurrentLyrics();
    else if (!$("lyrics-dialog").open && !$("immersive-dialog").open) current?.lyricRequest?.abort();
    persist();
    renderResults();
    $("setting-dataSaver").focus();
  },
  translation: (value) => { state.translated = value === "on"; persist(); renderLyrics(); },
};
$("result-content").addEventListener("change", (event) => {
  if (event.target.id === "stats-days") {
    state.statsDays = Number(event.target.value);
    renderResults();
    $("stats-days").focus();
    return;
  }
  const selection = event.target.dataset.selectTrack;
  if (selection) {
    if (event.target.checked) state.selected.add(selection);
    else state.selected.delete(selection);
    syncBatch();
    return;
  }
  const update = settingsActions[event.target.dataset.setting];
  if (!update) return;
  update(event.target.value);
  toast("设置已保存");
});

$("collection-form").addEventListener("submit", saveCollection);
$("import-library").addEventListener("change", importLibrary);
$("track-filter").addEventListener("input", (event) => { state.trackFilter = event.target.value; renderResults(); });
$("track-sort").addEventListener("change", (event) => {
  state.trackSort = event.target.value;
  renderResults();
});
$("queue-filter").addEventListener("input", filterQueueRows);
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
$("seek").addEventListener("input", () => seekPlayback(Number($("seek").value)));
$("expanded-seek").addEventListener("input", () => seekPlayback(Number($("expanded-seek").value)));

audio.addEventListener("volumechange", () => { $("volume").value = audio.volume; persist(); syncPlayer(); });
audio.addEventListener("playing", () => {
  if (checkSleepDeadline()) return;
  state.sleepStopped = false;
  const current = state.current;
  if (current) {
    if (!current.tracked && current.navigation) {
      const { track, recommendation, queueCursor, inserted } = current;
      state.trail = [...state.trail.slice(0, state.trailIndex + 1), { track, recommendation, queueCursor, inserted }].slice(-80);
      state.trailIndex = state.trail.length - 1;
    }
    current.tracked = true;
    saveProgress(true);
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
  else if (!checkSleepDeadline() && !enforcePracticeLoop(true)) nextTrack(true);
});
audio.addEventListener("timeupdate", () => {
  if (checkSleepDeadline()) return;
  sampleListening();
  if (enforcePracticeLoop()) return;
  saveProgress();
  const current = state.current;
  if (!state.dataSaver && state.radioMode !== "off" && current?.tracked && !current.prefetched && audio.currentTime >= 12) {
    current.prefetched = true;
    if (state.order !== "repeat-one" && !state.nextUp.length && shouldRecommend(queueStep().track)) {
      const [seed] = radioSeeds();
      if (seed) prefetchSimilar(seed);
    }
  }
});
window.addEventListener("pagehide", () => saveProgress(true));
document.addEventListener("visibilitychange", checkSleepDeadline);
for (const name of ["loadedmetadata", "timeupdate", "emptied", "durationchange"]) audio.addEventListener(name, syncTimeline);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && $("mobile-more").open) {
    $("mobile-more").open = false;
    $("mobile-more").querySelector("summary").focus();
  }
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || document.querySelector("dialog[open]")) return;
  if (event.target.closest?.("input,select,textarea,[contenteditable]")) return;
  if (event.key === "/") { event.preventDefault(); displayMode("search"); $("query").focus(); }
  if (event.code === "Space" && !event.target.closest?.("button,a") && (state.current || state.queue.length || state.nextUp.length)) {
    event.preventDefault();
    togglePlay();
  }
});

if ("mediaSession" in navigator) {
  for (const [action, handler] of Object.entries({
    play: () => togglePlay(), pause: () => audio.pause(), previoustrack: () => actions.previous(),
    nexttrack: () => nextTrack(), seekto: (details) => {
      seekPlayback(details.seekTime);
    },
  })) {
    try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* This browser does not implement the action. */ }
  }
}

$("browse-categories").innerHTML = categories.map((category) =>
  '<button type="button" data-category="' + category + '" aria-pressed="false">' +
  (category === "charts" ? "排行榜" : category) + "</button>").join("");
initListeningTools();
initImmersive();
openLocation();
renderQueue();
syncPlayer();
checkService();
