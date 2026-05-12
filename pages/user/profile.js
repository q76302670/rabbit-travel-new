// pages/user/profile.js — 他人主页
import JournalModel from '../../models/journal-model'
import handleImageError from '../../utils/image-helper'

Page({
  data: {
    user: null,
    journals: [],
    loading: false,
    targetUserId: '',
    isOwnProfile: false,
    isFollowing: false,
    followBtnClass: '',
    followBtnText: '+ 关注',
  },

  onLoad(query) {
    var app = getApp()
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight || 44,
      navPaddingRight: app.globalData.capsulePaddingRight || 95
    })
    var id = query.userId || query.id || ''
    if (id) {
      var myId = app.globalData.userId || ''
      this.setData({ targetUserId: id, isOwnProfile: id === myId })
      this.loadProfile(id)
      if (id !== myId && myId) {
        this.checkFollowStatus()
      }
    }
  },

  /** 检查是否已关注 */
  checkFollowStatus() {
    var self = this
    wx.cloud.callFunction({
      name: 'getFollowStatus',
      data: { targetUserId: this.data.targetUserId },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          self.setData({ isFollowing: res.result.isFollowing })
          self._updateFollowBtn(res.result.isFollowing)
        }
      }
    })
  },

  /** 更新关注按钮样式 */
  _updateFollowBtn(following) {
    this.setData({
      followBtnClass: following ? 'following' : '',
      followBtnText: following ? '已关注' : '+ 关注',
    })
  },

  /** 切换关注状态 */
  toggleFollow() {
    var app = getApp()
    if (!app.globalData.userId) {
      wx.navigateTo({ url: '/pages/login/login' })
      return
    }
    var self = this
    wx.cloud.callFunction({
      name: 'toggleFollow',
      data: { targetUserId: this.data.targetUserId },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          self.setData({ isFollowing: res.result.isFollowing })
          self._updateFollowBtn(res.result.isFollowing)
          // 通知被关注者（仅新关注时触发）
          if (res.result.isFollowing && self.data.targetUserId) {
            wx.cloud.callFunction({
              name: 'addNotification',
              data: {
                receiverId: self.data.targetUserId,
                type: 'follow',
                targetId: app.globalData.userId,
                targetType: 'user'
              }
            })
          }
          wx.showToast({
            title: res.result.isFollowing ? '已关注' : '已取消关注',
            icon: 'success'
          })
        } else {
          wx.showToast({ title: (res.result && res.result.message) || '操作失败', icon: 'none' })
        }
      },
      fail: function() {
        wx.showToast({ title: '网络异常', icon: 'none' })
      }
    })
  },

  loadProfile(userId) {
    this.setData({ loading: true })

    // 云端优先
    var self = this
    wx.cloud.callFunction({
      name: 'getUserJournals',
      data: { userId: userId, type: 'published' },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          var journals = (res.result.journals || []).map(function(j) {
            return {
              ...j,
              coverUrl: j.cover || (j.photos && j.photos[0] ? j.photos[0].url : '')
            }
          })
          // 取第一篇游记作为用户信息
          var first = journals[0]
          var user = {
            _id: userId,
            nickname: first ? (first.author_name || '旅行者') : '旅行者',
            avatar: first ? (first.author_avatar || '') : '',
          }
          self.setData({ user: user, journals: journals, loading: false })
        } else {
          throw new Error(res.result ? res.result.message : '加载失败')
        }
      },
      fail: function() {
        // 降级本地
        var all = JournalModel.loadAll()
        var myJournals = all.filter(function(j) { return j.author_id === userId && j.status === 'published' })
        var journal = null
        for (var i = 0; i < all.length; i++) {
          if (all[i].author_id === userId) { journal = all[i]; break }
        }
        var user = journal
          ? { _id: userId, nickname: journal.author_name || '旅行者', avatar: journal.author_avatar || '' }
          : { _id: userId, nickname: '旅行者', avatar: '' }
        self.setData({ user: user, journals: myJournals, loading: false })
      }
    })
  },

  goToDetail(e) {
    wx.navigateTo({ url: '/pages/journal/detail?id=' + e.currentTarget.dataset.id })
  },

  goBack() {
    var pages = getCurrentPages()
    if (pages.length <= 1) {
      wx.switchTab({ url: '/pages/index/index' })
    } else {
      wx.navigateBack()
    }
  },

  handleImageError(e) {
    handleImageError.call(this, e)
  },

  onShareAppMessage() {
    const u = this.data.user
    if (!u) return {}
    return {
      title: u.nickname + '的主页 - 兔子旅行',
      path: '/pages/user/profile?id=' + u._id,
    }
  },
})
