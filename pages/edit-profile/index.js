// pages/edit-profile/index.js — 编辑资料
import handleImageError from '../../utils/image-helper'
const app = getApp()

Page({
  data: {
    statusBarHeight: 44,
    navPaddingRight: 95,
    nickname: '',
    bio: '',
    avatar: '',
    saving: false,
    allTags: ['胶片摄影', '独行侠', '落日收集者', '城市漫游', '极简主义', '当地美食', '自然风光', '历史文化', '徒步探险', '艺术策展'],
    selectedTags: [],
  },

  onLoad() {
    var app = getApp()
    var statusBarHeight = app.globalData.statusBarHeight || 44
    var capsulePaddingRight = app.globalData.capsulePaddingRight || 95
    console.log('[编辑资料] statusBarHeight:', statusBarHeight, 'navPaddingRight:', capsulePaddingRight)

    var user = app.globalData.userInfo
    var navHeight = statusBarHeight + (88 / 2)  // 88rpx ≈ 44px
    this.setData({
      statusBarHeight: statusBarHeight,
      navPaddingRight: capsulePaddingRight,
      navHeight: navHeight,
      nickname: user ? user.nickname || '' : '',
      bio: user ? user.bio || '' : '',
      avatar: user ? user.avatar || '' : '',
      selectedTags: user ? user.tags || [] : [],
    })
  },

  chooseAvatar() {
    wx.chooseMedia({
      count: 1, mediaType: ['image'], sourceType: ['album', 'camera'],
      success: function(res) {
        this.setData({ avatar: res.tempFiles[0].tempFilePath })
      }.bind(this),
    })
  },

  onNicknameInput(e) { this.setData({ nickname: e.detail.value }) },
  onBioInput(e) { this.setData({ bio: e.detail.value }) },

  /** 切换标签 */
  toggleTag(e) {
    console.log('[标签] toggleTag 触发', JSON.stringify(e.currentTarget.dataset))
    var tag = e.currentTarget.dataset.tag
    var tags = this.data.selectedTags.slice()
    var idx = tags.indexOf(tag)
    if (idx > -1) {
      tags.splice(idx, 1)
    } else {
      if (tags.length >= 5) { wx.showToast({ title: '最多选5个标签', icon: 'none' }); return }
      tags.push(tag)
    }
    this.setData({ selectedTags: tags })
  },

  /** 保存到云端 */
  saveProfile() {
    var self = this
    var nickname = this.data.nickname || '旅行者'
    var bio = this.data.bio || ''
    var tags = this.data.selectedTags || []

    if (!nickname.trim()) { wx.showToast({ title: '昵称不能为空', icon: 'none' }); return }

    wx.showLoading({ title: '保存中...' })
    wx.cloud.callFunction({
      name: 'updateUserProfile',
      data: { nickname: nickname.trim(), bio: bio, tags: tags },
      success: function(res) {
        wx.hideLoading()
        if (res.result && res.result.code === 0) {
          var app = getApp()
          if (app.globalData.userInfo) {
            app.globalData.userInfo.nickname = nickname.trim()
            app.globalData.userInfo.bio = bio
            app.globalData.userInfo.tags = tags
            wx.setStorageSync('rabbit_travel_user', JSON.stringify(app.globalData.userInfo))
          }
          wx.showToast({ title: '保存成功', icon: 'success' })
          setTimeout(function() {
            var pages = getCurrentPages()
            if (pages.length <= 1) { wx.switchTab({ url: '/pages/profile/profile' }) }
            else { wx.navigateBack() }
          }, 1500)
        } else {
          wx.showToast({ title: '保存失败', icon: 'error' })
        }
      },
      fail: function() {
        wx.hideLoading()
        wx.showToast({ title: '保存失败', icon: 'error' })
      }
    })
  },

  handleImageError(e) {
    handleImageError.call(this, e)
  },

  goBack() { wx.navigateBack() },
})
