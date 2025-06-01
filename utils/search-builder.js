/**
 * X搜索查询构建器
 * 将复杂的X搜索操作符转换为用户友好的可视化界面
 * 基于X平台68个搜索操作符的完整实现
 */

class XSearchQueryBuilder {
    constructor() {
        this.conditions = [];
        this.currentUser = null;
        this.searchHistory = [];
        this.templates = this.getSearchTemplates();
    }

    /**
     * 重置所有搜索条件
     */
    reset() {
        this.conditions = [];
        return this;
    }

    /**
     * 设置当前用户（用于用户页面搜索）
     */
    setCurrentUser(username, displayName = null) {
        this.currentUser = {
            username: username,
            displayName: displayName || username
        };
        return this;
    }

    /**
     * 添加基础关键词搜索
     */
    addKeywords(keywords, options = {}) {
        if (!keywords || keywords.trim() === '') return this;

        const {
            exact = false,      // 精确匹配
            exclude = false,    // 排除
            operator = 'AND',   // AND/OR
            wildcard = false,   // 通配符支持
            forceOriginal = false // 强制原样（防止拼写校正）
        } = options;

        let condition = keywords.trim();

        // 处理通配符
        if (wildcard && exact) {
            condition = `"${condition}"`;
        } else if (exact) {
            condition = `"${condition}"`;
        } else if (forceOriginal) {
            condition = `+${condition}`;
        }

        if (exclude) {
            condition = `-${condition}`;
        }

        // 处理多关键词的逻辑操作符
        if (operator === 'OR' && condition.includes(' ') && !exact) {
            const words = condition.split(' ');
            condition = words.join(' OR ');
        }

        this.conditions.push(condition);
        return this;
    }

    /**
     * 添加用户相关条件
     */
    addUserCondition(username, type = 'from') {
        if (!username) return this;

        const validTypes = ['from', 'to', '@'];
        if (!validTypes.includes(type)) {
            throw new Error(`无效的用户条件类型: ${type}`);
        }

        let condition;
        switch (type) {
            case 'from':
                condition = `from:${username}`;
                break;
            case 'to':
                condition = `to:${username}`;
                break;
            case '@':
                condition = `@${username}`;
                break;
        }

        this.conditions.push(condition);
        return this;
    }

    /**
     * 添加列表搜索
     */
    addList(listIdentifier, isListId = false) {
        if (!listIdentifier) return this;
        
        if (isListId) {
            // 使用列表ID
            this.conditions.push(`list:${listIdentifier}`);
        } else {
            // 使用 owner_screen_name/list_slug 格式
            this.conditions.push(`list:${listIdentifier}`);
        }
        return this;
    }

    /**
     * 添加话题标签
     */
    addHashtag(hashtag) {
        if (!hashtag) return this;
        
        // 确保hashtag以#开头
        if (!hashtag.startsWith('#')) {
            hashtag = '#' + hashtag;
        }

        this.conditions.push(hashtag);
        return this;
    }

    /**
     * 添加股票代码
     */
    addCashtag(cashtag) {
        if (!cashtag) return this;
        
        // 确保cashtag以$开头
        if (!cashtag.startsWith('$')) {
            cashtag = '$' + cashtag;
        }

        this.conditions.push(cashtag);
        return this;
    }

    /**
     * 添加语言筛选
     */
    addLanguage(langCode) {
        if (!langCode) return this;
        
        // 支持更多语言代码，包括特殊代码
        const validLangs = [
            'en', 'zh', 'ja', 'ko', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ar',
            'und', 'qam', 'qct', 'qht', 'qme', 'qst', 'zxx'
        ];
        
        if (validLangs.includes(langCode)) {
            this.conditions.push(`lang:${langCode}`);
        }
        return this;
    }

    /**
     * 添加URL筛选
     */
    addUrl(urlText) {
        if (!urlText) return this;
        this.conditions.push(`url:${urlText}`);
        return this;
    }

    /**
     * 添加表情符号搜索
     */
    addEmoji(emojiType) {
        if (!emojiType) return this;
        
        const emojiMap = {
            'positive': ':)',
            'negative': ':(',
            'question': '?'
        };
        
        if (emojiMap[emojiType]) {
            this.conditions.push(emojiMap[emojiType]);
        } else {
            this.conditions.push(emojiType);
        }
        return this;
    }

    /**
     * 添加筛选条件
     */
    addFilter(filterType, exclude = false) {
        if (!filterType) return this;

        const validFilters = [
            'verified', 'blue_verified', 'follows', 'social', 'trusted',
            'replies', 'links', 'media', 'images', 'videos', 
            'nativeretweets', 'retweets', 'quote', 'self_threads',
            'has_engagement', 'news', 'safe', 'hashtags'
        ];

        if (!validFilters.includes(filterType)) {
            throw new Error(`无效的筛选类型: ${filterType}`);
        }

        const prefix = exclude ? '-' : '';
        this.conditions.push(`${prefix}filter:${filterType}`);
        return this;
    }

    /**
     * 添加特殊筛选（include操作符）
     */
    addInclude(includeType) {
        if (!includeType) return this;
        
        const validIncludes = ['nativeretweets'];
        if (validIncludes.includes(includeType)) {
            this.conditions.push(`include:${includeType}`);
        }
        return this;
    }

    /**
     * 添加互动数量筛选
     */
    addEngagement(type, count, isMinimum = true) {
        if (!type || count === undefined) return this;

        const validTypes = ['retweets', 'faves', 'likes', 'replies'];
        if (!validTypes.includes(type)) {
            throw new Error(`无效的互动类型: ${type}`);
        }

        // 统一likes和faves
        if (type === 'likes') type = 'faves';

        const prefix = isMinimum ? '' : '-';
        this.conditions.push(`${prefix}min_${type}:${count}`);
        return this;
    }

    /**
     * 添加时间范围
     */
    addTimeRange(options = {}) {
        const {
            since,      // 开始时间 YYYY-MM-DD
            until,      // 结束时间 YYYY-MM-DD
            sinceTime,  // Unix时间戳
            untilTime,  // Unix时间戳
            sinceId,    // 推文ID
            maxId,      // 推文ID
            withinTime, // 相对时间 如 2d, 3h, 5m, 30s
            sinceDateTime, // 精确时间 YYYY-MM-DD_HH:MM:SS_TIMEZONE
            untilDateTime  // 精确时间 YYYY-MM-DD_HH:MM:SS_TIMEZONE
        } = options;

        if (since) {
            this.conditions.push(`since:${since}`);
        }
        
        if (until) {
            this.conditions.push(`until:${until}`);
        }
        
        if (sinceTime) {
            this.conditions.push(`since_time:${sinceTime}`);
        }
        
        if (untilTime) {
            this.conditions.push(`until_time:${untilTime}`);
        }
        
        if (sinceId) {
            this.conditions.push(`since_id:${sinceId}`);
        }
        
        if (maxId) {
            this.conditions.push(`max_id:${maxId}`);
        }
        
        if (withinTime) {
            this.conditions.push(`within_time:${withinTime}`);
        }
        
        if (sinceDateTime) {
            this.conditions.push(`since:${sinceDateTime}`);
        }
        
        if (untilDateTime) {
            this.conditions.push(`until:${untilDateTime}`);
        }

        return this;
    }

    /**
     * 添加地理位置筛选
     */
    addLocation(options = {}) {
        const {
            city,       // 城市名
            near,       // 附近位置
            within,     // 范围半径
            geocode,    // 经纬度坐标 lat,long,radius
            placeId     // 地点ID
        } = options;

        if (city) {
            if (city.includes(' ')) {
                this.conditions.push(`near:"${city}"`);
            } else {
                this.conditions.push(`near:${city}`);
            }
        }
        
        if (near) {
            if (near === 'me') {
                this.conditions.push('near:me');
            } else {
                this.conditions.push(`near:${near}`);
            }
        }
        
        if (within) {
            this.conditions.push(`within:${within}`);
        }
        
        if (geocode) {
            this.conditions.push(`geocode:${geocode}`);
        }
        
        if (placeId) {
            this.conditions.push(`place:${placeId}`);
        }

        return this;
    }

    /**
     * 添加推文类型筛选
     */
    addTweetType(options = {}) {
        const {
            conversationId,  // 推文串ID
            quotedTweetId,   // 被引用推文ID
            quotedUserId,    // 被引用用户ID
            cardName,        // 卡片类型
            cardDomain,      // 卡片域名
            source          // 发布客户端
        } = options;

        if (conversationId) {
            this.conditions.push(`conversation_id:${conversationId}`);
        }
        
        if (quotedTweetId) {
            this.conditions.push(`quoted_tweet_id:${quotedTweetId}`);
        }
        
        if (quotedUserId) {
            this.conditions.push(`quoted_user_id:${quotedUserId}`);
        }
        
        if (cardName) {
            this.conditions.push(`card_name:${cardName}`);
        }
        
        if (cardDomain) {
            this.conditions.push(`card_domain:${cardDomain}`);
        }
        
        if (source) {
            // 处理客户端名称中的空格
            const formattedSource = source.includes(' ') ? `"${source}"` : source.replace(' ', '_');
            this.conditions.push(`source:${formattedSource}`);
        }

        return this;
    }

    /**
     * 构建最终搜索查询
     */
    build() {
        if (this.conditions.length === 0) {
            return '';
        }
        
        return this.conditions.join(' ');
    }

    /**
     * 获取搜索描述
     */
    getDescription() {
        if (this.conditions.length === 0) {
            return '无搜索条件';
        }

        const descriptions = [];
        
        this.conditions.forEach(condition => {
            if (condition.startsWith('from:')) {
                descriptions.push(`来自用户: ${condition.substring(5)}`);
            } else if (condition.startsWith('to:')) {
                descriptions.push(`回复用户: ${condition.substring(3)}`);
            } else if (condition.startsWith('@')) {
                descriptions.push(`提及用户: ${condition.substring(1)}`);
            } else if (condition.startsWith('#')) {
                descriptions.push(`话题标签: ${condition}`);
            } else if (condition.startsWith('$')) {
                descriptions.push(`股票代码: ${condition}`);
            } else if (condition.startsWith('lang:')) {
                descriptions.push(`语言: ${condition.substring(5)}`);
            } else if (condition.startsWith('since:')) {
                descriptions.push(`开始时间: ${condition.substring(6)}`);
            } else if (condition.startsWith('until:')) {
                descriptions.push(`结束时间: ${condition.substring(6)}`);
            } else if (condition.startsWith('filter:')) {
                descriptions.push(`筛选: ${condition.substring(7)}`);
            } else if (condition.startsWith('min_')) {
                descriptions.push(`最少互动: ${condition}`);
            } else if (condition.startsWith('near:')) {
                descriptions.push(`地理位置: ${condition.substring(5)}`);
            } else if (condition.startsWith('"') && condition.endsWith('"')) {
                descriptions.push(`精确短语: ${condition}`);
            } else {
                descriptions.push(`关键词: ${condition}`);
            }
        });

        return descriptions.join(', ');
    }

    /**
     * 保存搜索到历史记录
     */
    saveToHistory(name = null) {
        const query = this.build();
        if (!query) return;

        const historyItem = {
            id: Date.now().toString(),
            name: name || this.getDescription(),
            query: query,
            conditions: [...this.conditions],
            timestamp: new Date().toISOString(),
            user: this.currentUser ? this.currentUser.username : null
        };

        // 避免重复
        const existingIndex = this.searchHistory.findIndex(item => item.query === query);
        if (existingIndex !== -1) {
            this.searchHistory[existingIndex] = historyItem;
        } else {
            this.searchHistory.unshift(historyItem);
        }

        // 限制历史记录数量
        if (this.searchHistory.length > 50) {
            this.searchHistory = this.searchHistory.slice(0, 50);
        }

        this.saveHistoryToStorage();
        return historyItem.id;
    }

    /**
     * 从历史记录加载搜索
     */
    loadFromHistory(historyId) {
        const historyItem = this.searchHistory.find(item => item.id === historyId);
        if (historyItem) {
            this.conditions = [...historyItem.conditions];
            return true;
        }
        return false;
    }

    /**
     * 获取搜索历史
     */
    getHistory() {
        return this.searchHistory;
    }

    /**
     * 清空搜索历史
     */
    clearHistory() {
        this.searchHistory = [];
        this.saveHistoryToStorage();
    }

    /**
     * 保存历史记录到存储
     */
    async saveHistoryToStorage() {
        try {
            await chrome.storage.local.set({
                'xcopilot_search_history': this.searchHistory
            });
        } catch (error) {
            console.error('保存搜索历史失败:', error);
        }
    }

    /**
     * 从存储加载历史记录
     */
    async loadHistoryFromStorage() {
        try {
            const result = await chrome.storage.local.get(['xcopilot_search_history']);
            if (result.xcopilot_search_history) {
                this.searchHistory = result.xcopilot_search_history;
            }
        } catch (error) {
            console.error('加载搜索历史失败:', error);
        }
    }

    /**
     * 获取搜索模板
     */
    getSearchTemplates() {
        return [
            {
                id: 'popular_tweets',
                name: '热门推文',
                description: '查找高互动的推文',
                conditions: ['min_faves:100', 'min_retweets:50', '-filter:replies']
            },
            {
                id: 'recent_media',
                name: '最新媒体',
                description: '最近的图片和视频',
                conditions: ['filter:media', 'within_time:24h']
            },
            {
                id: 'verified_news',
                name: '认证用户新闻',
                description: '来自认证用户的新闻',
                conditions: ['filter:verified', 'filter:news', 'filter:links']
            },
            {
                id: 'user_threads',
                name: '用户推文串',
                description: '用户的推文串',
                conditions: ['filter:self_threads']
            },
            {
                id: 'trending_hashtags',
                name: '热门话题',
                description: '包含话题标签的热门内容',
                conditions: ['filter:hashtags', 'min_faves:50']
            }
        ];
    }

    /**
     * 应用搜索模板
     */
    applyTemplate(templateId) {
        const template = this.templates.find(t => t.id === templateId);
        if (template) {
            this.conditions = [...template.conditions];
            return true;
        }
        return false;
    }

    /**
     * 验证搜索条件
     */
    validate() {
        const errors = [];
        
        // 检查是否有冲突的条件
        const hasFrom = this.conditions.some(c => c.startsWith('from:'));
        const hasTo = this.conditions.some(c => c.startsWith('to:'));
        const hasMention = this.conditions.some(c => c.startsWith('@'));
        
        if (hasFrom && hasTo && hasMention) {
            errors.push('用户条件过多，可能导致搜索结果为空');
        }
        
        // 检查时间范围
        const sinceConditions = this.conditions.filter(c => c.startsWith('since:'));
        const untilConditions = this.conditions.filter(c => c.startsWith('until:'));
        
        if (sinceConditions.length > 1) {
            errors.push('只能设置一个开始时间');
        }
        
        if (untilConditions.length > 1) {
            errors.push('只能设置一个结束时间');
        }
        
        // 检查地理位置
        const nearConditions = this.conditions.filter(c => c.startsWith('near:'));
        const geocodeConditions = this.conditions.filter(c => c.startsWith('geocode:'));
        
        if (nearConditions.length > 1 || geocodeConditions.length > 1) {
            errors.push('只能设置一个地理位置条件');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * 获取搜索建议
     */
    getSuggestions(currentInput = '') {
        const suggestions = [];
        
        // 基于当前输入提供建议
        if (currentInput.startsWith('#')) {
            suggestions.push(
                { type: 'hashtag', text: '#trending', description: '热门话题' },
                { type: 'hashtag', text: '#news', description: '新闻话题' },
                { type: 'hashtag', text: '#tech', description: '科技话题' }
            );
        } else if (currentInput.startsWith('@')) {
            suggestions.push(
                { type: 'mention', text: '@username', description: '提及用户' }
            );
        } else if (currentInput.startsWith('$')) {
            suggestions.push(
                { type: 'cashtag', text: '$AAPL', description: '苹果股票' },
                { type: 'cashtag', text: '$TSLA', description: '特斯拉股票' }
            );
        } else {
            // 通用建议
            suggestions.push(
                { type: 'keyword', text: 'filter:verified', description: '仅认证用户' },
                { type: 'keyword', text: 'filter:media', description: '包含媒体' },
                { type: 'keyword', text: 'min_faves:10', description: '至少10个赞' },
                { type: 'keyword', text: 'lang:en', description: '英文推文' }
            );
        }
        
        return suggestions;
    }

    /**
     * 获取支持的语言列表
     */
    getSupportedLanguages() {
        return [
            { code: 'en', name: '英语' },
            { code: 'zh', name: '中文' },
            { code: 'ja', name: '日语' },
            { code: 'ko', name: '韩语' },
            { code: 'es', name: '西班牙语' },
            { code: 'fr', name: '法语' },
            { code: 'de', name: '德语' },
            { code: 'it', name: '意大利语' },
            { code: 'pt', name: '葡萄牙语' },
            { code: 'ru', name: '俄语' },
            { code: 'ar', name: '阿拉伯语' },
            { code: 'und', name: '未定义语言' },
            { code: 'qam', name: '仅提及' },
            { code: 'qct', name: '仅含股票代码' },
            { code: 'qht', name: '仅含话题标签' },
            { code: 'qme', name: '含媒体链接' },
            { code: 'qst', name: '短文本' },
            { code: 'zxx', name: '仅媒体无文本' }
        ];
    }

    /**
     * 获取支持的卡片类型
     */
    getSupportedCardTypes() {
        return [
            { type: 'poll2choice_text_only', name: '2选项文本投票' },
            { type: 'poll3choice_image', name: '3选项图片投票' },
            { type: 'poll4choice_text_only', name: '4选项文本投票' },
            { type: 'audio', name: '音频卡片' },
            { type: 'animated_gif', name: 'GIF卡片' },
            { type: 'summary', name: '小图摘要卡片' },
            { type: 'summary_large_image', name: '大图摘要卡片' },
            { type: 'player', name: '播放器卡片' },
            { type: 'promo_image_app', name: '推广应用图片卡片' }
        ];
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = XSearchQueryBuilder;
} else if (typeof window !== 'undefined') {
    window.XSearchQueryBuilder = XSearchQueryBuilder;
} 