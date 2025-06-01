/**
 * xCopilot Background Script
 * 后台服务工作者 - 处理数据获取和消息传递
 */

class XCopilotBackground {
    constructor() {
        this.isInitialized = false;
        this.syncInterval = null;
        this.init();
    }

    /**
     * 初始化后台服务
     */
    async init() {
        if (this.isInitialized) return;
        
        try {
            this.setupEventListeners();
            this.setupAlarms();
            await this.initializeStorage();
            this.isInitialized = true;
            console.log('xCopilot Background Service 初始化完成');
        } catch (error) {
            console.error('Background Service 初始化失败:', error);
        }
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 监听插件图标点击
        chrome.action.onClicked.addListener((tab) => {
            this.handleActionClick(tab);
        });

        // 监听消息
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true;
        });

        // 监听安装事件
        chrome.runtime.onInstalled.addListener((details) => {
            this.handleInstall(details);
        });
    }

    /**
     * 处理来自popup的消息
     */
    async handleMessage(request, sender, sendResponse) {
        try {
            switch (request.action) {
                case 'fetchTweets':
                    const tweets = await this.fetchTweets(request.params);
                    sendResponse({ success: true, data: tweets });
                    break;
                
                case 'getUserInfo':
                    const userInfo = await this.getUserInfo();
                    sendResponse({ success: true, data: userInfo });
                    break;
                
                case 'checkAuth':
                    const isAuthenticated = await this.checkAuthentication();
                    sendResponse({ success: true, data: { authenticated: isAuthenticated } });
                    break;
                
                case 'fetchSearchResults':
                    if (!request.query) {
                        sendResponse({ success: false, error: '搜索查询不能为空' });
                        return;
                    }
                    try {
                        const searchUrl = `https://x.com/search?q=${encodeURIComponent(request.query)}&src=typed_query&f=live`;
                        console.log('Background: Fetching URL:', searchUrl);
                        
                        const response = await fetch(searchUrl, {
                            method: 'GET',
                            headers: {
                                // X/Twitter可能会有一些反爬虫机制，这里可以尝试模拟浏览器请求头
                                // 但要注意，过度复杂的请求头也可能被识别
                                // 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                            }
                        });

                        if (!response.ok) {
                            console.error('Background: Fetch failed with status:', response.status, response.statusText);
                            sendResponse({ success: false, error: `获取X搜索页面失败: ${response.status} ${response.statusText}` });
                            return;
                        }

                        const htmlContent = await response.text();
                        console.log('Background: Successfully fetched HTML, length:', htmlContent.length);
                        
                        // 为了节省传输和content script处理的token，只返回HTML片段作为演示
                        const snippet = htmlContent.substring(0, 2000); // 返回前2000个字符作为片段

                        sendResponse({ success: true, htmlContent: htmlContent, htmlSnippet: snippet });

                    } catch (fetchError) {
                        console.error('Background: Error fetching search results:', fetchError);
                        sendResponse({ success: false, error: `抓取X搜索页面时出错: ${fetchError.message}` });
                    }
                    return true;

                default:
                    sendResponse({ success: false, error: '未知的操作类型' });
            }
        } catch (error) {
            console.error('处理消息失败:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * 设置定时器
     */
    setupAlarms() {
        // 清除现有的定时器
        chrome.alarms.clearAll();
        
        // 设置自动同步定时器（每30分钟）
        chrome.alarms.create('autoSync', {
            delayInMinutes: 30,
            periodInMinutes: 30
        });
        
        // 监听定时器事件
        chrome.alarms.onAlarm.addListener((alarm) => {
            if (alarm.name === 'autoSync') {
                this.performAutoSync();
            }
        });
    }

    /**
     * 执行自动同步
     */
    async performAutoSync() {
        try {
            // 检查用户设置是否启用自动同步
            const settings = await this.getSettings();
            if (!settings.autoSync) return;
            
            console.log('执行自动同步...');
            await this.fetchTweets({ count: settings.displayCount || 50 });
        } catch (error) {
            console.error('自动同步失败:', error);
        }
    }

    /**
     * 获取推文数据
     */
    async fetchTweets(params = {}) {
        try {
            // 首先检查是否已认证
            const isAuthenticated = await this.checkAuthentication();
            if (!isAuthenticated) {
                // 如果未认证，返回模拟数据用于演示
                return this.getMockTweets(params.count || 50);
            }
            
            // TODO: 实现真实的Twitter API调用
            // 目前返回模拟数据
            const tweets = this.getMockTweets(params.count || 50);
            
            // 保存到本地存储
            await this.saveTweets(tweets);
            
            return tweets;
        } catch (error) {
            console.error('获取推文失败:', error);
            throw error;
        }
    }

    /**
     * 获取模拟推文数据（用于演示）
     */
    getMockTweets(count) {
        const mockTweets = [];
        const sampleTexts = [
            "刚刚完成了一个很棒的项目，学到了很多新技术！#编程 #学习",
            "今天的天气真不错，适合出去走走 🌞",
            "分享一个有用的开发技巧：使用Chrome DevTools可以大大提高调试效率",
            "正在学习新的JavaScript框架，感觉前端技术发展真快",
            "推荐一本好书：《代码整洁之道》，对提高代码质量很有帮助",
            "参加了一个技术会议，收获满满！遇到了很多志同道合的朋友",
            "开源项目更新了新版本，修复了几个重要的bug",
            "周末计划：整理代码库，优化性能，写技术博客",
            "发现了一个很有趣的API，可以用来做一些创意项目",
            "团队协作的重要性：好的沟通能让项目事半功倍"
        ];
        
        const now = new Date();
        
        for (let i = 0; i < count; i++) {
            const randomHours = Math.floor(Math.random() * 24 * 7); // 最近一周内
            const createdAt = new Date(now.getTime() - randomHours * 60 * 60 * 1000);
            
            const tweet = {
                id: `mock_${Date.now()}_${i}`,
                text: sampleTexts[i % sampleTexts.length],
                createdAt: createdAt.toISOString(),
                likeCount: Math.floor(Math.random() * 100),
                retweetCount: Math.floor(Math.random() * 50),
                replyCount: Math.floor(Math.random() * 20),
                isRetweet: Math.random() < 0.2, // 20%概率是转推
                isReply: Math.random() < 0.15,  // 15%概率是回复
                author: {
                    username: 'demo_user',
                    displayName: '演示用户',
                    avatar: '../assets/icons/default-avatar.png'
                }
            };
            
            mockTweets.push(tweet);
        }
        
        // 按时间倒序排列
        return mockTweets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    /**
     * 获取用户信息
     */
    async getUserInfo() {
        try {
            // TODO: 实现真实的用户信息获取
            return {
                username: 'demo_user',
                displayName: '演示用户',
                avatar: '../assets/icons/default-avatar.png',
                followersCount: 1234,
                followingCount: 567,
                tweetsCount: 890
            };
        } catch (error) {
            console.error('获取用户信息失败:', error);
            throw error;
        }
    }

    /**
     * 检查认证状态
     */
    async checkAuthentication() {
        try {
            // TODO: 实现真实的认证检查
            // 目前返回false，使用模拟数据
            const result = await chrome.storage.local.get(['twitterAuth']);
            return result.twitterAuth && result.twitterAuth.accessToken;
        } catch (error) {
            console.error('检查认证状态失败:', error);
            return false;
        }
    }

    /**
     * 保存推文数据
     */
    async saveTweets(tweets) {
        try {
            await chrome.storage.local.set({
                tweets: tweets,
                lastSync: new Date().toISOString()
            });
            console.log(`已保存 ${tweets.length} 条推文`);
        } catch (error) {
            console.error('保存推文失败:', error);
            throw error;
        }
    }

    /**
     * 获取设置
     */
    async getSettings() {
        try {
            const result = await chrome.storage.sync.get(['settings']);
            return result.settings || {
                theme: 'light',
                autoSync: true,
                displayCount: 50
            };
        } catch (error) {
            console.error('获取设置失败:', error);
            return {
                theme: 'light',
                autoSync: true,
                displayCount: 50
            };
        }
    }

    /**
     * 初始化存储
     */
    async initializeStorage() {
        try {
            // 检查是否是首次安装
            const result = await chrome.storage.local.get(['isFirstRun']);
            
            if (!result.isFirstRun) {
                // 首次运行，设置默认值
                await chrome.storage.local.set({
                    isFirstRun: false,
                    tweets: [],
                    lastSync: null
                });
                
                await chrome.storage.sync.set({
                    settings: {
                        theme: 'light',
                        autoSync: true,
                        displayCount: 50
                    }
                });
                
                console.log('首次运行，已初始化默认设置');
            }
        } catch (error) {
            console.error('初始化存储失败:', error);
        }
    }

    /**
     * 处理Twitter OAuth认证
     */
    async authenticateTwitter() {
        try {
            // TODO: 实现Twitter OAuth流程
            // 这里需要实现完整的OAuth 2.0流程
            console.log('Twitter认证功能待实现');
            throw new Error('Twitter认证功能正在开发中');
        } catch (error) {
            console.error('Twitter认证失败:', error);
            throw error;
        }
    }

    /**
     * 清理过期数据
     */
    async cleanupOldData() {
        try {
            const result = await chrome.storage.local.get(['tweets']);
            if (!result.tweets) return;
            
            const now = new Date();
            const sixMonthsAgo = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000);
            
            // 保留最近6个月的数据
            const filteredTweets = result.tweets.filter(tweet => {
                const tweetDate = new Date(tweet.createdAt);
                return tweetDate >= sixMonthsAgo;
            });
            
            if (filteredTweets.length !== result.tweets.length) {
                await chrome.storage.local.set({ tweets: filteredTweets });
                console.log(`清理了 ${result.tweets.length - filteredTweets.length} 条过期推文`);
            }
        } catch (error) {
            console.error('清理过期数据失败:', error);
        }
    }

    /**
     * 处理插件图标点击
     */
    async handleActionClick(tab) {
        try {
            // 检查是否在Twitter页面
            if (tab.url && (tab.url.includes('twitter.com') || tab.url.includes('x.com'))) {
                // 在Twitter页面，切换侧边栏显示
                try {
                    await chrome.tabs.sendMessage(tab.id, {
                        action: 'toggleSidebar'
                    });
                } catch (error) {
                    console.error('发送消息到content script失败:', error);
                    // 如果content script还没有加载，可能需要重新注入
                    await this.injectContentScript(tab.id);
                }
            }
            // 非Twitter页面会自动显示弹窗（由manifest.json的default_popup处理）
        } catch (error) {
            console.error('处理图标点击失败:', error);
        }
    }

    /**
     * 注入content script
     */
    async injectContentScript(tabId) {
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content/content.js']
            });
        } catch (error) {
            console.error('注入content script失败:', error);
        }
    }

    /**
     * 处理安装事件
     */
    handleInstall(details) {
        console.log('xCopilot 扩展已安装/更新:', details.reason);
        
        if (details.reason === 'install') {
            // 首次安装
            console.log('欢迎使用 xCopilot!');
        } else if (details.reason === 'update') {
            // 更新
            console.log('xCopilot 已更新到新版本');
        }
    }
}

// 监听扩展启动事件
chrome.runtime.onStartup.addListener(() => {
    console.log('xCopilot 扩展已启动');
});

// 初始化后台服务
const backgroundService = new XCopilotBackground(); 