"""Extend the upstream Flask app with anonymous song recommendations."""

import re
from functools import lru_cache
from threading import BoundedSemaphore
from time import monotonic

import requests
from flask import Blueprint, current_app, request


discovery = Blueprint("echo_discovery", __name__)
upstream_slots = BoundedSemaphore(4)


@lru_cache(maxsize=256)
def similar_tracks(song_id, cache_window):
    """Cache small metadata responses for up to ten minutes."""
    if not upstream_slots.acquire(blocking=False):
        raise requests.RequestException("Discovery request limit reached")
    try:
        with requests.Session() as session:
            session.trust_env = False
            response = session.get(
                "https://music.163.com/api/v1/discovery/simiSong",
                params={"songid": song_id, "limit": 5, "offset": 0},
                timeout=(3, 5),
                allow_redirects=False,
            )
            response.raise_for_status()
            payload = response.json()
    finally:
        upstream_slots.release()
    if not isinstance(payload, dict) or payload.get("code") != 200 or not isinstance(payload.get("songs"), list):
        raise ValueError("Unexpected discovery response")

    tracks = []
    for song in payload["songs"][:5]:
        if not isinstance(song, dict) or not re.fullmatch(r"[1-9][0-9]{0,19}", str(song.get("id"))):
            continue
        album = song.get("album")
        artists = song.get("artists")
        album = album if isinstance(album, dict) else {}
        artists = artists if isinstance(artists, list) else []
        tracks.append({
            "id": str(song["id"]),
            "name": song.get("name"),
            "artists": [artist["name"] for artist in artists if isinstance(artist, dict) and artist.get("name")],
            "album": album.get("name"),
            "pic": album.get("picUrl"),
        })
    return tracks


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


if __name__ == "__main__":
    from main import app, start_api_server

    app.register_blueprint(discovery)
    start_api_server()
