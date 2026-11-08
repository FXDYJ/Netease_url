# 回声音乐播放器调研

调研日期为 2026 年 11 月 8 日。样本覆盖中文流媒体、国际订阅服务、自托管客户端、桌面本地播放器和音乐发现社区。以下对比依据公开产品文档、发行说明和开发者提供的应用介绍。取舍按「回声」的免登录、浏览器使用和轻量 NAS 部署目标评估。

| 产品 | 做得好的地方 | 在回声里的取舍 |
| --- | --- | --- |
| 网易云音乐 | 心动模式把熟悉曲目和推荐放进同一次收听，私人 DJ 也能提供持续播放 | 做成用户主动开启的电台。独立保存偏好，保留手动队列和顺序播放。完整的服务端推荐模型依赖平台数据。 [官方应用](https://apps.apple.com/cn/app/id590338362) · [产品研究](https://qks.sufe.edu.cn/J/PDFFullDown/A0ODfAAkzl-kMEI-924k-BLS0-arge0YVawCLD) |
| QQ 音乐 | 相似单曲、个性电台、翻译歌词和多种搜索入口衔接紧密 | 在单曲详情放相似电台，搜索继续作为首页。账户同步、MV 和语音识别需要更多服务。 [官方应用](https://apps.apple.com/cn/app/id429885089) |
| 酷狗音乐 | 网页直接提供搜索和榜单，移动客户端覆盖更多播放场景 | 借鉴快捷入口，首页维持搜索和试听的重点。听书、直播和会员入口会拉长选歌路径。 [官方网站](https://www.kugou.com/) · [官方应用](https://apps.apple.com/cn/app/id472208016) |
| 酷我音乐 | 电台分类和音质选择容易理解 | 保留清晰的音质选择。曲库覆盖与音质取决于当前可用音源。 [官方应用](https://apps.apple.com/cn/app/id588673713) |
| Spotify | Smart Shuffle 把推荐标在播放器上，Autoplay 在队列结束后接续，随机播放还有减少重复的选项 | 提供独立的插播和接续模式，标明来源，减少短期重复。免费移动端固定开启 Smart Shuffle 的做法降低了控制权。 [随机播放](https://support.spotify.com/tj-en/article/shuffle-play/) · [自动接播](https://support.spotify.com/ng/article/autoplay/) |
| Apple Music | 手动安排下一首和自动接播分开，点播优先级清楚 | 手动插队优先于推荐，也可以用「播放全部」开始新队列。Apple Music 的自动接播要求订阅。 [队列与自动接播](https://support.apple.com/en-gb/109336) |
| YouTube Music | 电台可由用户选择的音乐要素组装，听众可以主动改变发现范围 | 第一版用当前歌曲做种子，再选探索程度。大量维度和视频入口会增加初始化成本。 [官方功能指南](https://blog.youtube/news-and-events/youtube-music-app-2023-guide/) |
| Deezer | Flow 让喜欢过的歌曲和新发现共存，Flow Tuner 把调节推荐的控制交给听众 | 加入偏熟悉、均衡、多探索和可撤销的「不再推荐」。当前数据足以做曲目和歌手排序，按曲风精调需要更完整的曲库标签。 [Flow Tuner](https://newsroom-deezer.com/2026/02/deezer-launches-flow-tuner-personalized-recommendations/) |
| TIDAL | Daily Discovery 用小批量精选压低选择成本 | 每次只为当前场景选下一首，避免为了填满发现页而预载大量内容。每日推荐依赖历史积累，冷启动体验较弱。 [Daily Discovery](https://support.tidal.com/hc/en-us/articles/23351150845329-Daily-Discovery) |
| Plexamp | Track Radio 通过音频分析找到听感相近的曲目 | 借鉴从单曲启动电台的交互。Plex 的全库分析需要已有音乐文件、服务器运算和 Plex Pass，超出本项目的轻量部署目标。 [Sonic Analysis](https://www.plex.tv/blog/super-sonic-get-closer-to-your-music-in-plexamp/) |
| Navidrome | 开源音乐库提供动态歌单，搭配 AudioMuse-AI 可以做 Instant Mix | 把歌单保存与临时推荐分开。自托管曲库扫描和额外分析服务适合拥有音频文件的部署。 [智能歌单](https://navidrome.org/docs/usage/smartplaylists/) · [AudioMuse-AI](https://navidrome.org/docs/usage/integration/audiomuse/) |
| Feishin | 开源播放器把常驻控制、同步歌词和智能歌单放在同一个工作区 | 保持播放条和歌词跨页面可用。桌面 MPV 和服务端音乐库适合作为独立客户端能力。 [源码及功能](https://github.com/jeffvli/feishin) |
| Symfonium | Smart Flow 能改变已开始播放的会话，控制在听歌当下可用 | 把相似电台放在当前曲目旁。基于声学分析的模式依赖媒体提供方的能力，设置层次也更多。 [发行说明](https://support.symfonium.app/t/version-12-1-0-released/7297) |
| foobar2000 | 本地媒体库、ReplayGain 和队列工具清楚，支持记住播放曲目和进度 | 提供显式「接着听」。浏览器播放 CDN 音源时，缺少可靠的全曲响度标签和底层输出控制。 [功能概览](https://www.foobar2000.org/?page=Overview) · [播放选项](https://wiki.hydrogenaudio.org/index.php?title=Foobar2000%3APreferences%3APlayback) |
| AIMP | 智能歌单、标签整理和本地播放控制适合大曲库 | 先做低门槛的本机歌单整理和批量加入。复杂标签规则需要稳定的本地曲库元数据。 [功能说明](https://aimp.ru/?do=features&lang=en) |
| ListenBrainz | 开源平台把熟悉曲目和每周新发现分开，公开说明推荐的依据 | 把熟悉度做成可控选项，标注每首推荐来自哪里。基于完整历史的跨设备画像需要集中存储。 [推荐示例](https://listenbrainz.org/user/kdb424/recommendations/) · [源码](https://github.com/metabrainz/listenbrainz-server) |
| Bandcamp | 通过流派、标签和地区探索独立音乐，试听与购买路径清楚 | 借鉴从可辨识的线索出发发现音乐。试听和购买规则由创作者与平台决定，使用其他目录需要单独的音源集成。 [Discover](https://blog.bandcamp.com/2023/12/12/discover-a-new-way-to-shop-on-bandcamp/) · [条款](https://bandcamp.com/terms_of_use) |
| SoundCloud | 网页可以从作品启动电台，收藏、歌单与发现入口彼此独立 | 让用户从曲目详情或播放器启动相似电台。推荐借鉴曲目关联，社交关系和转发数据依赖平台社区。 [Stations](https://help.soundcloud.com/hc/en-us/articles/115003565208-Stations-and-how-they-work) · [Related tracks](https://help.soundcloud.com/hc/en-us/articles/115003565888-Related-tracks) |
| Jamendo Music | 独立作品可免费流式收听，曲目由创作者选择 Creative Commons 授权 | 明确区分网站的免费功能与音源的可用范围。开放授权曲库以独立音乐为主，适合补充探索场景。 [创作者指南](https://support-artist.jamendo.com/en_GB/getting-started) |

## 本版设计

- 心动电台默认关闭。用户可以从单曲启动，也可开启队列结束后接续，或在顺序队列中按探索程度穿插推荐。推荐曲目可以来自队列下一首或队列外，临时推荐与手动添加的队列分开。
- 用歌曲的相似关联获得候选，用收藏、实际播放时长和近期重复情况排序。匿名相似接口属于上游兼容接口，失效时回退到同歌手搜索或本机收藏。推荐理由按实际来源展示。
- 播放队列支持「下一首播放」。随机播放优先使用本次未播放的曲目，上一首使用实际播放记录。个人歌单支持新建、重命名、删歌和把整组曲目保存下来。刷新后可按需恢复最近曲目的进度。
- 借鉴 Apple Music 的音乐库导出，让免登录用户可以手动迁移歌单与收藏。备份仅含曲目资料，重复导入时按歌单和曲目 ID 合并。与账号同步相比，需要用户主动保管文件。 [Apple Music 音乐库导出](https://support.apple.com/en-ie/guide/music/-mus27cd5060f/mac)
- 借鉴 Spotify 的作品链接和 AIMP 的定时停止。歌曲、专辑和公开歌单可以分享站内链接，打开后直接加载详情，音频由访客选择播放。定时停止提供倒计时和播完当前曲目两种用法。 [Spotify 分享](https://support.spotify.com/zm/article/share-from-spotify/) · [AIMP 定时停止](https://aimp.ru/?do=features&os=android)
- 长列表可以按歌曲、歌手和专辑即时筛选。整张播放、加入队列和保存歌单仍以完整列表为单位，避免筛选后误把整张歌单截断。
- 新功能无需访客账户。收藏、歌单、偏好和进度保存在当前浏览器。电台只向 NAS 请求精简的曲目信息。音频继续按现有播放来源设置加载，外网默认直连源站。
