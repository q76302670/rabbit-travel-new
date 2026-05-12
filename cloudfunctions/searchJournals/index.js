const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloudbase-0gx2xhccf8b7742d' })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { keyword } = event
    if (!keyword || !keyword.trim()) return { code: 0, journals: [] }

    const reg = db.RegExp({ regexp: keyword.trim(), options: 'i' })
    const [titleRes, destRes] = await Promise.all([
      db.collection('journals').where({ status: 'published', title: reg }).limit(20).get(),
      db.collection('journals').where({ status: 'published', destination: reg }).limit(20).get()
    ])

    const all = [...titleRes.data, ...destRes.data]
    const seen = {}
    const journals = all.filter(j => { if (seen[j._id]) return false; seen[j._id] = true; return true })

    return { code: 0, journals }
  } catch (e) {
    return { code: -1, message: e.message }
  }
}
