// pages/message/message.js — 消息页
import handleImageError from '../../utils/image-helper'

const app = getApp()

Page({
  data: {
    statusBarHeight: 44,
    notifications: [],
    unreadCount: 0,
  },

  onLoad() {
    this.setData({ statusBarHeight: app.globalData.statusBarHeight || 44 })
  },

  onShow() {
    // 每次进入重新加载，清除旧缓存
    this.setData({ notifications: [], unreadCount: 0 })
    this.loadNotifications()
  },

  /** 通知类型 → 中文文案 */
  formatNotification(item) {
    var map = {
      like: '赞了你的游记',
      collect: '收藏了你的游记',
      journal_comment: '评论了你的游记',
      image_comment: '评论了你的照片',
      reply: '回复了你的评论',
      follow: '关注了你'
    }
    return map[item.type] || '与你互动'
  },

  /** Date 对象 → 友好时间文字 */
  formatTime(date) {
    if (!date) return ''
    var d = new Date(date)
    if (isNaN(d.getTime())) return ''
    var now = Date.now()
    var diff = now - d.getTime()
    var minute = 60 * 1000
    var hour = 60 * minute
    var day = 24 * hour
    if (diff < minute) return '刚刚'
    if (diff < hour) return Math.floor(diff / minute) + '分钟前'
    if (diff < day) return Math.floor(diff / hour) + '小时前'
    if (diff < 7 * day) return Math.floor(diff / day) + '天前'
    var y = d.getFullYear()
    var m = String(d.getMonth() + 1).padStart(2, '0')
    var day2 = String(d.getDate()).padStart(2, '0')
    return y + '-' + m + '-' + day2
  },

  /** 从云端加载真实通知 */
  loadNotifications() {
    var self = this
    wx.cloud.callFunction({
      name: 'notification',
      data: { action: 'getNotifications' },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          var list = (res.result.notifications || []).map(function(n) {
            return {
              _id: n._id,
              actorName: n.actorName || '某用户',
              actorAvatar: n.actorAvatar || '',
              actorUserId: n.actorUserId || '',
              type: n.type || '',
              postId: n.postId || '',
              contentPreview: n.contentPreview || '',
              // 兼容双字段：isRead / is_read 任一为 true 即视为已读
              isRead: n.isRead === true || n.is_read === true,
              createdAt: n.createdAt || n.created_at || null,
              actionText: self.formatNotification(n),
              timeText: self.formatTime(n.createdAt || n.created_at)
            }
          })
          self.setData({
            notifications: list,
            unreadCount: res.result.unreadCount || 0
          })

          // 有未读则主动全部标已读
          var hasUnread = list.some(function(item) { return !item.isRead })
          if (hasUnread) {
            wx.cloud.callFunction({
              name: 'notification',
              data: { action: 'markAllAsRead' },
              success: function() {
                var updated = list.map(function(n) { return Object.assign({}, n, { isRead: true }) })
                self.setData({ notifications: updated })
              },
              fail: function() {}
            })
          }
        } else {
          self.setData({ notifications: [], unreadCount: 0 })
        }
      },
      fail: function() {
        console.warn('[消息] 云端加载失败')
        self.setData({ notifications: [], unreadCount: 0 })
      }
    })
  },

  /** 全部标记已读 */
  markAllRead() {
    var self = this
    wx.cloud.callFunction({
      name: 'notification',
      data: { action: 'markAllAsRead' },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          self.setData({ unreadCount: 0 })
          self.loadNotifications()
        }
      },
      fail: function() {}
    })
  },

  /** 点击通知：标为已读 + 跳转 */
  onNotificationTap(e) {
    var self = this
    var id = e.currentTarget.dataset.id
    var index = e.currentTarget.dataset.index
    var item = this.data.notifications[index]
    if (!item) return

    // 标为已读
    if (!item.isRead) {
      wx.cloud.callFunction({
        name: 'notification',
        data: { action: 'markAsRead', notificationId: id },
        success: function() {
          var list = self.data.notifications.slice()
          list[index] = Object.assign({}, list[index], { isRead: true })
          self.setData({ notifications: list })
        },
        fail: function() {}
      })
    }

    // 跳转
    if (item.type === 'follow') {
      wx.navigateTo({ url: '/pages/user/profile?userId=' + item.actorUserId })
    } else if (item.postId) {
      wx.navigateTo({ url: '/pages/journal/detail?id=' + item.postId })
    }
  },

  /** 长按通知：删除 */
  onNotificationLongPress(e) {
    var self = this
    var id = e.currentTarget.dataset.id
    var index = e.currentTarget.dataset.index

    wx.showActionSheet({
      itemList: ['删除此通知'],
      success: function(res) {
        if (res.tapIndex === 0) {
          self.deleteNotification(id, index)
        }
      }
    })
  },

  /** 删除单条通知（软删除） */
  deleteNotification(id, index) {
    var self = this
    wx.cloud.callFunction({
      name: 'notification',
      data: { action: 'deleteNotification', notificationId: id },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          var list = self.data.notifications.slice()
          list.splice(index, 1)
          self.setData({ notifications: list })
          wx.showToast({ title: '已删除', icon: 'success' })
        } else {
          wx.showToast({ title: '删除失败', icon: 'none' })
        }
      },
      fail: function() {
        wx.showToast({ title: '删除失败', icon: 'none' })
      }
    })
  },

  handleImageError(e) {
    handleImageError.call(this, e)
  },

  goBack() { wx.navigateBack() },
})
