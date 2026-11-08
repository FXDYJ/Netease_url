"""Extend the upstream Flask app with anonymous music catalog metadata."""

import re
from functools import lru_cache
from html import unescape
from threading import BoundedSemaphore
from time import monotonic

import requests
from flask import Blueprint, current_app, request


discovery = Blueprint("echo_discovery", __name__)
upstream_slots = BoundedSemaphore(4)
ID_PATTERN = re.compile(r"[1-9][0-9]{0,19}")
SEARCH_TYPES = {"artist": (100, "artists"), "album": (10, "albums"), "playlist": (1000, "playlists")}
CATEGORIES = {"华语", "流行", "民谣", "轻音乐", "摇滚", "电子", "学习", "工作", "睡眠", "运动"}
PAGE_SIZE = 12


def upstream(path, params=None):
    if not upstream_slots.acquire(blocking=False):
        raise requests.RequestException("Discovery request limit reached")
    try:
        with requests.Session() as session:
            session.trust_env = False
            response = session.get(
                "https://music.163.com" + path,
                params=params,
                timeout=(3, 5),
                allow_redirects=False,
            )
            response.raise_for_status()
            payload = response.json()
    finally:
        upstream_slots.release()
    if not isinstance(payload, dict) or payload.get("code") != 200:
        raise ValueError("Unexpected discovery response")
    return payload


def as_dict(value):
    return value if isinstance(value, dict) else {}


def object_list(data, limit):
    return (item for item in (data[:limit] if isinstance(data, list) else [])
            if isinstance(item, dict) and ID_PATTERN.fullmatch(str(item.get("id"))))


def catalog_entry(item, kind):
    return {
        "id": str(item["id"]),
        "name": str(item.get("name") or "")[:160],
        "pic": item.get("coverImgUrl") or item.get("picUrl") or item.get("img1v1Url"),
        "subtitle": as_dict(item.get("artist")).get("name") or as_dict(item.get("creator")).get("nickname"),
        "count": item.get({"playlist": "trackCount", "artist": "musicSize", "album": "size"}[kind]),
        "date": item.get("publishTime"),
        "update": item.get("updateFrequency"),
    }


def tracks_from(data, limit):
    result = []
    for song in object_list(data, limit):
        album = as_dict(song.get("al") or song.get("album"))
        artists = song.get("ar") or song.get("artists")
        result.append({
            "id": str(song["id"]),
            "name": song.get("name"),
            "artists": [{"id": str(artist["id"]), "name": artist.get("name")}
                        for artist in object_list(artists, 10) if artist.get("name")],
            "album": album.get("name"),
            "pic": album.get("picUrl"),
        })
    return result


@lru_cache(maxsize=256)
def similar_tracks(song_id, cache_window):
    payload = upstream("/api/v1/discovery/simiSong", {"songid": song_id, "limit": 5, "offset": 0})
    if not isinstance(payload.get("songs"), list):
        raise ValueError("Missing similar songs")
    return tracks_from(payload["songs"], 5)


@lru_cache(maxsize=160)
def catalog_search(kind, keyword, page, cache_window):
    if kind == "lyric":
        payload = upstream("/api/cloudsearch/pc", {"s": keyword, "type": 1006, "limit": PAGE_SIZE, "offset": page * PAGE_SIZE})
        result = as_dict(payload.get("result"))
        songs = list(object_list(result.get("songs"), PAGE_SIZE))
        matches = {}
        for song in songs:
            lines = song.get("lyrics")
            if isinstance(lines, list):
                line = next((line for line in lines if isinstance(line, str) and "<b>" in line), "")
                if line:
                    matches[str(song["id"])] = unescape(re.sub(r"<[^>]*>", "", line))[:180]
        total = result.get("songCount")
        return {"tracks": tracks_from(songs, PAGE_SIZE), "matches": matches,
                "more": isinstance(total, int) and total > (page + 1) * PAGE_SIZE}
    type_id, key = SEARCH_TYPES[kind]
    payload = upstream("/api/search/get", {"s": keyword, "type": type_id, "limit": PAGE_SIZE, "offset": page * PAGE_SIZE})
    result = as_dict(payload.get("result"))
    entries = [catalog_entry(item, kind) for item in object_list(result.get(key), PAGE_SIZE)]
    total = result.get(kind + "Count")
    return {"entries": entries, "more": bool(entries and (result.get("hasMore") or
            isinstance(total, int) and total > (page + 1) * PAGE_SIZE))}


@lru_cache(maxsize=128)
def artist_catalog(artist_id, section, page, cache_window):
    if section == "albums":
        payload = upstream("/api/artist/albums/" + artist_id, {"limit": PAGE_SIZE, "offset": page * PAGE_SIZE})
    else:
        payload = upstream("/api/v1/artist/" + artist_id)
    artist = as_dict(payload.get("artist"))
    if str(artist.get("id")) != artist_id:
        raise ValueError("Missing artist")
    return {
        "artist": {**catalog_entry(artist, "artist"), "description": str(artist.get("briefDesc") or "")[:1000]},
        "tracks": tracks_from(payload.get("hotSongs"), 50),
        "entries": [catalog_entry(item, "album") for item in object_list(payload.get("hotAlbums"), PAGE_SIZE)],
        "more": section == "albums" and bool(payload.get("more")),
    }


@lru_cache(maxsize=96)
def discover_playlists(category, page, cache_window):
    if category == "charts":
        payload = upstream("/api/toplist")
        entries = list(object_list(payload.get("list"), 80))
        batch = entries[page * PAGE_SIZE:(page + 1) * PAGE_SIZE]
        more = len(entries) > (page + 1) * PAGE_SIZE
    else:
        payload = upstream("/api/playlist/list", {"cat": category, "order": "hot", "limit": PAGE_SIZE, "offset": page * PAGE_SIZE})
        batch = list(object_list(payload.get("playlists"), PAGE_SIZE))
        more = bool(payload.get("more"))
    return {"entries": [catalog_entry(item, "playlist") for item in batch], "more": more}


def metadata_result(loader, *args):
    try:
        return {"success": True, "data": loader(*args, int(monotonic() // 600))}
    except (requests.RequestException, ValueError) as error:
        current_app.logger.warning("Music metadata unavailable for %s: %s", loader.__name__, type(error).__name__)
        return {"success": False, "message": "音乐目录暂时不可用，请稍后重试。"}, 502


def page_number():
    value = request.args.get("page", "0")
    return int(value) if re.fullmatch(r"[0-9]", value) else None


@discovery.get("/api/similar")
def similar():
    song_id = request.args.get("id", "")
    if not re.fullmatch(r"[1-9][0-9]{0,19}", song_id):
        return {"success": False, "message": "请提供有效的歌曲 ID。"}, 400
    try:
        tracks = similar_tracks(song_id, int(monotonic() // 600))
    except (requests.RequestException, ValueError) as error:
        current_app.logger.warning("Similar songs unavailable: %s", error)
        return {"success": False, "message": "相似歌曲暂时不可用，请稍后重试。"}, 502
    return {"success": True, "data": tracks}


@discovery.get("/api/catalog")
def catalog():
    kind = request.args.get("kind", "")
    keyword = request.args.get("q", "").strip()
    page = page_number()
    if (kind != "lyric" and kind not in SEARCH_TYPES) or not 1 <= len(keyword) <= 100 or page is None:
        return {"success": False, "message": "请提供有效的搜索类型、关键词和页码。"}, 400
    return metadata_result(catalog_search, kind, keyword, page)


@discovery.get("/api/artist")
def artist():
    artist_id = request.args.get("id", "")
    section = request.args.get("section", "songs")
    page = page_number()
    if not ID_PATTERN.fullmatch(artist_id) or section not in {"songs", "albums"} or page is None or (section == "songs" and page):
        return {"success": False, "message": "请提供有效的歌手 ID 和浏览类型。"}, 400
    return metadata_result(artist_catalog, artist_id, section, page)


@discovery.get("/api/discover")
def browse():
    category = request.args.get("category", "charts")
    page = page_number()
    if (category != "charts" and category not in CATEGORIES) or page is None:
        return {"success": False, "message": "请提供有效的歌单分类和页码。"}, 400
    return metadata_result(discover_playlists, category, page)


if __name__ == "__main__":
    from main import app, start_api_server

    app.register_blueprint(discovery)
    start_api_server()
