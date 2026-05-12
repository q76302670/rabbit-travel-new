// pages/collections/index.js — 收藏列表（云端数据）
import handleImageError from '../../utils/image-helper'
Page({
  data: {
    statusBarHeight: 44,
    navPaddingRight: 95,
    journals: [],
    loading: false,
    allJournals: [],
    filteredJournals: [],
    filteredLeftCol: [],
    filteredRightCol: [],
    searchKeyword: '',
  },

  onLoad() {
    this.setData({
      statusBarHeight: getApp().globalData.statusBarHeight || 44,
      navPaddingRight: getApp().globalData.capsulePaddingRight || 95
    })
  },

  onShow() {
    this.load()
  },

  /** 将数组拆分为左右两列 */
  _splitColumns(arr) {
    var left = []
    var right = []
    for (var i = 0; i < arr.length; i++) {
      i % 2 === 0 ? left.push(arr[i]) : right.push(arr[i])
    }
    return { left: left, right: right }
  },

  load() {
    var self = this
    self.setData({ loading: true })
    wx.cloud.callFunction({
      name: 'getUserLikes',
      data: { type: 'collect' },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          var journals = (res.result.journals || []).map(function(j) {
            return { ...j, coverUrl: j.cover || (j.photos && j.photos[0] ? j.photos[0].url : '') }
          })
          var cols = self._splitColumns(journals)
          self.setData({ journals: journals, leftCol: cols.left, rightCol: cols.right, allJournals: journals, filteredJournals: journals, filteredLeftCol: cols.left, filteredRightCol: cols.right, loading: false })
        } else {
          self.setData({ loading: false })
        }
      },
      fail: function(err) {
        console.error('[收藏列表] 加载失败:', err)
        self.setData({ loading: false })
        wx.showToast({ title: '加载失败', icon: 'none' })
      }
    })
  },

  handleImageError(e) {
    handleImageError.call(this, e)
  },

  goToDetail(e) {
    wx.navigateTo({ url: '/pages/journal/detail?id=' + e.currentTarget.dataset.id })
  },

  goBack() {
    const pages = getCurrentPages()
    if (pages.length <= 1) {
      wx.switchTab({ url: '/pages/profile/profile' })
    } else {
      wx.navigateBack()
    }
  },

  /** 搜索输入（防抖300ms） */
  onSearchInput(e) {
    var keyword = e.detail.value
    this.setData({ searchKeyword: keyword })
    if (this._searchTimer) clearTimeout(this._searchTimer)
    this._searchTimer = setTimeout(function(self) {
      self.filterList(keyword)
    }, 300, this)
  },

  /** 执行过滤 */
  filterList(keyword) {
    if (!keyword || !keyword.trim()) {
      var cols = this._splitColumns(this.data.allJournals)
      this.setData({ filteredJournals: this.data.allJournals, filteredLeftCol: cols.left, filteredRightCol: cols.right })
      return
    }
    var k = keyword.trim().toLowerCase()
    var filtered = this.data.allJournals.filter(function(j) {
      return (j.title && j.title.toLowerCase().indexOf(k) > -1) ||
             (j.destination && j.destination.toLowerCase().indexOf(k) > -1)
    })
    var cols = this._splitColumns(filtered)
    this.setData({ filteredJournals: filtered, filteredLeftCol: cols.left, filteredRightCol: cols.right })
  },

  /** 清空搜索 */
  onClearSearch() {
    var cols = this._splitColumns(this.data.allJournals)
    this.setData({ searchKeyword: '', filteredJournals: this.data.allJournals, filteredLeftCol: cols.left, filteredRightCol: cols.right })
  },

  /** 回车搜索 */
  onSearch() {
    if (this._searchTimer) clearTimeout(this._searchTimer)
    this.filterList(this.data.searchKeyword)
  },
})
