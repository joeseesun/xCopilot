/**
 * xCopilot Helper Utilities
 * 通用辅助函数集合
 */

class HelperUtils {
    /**
     * 时间处理工具
     */
    
    /**
     * 获取相对时间描述
     */
    static getTimeAgo(timestamp) {
        try {
            const now = new Date();
            const time = new Date(timestamp);
            const diffInSeconds = Math.floor((now - time) / 1000);
            
            if (diffInSeconds < 60) return '刚刚';
            if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}分钟前`;
            if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}小时前`;
            if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}天前`;
            if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)}个月前`;
            
            return `${Math.floor(diffInSeconds / 31536000)}年前`;
        } catch (error) {
            console.error('时间格式化失败:', error);
            return '未知时间';
        }
    }

    /**
     * 格式化数字（K, M, B）
     */
    static formatNumber(num) {
        if (typeof num !== 'number' || isNaN(num)) return '0';
        
        if (num < 1000) return num.toString();
        if (num < 1000000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
        if (num < 1000000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
    }

    /**
     * 截断文本
     */
    static truncateText(text, maxLength, suffix = '...') {
        if (!text || typeof text !== 'string') return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - suffix.length) + suffix;
    }

    /**
     * 转义HTML字符
     */
    static escapeHtml(text) {
        if (!text) return '';
        
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 延迟执行
     */
    static delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 防抖函数
     */
    static debounce(func, wait, immediate = false) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func(...args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func(...args);
        };
    }

    /**
     * 验证推文数据格式
     */
    static validateTweetData(tweet) {
        if (!tweet || typeof tweet !== 'object') return false;
        
        const requiredFields = ['id', 'text', 'createdAt'];
        return requiredFields.every(field => tweet.hasOwnProperty(field) && tweet[field] !== null);
    }

    /**
     * 数组去重（基于指定字段）
     */
    static uniqueBy(array, key) {
        const seen = new Set();
        return array.filter(item => {
            const value = typeof key === 'function' ? key(item) : item[key];
            if (seen.has(value)) {
                return false;
            }
            seen.add(value);
            return true;
        });
    }

    /**
     * 生成随机字符串
     */
    static generateRandomString(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * 复制到剪贴板
     */
    static async copyToClipboard(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                // 降级方案
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const result = document.execCommand('copy');
                document.body.removeChild(textArea);
                return result;
            }
        } catch (error) {
            console.error('复制失败:', error);
            return false;
        }
    }

    /**
     * 下载文件
     */
    static downloadFile(data, filename, type = 'application/json') {
        const blob = new Blob([data], { type });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}

// 导出工具类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HelperUtils;
} else if (typeof window !== 'undefined') {
    window.HelperUtils = HelperUtils;
} 