console.log("XCOPILOT: content.js script started execution."); // VERY EARLY LOG
console.log("🚀 XCOPILOT VERSION: 2024-01-20-FIXED"); // VERSION IDENTIFIER

/**
 * xCopilot Content Script
 * 在Twitter页面上运行的内容脚本，用于收集推文数据并替换右侧栏
 */

// XSearchQueryBuilder import is no longer needed as logic is integrated.
// let XSearchQueryBuilder; 

class XCopilotContentScript {
    constructor() {
        console.log("XCOPILOT: XCopilotContentScript constructor started."); // Constructor Start Log
        this.isInitialized = false;
        this.observer = null;
        this.userInfo = null;
        this.sidebar = null;
        this.sidebarVisible = false;
        this.currentUser = null;
        this.originalRightSidebar = null;
        // this.searchBuilder = null; // No longer an external instance

        this.urlCheckInterval = null;
        
        // 初始化好友数据
        this.friends = [];
        this.initializeFriends();
        
        // Initialize debounced function
        this.debouncedHandlePageNavigationOrChange = this._debounce(this.handlePageNavigationOrChange.bind(this), 1000); // 增加到1000ms防抖

        this.init();
    }

    /**
     * Utility to debounce a function
     */
    _debounce(func, delay) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    }

    /**
     * 初始化内容脚本
     */
    async init() {
        console.log("XCOPILOT: XCopilotContentScript init() started.");
        if (this.isInitialized) return;
        
        try {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.setup());
            } else {
                this.setup();
            }
        } catch (error) {
            console.error('xCopilot Content Script 初始化失败:', error);
        }
    }

    /**
     * 设置内容脚本
     */
    setup() {
        try {
            this.setupMessageListener();
            this.startObserving();
            this.startUrlChangeListener();
            
            // Initial detection and sidebar placement
            this.handlePageNavigationOrChange();

            this.isInitialized = true;
            console.log('xCopilot Content Script 已启动并开始监听页面变化');
        } catch (error) {
            console.error('设置内容脚本失败:', error);
        }
    }

    /**
     * 设置消息监听器
     */
    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true;
        });
    }

    /**
     * 处理来自background的消息
     */
    async handleMessage(request, sender, sendResponse) {
        try {
            switch (request.action) {
                case 'getUserInfo':
                    const userInfo = await this.collectUserInfo();
                    sendResponse({ success: true, data: userInfo });
                    break;
                
                case 'scrollToLoadMore':
                    await this.scrollToLoadMore();
                    sendResponse({ success: true });
                    break;
                
                case 'toggleSidebar':
                    this.toggleSidebarVisibility();
                    sendResponse({ success: true });
                    break;
                
                default:
                    sendResponse({ success: false, error: '未知的操作类型' });
            }
        } catch (error) {
            console.error('处理消息失败:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * 开始观察DOM变化
     */
    startObserving() {
        if (this.observer) {
            this.observer.disconnect(); // Disconnect previous observer if any
        }

        this.observer = new MutationObserver((mutations) => {
            let significantChange = false;
            // Removed isTweetProcessingRelevant as processTweetElements is removed

            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    if (mutation.addedNodes.length > 5 || mutation.removedNodes.length > 5) {
                        significantChange = true;
                    }
                    const mainContentArea = document.querySelector('main[role="main"]');
                    if (mainContentArea && (mainContentArea.contains(mutation.target) || Array.from(mutation.addedNodes).some(n => mainContentArea.contains(n)))) {
                        significantChange = true; 
                    }
                    // Removed call to processTweetElements
                } else if (mutation.type === 'attributes') {
                    if (mutation.target === document.body || (mutation.target.id && mutation.target.id === 'react-root')) { 
                    }
                }
                if (significantChange) break; 
            }

            if (significantChange) {
                console.log("MutationObserver detected significant DOM change, re-evaluating sidebar (debounced).");
                this.debouncedHandlePageNavigationOrChange(); 
            }
        });

        // Observe the body for childList and subtree. Attributes can be noisy if too broad.
        // Consider observing a more specific container if identified as X.com's main content root.
        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
            // attributes: true, // Re-evaluate if observing attributes on document.body is too noisy
            // attributeFilter: ['class', 'style'] // Example filter
        });
        console.log("MutationObserver 已启动 (enhanced to detect page changes)");
    }

    /**
     * 新增：监听URL变化
     */
    startUrlChangeListener() {
        let previousUrl = window.location.href;
        // Clear any existing interval to prevent multiple listeners
        if (this.urlCheckInterval) {
            clearInterval(this.urlCheckInterval);
        }
        this.urlCheckInterval = setInterval(() => {
            const currentUrl = window.location.href;
            if (currentUrl !== previousUrl) {
                console.log(`URL changed from ${previousUrl} to ${currentUrl} (debounced)`);
                previousUrl = currentUrl;
                this.debouncedHandlePageNavigationOrChange(); // MODIFIED: Use debounced function
            }
        }, 750); // Check every 750ms - adjust as needed, ensure it's not too frequent
        console.log("URL变化监听器已启动");
    }

    /**
     * 新增：处理页面导航或显著内容变化
     * This function should ideally be async if methods it calls are async.
     */
    async handlePageNavigationOrChange() {
        console.log("Handling page navigation or change...");
        
        // 检查是否已经有正常工作的侧边栏
        const existingSidebar = document.getElementById('xCopilot-sidebar-container');
        const twitterSidebar = this.findTwitterRightSidebar();
        
        if (existingSidebar && twitterSidebar && twitterSidebar.contains(existingSidebar)) {
            console.log("xCopilot sidebar already exists and is properly placed, skipping recreation.");
            this.updateSearchPlaceholder();
            return;
        }
        
        try {
            // 1. 重新检测当前用户/页面状态
            // Assuming detectCurrentUser might become async or already is
            await this.detectCurrentUser(); 

            // 2. (Optional) 重新收集数据 - Consider if this is always needed on navigation
            // For now, let user context drive if tweets need re-collection by other means
            // await this.collectInitialData(); 

            // 3. 确保侧边栏被正确注入/更新
            // Wait for the target sidebar element to be ready
            await this.waitForTwitterSidebar(); // MODIFIED: Wait for sidebar
            
            this.replaceRightSidebar(); // MODIFIED: Call directly

        } catch (error) {
            console.error('处理页面导航或变化时出错:', error);
        }
    }

    /**
     * NEW: Waits for the Twitter right sidebar element to be available in the DOM.
     * Polls for the element with a timeout.
     */
    async waitForTwitterSidebar(timeout = 7000, interval = 250) { // Increased timeout slightly
        console.log("XCOPILOT: Waiting for Twitter native sidebar to be available...");
        return new Promise((resolve, reject) => {
            let elapsedTime = 0;
            const checkInterval = setInterval(() => {
                const sidebarElement = this.findTwitterRightSidebar();
                if (sidebarElement) {
                    clearInterval(checkInterval);
                    console.log("XCOPILOT: Twitter native sidebar found.");
                    resolve(sidebarElement);
                } else {
                    elapsedTime += interval;
                    if (elapsedTime >= timeout) {
                        clearInterval(checkInterval);
                        console.warn("XCOPILOT: Timed out waiting for Twitter native sidebar.");
                        // It's important to resolve rather than reject here if we want
                        // replaceRightSidebar to still attempt, but it will then handle the null case.
                        // Or, we can reject and let the catch in handlePageNavigationOrChange handle it.
                        // For now, let's reject to make the failure explicit at this stage.
                        reject(new Error("Timeout waiting for Twitter sidebar element. xCopilot sidebar might not load."));
                    }
                }
            }, interval);
        });
    }

    /**
     * 收集用户信息
     */
    async collectUserInfo() {
        try {
            // 尝试从页面中提取用户信息
            const profileImage = document.querySelector('[data-testid="UserAvatar-Container-unknown"] img');
            const displayNameEl = document.querySelector('[data-testid="UserName"] span');
            const usernameEl = document.querySelector('[data-testid="UserScreenName"]');
            
            // 从URL中提取用户名
            const urlUsername = window.location.pathname.split('/')[1];

            return {
                username: usernameEl ? usernameEl.textContent.replace('@', '') : urlUsername,
                displayName: displayNameEl ? displayNameEl.textContent : '',
                avatar: profileImage ? profileImage.src : '',
                profileUrl: window.location.origin + '/' + urlUsername
            };
        } catch (error) {
            console.error('收集用户信息失败:', error);
            return null;
        }
    }

    /**
     * 滚动加载更多推文
     */
    async scrollToLoadMore() {
        try {
            const scrollHeight = document.documentElement.scrollHeight;
            window.scrollTo(0, scrollHeight);
            
            // 等待新内容加载
            await this.delay(2000);
            
            // 检查是否有新内容加载
            const newScrollHeight = document.documentElement.scrollHeight;
            return newScrollHeight > scrollHeight;
        } catch (error) {
            console.error('滚动加载失败:', error);
            return false;
        }
    }

    /**
     * 延迟函数
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 清理资源
     */
    cleanup() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        if (this.urlCheckInterval) {
            clearInterval(this.urlCheckInterval);
        }
        this.restoreOriginalSidebar(); 
        console.log('xCopilot Content Script 已清理');
    }

    /**
     * 获取当前登录用户的用户名
     */
    getCurrentLoggedInUser() {
        try {
            // 尝试从页面中获取当前登录用户的信息
            // 方法1: 从导航栏的用户头像链接获取
            const userAvatarLink = document.querySelector('a[data-testid="AppTabBar_Profile_Link"]');
            if (userAvatarLink && userAvatarLink.href) {
                const match = userAvatarLink.href.match(/x\.com\/([^\/\?]+)/);
                if (match && match[1]) {
                    console.log("🔍 ME: Found logged-in user from avatar link:", match[1]);
                    return match[1];
                }
            }
            
            // 方法2: 从侧边栏的用户信息获取
            const sidebarUserLink = document.querySelector('a[data-testid="SideNav_AccountSwitcher_Button"]');
            if (sidebarUserLink) {
                const usernameSpan = sidebarUserLink.querySelector('[data-testid="UserName"] span');
                if (usernameSpan && usernameSpan.textContent.startsWith('@')) {
                    const username = usernameSpan.textContent.replace('@', '');
                    console.log("🔍 ME: Found logged-in user from sidebar:", username);
                    return username;
                }
            }
            
            // 方法3: 尝试从其他可能的位置获取
            const profileLinks = document.querySelectorAll('a[href*="/"]');
            for (const link of profileLinks) {
                if (link.href && link.href.includes('x.com/') && link.getAttribute('aria-label')?.includes('Profile')) {
                    const match = link.href.match(/x\.com\/([^\/\?]+)/);
                    if (match && match[1] && !match[1].startsWith('i/')) {
                        console.log("🔍 ME: Found logged-in user from profile link:", match[1]);
                        return match[1];
                    }
                }
            }
            
            console.log("🔍 ME: Could not determine logged-in user");
            return null;
        } catch (error) {
            console.error("🔍 ME: Error getting logged-in user:", error);
            return null;
        }
    }

    /**
     * 检测当前页面的用户
     */
    async detectCurrentUser() {
        try {
            // 从URL中提取用户名
            const pathParts = window.location.pathname.split('/');
            console.log("🔍 USER_DETECT: URL path parts =", pathParts);
            
            // 定义系统页面路径，这些不是用户名
            const systemPaths = [
                'home', 'search', 'explore', 'notifications', 'messages', 
                'bookmarks', 'lists', 'profile', 'settings', 'help',
                'i', 'compose', 'login', 'signup', 'tos', 'privacy',
                'about', 'download', 'jobs', 'ads', 'business'
            ];
            
            if (pathParts.length >= 2 && pathParts[1] && 
                !pathParts[1].startsWith('i/') && 
                !systemPaths.includes(pathParts[1].toLowerCase())) {
                
                const username = pathParts[1];
                console.log("🔍 USER_DETECT: Potential username =", username);
                
                // 检查是否是用户主页（不是推文详情页等）
                if (!pathParts[2] || pathParts[2] === 'with_replies' || pathParts[2] === 'media' || pathParts[2] === 'likes') {
                    this.currentUser = {
                        username: username,
                        isUserPage: true,
                        isOnUserProfilePage: true
                    };
                    
                    // 尝试获取更多用户信息
                    this.enrichCurrentUserInfo();
                    
                    console.log('🔍 USER_DETECT: 检测到用户页面:', this.currentUser);
                } else if (pathParts[2] === 'status') {
                    // 如果是帖子详情页，设置当前用户为帖子作者
                    this.currentUser = {
                        username: username,
                        isUserPage: false,
                        isOnTweetDetailPage: true
                    };
                    
                    // 尝试获取更多用户信息
                    this.enrichCurrentUserInfo();
                    
                    console.log('🔍 USER_DETECT: 检测到帖子详情页:', this.currentUser);
                } else {
                    // 其他用户相关页面（如followers, following等）
                    const userSubPages = ['followers', 'following', 'likes', 'media', 'with_replies'];
                    if (userSubPages.includes(pathParts[2])) {
                        this.currentUser = {
                            username: username,
                            isUserPage: true,
                            isOnUserProfilePage: false,
                            isOnUserSubPage: true,
                            subPageType: pathParts[2]
                        };
                        
                        this.enrichCurrentUserInfo();
                        
                        console.log('🔍 USER_DETECT: 检测到用户子页面:', this.currentUser);
                    } else {
                        // 不是已知的用户子页面，可能是系统页面
                        this.currentUser = null;
                        console.log('🔍 USER_DETECT: 未知页面类型，清除用户上下文');
                    }
                }
            } else {
                // 清除当前用户信息（如果在首页或其他非用户页面）
                this.currentUser = null;
                console.log('🔍 USER_DETECT: 系统页面或首页，清除用户上下文');
            }
        } catch (error) {
            console.error('检测当前用户失败:', error);
            this.currentUser = null;
        }
    }

    /**
     * 丰富当前用户信息
     */
    async enrichCurrentUserInfo() {
        if (!this.currentUser || !this.currentUser.username) return;

        try {
            await this.delay(500); // Reduced delay, primary info is username from URL

            let displayName = this.currentUser.username; // Default to username
            let avatar = '';
            let bio = '';

            if (this.currentUser.isOnUserProfilePage) {
                // Try to get info from user profile page structure
                const displayNameEl = document.querySelector('div[data-testid="UserName"] span > span');
                const bioEl = document.querySelector('div[data-testid="UserDescription"] span');
                // Avatar selector might be complex, use a more general one or one specific to profile pages
                const avatarEl = document.querySelector(`a[href="/${this.currentUser.username}/photo"] img[alt][draggable]`);
                
                if (displayNameEl) displayName = displayNameEl.textContent.trim();
                if (avatarEl) avatar = avatarEl.src;
                if (bioEl) bio = bioEl.textContent.trim();

            } else if (this.currentUser.isOnTweetDetailPage) {
                // Try to get info from tweet detail page structure
                // Often, the tweet author's display name and avatar are near the tweet content.
                // This requires finding the specific tweet element for the current page.
                // For simplicity, we can try to find the first prominent username and avatar 
                // if the main tweet is easily identifiable.
                // This part can be very fragile due to X.com DOM changes.
                
                // Example: Find the author info of the main tweet on a status page
                // The main tweet on a status page might be within an <article> tag
                const articles = document.querySelectorAll('article[data-testid="tweet"]');
                let mainTweetArticle = null;
                // The main tweet is often the one whose URL matches window.location.pathname
                articles.forEach(article => {
                    const links = article.querySelectorAll('a[href*="/status/"]');
                    links.forEach(link => {
                        if (window.location.pathname.includes(link.getAttribute('href'))) {
                            mainTweetArticle = article;
                        }
                    });
                });

                if (mainTweetArticle) {
                    const userNameEl = mainTweetArticle.querySelector('div[data-testid="User-Name"] span > span');
                    const avatarElInTweet = mainTweetArticle.querySelector('div[data-testid="Tweet-User-Avatar"] img[alt][draggable]');
                    if (userNameEl) displayName = userNameEl.textContent.trim();
                    if (avatarElInTweet) avatar = avatarElInTweet.src;
                    // Bio is not typically available on tweet detail pages directly for the author.
                } else {
                    // Fallback if main tweet author info isn't easily found, rely on URL username
                    // console.log('Could not reliably find main tweet author details on status page.');
                }
            }

            this.currentUser.displayName = displayName;
            this.currentUser.avatar = avatar;
            this.currentUser.bio = bio; // Bio might be empty, especially on tweet detail pages

            // console.log('xCopilot: User info enriched:', this.currentUser);
            this.updateSearchPlaceholder();

        } catch (error) {
            console.error('xCopilot: Error enriching user info:', error);
            // Even if enrichment fails, this.currentUser.username from URL is still valid.
            this.updateSearchPlaceholder();
        }
    }

    /**
     * 更新搜索框占位符
     */
    updateSearchPlaceholder() {
        // This function updates the placeholder for the *general* search input,
        // not the dedicated "current user search" input.
        const generalSearchInput = this.sidebar ? this.sidebar.querySelector('#xcopilot-search-input') : null;

        if (generalSearchInput) {
            if (this.currentUser && this.currentUser.username) {
                // Use displayName if available, otherwise fallback to username
                const nameToShow = this.currentUser.displayName && this.currentUser.displayName !== this.currentUser.username 
                                 ? this.currentUser.displayName 
                                 : this.currentUser.username;
                
                if (this.currentUser.isOnUserProfilePage) {
                    generalSearchInput.placeholder = `搜索 ${nameToShow} 的推文... (或输入 /me 搜索自己)`;
                } else if (this.currentUser.isOnTweetDetailPage) {
                    generalSearchInput.placeholder = `搜索 ${nameToShow} 的推文... (或输入 /me 搜索自己)`;
                } else if (this.currentUser.isOnUserSubPage) {
                    generalSearchInput.placeholder = `搜索 ${nameToShow} 的推文... (或输入 /me 搜索自己)`;
                } else {
                    generalSearchInput.placeholder = `搜索 ${nameToShow} 的推文... (或输入 /me 搜索自己)`;
                }
            } else {
                generalSearchInput.placeholder = '搜索 X 推文... (或输入 /me 搜索自己)';
            }
            
            console.log("🔍 PLACEHOLDER: Updated to =", generalSearchInput.placeholder);
        }
    }

    /**
     * 验证用户上下文是否有效
     */
    isValidUserContext() {
        return this.currentUser && 
               this.currentUser.username && 
               this.currentUser.username.length > 0 &&
               !this.currentUser.username.startsWith('i/') &&
               this.currentUser.username !== 'home' &&
               this.currentUser.username !== 'search' &&
               this.currentUser.username !== 'explore';
    }

    /**
     * 替换Twitter右侧栏
     */
    replaceRightSidebar() {
        console.log("Attempting to replace right sidebar...");
        // The check for _advancedBuildQueryFunc was removed in a previous step as the property itself was removed.

        const twitterRightSidebar = this.findTwitterRightSidebar();

        if (twitterRightSidebar) {
            if (!this.originalRightSidebar) {
                // Store the original sidebar only once
                this.originalRightSidebar = twitterRightSidebar.cloneNode(true);
            }
            
            const existingCopilotSidebar = document.getElementById('xCopilot-sidebar-container');
            if (existingCopilotSidebar && existingCopilotSidebar.parentElement === twitterRightSidebar.parentElement) {
                console.log("xCopilot sidebar already exists in the correct parent. Ensuring it's visible and updated.");
                this.sidebar = existingCopilotSidebar; 
                this.showSidebar(); 
                this.updateSearchPlaceholder(); 
                // 重新设置事件监听器，确保它们正常工作
                setTimeout(() => {
                    this.setupSidebarEvents();
                }, 100);
                return; 
            }

            console.log("Original Twitter right sidebar found. Replacing with xCopilot sidebar.");
            twitterRightSidebar.innerHTML = ''; 

            if (!this.sidebar || !document.body.contains(this.sidebar)) { 
                // If sidebar doesn't exist or was detached from DOM, create/recreate it.
                this.sidebar = this.createReplacementSidebar();
                this.injectReplacementStyles(); 
            } else {
                // If this.sidebar DOM element exists but maybe needs to be moved or its content refreshed
                // For now, we assume createReplacementSidebar gives us the correct, up-to-date element
                // And if it was just detached, it will be re-appended. If it needs internal update, that should be handled within createReplacementSidebar or a dedicated update method.
                 console.log("Sidebar element exists, ensuring it is properly attached and updated.");
            }
            
            twitterRightSidebar.appendChild(this.sidebar);
            this.showSidebar(); 
            
            // 延迟设置事件监听器，确保DOM元素已经完全插入
            setTimeout(() => {
                this.setupSidebarEvents();
            }, 200);

        } else {
            console.warn("Twitter 右侧栏未找到。xCopilot 侧边栏无法注入。");
            if (this.sidebar && !document.body.contains(this.sidebar)) {
                this.sidebar = null; // Clear reference if it was removed from DOM
            }
        }
        this.updateSearchPlaceholder(); 
    }

    /**
     * 查找Twitter原生右侧栏 (Selectors might need updates for X.com changes)
     */
    findTwitterRightSidebar() {
        // Try a few known selectors for Twitter/X's right sidebar area
        let sidebar = document.querySelector('[data-testid="sidebarColumn"]');
        if (sidebar) return sidebar;

        // Fallback to structural search if testid is not found or changes
        sidebar = this.findRightSidebarByStructure();
        if (sidebar) return sidebar;
        
        console.warn("Standard right sidebar selectors failed.");
        return null;
    }
    
    /**
     * 通过页面结构尝试定位右侧栏
     */
    findRightSidebarByStructure(){
        // This is a heuristic approach and might need frequent updates
        const mainContentArea = document.querySelector('main[role="main"]');
        if (mainContentArea) {
            const potentialSidebars = mainContentArea.querySelectorAll('div[style*="width: 290px"], div[style*="width: 350px"]');
            for (let el of potentialSidebars) {
                if (this.isLikelyRightSidebar(el)) {
                    console.log("Found potential sidebar by structure:", el);
                    return el;
                }
            }
        }
        // Try looking for elements that are typically siblings to the main tweet feed
        const primaryColumn = document.querySelector('div[data-testid="primaryColumn"]');
        if (primaryColumn && primaryColumn.nextElementSibling) {
             if (this.isLikelyRightSidebar(primaryColumn.nextElementSibling)) {
                console.log("Found potential sidebar as sibling to primaryColumn:", primaryColumn.nextElementSibling);
                return primaryColumn.nextElementSibling;
             }
        }
        return null;
    }

    /**
     * 判断一个元素是否可能是目标右侧栏
     */
    isLikelyRightSidebar(element) {
        if (!element || typeof element.getBoundingClientRect !== 'function') return false;
        const rect = element.getBoundingClientRect();
        // Check position (should be on the right) and some dimension constraints
        return rect.width > 250 && rect.width < 400 && rect.height > 300 && rect.left > (window.innerWidth / 2);
    }

    /**
     * 创建替换用的侧边栏元素
     */
    createReplacementSidebar() {
        console.log("Creating new xCopilot sidebar element (Simplified)...");
        
        let sidebarContainer = document.getElementById('xCopilot-sidebar-container');
        if (sidebarContainer && !sidebarContainer.parentElement) {
            console.log("Re-using detached xCopilot-sidebar-container.");
            // Clear its content for the new simple structure
            sidebarContainer.innerHTML = ''; 
        } else if (sidebarContainer) {
            // If it exists and is attached, clear it for the new simple structure
             sidebarContainer.innerHTML = '';
        } else {
            // If it doesn't exist at all, create it
            sidebarContainer = document.createElement('div');
            sidebarContainer.id = 'xCopilot-sidebar-container'; 
            sidebarContainer.classList.add('xcopilot-sidebar'); 
        }
        
        // Common styles (can be moved to injectReplacementStyles if not already there)
        sidebarContainer.style.height = '100vh'; 
        sidebarContainer.style.overflowY = 'auto';
        sidebarContainer.style.padding = '10px';
        sidebarContainer.style.pointerEvents = 'auto';
        sidebarContainer.style.position = 'relative';
        sidebarContainer.style.zIndex = '996';

        // Simplified HTML structure for simple search only
        sidebarContainer.innerHTML = `
            <div id="xcopilot-header">
                <div class="header-brand">
                    <h3 class="brand-name">xCopilot</h3>
                    <span class="version-badge">v0.1.1</span>
                </div>
                <a href="https://x.com/vista8" target="_blank" class="author-link" title="关注作者 @vista8">
                    👨‍💻
                </a>
            </div>
            <div id="xcopilot-simple-search-section">
                <input type="text" id="xcopilot-search-input" placeholder="搜索 X 推文...">
                <button id="xcopilot-simple-search-btn">搜索</button>
            </div>
            <div id="xcopilot-friends-section">
                <div class="friends-header">
                    <h4>特别关注</h4>
                    <button id="manage-friends-btn" title="管理好友">⚙️</button>
                </div>
                <div id="xcopilot-friends-list">
                    <!-- 好友列表将通过JavaScript动态生成 -->
                </div>
            </div>
        `;
        
        // 渲染好友列表
        setTimeout(() => {
            this.renderFriendsList();
        }, 100);

        console.log("👥 FRIENDS: Created sidebar with friends");
        return sidebarContainer;
    }
    
    /**
     * 删除好友
     */
    async deleteFriend(id) {
        const index = this.friends.findIndex(f => f.id === id);
        if (index === -1) {
            throw new Error("好友不存在");
        }
        
        const deletedFriend = this.friends.splice(index, 1)[0];
        await this.saveFriends();
        this.renderFriendsList();
        
        console.log("👥 FRIENDS: Deleted friend:", deletedFriend);
        return deletedFriend;
    }
    
    /**
     * 更新好友信息
     */
    async updateFriend(id, name, username) {
        const friend = this.friends.find(f => f.id === id);
        if (!friend) {
            throw new Error("好友不存在");
        }
        
        if (!name || !username) {
            throw new Error("姓名和用户名不能为空");
        }
        
        // 检查用户名是否与其他好友冲突
        const existingFriend = this.friends.find(f => f.id !== id && f.username.toLowerCase() === username.toLowerCase());
        if (existingFriend) {
            throw new Error("该用户名已被其他好友使用");
        }
        
        friend.name = name.trim();
        friend.username = username.trim().replace('@', '');
        
        await this.saveFriends();
        this.renderFriendsList();
        
        console.log("👥 FRIENDS: Updated friend:", friend);
        return friend;
    }
    
    /**
     * 按名称排序好友
     */
    async sortFriends() {
        this.friends.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
        await this.saveFriends();
        this.renderFriendsList();
        console.log("👥 FRIENDS: Sorted by name");
    }
    
    /**
     * 重置为默认好友列表
     */
    async resetFriends() {
        this.friends = this.getDefaultFriends();
        await this.saveFriends();
        this.renderFriendsList();
        this.renderEditableFriendsList();
        console.log("👥 FRIENDS: Reset to default");
    }
    
    /**
     * 移动好友位置
     */
    async moveFriend(id, direction) {
        const index = this.friends.findIndex(f => f.id === id);
        if (index === -1) return;
        
        let newIndex;
        if (direction === 'up' && index > 0) {
            newIndex = index - 1;
        } else if (direction === 'down' && index < this.friends.length - 1) {
            newIndex = index + 1;
        } else {
            return; // 无法移动
        }
        
        // 交换位置
        [this.friends[index], this.friends[newIndex]] = [this.friends[newIndex], this.friends[index]];
        
        await this.saveFriends();
        this.renderFriendsList();
        console.log("👥 FRIENDS: Moved friend", direction);
    }

    /**
     * 渲染好友列表
     */
    renderFriendsList() {
        const friendsList = document.getElementById('xcopilot-friends-list');
        if (!friendsList) return;
        
        friendsList.innerHTML = '';
        
        // 预定义的头像颜色
        const avatarColors = [
            'linear-gradient(135deg, #1d9bf0 0%, #1a8cd8 100%)', // 蓝色
            'linear-gradient(135deg, #00ba7c 0%, #00a86b 100%)', // 绿色
            'linear-gradient(135deg, #f4212e 0%, #dc1c2e 100%)', // 红色
            'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)', // 橙色
            'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', // 紫色
            'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', // 青色
            'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', // 黄色
            'linear-gradient(135deg, #ec4899 0%, #db2777 100%)', // 粉色
        ];
        
        this.friends.forEach((friend, index) => {
            const friendItem = document.createElement('div');
            friendItem.className = 'friend-item';
            friendItem.dataset.username = friend.username;
            friendItem.dataset.name = friend.name;
            friendItem.dataset.id = friend.id;
            
            // 根据索引选择颜色，循环使用
            const avatarColor = avatarColors[index % avatarColors.length];
            
            friendItem.innerHTML = `
                <div class="friend-avatar" style="background: ${avatarColor}">
                    <span class="avatar-text">${friend.name.charAt(0)}</span>
                </div>
                <div class="friend-info">
                    <span class="friend-name">${friend.name}</span>
                    <span class="friend-username">@${friend.username}</span>
                </div>
                <div class="friend-actions">
                    <button class="copy-btn" title="复制@用户名">📋</button>
                </div>
            `;
            
            friendsList.appendChild(friendItem);
        });
        
        console.log("👥 FRIENDS: Rendered friends list with", this.friends.length, "friends");
    }
    
    /**
     * 渲染可编辑的好友列表
     */
    renderEditableFriendsList() {
        const editableList = document.getElementById('editable-friends-list');
        if (!editableList) return;
        
        editableList.innerHTML = '';
        
        this.friends.forEach((friend, index) => {
            const editableItem = document.createElement('div');
            editableItem.className = 'editable-friend-item';
            editableItem.dataset.id = friend.id;
            
            editableItem.innerHTML = `
                <input type="text" class="edit-name" value="${friend.name}" placeholder="显示名称">
                <input type="text" class="edit-username" value="${friend.username}" placeholder="用户名">
                <div class="edit-actions">
                    ${index > 0 ? '<button class="move-btn" data-direction="up" title="上移">↑</button>' : ''}
                    ${index < this.friends.length - 1 ? '<button class="move-btn" data-direction="down" title="下移">↓</button>' : ''}
                    <button class="save-btn" title="保存">💾</button>
                    <button class="delete-btn" title="删除">🗑️</button>
                </div>
            `;
            
            editableList.appendChild(editableItem);
        });
        
        console.log("👥 FRIENDS: Rendered editable friends list");
    }
    
    /**
     * 设置侧边栏元素的事件监听器
     */
    setupSidebarEvents() {
        console.log("XCOPILOT: Setting up sidebar events...");
        
        const simpleSearchBtn = document.getElementById('xcopilot-simple-search-btn');
        const searchInput = document.getElementById('xcopilot-search-input');
        
        console.log("XCOPILOT: Found elements - Button:", !!simpleSearchBtn, "Input:", !!searchInput);
        
        // 如果元素没有找到，尝试重试
        if (!simpleSearchBtn || !searchInput) {
            console.log("XCOPILOT: Elements not found, retrying in 500ms...");
            setTimeout(() => {
                this.setupSidebarEvents();
            }, 500);
            return;
        }
        
        // 检查是否已经设置过事件监听器
        if (searchInput && searchInput.dataset.eventsSetup === 'true') {
            console.log("XCOPILOT: Events already set up for this input, skipping...");
            return;
        }
        
        // 简化的搜索函数
        const performSearch = () => {
            console.log("🔍 SEARCH: Starting search...");
            
            if (!searchInput) {
                console.error("❌ SEARCH: Search input not found!");
                return;
            }
            
            const query = searchInput.value ? searchInput.value.trim() : '';
            console.log("🔍 SEARCH: Original query =", query);
            
            if (!query) {
                console.log("❌ SEARCH: Empty query, aborting");
                alert("请输入搜索关键词");
                return;
            }
            
            let finalQuery = query;
            
            // 检查是否是 /me 命令
            if (query.toLowerCase().startsWith('/me ')) {
                const searchTerm = query.substring(4).trim(); // 移除 "/me " 前缀
                if (!searchTerm) {
                    alert("请在 /me 后面输入搜索关键词，如：/me 今天的想法");
                    return;
                }
                
                // 获取当前登录用户
                const loggedInUser = this.getCurrentLoggedInUser();
                if (loggedInUser) {
                    finalQuery = `${searchTerm} from:${loggedInUser}`;
                    console.log("🔍 SEARCH: /me command detected, searching own content:", finalQuery);
                } else {
                    alert("无法获取当前登录用户信息，请确保已登录X账号");
                    return;
                }
            } else {
                // 原有的用户上下文逻辑
                if (this.currentUser && this.currentUser.username && this.isValidUserContext()) {
                    // 如果在用户页面或推文详情页，添加用户限定条件
                    if (this.currentUser.isOnUserProfilePage || 
                        this.currentUser.isOnTweetDetailPage || 
                        this.currentUser.isOnUserSubPage) {
                        
                        finalQuery = `${query} from:${this.currentUser.username}`;
                        console.log("🔍 SEARCH: Added user context, final query =", finalQuery);
                    } else {
                        console.log("🔍 SEARCH: User detected but not on user-specific page, using original query");
                    }
                } else {
                    console.log("🔍 SEARCH: No valid user context, using original query");
                }
            }
            
            // 构建搜索URL
            const searchUrl = `https://x.com/search?q=${encodeURIComponent(finalQuery)}&f=top`;
            console.log("🔍 SEARCH: URL =", searchUrl);
            
            // 添加视觉反馈
            if (simpleSearchBtn) {
                simpleSearchBtn.textContent = "搜索中...";
                simpleSearchBtn.disabled = true;
            }
            
            // 简单直接的跳转
            console.log("🔍 SEARCH: Navigating...");
            try {
                window.location.href = searchUrl;
            } catch (error) {
                console.error("❌ SEARCH: Navigation failed:", error);
                // 恢复按钮状态
                if (simpleSearchBtn) {
                    simpleSearchBtn.textContent = "搜索";
                    simpleSearchBtn.disabled = false;
                }
            }
        };
        
        // 设置按钮点击事件
        if (simpleSearchBtn) {
            console.log("XCOPILOT: Setting up button click event");
            simpleSearchBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log("🔍 BUTTON: Clicked!");
                performSearch();
            });
        }
        
        // 设置输入框事件
        if (searchInput) {
            console.log("XCOPILOT: Setting up input events");
            
            // 标记已设置事件监听器
            searchInput.dataset.eventsSetup = 'true';
            
            // 回车键搜索
            searchInput.addEventListener('keypress', (e) => {
                console.log("⌨️ KEY: Pressed", e.key);
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log("⌨️ ENTER: Detected!");
                    performSearch();
                }
            });
            
            // 也监听keydown作为备选
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log("⌨️ ENTER (keydown): Detected!");
                    performSearch();
                }
            });
            
            // 输入时恢复按钮状态
            searchInput.addEventListener('input', () => {
                if (simpleSearchBtn && simpleSearchBtn.disabled) {
                    simpleSearchBtn.textContent = "搜索";
                    simpleSearchBtn.disabled = false;
                }
            });
            
            console.log("XCOPILOT: Input events set up successfully");
        }
        
        // 设置好友模块事件
        this.setupFriendsEvents();
        
        console.log("XCOPILOT: All sidebar events set up successfully");
    }

    /**
     * 设置好友模块的事件监听器
     */
    setupFriendsEvents() {
        console.log("XCOPILOT: Setting up friends events...");
        
        // 设置管理按钮事件 - 改为打开弹层
        const manageFriendsBtn = document.getElementById('manage-friends-btn');
        
        if (manageFriendsBtn) {
            manageFriendsBtn.addEventListener('click', () => {
                this.createFriendsManagementModal();
                console.log("👥 FRIENDS: Opened management modal");
            });
        }
        
        // 设置好友项点击事件（跳转到用户页面）
        const friendItems = document.querySelectorAll('.friend-item');
        friendItems.forEach(item => {
            const username = item.dataset.username;
            const name = item.dataset.name;
            
            item.addEventListener('click', (e) => {
                // 如果点击的是复制按钮，不触发跳转
                if (e.target.classList.contains('copy-btn')) {
                    return;
                }
                
                console.log(`🔗 FRIEND: Navigating to @${username} (${name})`);
                const userUrl = `https://x.com/${username}`;
                window.open(userUrl, '_blank');
            });
        });
        
        // 设置复制按钮事件
        const copyBtns = document.querySelectorAll('.copy-btn');
        copyBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation(); // 阻止冒泡到父元素
                
                const friendItem = btn.closest('.friend-item');
                const username = friendItem.dataset.username;
                const name = friendItem.dataset.name;
                
                try {
                    // 复制@用户名到剪贴板
                    const textToCopy = `@${username}`;
                    await navigator.clipboard.writeText(textToCopy);
                    
                    console.log(`📋 COPY: Copied "${textToCopy}" for ${name}`);
                    
                    // 显示复制成功的视觉反馈
                    btn.classList.add('copied');
                    btn.textContent = '';
                    
                    // 2秒后恢复原状
                    setTimeout(() => {
                        btn.classList.remove('copied');
                        btn.textContent = '📋';
                    }, 2000);
                    
                } catch (error) {
                    console.error('📋 COPY: Failed to copy to clipboard:', error);
                    
                    // 如果剪贴板API失败，尝试使用传统方法
                    try {
                        const textArea = document.createElement('textarea');
                        textArea.value = `@${username}`;
                        document.body.appendChild(textArea);
                        textArea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textArea);
                        
                        console.log(`📋 COPY: Fallback copy successful for @${username}`);
                        
                        // 显示成功反馈
                        btn.classList.add('copied');
                        btn.textContent = '';
                        setTimeout(() => {
                            btn.classList.remove('copied');
                            btn.textContent = '📋';
                        }, 2000);
                        
                    } catch (fallbackError) {
                        console.error('📋 COPY: Fallback copy also failed:', fallbackError);
                        alert(`复制失败，请手动复制：@${username}`);
                    }
                }
            });
        });
        
        console.log("XCOPILOT: Friends events set up successfully");
    }

    injectReplacementStyles() {
        const styleId = 'xcopilot-styles';
        if (document.getElementById(styleId)) {
            // Remove existing styles to update them
            document.getElementById(styleId).remove();
        }

        const styles = `
            .xcopilot-sidebar {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                font-size: 15px;
                color: #0f1419;
                background: #ffffff;
                padding: 20px 16px;
                box-sizing: border-box;
                min-height: 100vh;
                pointer-events: auto !important;
                position: relative;
                z-index: 997;
                width: 320px;
                max-width: 320px;
                overflow-x: hidden;
            }
            
            #xcopilot-header {
                margin-bottom: 24px;
                pointer-events: auto;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            
            .header-brand {
                display: flex;
                align-items: center;
                gap: 8px;
                flex: 1;
                min-width: 0;
            }
            
            .brand-name {
                margin: 0;
                font-size: 20px;
                font-weight: 700;
                color: #0f1419;
                letter-spacing: -0.01em;
                line-height: 1.2;
                background: linear-gradient(135deg, #1d9bf0 0%, #1a8cd8 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            
            .version-badge {
                background: linear-gradient(135deg, #00ba7c 0%, #00a86b 100%);
                color: #ffffff;
                font-size: 10px;
                font-weight: 600;
                padding: 2px 6px;
                border-radius: 8px;
                line-height: 1;
                letter-spacing: 0.5px;
                flex-shrink: 0;
            }
            
            .author-link {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                background: #f7f9fa;
                display: flex;
                align-items: center;
                justify-content: center;
                text-decoration: none;
                font-size: 16px;
                transition: all 0.2s ease;
                flex-shrink: 0;
                border: 2px solid transparent;
            }
            
            .author-link:hover {
                background: #1d9bf0;
                border-color: #1d9bf0;
                transform: scale(1.1);
                box-shadow: 0 4px 12px rgba(29, 155, 240, 0.3);
            }
            
            #xcopilot-simple-search-section {
                position: relative;
                pointer-events: auto;
                margin-bottom: 24px;
            }
            
            #xcopilot-search-input {
                width: 100%;
                padding: 14px 16px;
                border: 2px solid #eff3f4;
                border-radius: 16px;
                box-sizing: border-box;
                font-size: 15px;
                color: #0f1419;
                background: #ffffff;
                transition: all 0.2s ease;
                outline: none;
                font-family: inherit;
                line-height: 1.4;
                pointer-events: auto;
                user-select: text;
                cursor: text;
                margin-bottom: 12px;
            }
            
            #xcopilot-search-input::placeholder {
                color: #657786;
                font-weight: 400;
            }
            
            #xcopilot-search-input:focus {
                border-color: #1d9bf0;
                box-shadow: 0 0 0 1px #1d9bf0;
                background: #ffffff;
            }
            
            #xcopilot-search-input:hover:not(:focus) {
                border-color: #cfd9de;
                background: #f7f9fa;
            }
            
            #xcopilot-simple-search-btn {
                width: 100%;
                padding: 14px 24px;
                background: linear-gradient(135deg, #1d9bf0 0%, #1a8cd8 100%);
                color: #ffffff;
                border: none;
                border-radius: 16px;
                font-weight: 600;
                font-size: 15px;
                cursor: pointer;
                transition: all 0.2s ease;
                font-family: inherit;
                letter-spacing: 0.01em;
                box-shadow: 0 2px 8px rgba(29, 155, 240, 0.15);
                position: relative;
                overflow: hidden;
            }
            
            #xcopilot-simple-search-btn:hover {
                background: linear-gradient(135deg, #1a8cd8 0%, #1570b8 100%);
                box-shadow: 0 4px 12px rgba(29, 155, 240, 0.25);
                transform: translateY(-1px);
            }
            
            #xcopilot-simple-search-btn:active {
                transform: translateY(0);
                box-shadow: 0 2px 6px rgba(29, 155, 240, 0.2);
            }
            
            #xcopilot-simple-search-btn:focus {
                outline: none;
                box-shadow: 0 0 0 2px rgba(29, 155, 240, 0.2), 0 4px 12px rgba(29, 155, 240, 0.25);
            }
            
            #xcopilot-simple-search-btn:disabled {
                background: linear-gradient(135deg, #657786 0%, #536471 100%);
                cursor: not-allowed;
                transform: none;
                box-shadow: 0 2px 4px rgba(101, 119, 134, 0.1);
            }
            
            /* 快速@好友模块样式 */
            #xcopilot-friends-section {
                padding-top: 20px;
                border-top: 1px solid #eff3f4;
            }
            
            .friends-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 16px;
            }
            
            .friends-header h4 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
                color: #0f1419;
                letter-spacing: -0.01em;
            }
            
            #manage-friends-btn {
                width: 28px;
                height: 28px;
                border: none;
                background: #f7f9fa;
                border-radius: 6px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                transition: all 0.2s ease;
                color: #657786;
                flex-shrink: 0;
            }
            
            #manage-friends-btn:hover {
                background: #eff3f4;
                color: #0f1419;
                transform: scale(1.05);
            }
            
            #xcopilot-friends-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .friend-item {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px;
                background: #f7f9fa;
                border-radius: 8px;
                transition: all 0.2s ease;
                cursor: pointer;
                border: 1px solid transparent;
                min-height: 44px;
                box-sizing: border-box;
                position: relative;
                width: 100%;
                overflow: hidden;
            }
            
            .friend-item:hover {
                background: #eff3f4;
                border-color: #cfd9de;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
            }
            
            .friend-item:hover .copy-btn {
                opacity: 1;
                visibility: visible;
            }
            
            .friend-avatar {
                width: 28px;
                height: 28px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }
            
            .avatar-text {
                color: #ffffff;
                font-size: 12px;
                font-weight: 700;
                line-height: 1;
            }
            
            .friend-info {
                display: flex;
                flex-direction: column;
                gap: 2px;
                flex: 1;
                min-width: 0;
                overflow: hidden;
                margin-right: 24px;
            }
            
            .friend-name {
                font-size: 12px;
                font-weight: 600;
                color: #0f1419;
                line-height: 1.2;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .friend-username {
                font-size: 11px;
                color: #657786;
                line-height: 1.2;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .friend-actions {
                position: absolute;
                top: 50%;
                right: 8px;
                transform: translateY(-50%);
                display: flex;
                align-items: center;
                justify-content: center;
                width: 20px;
                height: 20px;
            }
            
            .copy-btn {
                width: 20px;
                height: 20px;
                border: none;
                background: #ffffff;
                border-radius: 4px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                transition: all 0.2s ease;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                opacity: 0;
                visibility: hidden;
            }
            
            .copy-btn:hover {
                background: #1d9bf0;
                color: #ffffff;
                transform: scale(1.1);
                box-shadow: 0 2px 8px rgba(29, 155, 240, 0.3);
            }
            
            .copy-btn:active {
                transform: scale(0.95);
            }
            
            .copy-btn.copied {
                background: #00ba7c;
                color: #ffffff;
            }
            
            .copy-btn.copied::after {
                content: "✓";
                font-size: 12px;
            }
            
            /* 好友管理弹层样式 - 完全重新设计 */
            .xcopilot-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s ease;
            }
            
            .xcopilot-modal.show {
                opacity: 1;
                visibility: visible;
            }
            
            .modal-backdrop {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(4px);
            }
            
            .modal-content {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 90%;
                max-width: 900px;
                max-height: 90vh;
                background: #ffffff;
                border-radius: 20px;
                box-shadow: 0 25px 80px rgba(0, 0, 0, 0.3);
                overflow: hidden;
                display: flex;
                flex-direction: column;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            }
            
            .modal-header {
                background: linear-gradient(135deg, #1d9bf0 0%, #1a8cd8 100%);
                color: #ffffff;
                padding: 24px 32px;
                border-bottom: none;
                position: relative;
            }
            
            .header-content h2 {
                margin: 0 0 8px 0;
                font-size: 24px;
                font-weight: 700;
                letter-spacing: -0.02em;
            }
            
            .header-subtitle {
                margin: 0;
                font-size: 14px;
                opacity: 0.9;
                font-weight: 400;
            }
            
            .close-btn {
                position: absolute;
                top: 20px;
                right: 20px;
                width: 40px;
                height: 40px;
                border: none;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #ffffff;
                transition: all 0.2s ease;
                backdrop-filter: blur(10px);
            }
            
            .close-btn:hover {
                background: rgba(255, 255, 255, 0.3);
                transform: scale(1.1);
            }
            
            /* Tab 导航样式 */
            .tab-navigation {
                display: flex;
                background: #f8fafc;
                border-bottom: 1px solid #e2e8f0;
                padding: 0;
                margin: 0;
            }
            
            .tab-btn {
                flex: 1;
                padding: 16px 24px;
                border: none;
                background: transparent;
                color: #64748b;
                font-size: 15px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                border-bottom: 3px solid transparent;
                font-family: inherit;
                position: relative;
            }
            
            .tab-btn:hover {
                background: rgba(29, 155, 240, 0.05);
                color: #1d9bf0;
            }
            
            .tab-btn.active {
                background: #ffffff;
                color: #1d9bf0;
                border-bottom-color: #1d9bf0;
                box-shadow: 0 -2px 8px rgba(29, 155, 240, 0.1);
            }
            
            .tab-btn svg {
                transition: transform 0.2s ease;
            }
            
            .tab-btn:hover svg,
            .tab-btn.active svg {
                transform: scale(1.1);
            }
            
            /* Tab 内容样式 */
            .tab-content {
                display: none;
                animation: fadeIn 0.3s ease;
            }
            
            .tab-content.active {
                display: block;
            }
            
            @keyframes fadeIn {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            /* 成功提示样式 */
            .success-message {
                margin-top: 20px;
                padding: 16px 20px;
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                color: #ffffff;
                border-radius: 12px;
                display: flex;
                align-items: center;
                gap: 12px;
                font-weight: 500;
                box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
                animation: slideInUp 0.3s ease;
            }
            
            .success-message.hidden {
                display: none;
            }
            
            .success-message svg {
                flex-shrink: 0;
            }
            
            @keyframes slideInUp {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .modal-body {
                flex: 1;
                overflow-y: auto;
                padding: 0;
            }
            
            .add-friend-section {
                padding: 32px;
                background: #f8fafc;
                border-bottom: 1px solid #e2e8f0;
            }
            
            .section-title {
                margin-bottom: 24px;
            }
            
            .section-title h3 {
                margin: 0 0 8px 0;
                font-size: 20px;
                font-weight: 600;
                color: #1e293b;
                letter-spacing: -0.01em;
            }
            
            .section-description {
                margin: 0;
                font-size: 14px;
                color: #64748b;
                line-height: 1.5;
            }
            
            .add-friend-form {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                align-items: end;
            }
            
            .form-group {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .form-group label {
                font-size: 14px;
                font-weight: 600;
                color: #374151;
                margin: 0;
            }
            
            .form-group input {
                padding: 12px 16px;
                border: 2px solid #e5e7eb;
                border-radius: 12px;
                font-size: 15px;
                background: #ffffff;
                transition: all 0.2s ease;
                font-family: inherit;
            }
            
            .form-group input:focus {
                outline: none;
                border-color: #1d9bf0;
                box-shadow: 0 0 0 3px rgba(29, 155, 240, 0.1);
            }
            
            .input-with-prefix {
                position: relative;
                display: flex;
                align-items: center;
                border: 2px solid #e5e7eb;
                border-radius: 12px;
                background: #ffffff;
                transition: all 0.2s ease;
            }
            
            .input-with-prefix:focus-within {
                border-color: #1d9bf0;
                box-shadow: 0 0 0 3px rgba(29, 155, 240, 0.1);
            }
            
            .input-prefix {
                padding: 12px 0 12px 16px;
                color: #6b7280;
                font-size: 15px;
                font-weight: 500;
            }
            
            .input-with-prefix input {
                flex: 1;
                padding: 12px 16px 12px 0;
                border: none;
                background: transparent;
                font-size: 15px;
            }
            
            .input-with-prefix input:focus {
                outline: none;
                box-shadow: none;
            }
            
            .primary-btn {
                grid-column: span 2;
                padding: 14px 24px;
                background: linear-gradient(135deg, #1d9bf0 0%, #1a8cd8 100%);
                color: #ffffff;
                border: none;
                border-radius: 12px;
                font-size: 15px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                font-family: inherit;
                letter-spacing: 0.01em;
            }
            
            .primary-btn:hover {
                background: linear-gradient(135deg, #1a8cd8 0%, #1570b8 100%);
                transform: translateY(-1px);
                box-shadow: 0 8px 25px rgba(29, 155, 240, 0.3);
            }
            
            .primary-btn:active {
                transform: translateY(0);
            }
            
            .friends-list-section {
                padding: 32px;
            }
            
            .section-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 24px;
                flex-wrap: wrap;
                gap: 16px;
            }
            
            .section-header .section-title {
                margin: 0;
                flex: 1;
            }
            
            .friends-count {
                font-size: 14px;
                color: #64748b;
                font-weight: 500;
            }
            
            .management-actions {
                display: flex;
                gap: 12px;
            }
            
            .secondary-btn,
            .danger-btn {
                padding: 10px 16px;
                border: 2px solid;
                border-radius: 10px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                gap: 6px;
                font-family: inherit;
            }
            
            .secondary-btn {
                background: #ffffff;
                border-color: #1d9bf0;
                color: #1d9bf0;
            }
            
            .secondary-btn:hover {
                background: #1d9bf0;
                color: #ffffff;
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(29, 155, 240, 0.3);
            }
            
            .danger-btn {
                background: #ffffff;
                border-color: #ef4444;
                color: #ef4444;
            }
            
            .danger-btn:hover {
                background: #ef4444;
                color: #ffffff;
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
            }
            
            .modal-friends-list {
                display: flex;
                flex-direction: column;
                gap: 16px;
                max-height: 500px;
                overflow-y: auto;
                padding: 4px;
            }
            
            .modal-friend-item {
                display: flex;
                align-items: center;
                gap: 20px;
                padding: 24px;
                background: #ffffff;
                border: 2px solid #f1f5f9;
                border-radius: 16px;
                transition: all 0.2s ease;
            }
            
            .modal-friend-item:hover {
                border-color: #1d9bf0;
                box-shadow: 0 8px 25px rgba(29, 155, 240, 0.1);
                transform: translateY(-2px);
            }
            
            .modal-friend-item .friend-info {
                display: flex;
                align-items: center;
                gap: 16px;
                flex: 1;
                min-width: 0;
            }
            
            .modal-friend-item .friend-avatar {
                width: 56px;
                height: 56px;
                flex-shrink: 0;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .modal-friend-item .avatar-text {
                font-size: 20px;
                font-weight: 700;
                color: #ffffff;
            }
            
            .friend-details {
                display: flex;
                flex-direction: row;
                gap: 12px;
                flex: 1;
                min-width: 0;
            }
            
            .friend-details input {
                padding: 12px 16px;
                border: 2px solid #e5e7eb;
                border-radius: 10px;
                font-size: 15px;
                background: #ffffff;
                transition: all 0.2s ease;
                font-family: inherit;
                flex: 1;
                min-width: 0;
            }
            
            .friend-details input:focus {
                outline: none;
                border-color: #1d9bf0;
                box-shadow: 0 0 0 3px rgba(29, 155, 240, 0.1);
            }
            
            .friend-details input:first-child {
                flex: 1.2;
            }
            
            .friend-details input:last-child {
                flex: 1;
            }
            
            .friend-actions {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-shrink: 0;
                position: static;
                transform: none;
                width: auto;
                height: auto;
            }
            
            .friend-actions button {
                width: 36px;
                height: 36px;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 500;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                backdrop-filter: blur(10px);
            }
            
            .friend-actions .move-btn {
                background: rgba(107, 114, 128, 0.1);
                color: #6b7280;
                border: 1px solid rgba(107, 114, 128, 0.2);
            }
            
            .friend-actions .move-btn:hover:not(.disabled) {
                background: rgba(107, 114, 128, 0.15);
                color: #4b5563;
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(107, 114, 128, 0.2);
            }
            
            .friend-actions .move-btn.disabled {
                background: rgba(229, 231, 235, 0.5);
                color: #9ca3af;
                cursor: not-allowed;
                opacity: 0.6;
                border: 1px solid rgba(229, 231, 235, 0.3);
            }
            
            .friend-actions .save-btn {
                background: rgba(16, 185, 129, 0.1);
                color: #10b981;
                border: 1px solid rgba(16, 185, 129, 0.2);
            }
            
            .friend-actions .save-btn:hover {
                background: rgba(16, 185, 129, 0.15);
                color: #059669;
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
            }
            
            .friend-actions .delete-btn {
                background: rgba(239, 68, 68, 0.1);
                color: #ef4444;
                border: 1px solid rgba(239, 68, 68, 0.2);
            }
            
            .friend-actions .delete-btn:hover {
                background: rgba(239, 68, 68, 0.15);
                color: #dc2626;
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
            }
            
            /* 滚动条样式 */
            .modal-friends-list::-webkit-scrollbar {
                width: 6px;
            }
            
            .modal-friends-list::-webkit-scrollbar-track {
                background: #f1f5f9;
                border-radius: 3px;
            }
            
            .modal-friends-list::-webkit-scrollbar-thumb {
                background: #cbd5e1;
                border-radius: 3px;
            }
            
            .modal-friends-list::-webkit-scrollbar-thumb:hover {
                background: #94a3b8;
            }
            
            /* 响应式设计 */
            @media (max-width: 768px) {
                .modal-content {
                    width: 95%;
                    max-height: 95vh;
                }
                
                .modal-header {
                    padding: 20px 24px;
                }
                
                .add-friend-section,
                .friends-list-section {
                    padding: 24px 20px;
                }
                
                .add-friend-form {
                    grid-template-columns: 1fr;
                    gap: 16px;
                }
                
                .primary-btn {
                    grid-column: span 1;
                }
                
                .section-header {
                    flex-direction: column;
                    align-items: flex-start;
                }
                
                .management-actions {
                    width: 100%;
                    justify-content: flex-start;
                }
                
                .modal-friend-item {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 16px;
                }
                
                .modal-friend-item .friend-info {
                    width: 100%;
                }
                
                .friend-details {
                    flex-direction: column;
                    gap: 12px;
                }
                
                .friend-details input:first-child,
                .friend-details input:last-child {
                    flex: 1;
                }
                
                .friend-actions {
                    width: 100%;
                    justify-content: flex-end;
                }
            }
            
            /* 深色模式适配 */
            @media (prefers-color-scheme: dark) {
                .xcopilot-sidebar {
                    background: #000000;
                    color: #ffffff;
                }
                
                .brand-name {
                    color: #ffffff;
                    background: linear-gradient(135deg, #1d9bf0 0%, #1a8cd8 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }
                
                #xcopilot-search-input {
                    background: #16181c;
                    border-color: #2f3336;
                    color: #ffffff;
                }
                
                #xcopilot-search-input:hover:not(:focus) {
                    background: #1c1f23;
                    border-color: #3e4144;
                }
                
                #xcopilot-search-input::placeholder {
                    color: #71767b;
                }
                
                #xcopilot-friends-section {
                    border-top-color: #2f3336;
                }
                
                .friends-header h4 {
                    color: #ffffff;
                }
                
                .author-link {
                    background: #16181c;
                    color: #71767b;
                }
                
                .author-link:hover {
                    background: #1d9bf0;
                    color: #ffffff;
                }
                
                .friend-item {
                    background: #16181c;
                    border-color: #2f3336;
                }
                
                .friend-item:hover {
                    background: #1c1f23;
                    border-color: #3e4144;
                }
                
                .friend-name {
                    color: #ffffff;
                }
                
                .friend-username {
                    color: #71767b;
                }
                
                .copy-btn {
                    background: #16181c;
                    color: #ffffff;
                    box-shadow: 0 1px 3px rgba(255, 255, 255, 0.1);
                }
                
                .copy-btn:hover {
                    background: #1d9bf0;
                    color: #ffffff;
                }
                
                /* 弹层深色模式 */
                .modal-content {
                    background: #000000;
                    border: 1px solid #2f3336;
                }
                
                .modal-header {
                    background: linear-gradient(135deg, #1d9bf0 0%, #1a8cd8 100%);
                }
                
                /* Tab 深色模式 */
                .tab-navigation {
                    background: #16181c;
                    border-bottom-color: #2f3336;
                }
                
                .tab-btn {
                    color: #71767b;
                }
                
                .tab-btn:hover {
                    background: rgba(29, 155, 240, 0.1);
                    color: #1d9bf0;
                }
                
                .tab-btn.active {
                    background: #000000;
                    color: #1d9bf0;
                    border-bottom-color: #1d9bf0;
                }
                
                .add-friend-section {
                    background: #16181c;
                    border-bottom-color: #2f3336;
                }
                
                .section-title h3 {
                    color: #ffffff;
                }
                
                .section-description,
                .friends-count {
                    color: #71767b;
                }
                
                .form-group label {
                    color: #ffffff;
                }
                
                .form-group input,
                .input-with-prefix {
                    background: #000000;
                    border-color: #2f3336;
                    color: #ffffff;
                }
                
                .input-prefix {
                    color: #71767b;
                }
                
                .form-group input:focus,
                .input-with-prefix:focus-within {
                    border-color: #1d9bf0;
                    box-shadow: 0 0 0 3px rgba(29, 155, 240, 0.1);
                }
                
                .secondary-btn {
                    background: #000000;
                    border-color: #1d9bf0;
                    color: #1d9bf0;
                }
                
                .secondary-btn:hover {
                    background: #1d9bf0;
                    color: #ffffff;
                }
                
                .danger-btn {
                    background: #000000;
                    border-color: #ef4444;
                    color: #ef4444;
                }
                
                .danger-btn:hover {
                    background: #ef4444;
                    color: #ffffff;
                }
                
                .friends-list-section {
                    background: #000000;
                }
                
                .modal-friend-item {
                    background: #16181c;
                    border-color: #2f3336;
                }
                
                .modal-friend-item:hover {
                    border-color: #1d9bf0;
                    background: #1c1f23;
                }
                
                .friend-details input {
                    background: #000000;
                    border-color: #2f3336;
                    color: #ffffff;
                    flex: 1;
                    min-width: 0;
                }
                
                .friend-details input:focus {
                    border-color: #1d9bf0;
                    box-shadow: 0 0 0 3px rgba(29, 155, 240, 0.1);
                }
                
                .friend-details input:first-child {
                    flex: 1.2;
                }
                
                .friend-details input:last-child {
                    flex: 1;
                }
                
                .modal-friends-list::-webkit-scrollbar-track {
                    background: #2f3336;
                }
                
                .modal-friends-list::-webkit-scrollbar-thumb {
                    background: #536471;
                }
                
                .modal-friends-list::-webkit-scrollbar-thumb:hover {
                    background: #657786;
                }
                
                /* 好友操作按钮深色模式 */
                .friend-actions .move-btn {
                    background: rgba(107, 114, 128, 0.15);
                    color: #9ca3af;
                    border: 1px solid rgba(107, 114, 128, 0.3);
                }
                
                .friend-actions .move-btn:hover:not(.disabled) {
                    background: rgba(107, 114, 128, 0.25);
                    color: #d1d5db;
                    box-shadow: 0 4px 12px rgba(107, 114, 128, 0.3);
                }
                
                .friend-actions .move-btn.disabled {
                    background: rgba(75, 85, 99, 0.3);
                    color: #6b7280;
                    border: 1px solid rgba(75, 85, 99, 0.2);
                }
                
                .friend-actions .save-btn {
                    background: rgba(16, 185, 129, 0.15);
                    color: #34d399;
                    border: 1px solid rgba(16, 185, 129, 0.3);
                }
                
                .friend-actions .save-btn:hover {
                    background: rgba(16, 185, 129, 0.25);
                    color: #6ee7b7;
                    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
                }
                
                .friend-actions .delete-btn {
                    background: rgba(239, 68, 68, 0.15);
                    color: #f87171;
                    border: 1px solid rgba(239, 68, 68, 0.3);
                }
                
                .friend-actions .delete-btn:hover {
                    background: rgba(239, 68, 68, 0.25);
                    color: #fca5a5;
                    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
                }
            }
        `;
        
        const styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }

    /**
     * 初始化好友数据
     */
    async initializeFriends() {
        try {
            // 从Chrome存储中加载好友数据
            const result = await chrome.storage.local.get(['xcopilot_friends']);
            if (result.xcopilot_friends && Array.isArray(result.xcopilot_friends)) {
                this.friends = result.xcopilot_friends;
                console.log("👥 FRIENDS: Loaded from storage:", this.friends.length, "friends");
            } else {
                // 如果没有存储的数据，使用默认好友列表
                this.friends = this.getDefaultFriends();
                await this.saveFriends();
                console.log("👥 FRIENDS: Initialized with default friends");
            }
        } catch (error) {
            console.error("👥 FRIENDS: Failed to load from storage:", error);
            this.friends = this.getDefaultFriends();
        }
    }
    
    /**
     * 获取默认好友列表
     */
    getDefaultFriends() {
        return [
            { name: "橘子", username: "oran_ge", id: Date.now() + 1 },
            { name: "小互", username: "imxiaohu", id: Date.now() + 2 },
            { name: "福祥", username: "fuxiangPro", id: Date.now() + 3 },
            { name: "七娘", username: "GlocalTerapy", id: Date.now() + 4 },
            { name: "歸藏", username: "op7418", id: Date.now() + 5 },
            { name: "黄叔", username: "PMbackttfuture", id: Date.now() + 6 }
        ];
    }
    
    /**
     * 保存好友数据到Chrome存储
     */
    async saveFriends() {
        try {
            await chrome.storage.local.set({ xcopilot_friends: this.friends });
            console.log("👥 FRIENDS: Saved to storage:", this.friends.length, "friends");
        } catch (error) {
            console.error("👥 FRIENDS: Failed to save to storage:", error);
        }
    }
    
    /**
     * 添加新好友
     */
    async addFriend(name, username) {
        if (!name || !username) {
            throw new Error("姓名和用户名不能为空");
        }
        
        // 检查用户名是否已存在
        if (this.friends.some(f => f.username.toLowerCase() === username.toLowerCase())) {
            throw new Error("该用户名已存在");
        }
        
        const newFriend = {
            id: Date.now(),
            name: name.trim(),
            username: username.trim().replace('@', '') // 移除@符号
        };
        
        this.friends.push(newFriend);
        await this.saveFriends();
        this.renderFriendsList();
        
        console.log("👥 FRIENDS: Added new friend:", newFriend);
        return newFriend;
    }

    /**
     * 显示侧边栏
     */
    showSidebar() {
        if (this.sidebar) {
            this.sidebar.style.display = 'block';
            this.sidebarVisible = true;
            console.log("XCOPILOT: Sidebar shown");
        }
    }

    /**
     * 隐藏侧边栏
     */
    hideSidebar() {
        if (this.sidebar) {
            this.sidebar.style.display = 'none';
            this.sidebarVisible = false;
            console.log("XCOPILOT: Sidebar hidden");
        }
    }

    /**
     * 切换侧边栏显示状态
     */
    toggleSidebarVisibility() {
        if (this.sidebarVisible) {
            this.hideSidebar();
        } else {
            this.showSidebar();
        }
    }

    /**
     * 恢复原始侧边栏
     */
    restoreOriginalSidebar() {
        const twitterRightSidebar = this.findTwitterRightSidebar();
        if (twitterRightSidebar && this.originalRightSidebar) {
            twitterRightSidebar.innerHTML = '';
            twitterRightSidebar.appendChild(this.originalRightSidebar.cloneNode(true));
            console.log("XCOPILOT: Original sidebar restored");
        }
    }

    /**
     * 创建好友管理弹层
     */
    createFriendsManagementModal() {
        // 检查是否已存在弹层
        let existingModal = document.getElementById('xcopilot-friends-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'xcopilot-friends-modal';
        modal.className = 'xcopilot-modal';
        
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <div class="header-content">
                        <h2>特别关注管理</h2>
                        <p class="header-subtitle">管理你的特别关注列表，快速访问重要用户</p>
                    </div>
                    <button id="close-modal-btn" class="close-btn" aria-label="关闭">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M12.854 4.854a.5.5 0 0 0-.708-.708L8 8.293 3.854 4.146a.5.5 0 1 0-.708.708L7.293 9l-4.147 4.146a.5.5 0 0 0 .708.708L8 9.707l4.146 4.147a.5.5 0 0 0 .708-.708L8.707 9l4.147-4.146z"/>
                        </svg>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="tab-navigation">
                        <button class="tab-btn active" data-tab="add-friend-tab">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z"/>
                            </svg>
                            添加新关注
                        </button>
                        <button class="tab-btn" data-tab="manage-friends-tab">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M10.5 5a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0V6.707l-1.146 1.147a.5.5 0 0 1-.708-.708l2-2a.5.5 0 0 1 .708 0l2 2a.5.5 0 0 1-.708.708L11 6.707V9.5a.5.5 0 0 1-.5.5z"/>
                                <path d="M3 2a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9A.5.5 0 0 1 3 2zm0 3a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 3 5zm0 3a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5A.5.5 0 0 1 3 8z"/>
                            </svg>
                            管理关注
                        </button>
                    </div>
                    <div class="tab-content active" id="add-friend-tab">
                        <div class="add-friend-section">
                            <div class="section-title">
                                <h3>添加新关注</h3>
                                <span class="section-description">添加你想要特别关注的用户</span>
                            </div>
                            <div class="add-friend-form">
                                <div class="form-group">
                                    <label for="modal-friend-name-input">显示名称</label>
                                    <input type="text" id="modal-friend-name-input" placeholder="如：向阳乔木" autocomplete="off">
                                </div>
                                <div class="form-group">
                                    <label for="modal-friend-username-input">X用户名</label>
                                    <div class="input-with-prefix">
                                        <span class="input-prefix">@</span>
                                        <input type="text" id="modal-friend-username-input" placeholder="vista8" autocomplete="off">
                                    </div>
                                </div>
                                <button id="modal-add-friend-btn" class="primary-btn">
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                        <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z"/>
                                    </svg>
                                    添加关注
                                </button>
                            </div>
                            
                            <!-- 添加成功提示 -->
                            <div id="add-success-message" class="success-message hidden">
                                <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                                    <path d="M10.97 4.97a.235.235 0 0 0-.02.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-1.071-1.05z"/>
                                </svg>
                                <span>好友添加成功！</span>
                            </div>
                        </div>
                    </div>
                    <div class="tab-content" id="manage-friends-tab">
                        <div class="friends-list-section">
                            <div class="section-header">
                                <div class="section-title">
                                    <h3>关注列表</h3>
                                    <span class="friends-count">共 <span id="friends-count">0</span> 位</span>
                                </div>
                                <div class="management-actions">
                                    <button id="modal-sort-friends-btn" class="secondary-btn">
                                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                            <path d="M10.5 5a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0V6.707l-1.146 1.147a.5.5 0 0 1-.708-.708l2-2a.5.5 0 0 1 .708 0l2 2a.5.5 0 0 1-.708.708L11 6.707V9.5a.5.5 0 0 1-.5.5z"/>
                                            <path d="M3 2a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9A.5.5 0 0 1 3 2zm0 3a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 3 5zm0 3a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5A.5.5 0 0 1 3 8z"/>
                                        </svg>
                                        排序
                                    </button>
                                    <button id="modal-reset-friends-btn" class="danger-btn">
                                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                            <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
                                            <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
                                        </svg>
                                        重置
                                    </button>
                                </div>
                            </div>
                            <div id="modal-friends-list" class="modal-friends-list">
                                <!-- 好友列表将动态生成 -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        this.renderModalFriendsList();
        this.setupModalEvents();
        
        // 显示弹层
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);
        
        console.log("👥 FRIENDS: Created management modal");
        return modal;
    }

    /**
     * 渲染弹层中的好友列表
     */
    renderModalFriendsList() {
        const modalFriendsList = document.getElementById('modal-friends-list');
        const friendsCountEl = document.getElementById('friends-count');
        if (!modalFriendsList) return;
        
        // 更新好友数量
        if (friendsCountEl) {
            friendsCountEl.textContent = this.friends.length;
        }
        
        modalFriendsList.innerHTML = '';
        
        // 预定义的头像颜色（与侧边栏保持一致）
        const avatarColors = [
            'linear-gradient(135deg, #1d9bf0 0%, #1a8cd8 100%)', // 蓝色
            'linear-gradient(135deg, #00ba7c 0%, #00a86b 100%)', // 绿色
            'linear-gradient(135deg, #f4212e 0%, #dc1c2e 100%)', // 红色
            'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)', // 橙色
            'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', // 紫色
            'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', // 青色
            'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', // 黄色
            'linear-gradient(135deg, #ec4899 0%, #db2777 100%)', // 粉色
        ];
        
        this.friends.forEach((friend, index) => {
            const friendItem = document.createElement('div');
            friendItem.className = 'modal-friend-item';
            friendItem.dataset.id = friend.id;
            
            // 根据索引选择颜色，循环使用
            const avatarColor = avatarColors[index % avatarColors.length];
            
            friendItem.innerHTML = `
                <div class="friend-info">
                    <div class="friend-avatar" style="background: ${avatarColor}">
                        <span class="avatar-text">${friend.name.charAt(0)}</span>
                    </div>
                    <div class="friend-details">
                        <input type="text" class="edit-name" value="${friend.name}" placeholder="显示名称">
                        <input type="text" class="edit-username" value="${friend.username}" placeholder="用户名">
                    </div>
                </div>
                <div class="friend-actions">
                    <button class="move-btn ${index === 0 ? 'disabled' : ''}" data-direction="up" title="上移" ${index === 0 ? 'disabled' : ''}>
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 3.5a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-1 0V4.707L5.354 6.854a.5.5 0 1 1-.708-.708l3-3a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 4.707V4a.5.5 0 0 1 .5-.5z"/>
                        </svg>
                    </button>
                    <button class="move-btn ${index === this.friends.length - 1 ? 'disabled' : ''}" data-direction="down" title="下移" ${index === this.friends.length - 1 ? 'disabled' : ''}>
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 12.5a.5.5 0 0 0 .5-.5V3a.5.5 0 0 0-1 0v8.793L5.354 9.646a.5.5 0 1 0-.708.708l3 3a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 11.293V12a.5.5 0 0 0 .5.5z"/>
                        </svg>
                    </button>
                    <button class="save-btn" title="保存">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H9.5a1 1 0 0 0-1 1v7.293l2.646-2.647a.5.5 0 0 1 .708.708l-3.5 3.5a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 9.293V2a2 2 0 0 1 2-2H14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h2.5a.5.5 0 0 1 0 1H2z"/>
                        </svg>
                    </button>
                    <button class="delete-btn" title="删除">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5ZM11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H2.506a.58.58 0 0 0-.01 0H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84L13.962 3.5H14.5a.5.5 0 0 0 0-1h-1.004a.58.58 0 0 0-.01 0H11Zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5h9.916Zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47ZM8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5Z"/>
                        </svg>
                    </button>
                </div>
            `;
            
            modalFriendsList.appendChild(friendItem);
        });
        
        console.log("👥 FRIENDS: Rendered modal friends list");
    }

    /**
     * 设置弹层事件监听器
     */
    setupModalEvents() {
        // 关闭弹层事件
        const closeBtn = document.getElementById('close-modal-btn');
        const backdrop = document.querySelector('.modal-backdrop');
        const modal = document.getElementById('xcopilot-friends-modal');
        
        const closeModal = () => {
            if (modal) {
                modal.classList.remove('show');
                setTimeout(() => {
                    modal.remove();
                }, 300);
            }
        };
        
        if (closeBtn) {
            closeBtn.addEventListener('click', closeModal);
        }
        
        if (backdrop) {
            backdrop.addEventListener('click', closeModal);
        }
        
        // ESC键关闭弹层
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal && modal.classList.contains('show')) {
                closeModal();
            }
        });
        
        // Tab 切换事件
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;
                this.switchTab(tabId);
            });
        });
        
        // 添加好友事件
        const addBtn = document.getElementById('modal-add-friend-btn');
        const nameInput = document.getElementById('modal-friend-name-input');
        const usernameInput = document.getElementById('modal-friend-username-input');
        const successMessage = document.getElementById('add-success-message');
        
        if (addBtn && nameInput && usernameInput) {
            addBtn.addEventListener('click', async () => {
                const name = nameInput.value.trim();
                const username = usernameInput.value.trim();
                
                if (!name || !username) {
                    alert("请填写完整的好友信息");
                    return;
                }
                
                try {
                    await this.addFriend(name, username);
                    nameInput.value = '';
                    usernameInput.value = '';
                    this.renderModalFriendsList();
                    this.renderFriendsList(); // 更新侧边栏列表
                    
                    // 显示成功提示
                    if (successMessage) {
                        successMessage.classList.remove('hidden');
                        setTimeout(() => {
                            successMessage.classList.add('hidden');
                        }, 3000);
                    }
                    
                    console.log("👥 FRIENDS: Friend added successfully via modal");
                } catch (error) {
                    alert("添加失败：" + error.message);
                }
            });
            
            // 回车键添加好友
            [nameInput, usernameInput].forEach(input => {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        addBtn.click();
                    }
                });
            });
        }
        
        // 排序和重置事件
        const sortBtn = document.getElementById('modal-sort-friends-btn');
        const resetBtn = document.getElementById('modal-reset-friends-btn');
        
        if (sortBtn) {
            sortBtn.addEventListener('click', async () => {
                await this.sortFriends();
                this.renderModalFriendsList();
                this.renderFriendsList();
                alert("好友列表已按名称排序");
            });
        }
        
        if (resetBtn) {
            resetBtn.addEventListener('click', async () => {
                if (confirm("确定要恢复默认好友列表吗？这将删除所有自定义好友。")) {
                    await this.resetFriends();
                    this.renderModalFriendsList();
                    this.renderFriendsList();
                    alert("已恢复默认好友列表");
                }
            });
        }
        
        // 好友项操作事件
        this.setupModalFriendItemEvents();
    }

    /**
     * 设置弹层中好友项的事件监听器
     */
    setupModalFriendItemEvents() {
        const friendItems = document.querySelectorAll('.modal-friend-item');
        
        friendItems.forEach(item => {
            const id = parseInt(item.dataset.id);
            const nameInput = item.querySelector('.edit-name');
            const usernameInput = item.querySelector('.edit-username');
            const saveBtn = item.querySelector('.save-btn');
            const deleteBtn = item.querySelector('.delete-btn');
            const moveBtns = item.querySelectorAll('.move-btn');
            
            // 保存按钮事件
            if (saveBtn) {
                saveBtn.addEventListener('click', async () => {
                    const name = nameInput.value.trim();
                    const username = usernameInput.value.trim();
                    
                    if (!name || !username) {
                        alert("姓名和用户名不能为空");
                        return;
                    }
                    
                    try {
                        await this.updateFriend(id, name, username);
                        this.renderModalFriendsList();
                        this.renderFriendsList();
                        alert("好友信息已更新");
                    } catch (error) {
                        alert("更新失败：" + error.message);
                    }
                });
            }
            
            // 删除按钮事件
            if (deleteBtn) {
                deleteBtn.addEventListener('click', async () => {
                    const friendName = nameInput.value.trim() || '该好友';
                    if (confirm(`确定要删除 ${friendName} 吗？`)) {
                        try {
                            await this.deleteFriend(id);
                            this.renderModalFriendsList();
                            this.renderFriendsList();
                            alert("好友已删除");
                        } catch (error) {
                            alert("删除失败：" + error.message);
                        }
                    }
                });
            }
            
            // 移动按钮事件
            moveBtns.forEach(btn => {
                if (!btn.disabled) {
                    btn.addEventListener('click', async () => {
                        const direction = btn.dataset.direction;
                        await this.moveFriend(id, direction);
                        this.renderModalFriendsList();
                        this.renderFriendsList();
                    });
                }
            });
        });
    }

    /**
     * 切换Tab
     */
    switchTab(tabId) {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        
        // 移除所有active状态
        tabBtns.forEach(btn => {
            btn.classList.remove('active');
        });
        
        tabContents.forEach(content => {
            content.classList.remove('active');
        });
        
        // 激活选中的tab
        const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
        const activeContent = document.getElementById(tabId);
        
        if (activeBtn && activeContent) {
            activeBtn.classList.add('active');
            activeContent.classList.add('active');
        }
        
        console.log(`👥 FRIENDS: Switched to tab: ${tabId}`);
    }
}

// --- Script Instantiation and Global Setup --- 

// Ensure only one instance of the content script runs.
if (typeof window.xCopilotGlobalInstance === 'undefined') {
    console.log("XCOPILOT: Attempting to instantiate XCopilotContentScript..."); // Instantiation attempt
    try {
        window.xCopilotGlobalInstance = new XCopilotContentScript(); // The single instantiation
        console.log("XCOPILOT: XCopilotContentScript instantiated successfully."); // Instantiation success

        // Check if on the correct domain to add global listeners
        if (window.location.hostname === 'twitter.com' || window.location.hostname === 'x.com') {
            // Simple global URL change observer (can be a fallback or complement to instance's own listeners)
            let lastUrlForGlobalObserver = location.href;
            const globalUrlObserver = new MutationObserver(() => {
                const currentUrl = location.href;
                if (currentUrl !== lastUrlForGlobalObserver) {
                    console.log("Global_URL_Observer: URL changed to", currentUrl);
                    lastUrlForGlobalObserver = currentUrl;
                    if (window.xCopilotGlobalInstance && typeof window.xCopilotGlobalInstance.handlePageNavigationOrChange === 'function') {
                        window.xCopilotGlobalInstance.handlePageNavigationOrChange();
                    } else {
                        console.warn("Global_URL_Observer: xCopilotGlobalInstance or handlePageNavigationOrChange not found during URL change.");
                    }
                }
            });
            globalUrlObserver.observe(document, { subtree: true, childList: true });
            console.log("Global_URL_Observer: Started on x.com/twitter.com for the single instance.");

            // Cleanup for the global instance when the window unloads.
            window.addEventListener('beforeunload', () => {
                if (window.xCopilotGlobalInstance && typeof window.xCopilotGlobalInstance.cleanup === 'function') {
                    console.log("Global beforeunload: Cleaning up xCopilotGlobalInstance...");
                    window.xCopilotGlobalInstance.cleanup();
                }
            });
            console.log("XCOPILOT: Global beforeunload listener attached for the single instance.");
        } else {
            console.log("XCOPILOT: Not on twitter.com or x.com, global listeners not attached.");
        }
    } catch (e) {
        console.error("XCOPILOT: CRITICAL ERROR during XCopilotContentScript instantiation or initial setup:", e);
    }

} else {
    console.log("XCOPILOT: xCopilotGlobalInstance already exists. No new instantiation.");
    // Optional: If it exists, maybe call a re-check or update function if needed, 
    // though instance's own listeners should ideally handle navigations.
    // e.g., if (window.xCopilotGlobalInstance.isUrlDifferent(location.href)) { 
    //    window.xCopilotGlobalInstance.handlePageNavigationOrChange(); 
    // }
} 