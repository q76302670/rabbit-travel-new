// 云函数 login — 微信登录（完整错误处理）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { OPENID } = cloud.getWXContext()
    console.log('[login] openid:', OPENID)

    if (!OPENID) {
      return { code: -1, message: 'openid 为空' }
    }

    const userCollection = db.collection('users')

    // 查找已有用户
    const existing = await userCollection
      .where({ openid: OPENID })
      .limit(1)
      .get()

    console.log('[login] 查询结果数量:', existing.data.length)

    if (existing.data.length > 0) {
      return { code: 0, user: existing.data[0], isNew: false }
    }

    // 新建用户
    const now = new Date().toISOString()
    const newUser = {
      openid: OPENID,
      nickname: '旅行者',
      avatar: '',
      bio: '',
      tags: [],
      is_admin: false,
      journal_count: 0,
      like_count: 0,
      created_at: now,
      updated_at: now,
    }

    const result = await userCollection.add({ data: newUser })
    console.log('[login] 新用户创建成功:', result._id)

    return { code: 0, user: { ...newUser, _id: result._id }, isNew: true }

  } catch (e) {
    console.error('[login] 云函数报错:', e)
    return { code: -1, message: e.message || '未知错误' }
  }
}
