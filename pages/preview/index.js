const app = getApp()

Page({
  data: {
    journal: null,
    photos: [],
    loading: true,
    statusBarHeight: 44,
    hasPhotos: false,
    photoCount: 0,
  },

  onLoad() {
    this.setData({ statusBarHeight: app.globalData.statusBarHeight || 44 })
    var previewData = app.globalData.previewData || {}
    console.log('[预览] 接收数据:', JSON.stringify(previewData))
    var photos = previewData.photos || []
    if (previewData && previewData.photos) {
      this.setData({
        journal: previewData,
        photos: photos,
        loading: false,
        hasPhotos: photos.length > 0,
        photoCount: photos.length,
      })
    } else {
      wx.showToast({ title: '预览数据不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1000)
    }
  },

  goBack() {
    wx.navigateBack()
  },
})
