// ========================================
// 兔子旅行 — 用户服务（登录/登出/本地缓存）
// ========================================

const USER_KEY = 'rabbit_travel_user'
const DEVICE_ID_KEY = 'rabbit_travel_device_id'

/**
 * 获取/创建设备稳定标识
 * 同一台设备始终返回同一个 ID，不受登录/登出影响
 * 保证本地闭环阶段 ownership 体系稳定
 */
function getDeviceId() {
  try {
    let id = wx.getStorageSync(DEVICE_ID_KEY)
    if (!id) {
      id = 'dev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
      wx.setStorageSync(DEVICE_ID_KEY, id)
    }
    return id
  } catch {
    return 'dev_' + Date.now()
  }
}

/** 检查本地存储的登录态 */
function checkLogin() {
  try {
    const raw = wx.getStorageSync(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/**
 * 微信登录（云端 → 本地降级）
 * 注意：getApp() 在函数内部调用，此时 App 已就绪
 */
async function login() {
  const app = getApp()

  let code = ''
  try {
    const res = await wx.login()
    code = res && res.code ? res.code : ''
  } catch (err) {
    console.warn('[UserService] wx.login 失败', err)
  }

  // 先试云端
  if (app.globalData && app.globalData.isCloudReady) {
    try {
      const cloudRes = await wx.cloud.callFunction({
        name: 'login',
        data: { code },
      })
      const result = cloudRes.result
      // cloud function 返回 { code: 0, user: {...} } 表示成功
      if (result && result.code === 0) {
        const user = result.user
        wx.setStorageSync(USER_KEY, JSON.stringify(user))
        wx.setStorageSync('token', user.openid || user._id || '')
        return user
      }
    } catch (err) {
      console.warn('[UserService] 云端登录失败，降级本地', err)
    }
  }

  // 本地降级：使用稳定 deviceId 作为用户标识
  const deviceId = getDeviceId()
  const user = {
    _id: deviceId,
    nickname: '旅行者',
    avatar: '',
    is_admin: false,
  }
  wx.setStorageSync(USER_KEY, JSON.stringify(user))
  return user
}

/** 退出登录 */
function logout() {
  wx.removeStorageSync(USER_KEY)
}

module.exports = {
  checkLogin,
  login,
  logout,
  getDeviceId,
}
