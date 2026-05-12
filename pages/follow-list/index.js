// pages/follow-list/index.js — 粉丝/关注通用列表页
const app = getApp()

Page({
  data: {
    statusBarHeight: 44,
    navHeight: 88,
    users: [],
    pageTitle: '',
    emptyText: '',
    type: 'followers',
    targetUserId: ''
  },

  onLoad(options) {
    var type = options.type || 'followers'
    var userId = options.userId
    var statusBarHeight = app.globalData.statusBarHeight || 44

    this.setData({
      type: type,
      targetUserId: userId,
      statusBarHeight: statusBarHeight,
      navHeight: 88 + statusBarHeight,
      pageTitle: type === 'followers' ? '粉丝' : '关注',
      emptyText: type === 'followers' ? '还没有粉丝' : '还没有关注任何人'
    })

    this.loadList()
  },

  loadList() {
    var self = this
    var cloudName = this.data.type === 'followers' ? 'getFollowers' : 'getFollowing'

    wx.cloud.callFunction({
      name: cloudName,
      data: { userId: this.data.targetUserId },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          self.setData({ users: res.result.users || [] })
        }
      },
      fail: function(err) {
        console.warn('[关注列表] 加载失败:', err)
      }
    })
  },

  goToUser(e) {
    var id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/user/profile?userId=' + id })
  },

  goBack() {
    var pages = getCurrentPages()
    if (pages.length <= 1) {
      wx.switchTab({ url: '/pages/profile/profile' })
    } else {
      wx.navigateBack()
    }
  }
})
