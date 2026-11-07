"use strict";

const $ = (id) => document.getElementById(id);
const audio = $("audio");
const libraryKey = "echo-room-v1";
const qualities = {
  standard: "标准音质", exhigh: "极高音质", lossless: "无损音质", hires: "Hi-Res",
  jyeffect: "高清环绕声", sky: "沉浸环绕声", jymaster: "超清母带", dolby: "杜比全景声",
};
const screens = {
  search: ["搜索", "想听什么？", "搜一首歌，或粘贴网易云音乐链接。", "歌曲名、歌手或音乐链接", "搜索"],
  song: ["单曲解析", "解析单曲", "查看音源、实际音质和双语歌词。", "输入歌曲 ID 或网易云音乐链接", "解析"],
  playlist: ["歌单解析", "打开歌单", "查看曲目、逐首试听，或一次加入播放队列。", "输入歌单 ID 或链接", "解析"],
  album: ["专辑解析", "打开专辑", "按曲目顺序浏览专辑，保存想听的歌。", "输入专辑 ID 或链接", "解析"],
  download: ["音乐下载", "下载音乐", "按所选音质保存文件。服务端会尝试写入封面和标签。", "输入歌曲 ID 或网易云音乐链接", "下载"],
  favorites: ["收藏", "我的收藏", "收藏保存在当前浏览器。"],
  history: ["最近播放", "最近播放", "在当前浏览器里接着听。"],
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
const isId = (value) => /^[1-9]\d{0,19}$/.test(value);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]
));
const icon = (id) => '<svg aria-hidden="true"><use href="/static/studio-icons.svg#' + id + '"></use></svg>';

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
    pic: String(data.pic || data.picUrl || data.al?.picUrl || ""),
  };
}

function tracksFrom(value) {
  return Array.isArray(value) ? value.map(songRecord).filter(Boolean) : [];
}

const saved = restore();
const state = {
  mode: "search",
  views: { search: { title: "快速试听", note: "从这几首开始，或搜索你想听的歌。", tracks: quickTracks } },
  queries: {},
  favorites: tracksFrom(saved.favorites),
  history: tracksFrom(saved.history),
  queue: tracksFrom(saved.queue),
  quality: Object.hasOwn(qualities, saved.quality) ? saved.quality : "standard",
  order: orders.some(([id]) => id === saved.order) ? saved.order : "sequence",
  translated: saved.translated !== false,
  lookup: null,
  playRequest: null,
  current: null,
  lyrics: [],
  lrc: "",
  translation: "",
  lyricIndex: -1,
  downloads: new Set(),
  serviceCheck: 0,
};

function persist() {
  try {
    const { favorites, history, queue, quality, order, translated } = state;
    localStorage.setItem(libraryKey, JSON.stringify({ favorites, history, queue, quality, order, translated, volume: audio.volume }));
  } catch {
    // Private browsing or storage quotas may prevent saving preferences.
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

async function request(path, params = {}, { signal, timeout = 40000, binary = false } = {}) {
  const url = new URL(path, location.origin);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener("abort", abort, { once: true });
  let expired = false;
  const timer = setTimeout(() => { expired = true; abort(); }, timeout);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
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
    if (error instanceof TypeError) throw new Error("无法连接 NAS 音乐服务，请检查网络。");
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
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
  for (const link of document.querySelectorAll("nav [data-mode]")) {
    if (link.dataset.mode === mode) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  renderResults();
}

function getView() {
  if (state.mode === "favorites") return { title: "已收藏的歌曲", note: state.favorites.length + " 首", tracks: state.favorites };
  if (state.mode === "history") return { title: "最近播放的歌曲", note: state.history.length + " 首", tracks: state.history };
  return state.views[state.mode] || { title: "结果", tracks: [] };
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

function trackList(tracks) {
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
      button("download", "download", "下载 " + track.name, track, { disabled: isDownloading(track.id) }) + "</div></div>";
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
      button("favorite", "heart", favorite(track) ? "取消收藏" : "收藏", track, { pressed: favorite(track) }) + "</div></div></article>";
  }
  if (view.collection) {
    const data = view.collection;
    const date = Number(data.publishTime) > 0 ? new Date(Number(data.publishTime)).toLocaleDateString("zh-CN") : "";
    const meta = [data.creator || data.artist, date, data.trackCount == null ? "" : data.trackCount + " 首"].filter(Boolean).join(" · ");
    const description = data.description ? '<details><summary>查看简介</summary><p>' + esc(data.description) + "</p></details>" : "";
    return '<article class="detail">' + cover({ pic: data.coverImgUrl }, 240) + '<div class="detail-body"><h3>' + esc(data.name) +
      "</h3><p>" + esc(meta) + "</p>" + description + "</div></article>";
  }
  return "";
}

function renderResults() {
  const view = getView();
  $("results-title").textContent = view.title;
  $("results-note").textContent = view.note || "";
  $("add-all").hidden = !view.tracks?.length;
  $("submit-search").disabled = view.kind === "loading";
  const message = $("result-message");
  message.hidden = !view.message;
  message.textContent = view.message || "";
  message.dataset.kind = view.kind || "info";
  const content = $("result-content");
  content.setAttribute("aria-busy", String(view.kind === "loading"));
  if (view.kind === "loading") {
    content.innerHTML = '<div class="skeleton-row" aria-hidden="true"><span></span><span></span></div>'.repeat(3);
  } else if (view.kind === "error") {
    content.innerHTML = empty("info", "请调整输入或重试", "连接状态可以在右上角查看。");
  } else if (view.kind === "saved") {
    content.innerHTML = empty("download", view.filename || "文件已处理", view.savedMessage || "下载任务已完成。");
  } else if (view.song || view.collection || view.tracks?.length) {
    content.innerHTML = detailCard(view) + (view.tracks?.length ? trackList(view.tracks) :
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
      result = { title: target === "album" ? "专辑详情" : "歌单详情", note: "已读取 " + tracks.length + " 首曲目", collection, tracks };
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
  return { title: "单曲详情", note: "网易云音乐 ID " + song.id, song, songData: data, requested: quality, message };
}

function findTrack(id) {
  const view = getView();
  return [view.song, ...(view.tracks || []), state.current?.track, ...state.queue, ...state.favorites, ...state.history]
    .find((item) => item?.id === id);
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

function renderQueue() {
  $("queue-count").hidden = !state.queue.length;
  $("queue-count").textContent = state.queue.length;
  $("queue-title-count").textContent = state.queue.length ? "· " + state.queue.length + " 首" : "";
  $("clear-queue").disabled = !state.queue.length;
  if (!$("queue-dialog").open) return;
  $("queue-rows").innerHTML = state.queue.length ? state.queue.map((track, index) => (
    '<div class="queue-row' + (state.current?.track.id === track.id ? " is-current" : "") + '">' + trackMeta(track, "play") + '<div>' +
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

function displayCurrent(track) {
  $("now-name").textContent = track.name;
  $("now-artist").textContent = track.artists || "未知歌手";
  $("mini-name").textContent = track.name;
  $("mini-artist").textContent = track.artists || "未知歌手";
  applyCover($("now-image"), track, 520, $("now-cover"));
  applyCover($("mini-image"), track, 100);
  if ("mediaSession" in navigator && typeof MediaMetadata !== "undefined") {
    const art = mediaURL(track.pic, 300);
    navigator.mediaSession.metadata = new MediaMetadata({ title: track.name, artist: track.artists, album: track.album, artwork: art ? [{ src: art }] : [] });
  }
}

async function playAudio() {
  try {
    await audio.play();
  } catch (error) {
    if (error.name !== "AbortError") {
      const message = error.name === "NotAllowedError" ? "点击播放按钮继续试听。" : "浏览器无法播放这个音源，请换一个音质。";
      setNowStatus(message, "error");
      toast(message);
    }
  }
}

async function startTrack(track, { autoPlay = true, seek = 0, keepCurrent = false } = {}) {
  state.playRequest?.abort();
  const controller = new AbortController();
  state.playRequest = controller;
  const quality = state.quality;
  const signal = controller.signal;
  if (!keepCurrent) {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    state.current = { track, requested: quality };
    setLyrics("", "");
    displayCurrent(track);
    const songView = getView();
    const detail = songView.song?.id === track.id ? songView.songData : null;
    if (detail?.lyric) setLyrics(detail.lyric, detail.tlyric);
    else request("/song", { id: track.id, type: "lyric", level: quality }, { signal }).then((data) => {
      if (!signal.aborted && state.current?.track.id === track.id) setLyrics(data.lrc?.lyric, data.tlyric?.lyric);
    }).catch(() => {
      if (!signal.aborted && state.current?.track.id === track.id) $("lyrics").textContent = "歌词暂时无法加载。";
    });
  }
  enqueue([track], false);
  setNowStatus("正在获取音源…", "loading");
  try {
    const data = await request("/song", { id: track.id, type: "url", level: quality }, { signal });
    if (signal.aborted) return;
    const stream = mediaURL(data.url);
    if (!stream) throw new Error("这个音质没有可用的音源，可以尝试切换音质。");
    state.current = { track, requested: quality, level: data.level, stream };
    audio.src = stream;
    if (seek > 0) {
      audio.addEventListener("loadedmetadata", () => {
        if (audio.src === stream && Number.isFinite(audio.duration)) audio.currentTime = Math.min(seek, audio.duration);
      }, { once: true });
    }
    setNowStatus("可试听" + qualitySuffix(), "ok");
    if (autoPlay) await playAudio();
  } catch (error) {
    if (!signal.aborted) {
      const message = error.message || "暂时无法读取音源。";
      setNowStatus(keepCurrent ? "切换失败，保留原音源" + qualitySuffix() : message, "error");
      toast(message);
    }
  } finally {
    if (state.playRequest === controller) {
      state.playRequest = null;
      syncPlayer();
    }
  }
}

function togglePlay(track = state.current?.track || state.queue[0]) {
  if (!track) return;
  if (state.current?.track.id !== track.id || !audio.getAttribute("src")) {
    if (!state.playRequest || state.current?.track.id !== track.id) startTrack(track);
  } else if (audio.paused) {
    playAudio();
  } else {
    audio.pause();
  }
}

function changeTrack(direction, ended = false) {
  if (!state.queue.length) return;
  if (ended && state.order === "repeat-one" && audio.getAttribute("src")) {
    audio.currentTime = 0;
    playAudio();
    return;
  }
  const index = state.queue.findIndex((track) => track.id === state.current?.track.id);
  let next = index < 0 ? 0 : index + direction;
  if (state.order === "shuffle" && direction > 0 && state.queue.length > 1) {
    const possible = state.queue.filter((track) => track.id !== state.current?.track.id);
    startTrack(possible[Math.floor(Math.random() * possible.length)]);
    return;
  }
  if (state.order === "repeat-all") next = (next + state.queue.length) % state.queue.length;
  if (state.queue[next]) startTrack(state.queue[next]);
  else if (ended) setNowStatus("已播完队列" + qualitySuffix(), "ok");
}

function qualitySuffix() {
  return state.current?.level ? " · " + (qualities[state.current.level] || state.current.level) : "";
}

function syncPlayer() {
  const track = state.current?.track;
  const activeIndex = state.queue.findIndex((item) => item.id === track?.id);
  const wrap = state.order === "repeat-all";
  const toggle = $("play-toggle");
  toggle.disabled = (!track && !state.queue.length) || (!!state.playRequest && !audio.getAttribute("src"));
  const playing = !audio.paused;
  setIcon(toggle, playing ? "pause" : "play");
  labelButton(toggle, playing ? "暂停" : "播放");
  $("previous").disabled = audio.currentTime < 3 && (state.queue.length === 0 || activeIndex <= 0 && !wrap);
  $("next").disabled = state.queue.length === 0 || (activeIndex === state.queue.length - 1 && !wrap &&
    (state.order !== "shuffle" || state.queue.length === 1));
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
  const activeIndex = state.queue.findIndex((track) => track.id === state.current?.track.id);
  $("previous").disabled = audio.currentTime < 3 && (state.queue.length === 0 || activeIndex <= 0 && state.order !== "repeat-all");
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

function isDownloading(id) {
  return state.downloads.has(id);
}

function syncDownloads(id, disabled) {
  for (const button of $("result-content").querySelectorAll('[data-action="download"]')) {
    if (button.dataset.track === id) button.disabled = disabled;
  }
}

async function downloadTrack(track, format = "file", signal) {
  if (isDownloading(track.id)) throw new Error("这首歌正在下载。");
  state.downloads.add(track.id);
  syncDownloads(track.id, true);
  if (!signal) toast("正在准备下载 · " + (track.name || "歌曲"));
  try {
    const result = await request("/download", { id: track.id, quality: state.quality, format }, {
      signal, binary: format === "file", timeout: 240000,
    });
    if (format === "json") {
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

async function checkService() {
  const check = ++state.serviceCheck;
  const dots = [$("connection-dot"), $("rail-status")];
  dots.forEach((dot) => { dot.dataset.state = "loading"; });
  $("connection-text").textContent = "正在连接";
  $("rail-caption").textContent = "正在连接";
  $("service-message").textContent = "正在检查 NAS API…";
  const [health, info] = await Promise.allSettled([request("/health", {}, { timeout: 8000 }), request("/api/info", {}, { timeout: 8000 })]);
  if (state.serviceCheck !== check) return;
  const running = health.status === "fulfilled";
  dots.forEach((dot) => { dot.dataset.state = running ? "ok" : "error"; });
  $("connection-text").textContent = running ? "服务在线" : "服务不可达";
  $("rail-caption").textContent = $("connection-text").textContent;
  $("service-message").textContent = running ? "NAS 音乐服务在线。" : health.reason.message;
  const details = [
    ["服务版本", info.value?.version || health.value?.version || "未知"],
    ["Cookie 文件", health.value?.cookie_status === "valid" ? "已读取" : running ? "未读取到" : "未知"],
    ["API 信息", info.status === "fulfilled" ? "可读取" : "读取失败"],
    ["支持音质", (info.value?.supported_qualities || []).map((key) => qualities[key] || key).join("、")],
  ];
  $("service-details").innerHTML = details.filter(([, value]) => value).map(([label, value]) => "<dt>" + esc(label) + "</dt><dd>" + esc(value) + "</dd>").join("");
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

const actions = {
  service: () => showDialog("service-dialog"),
  "refresh-service": checkService,
  queue: () => { showDialog("queue-dialog"); renderQueue(); },
  close: (_, button) => button.closest("dialog")?.close(),
  play: (track) => togglePlay(track),
  enqueue: (track) => track && enqueue([track]),
  "add-all": () => enqueue(getView().tracks || []),
  favorite: toggleFavorite,
  "now-like": () => toggleFavorite(state.current?.track),
  "toggle-play": () => togglePlay(),
  next: () => changeTrack(1),
  previous: () => { if (audio.currentTime >= 3) audio.currentTime = 0; else changeTrack(-1); },
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
    persist();
    renderQueue();
    syncPlayer();
    $("queue-dialog").querySelector('[data-action="close"]').focus();
  },
  details: (track) => track && lookup(track.id, "song"),
  download: (track) => track && downloadTrack(track).catch((error) => toast(error.message)),
  "copy-link": copyLink,
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

window.addEventListener("hashchange", () => {
  const mode = location.hash.slice(1);
  if (mode !== "main" && mode !== state.mode) displayMode(mode, false);
});
$("lookup-form").addEventListener("submit", (event) => { event.preventDefault(); lookup($("query").value); });
$("query").addEventListener("input", () => { state.queries[state.mode] = $("query").value; });
$("quality").innerHTML = Object.entries(qualities).map(([value, label]) => '<option value="' + value + '">' + esc(label) + "</option>").join("");
$("quality").value = state.quality;
$("quality").addEventListener("change", () => {
  state.quality = $("quality").value;
  persist();
  if (state.current?.stream) startTrack(state.current.track, { autoPlay: !audio.paused, seek: audio.currentTime, keepCurrent: true });
  else if (state.playRequest && state.current) startTrack(state.current.track);
  if (state.mode === "song" && getView().song) lookup(getView().song.id, "song");
});
const savedVolume = Number(saved.volume);
audio.volume = Number.isFinite(savedVolume) ? Math.min(1, Math.max(0, savedVolume)) : 0.75;
$("volume").value = audio.volume;
$("volume").addEventListener("input", () => { audio.volume = Number($("volume").value); audio.muted = false; });
$("seek").addEventListener("input", () => { audio.currentTime = Number($("seek").value); });

audio.addEventListener("volumechange", () => { $("volume").value = audio.volume; persist(); syncPlayer(); });
audio.addEventListener("playing", () => {
  if (state.current) recordPlay(state.current.track);
  setNowStatus("正在播放" + qualitySuffix(), "ok");
  syncPlayer();
});
audio.addEventListener("pause", () => { if (audio.getAttribute("src")) setNowStatus("已暂停" + qualitySuffix(), "ok"); syncPlayer(); });
audio.addEventListener("error", () => {
  if (audio.getAttribute("src")) setNowStatus("音源播放失败，可以换一个音质。", "error");
  syncPlayer();
});
audio.addEventListener("waiting", () => { if (!audio.paused && audio.getAttribute("src")) setNowStatus("正在缓冲…", "loading"); });
audio.addEventListener("ended", () => changeTrack(1, true));
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
    nexttrack: () => changeTrack(1), seekto: (details) => {
      if (Number.isFinite(details.seekTime) && Number.isFinite(audio.duration)) audio.currentTime = Math.min(details.seekTime, audio.duration);
    },
  })) {
    try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* This browser does not implement the action. */ }
  }
}

displayMode(location.hash.slice(1) || "search", false);
renderQueue();
syncPlayer();
checkService();
