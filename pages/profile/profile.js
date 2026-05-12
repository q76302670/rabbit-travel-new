// pages/profile/profile.js — 个人中心
import JournalModel from '../../models/journal-model'
import InteractionModel from '../../models/interaction-model'
import handleImageError from '../../utils/image-helper'

const app = getApp()

Page({
  data: {
    user: null,
    isLoggedIn: false,
    journalCount: 0,
    followerCount: 0,
    followingCount: 0,
    statusBarHeight: 44,
    unreadCount: 0,
    unreadText: '',
    unreadClass: '',
  },

  onLoad() {
    var app = getApp()
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight || 44,
      navPaddingRight: app.globalData.capsulePaddingRight || 95,
    })
  },

  onShow() {
    this.loadProfile()
    this.loadFollowCount()
    this.loadUnreadCount()
  },

  async loadProfile() {
    var user = app.globalData.userInfo
    var isLoggedIn = app.globalData.isLoggedIn

    if (!isLoggedIn || !user) {
      this.setData({ isLoggedIn: false, user: null, journalCount: 0, likeCount: 0 })
      return
    }

    this.setData({ user: user, isLoggedIn: true })

    // 云端优先，失败降级本地
    try {
      var statsRes = await this._callCloud('getUserStats', {})
      if (statsRes && statsRes.code === 0) {
        this.setData({
          journalCount: statsRes.journalCount || 0
        })
      } else {
        throw new Error('stats failed')
      }
    // 加载未读数 — 统一走 notification.getUnreadCount
    try {
      var notifRes = await this._callCloud('notification', { action: 'getUnreadCount' })
      if (notifRes && notifRes.code === 0) {
        var uc = notifRes.unreadCount || 0
        this.setData({ unreadCount: uc, unreadText: uc > 99 ? '99+' : String(uc), unreadClass: uc > 0 ? 'has-unread' : '' })
      }
    } catch (e) {}

    } catch (e) {
      console.warn('[个人中心] 云端统计失败，降级本地:', e)
      var allJournals = JournalModel.loadAll()
      var myJournals = allJournals.filter(function(j) { return j.author_id === user._id && j.status === 'published' })
      this.setData({
        journalCount: myJournals.length
      })
    }
  },

  /** 加载未读消息数 — 统一走 notification.getUnreadCount */
  loadUnreadCount() {
    var self = this
    wx.cloud.callFunction({
      name: 'notification',
      data: { action: 'getUnreadCount' },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          var count = res.result.unreadCount || 0
          self.setData({ unreadCount: count, unreadText: count > 99 ? '99+' : String(count), unreadClass: count > 0 ? 'has-unread' : '' })
          console.log('[消息角标] unreadCount:', count)
        }
      },
      fail: function() {}
    })
  },

  _callCloud(name, data) {
    var self = this
    return new Promise(function(resolve, reject) {
      wx.cloud.callFunction({
        name: name,
        data: data || {},
        success: function(res) { resolve(res.result) },
        fail: function(err) {
          console.warn('[个人中心] 云函数调用失败:', name, err)
          reject(err)
        }
      })
    })
  },

  goToDetail(e) {
    var id = e.currentTarget.dataset.id
    if (id) wx.navigateTo({ url: '/pages/journal/detail?id=' + id })
  },

  goToLogin() {
    // 主动登录 → 不加 redirect → 登录成功后回首页
    wx.navigateTo({ url: '/pages/login/login' })
  },
  goToMyJournals() { wx.navigateTo({ url: '/pages/my-journals/index' }) },
  goToDrafts() { wx.navigateTo({ url: '/pages/drafts/drafts' }) },
  goToCollections() { wx.navigateTo({ url: '/pages/collections/index' }) },
  goToLikes() { wx.navigateTo({ url: '/pages/likes/index' }) },
  goToMessages() { wx.navigateTo({ url: '/pages/message/message' }) },

  /** 加载粉丝/关注数 */
  loadFollowCount() {
    var self = this
    var userId = app.globalData.userId
    if (!userId) return

    wx.cloud.callFunction({
      name: 'getFollowers',
      data: { userId: userId },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          self.setData({ followerCount: res.result.users ? res.result.users.length : 0 })
        }
      },
      fail: function() {}
    })

    wx.cloud.callFunction({
      name: 'getFollowing',
      data: { userId: userId },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          self.setData({ followingCount: res.result.users ? res.result.users.length : 0 })
        }
      },
      fail: function() {}
    })
  },

  goToFollowers() {
    var userId = app.globalData.userId
    if (!userId) return
    wx.navigateTo({ url: '/pages/follow-list/index?userId=' + userId + '&type=followers' })
  },

  goToFollowing() {
    var userId = app.globalData.userId
    if (!userId) return
    wx.navigateTo({ url: '/pages/follow-list/index?userId=' + userId + '&type=following' })
  },
  goToEditProfile() {
    var app = getApp()
    if (!app.globalData.userId) {
      wx.navigateTo({ url: '/pages/login/login' })
      return
    }
    wx.navigateTo({ url: '/pages/edit-profile/index' })
  },
  goToAdmin() { wx.navigateTo({ url: '/pages/admin/index' }) },

  handleImageError(e) {
    handleImageError.call(this, e)
  },

  handleLogout() {
    var self = this
    wx.showModal({
      title: '退出登录',
      content: '确认退出当前账号？',
      confirmText: '退出',
      confirmColor: '#FF4444',
      success: function(res) {
        if (!res.confirm) return

        var app = getApp()
        
        // ----- 日志打印 -----
        console.log('[退出登录] 执行前 globalData:', JSON.stringify({
          userId: app.globalData.userId,
          openid: app.globalData.openid,
          userInfo: app.globalData.userInfo,
          token: app.globalData.token,
          isLoggedIn: app.globalData.isLoggedIn
        }))
        console.log('[退出登录] 执行前 storage userId:', wx.getStorageSync('userId'))
        console.log('[退出登录] 执行前 storage userInfo:', wx.getStorageSync('userInfo'))
        console.log('[退出登录] storage 全部 key:', wx.getStorageInfoSync().keys)

        // ----- 清理 globalData -----
        app.globalData.userId = null
        app.globalData.openid = null
        app.globalData.userInfo = null
        app.globalData.token = null
        app.globalData.isLoggedIn = false

        // ----- 清理 storage（列出 keys 动态清除所有登录相关 key）-----
        var loginKeys = wx.getStorageInfoSync().keys
        var toRemove = []
        for (var i = 0; i < loginKeys.length; i++) {
          var k = loginKeys[i]
          if (k === 'userId' || k === 'openid' || k === 'userInfo' || 
              k === 'token' || k === 'isLoggedIn' || k === 'loginToken' || 
              k === 'user_token' || k === 'auth_token' || k.indexOf('login') >= 0 ||
              k.indexOf('user') >= 0 || k.indexOf('auth') >= 0 || k.indexOf('token') >= 0) {
            toRemove.push(k)
          }
        }
        for (var j = 0; j < toRemove.length; j++) {
          try { wx.removeStorageSync(toRemove[j]) } catch (e) {}
        }
        console.log('[退出登录] 已清除 storage key:', toRemove)

        // ----- 重置页面数据 -----
        self.setData({
          isLoggedIn: false,
          userInfo: null,
          user: null,          // ★★★ 关键修复：WXML 用 {{user.avatar}} 和 {{user.nickname}}
          avatar: '',
          nickname: '',
          journalCount: 0,
        })

        // ----- 标记已主动退出，防止下次冷启动自动登录 -----
        wx.setStorageSync('hasLoggedOut', true)
        console.log('[退出登录] 已设置退出标记 hasLoggedOut=true')

        // ----- 打印最终状态确认 -----
        console.log('[退出登录] 执行后 storage userId:', wx.getStorageSync('userId'))
        console.log('[退出登录] 执行后 storage 剩余 key:', wx.getStorageInfoSync().keys)

        wx.showToast({ title: '已退出登录', icon: 'none' })
      }
    })
  },
})
