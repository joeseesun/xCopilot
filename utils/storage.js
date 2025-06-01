/**
 * xCopilot Storage Utilities
 * 数据存储和管理工具函数
 */

class StorageManager {
    constructor() {
        this.localStorageKeys = {
            TWEETS: 'tweets',
            LAST_SYNC: 'lastSync',
            USER_INFO: 'userInfo',
            TWITTER_AUTH: 'twitterAuth',
            IS_FIRST_RUN: 'isFirstRun'
        };
        
        this.syncStorageKeys = {
            SETTINGS: 'settings',
            USER_PREFERENCES: 'userPreferences'
        };
    }

    /**
     * 本地存储操作
     */
    
    /**
     * 保存推文数据
     */
    async saveTweets(tweets) {
        try {
            const data = {
                [this.localStorageKeys.TWEETS]: tweets,
                [this.localStorageKeys.LAST_SYNC]: new Date().toISOString()
            };
            await chrome.storage.local.set(data);
            console.log(`已保存 ${tweets.length} 条推文`);
            return true;
        } catch (error) {
            console.error('保存推文失败:', error);
            throw error;
        }
    }

    /**
     * 获取推文数据
     */
    async getTweets() {
        try {
            const result = await chrome.storage.local.get([
                this.localStorageKeys.TWEETS,
                this.localStorageKeys.LAST_SYNC
            ]);
            
            return {
                tweets: result[this.localStorageKeys.TWEETS] || [],
                lastSync: result[this.localStorageKeys.LAST_SYNC] || null
            };
        } catch (error) {
            console.error('获取推文失败:', error);
            return { tweets: [], lastSync: null };
        }
    }

    /**
     * 添加新推文（去重）
     */
    async addTweets(newTweets) {
        try {
            const { tweets: existingTweets } = await this.getTweets();
            const existingIds = new Set(existingTweets.map(t => t.id));
            
            // 过滤重复推文
            const uniqueNewTweets = newTweets.filter(tweet => !existingIds.has(tweet.id));
            
            if (uniqueNewTweets.length === 0) {
                console.log('没有新推文需要添加');
                return existingTweets;
            }
            
            // 合并推文并按时间排序
            const allTweets = [...existingTweets, ...uniqueNewTweets]
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            await this.saveTweets(allTweets);
            console.log(`添加了 ${uniqueNewTweets.length} 条新推文`);
            
            return allTweets;
        } catch (error) {
            console.error('添加推文失败:', error);
            throw error;
        }
    }

    /**
     * 保存用户信息
     */
    async saveUserInfo(userInfo) {
        try {
            await chrome.storage.local.set({
                [this.localStorageKeys.USER_INFO]: userInfo
            });
            return true;
        } catch (error) {
            console.error('保存用户信息失败:', error);
            throw error;
        }
    }

    /**
     * 获取用户信息
     */
    async getUserInfo() {
        try {
            const result = await chrome.storage.local.get([this.localStorageKeys.USER_INFO]);
            return result[this.localStorageKeys.USER_INFO] || null;
        } catch (error) {
            console.error('获取用户信息失败:', error);
            return null;
        }
    }

    /**
     * 保存Twitter认证信息
     */
    async saveTwitterAuth(authData) {
        try {
            await chrome.storage.local.set({
                [this.localStorageKeys.TWITTER_AUTH]: authData
            });
            return true;
        } catch (error) {
            console.error('保存认证信息失败:', error);
            throw error;
        }
    }

    /**
     * 获取Twitter认证信息
     */
    async getTwitterAuth() {
        try {
            const result = await chrome.storage.local.get([this.localStorageKeys.TWITTER_AUTH]);
            return result[this.localStorageKeys.TWITTER_AUTH] || null;
        } catch (error) {
            console.error('获取认证信息失败:', error);
            return null;
        }
    }

    /**
     * 清除认证信息
     */
    async clearTwitterAuth() {
        try {
            await chrome.storage.local.remove([this.localStorageKeys.TWITTER_AUTH]);
            return true;
        } catch (error) {
            console.error('清除认证信息失败:', error);
            throw error;
        }
    }

    /**
     * 同步存储操作
     */
    
    /**
     * 保存设置
     */
    async saveSettings(settings) {
        try {
            await chrome.storage.sync.set({
                [this.syncStorageKeys.SETTINGS]: settings
            });
            return true;
        } catch (error) {
            console.error('保存设置失败:', error);
            throw error;
        }
    }

    /**
     * 获取设置
     */
    async getSettings() {
        try {
            const result = await chrome.storage.sync.get([this.syncStorageKeys.SETTINGS]);
            return result[this.syncStorageKeys.SETTINGS] || this.getDefaultSettings();
        } catch (error) {
            console.error('获取设置失败:', error);
            return this.getDefaultSettings();
        }
    }

    /**
     * 获取默认设置
     */
    getDefaultSettings() {
        return {
            theme: 'light',
            autoSync: true,
            displayCount: 50,
            syncInterval: 30, // 分钟
            enableNotifications: true,
            language: 'zh-CN'
        };
    }

    /**
     * 更新设置
     */
    async updateSettings(newSettings) {
        try {
            const currentSettings = await this.getSettings();
            const updatedSettings = { ...currentSettings, ...newSettings };
            await this.saveSettings(updatedSettings);
            return updatedSettings;
        } catch (error) {
            console.error('更新设置失败:', error);
            throw error;
        }
    }

    /**
     * 数据管理操作
     */
    
    /**
     * 清理过期数据
     */
    async cleanupOldData(maxAgeInDays = 180) {
        try {
            const { tweets } = await this.getTweets();
            if (!tweets || tweets.length === 0) return 0;
            
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - maxAgeInDays);
            
            const filteredTweets = tweets.filter(tweet => {
                const tweetDate = new Date(tweet.createdAt);
                return tweetDate >= cutoffDate;
            });
            
            const removedCount = tweets.length - filteredTweets.length;
            
            if (removedCount > 0) {
                await this.saveTweets(filteredTweets);
                console.log(`清理了 ${removedCount} 条过期推文`);
            }
            
            return removedCount;
        } catch (error) {
            console.error('清理过期数据失败:', error);
            throw error;
        }
    }

    /**
     * 获取存储使用情况
     */
    async getStorageUsage() {
        try {
            const localUsage = await chrome.storage.local.getBytesInUse();
            const syncUsage = await chrome.storage.sync.getBytesInUse();
            
            return {
                local: {
                    used: localUsage,
                    quota: chrome.storage.local.QUOTA_BYTES || 5242880, // 5MB
                    percentage: (localUsage / (chrome.storage.local.QUOTA_BYTES || 5242880)) * 100
                },
                sync: {
                    used: syncUsage,
                    quota: chrome.storage.sync.QUOTA_BYTES || 102400, // 100KB
                    percentage: (syncUsage / (chrome.storage.sync.QUOTA_BYTES || 102400)) * 100
                }
            };
        } catch (error) {
            console.error('获取存储使用情况失败:', error);
            return null;
        }
    }

    /**
     * 导出数据
     */
    async exportData() {
        try {
            const [tweets, userInfo, settings] = await Promise.all([
                this.getTweets(),
                this.getUserInfo(),
                this.getSettings()
            ]);
            
            const exportData = {
                version: '1.0.0',
                exportDate: new Date().toISOString(),
                tweets: tweets.tweets,
                userInfo: userInfo,
                settings: settings
            };
            
            return exportData;
        } catch (error) {
            console.error('导出数据失败:', error);
            throw error;
        }
    }

    /**
     * 导入数据
     */
    async importData(importData) {
        try {
            if (!importData || !importData.version) {
                throw new Error('无效的导入数据格式');
            }
            
            // 验证数据格式
            if (importData.tweets && Array.isArray(importData.tweets)) {
                await this.saveTweets(importData.tweets);
            }
            
            if (importData.userInfo) {
                await this.saveUserInfo(importData.userInfo);
            }
            
            if (importData.settings) {
                await this.saveSettings(importData.settings);
            }
            
            console.log('数据导入成功');
            return true;
        } catch (error) {
            console.error('导入数据失败:', error);
            throw error;
        }
    }

    /**
     * 清除所有数据
     */
    async clearAllData() {
        try {
            await Promise.all([
                chrome.storage.local.clear(),
                chrome.storage.sync.clear()
            ]);
            console.log('所有数据已清除');
            return true;
        } catch (error) {
            console.error('清除数据失败:', error);
            throw error;
        }
    }

    /**
     * 初始化存储
     */
    async initializeStorage() {
        try {
            const result = await chrome.storage.local.get([this.localStorageKeys.IS_FIRST_RUN]);
            
            if (result[this.localStorageKeys.IS_FIRST_RUN] !== false) {
                // 首次运行，设置默认值
                await chrome.storage.local.set({
                    [this.localStorageKeys.IS_FIRST_RUN]: false,
                    [this.localStorageKeys.TWEETS]: [],
                    [this.localStorageKeys.LAST_SYNC]: null
                });
                
                await this.saveSettings(this.getDefaultSettings());
                
                console.log('存储已初始化');
                return true;
            }
            
            return false; // 不是首次运行
        } catch (error) {
            console.error('初始化存储失败:', error);
            throw error;
        }
    }

    /**
     * 监听存储变化
     */
    onStorageChanged(callback) {
        chrome.storage.onChanged.addListener((changes, namespace) => {
            callback(changes, namespace);
        });
    }
}

// 创建全局实例
const storageManager = new StorageManager();

// 导出给其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageManager;
} else if (typeof window !== 'undefined') {
    window.StorageManager = StorageManager;
    window.storageManager = storageManager;
} 