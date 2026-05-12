const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloudbase-0gx2xhccf8b7742d' })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  try {
    const { userId } = event
    console.log('[getFollowing] 查询 userId:', userId)

    const followsRes = await db.collection('follows')
      .where({ follower_id: userId })
      .orderBy('created_at', 'desc')
      .limit(50)
      .get()

    console.log('[getFollowing] follows 记录数:', followsRes.data.length)
    console.log('[getFollowing] following_ids:', followsRes.data.map(f => f.following_id))

    if (followsRes.data.length === 0) return { code: 0, users: [] }

    const followingIds = followsRes.data.map(f => f.following_id)

    // 兼容查询：openid 字段或 _id 字段
    const usersRes = await db.collection('users')
      .where(_.or([
        { openid: _.in(followingIds) },
        { _id: _.in(followingIds) }
      ]))
      .get()

    console.log('[getFollowing] 查到 users 数:', usersRes.data.length)

    return { code: 0, users: usersRes.data }
  } catch (e) {
    console.error('[getFollowing]', e)
    return { code: -1, users: [], message: e.message }
  }
}
