**表1：X（Twitter）高级搜索操作符综合列表**

| 操作符 (Operator) | 类别 (Category) | 描述 (Description) | 示例 (Example) | 主要来源 (Primary Source Snippet(s)) |
| :---- | :---- | :---- | :---- | :---- |
| word1 word2 | 内容 (Content) | 查找包含所有指定单词的推文（隐式AND）。括号可用于组合词语。 | nasa esa | 3 |
| word1 OR word2 | 内容 (Content) | 查找包含任一指定单词的推文。OR 必须大写。 | nasa OR esa | 3 |
| "exact phrase" | 内容 (Content) | 查找包含完整精确短语的推文。也用于防止拼写校正。 | "state of the art" | 3 |
| \-word | 内容 (Content) | 排除包含特定单词的推文。也适用于短语和其他操作符。 | love \-hate, "live laugh love" \-prayer | 1 |
| \#hashtag | 内容 (Content) | 查找包含特定话题标签的推文。 | \#tgif, \#MondayMotivation | 3 |
| $cashtag | 内容 (Content) | 查找包含特定股票代码标签的推文。 | $TWTR | 3 |
| lang:\[language\_code\] | 内容 (Content) | 查找特定语言的推文。语言代码为ISO 639-1标准，如 en (英语), zh (中文)。特殊代码如 und (未定义), qam (仅提及), qct (仅含cashtag), qht (仅含hashtag), qme (含媒体链接), qst (短文本), zxx (仅媒体/卡片无文本) 3。 | lang:en, lang:zh, lang:qam | 3 |
| url:\[text\_in\_url\] | 内容 (Content) | 查找包含特定文本的URL的推文。对子域名和域名效果好。 | url:google.com, url:typefully | 2 |
| \+word | 内容 (Content) | 强制按原样包含某个词，防止拼写校正。 | \+radiooooo | 3 |
| "phrase with \* wildcard" | 内容 (Content) | 查找带有通配符的完整短语。\* 仅在引用短语内或有空格时有效。 | "this is the \* time this week" | 3 |
| ? | 内容 (Content) | 匹配包含问号的推文。 | What? | 3 |
| :) 或 :( | 内容 (Content) | 匹配包含特定表情符号的推文（正面或负面）。 | happy :), \`sad :3 | 内容 (Content) |
| from:username | 账户 (Account) | 查找由特定用户发送的推文。 | from:elonmusk | 3 |
| to:username | 账户 (Account) | 查找回复特定用户的推文。 | to:SpaceX | 1 |
| @username | 账户 (Account) | 查找提及特定用户的推文。可与 \-from:username 结合以仅查找提及。 | @NASA | 3 |
| list:list\_id | 账户 (Account) | 查找来自特定公开列表成员的推文（使用列表ID）。 | list:715919216927322112 | 3 |
| list:owner\_screen\_name/list\_slug | 账户 (Account) | 查找来自特定公开列表成员的推文（使用列表所有者用户名和列表别名）。 | list:esa/astronauts | 3 |
| filter:verified | 筛选 (Filter) | 筛选来自认证用户的推文。 | news filter:verified | 3 |
| filter:blue\_verified | 筛选 (Filter) | 筛选来自Twitter Blue付费认证用户的推文。 | opinion filter:blue\_verified | 3 |
| filter:follows | 筛选 (Filter) | 仅查找来自您关注的账户的推文。不可否定。 | updates filter:follows | 3 |
| filter:social / filter:trusted | 筛选 (Filter) | 仅查找基于您的关注和活动，通过算法扩展的网络中的账户的推文。作用于“热门”结果而非“最新”。 | recommendations filter:social | 3 |
| filter:replies / \-filter:replies | 筛选 (Filter) | 仅查找回复 / 排除回复，仅查找原创推文。 | discussion filter:replies, announcement \-filter:replies | 2 |
| filter:links / \-filter:links | 筛选 (Filter) | 仅查找包含链接 / 排除包含链接的推文。 | article filter:links, opinion \-filter:links | 2 |
| filter:media / \-filter:media | 筛选 (Filter) | 仅查找包含媒体（图片、视频）/ 排除包含媒体的推文。 | event filter:media, textpost \-filter:media | 3 |
| filter:images / \-filter:images | 筛选 (Filter) | 仅查找包含图片 / 排除包含图片的推文。 | art filter:images, status \-filter:images | 3 |
| filter:videos | 筛选 (Filter) | 仅查找包含视频的推文（包括原生视频和外部链接如YouTube）。 | tutorial filter:videos | 3 |
| filter:nativeretweets | 筛选 (Filter) | 仅查找使用转推按钮创建的原生转推（近7-10天内）。 | filter:nativeretweets from:someuser | 3 |
| include:nativeretweets | 筛选 (Filter) | 默认排除原生转推，此操作符将其包含在结果中（近7-10天内）。 | keyword include:nativeretweets | 3 |
| filter:retweets | 筛选 (Filter) | 查找旧式转推（"RT"）和引用推文。 | news filter:retweets | 3 |
| filter:self\_threads | 筛选 (Filter) | 仅查找同一用户发起的推文串中的自我回复。 | from:userX filter:self\_threads | 3 |
| filter:quote | 筛选 (Filter) | 查找包含引用推文的推文。 | commentary filter:quote | 3 |
| filter:has\_engagement | 筛选 (Filter) | 查找有一定互动（回复、喜欢、转推）的推文。 | popular filter:has\_engagement | 3 |
| filter:news | 筛选 (Filter) | 查找链接到新闻报道的推文（基于白名单域名）。 | update filter:news | 3 |
| filter:safe | 筛选 (Filter) | 排除标记为“可能敏感”的NSFW内容。 | family filter:safe | 3 |
| filter:hashtags | 筛选 (Filter) | 仅查找包含话题标签的推文。 | event filter:hashtags | 3 |
| min\_retweets:N | 互动 (Engagement) | 查找至少有N个转推的推文。 | viral min\_retweets:1000 | 2 |
| min\_faves:N (或 min\_likes:N) | 互动 (Engagement) | 查找至少有N个喜欢（点赞）的推文。 | loved min\_faves:500 | 2 |
| min\_replies:N | 互动 (Engagement) | 查找至少有N个回复的推文。 | discussion min\_replies:50 | 2 |
| \-min\_retweets:N | 互动 (Engagement) | 查找最多有N个转推的推文。 | niche \-min\_retweets:10 | 3 |
| \-min\_faves:N | 互动 (Engagement) | 查找最多有N个喜欢（点赞）的推文。 | undiscovered \-min\_faves:5 | 3 |
| \-min\_replies:N | 互动 (Engagement) | 查找最多有N个回复的推文。 | monologue \-min\_replies:2 | 3 |
| since:YYYY-MM-DD | 日期/时间 (Date/Time) | 查找指定日期之后（含当天）发布的推文。 | event since:2023-01-01 | 3 |
| until:YYYY-MM-DD | 日期/时间 (Date/Time) | 查找指定日期之前（含当天）发布的推文。 | campaign until:2023-12-31 | 3 |
| since:YYYY-MM-DD\_HH:MM:SS\_TIMEZONE | 日期/时间 (Date/Time) | 查找指定日期时间之后（含）发布的推文（时区如UTC）。 | breaking since:2023-01-01\_12:00:00\_UTC | 3 |
| until:YYYY-MM-DD\_HH:MM:SS\_TIMEZONE | 日期/时间 (Date/Time) | 查找指定日期时间之前（不含）发布的推文。 | live\_event until:2023-01-01\_14:00:00\_UTC | 3 |
| since\_time:UNIX\_TIMESTAMP | 日期/时间 (Date/Time) | 查找指定Unix时间戳（秒）之后（含）发布的推文。 | launch since\_time:1609459200 | 3 |
| until\_time:UNIX\_TIMESTAMP | 日期/时间 (Date/Time) | 查找指定Unix时间戳（秒）之前发布的推文。 | offer until\_time:1612137599 | 3 |
| since\_id:TWEET\_ID | 日期/时间 (Date/Time) | 查找指定推文ID之后（不含）发布的推文（Snowflake ID）。 | update since\_id:1234567890123456789 | 3 |
| max\_id:TWEET\_ID | 日期/时间 (Date/Time) | 查找指定推文ID之前（含）发布的推文（Snowflake ID）。 | archive max\_id:1234567890123456789 | 3 |
| within\_time:2d, 3h, 5m, 30s | 日期/时间 (Date/Time) | 查找过去特定时间段内的推文（如2天、3小时、5分钟、30秒）。 | recent within\_time:2h | 3 |
| near:city\_name | 地理位置 (Location) | 查找在指定城市附近（地理标记）发布的推文。 | food near:london | 3 |
| near:"City Name with Spaces" | 地理位置 (Location) | 查找在名称包含空格的城市附近发布的推文。 | jobs near:"New York City" | 3 |
| near:me | 地理位置 (Location) | 查找在X认为的“我”附近发布的推文。 | traffic near:me | 3 |
| within:radius | 地理位置 (Location) | 与near:配合使用，限定特定半径范围（如10km, 15mi）。 | fire near:san-francisco within:10km | 3 |
| geocode:lat,long,radius | 地理位置 (Location) | 查找在指定经纬度坐标及半径范围内的推文。 | geocode:37.7764685,-122.4172004,10km | 3 |
| place:place\_id | 地理位置 (Location) | 根据地点对象ID查找推文。 | place:96683cc9126741d1 (USA Place ID) | 3 |
| conversation\_id:tweet\_id | 推文类型 (Tweet Type) | 查找属于特定推文串（thread）一部分的推文（包括直接回复和串内其他回复）。 | conversation\_id:123... | 3 |
| quoted\_tweet\_id:tweet\_id | 推文类型 (Tweet Type) | 查找引用了特定推文ID的推文。 | quoted\_tweet\_id:123... | 3 |
| quoted\_user\_id:user\_id | 推文类型 (Tweet Type) | 查找引用了特定用户ID的所有推文。 | quoted\_user\_id:2244994945 (e.g. @Twitter user ID) | 3 |
| card\_name:\[type\] | 推文类型 (Tweet Type) | 查找包含特定类型Twitter卡片的推文。类型如：poll2choice\_text\_only (2选项文本投票), poll3choice\_image (3选项图片投票), audio (音频卡), animated\_gif (GIF卡), summary (小图摘要卡), summary\_large\_image (大图摘要卡), player (播放器卡), promo\_image\_app (推广应用图片卡) 等。 | card\_name:poll4choice\_text\_only, card\_name:audio | 3 |
| card\_domain:domain\_name | 推文类型 (Tweet Type) | 匹配Twitter卡片中的域名。 | card\_domain:spotify.com | 3 |
| source:client\_name | 推文类型 (Tweet Type) | 查找通过特定客户端发送的推文。客户端名称中的空格用下划线替代，或用引号括起。需与其他操作符结合使用。 | news source:tweetdeck lang:en, photo source:"Twitter for iPhone" lang:en | 3 |

此表为开发者提供了实现插件核心功能的坚实基础。值得注意的是，某些操作符（如filter:blue\_verified）反映了X平台的最新变化，对于希望构建与时俱进工具的开发者而言尤为重要。