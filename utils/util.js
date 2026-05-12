// utils/util.js — 通用工具函数

/** Toast 轻提示 */
export function showToast(title, icon = 'none', duration = 1500) {
  wx.showToast({ title, icon, duration })
}

/** 加载提示 */
export function showLoading(title = '加载中...') {
  wx.showLoading({ title, mask: true })
}

export function hideLoading() {
  wx.hideLoading()
}

/** 确认弹窗 */
export function showConfirm(title, content) {
  return new Promise((resolve) => {
    wx.showModal({
      title, content, confirmColor: '#8A4DFF',
      success: (res) => resolve(res.confirm),
    })
  })
}

/** 格式化时间 */
export function formatTime(date) {
  const d = new Date(date)
  const y = d.getFullYear()
  const M = d.getMonth() + 1
  const D = d.getDate()
  const h = d.getHours()
  const m = d.getMinutes()
  return `${y}/${pad(M)}/${pad(D)} ${pad(h)}:${pad(m)}`
}

/** 相对时间 */
export function formatRelative(date) {
  const diff = Date.now() - new Date(date).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min}分钟前`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour}小时前`
  const day = Math.floor(hour / 24)
  if (day < 30) return `${day}天前`
  return `${Math.floor(day / 30)}个月前`
}

function pad(n) { return n < 10 ? '0' + n : '' + n }
