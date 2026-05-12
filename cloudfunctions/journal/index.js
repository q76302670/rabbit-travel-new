// 云函数 journal — 游记 CRUD + 草稿
const cloud = require('wx-server-sdk')
cloud.init()

const db = cloud.database()
const journals = db.collection('journals')

exports.main = async (event, context) => {
  const { action, ...data } = event
  const openid = context.OPENID

  try {
    switch (action) {
      case 'create':
        return await createJournal(openid, data)
      case 'list':
        return await listJournals(data)
      case 'get':
        return await getJournal(data.id)
      case 'saveDraft':
        return await saveDraft(openid, data)
      case 'listDrafts':
        return await listDrafts(openid)
      case 'deleteDraft':
        return await deleteDraft(openid, data.id)
      case 'publishDraft':
        return await publishDraft(openid, data.id)
      default:
        return { success: false, error: '未知操作' }
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

async function createJournal(openid, data) {
  const journal = {
    ...data,
    author_id: openid,
    status: 'published',
    like_count: 0,
    collect_count: 0,
    comment_count: 0,
    created_at: db.serverDate(),
    updated_at: db.serverDate(),
    published_at: db.serverDate(),
  }
  const res = await journals.add({ data: journal })
  journal._id = res._id
  return { success: true, data: journal }
}

async function listJournals(data) {
  const query = { status: 'published' }
  const res = await journals.where(query).orderBy('published_at', 'desc').get()
  return { success: true, data: res.data }
}

async function getJournal(id) {
  const res = await journals.doc(id).get()
  return { success: true, data: res.data }
}

async function saveDraft(openid, data) {
  const doc = {
    ...data,
    author_id: openid,
    status: 'draft',
    updated_at: db.serverDate(),
    created_at: db.serverDate(),
    like_count: 0,
    collect_count: 0,
    comment_count: 0,
  }
  const res = await journals.add({ data: doc })
  doc._id = res._id
  return { success: true, data: doc }
}

async function listDrafts(openid) {
  const res = await journals.where({ author_id: openid, status: 'draft' }).orderBy('updated_at', 'desc').get()
  return { success: true, data: res.data }
}

async function deleteDraft(openid, id) {
  await journals.doc(id).remove()
  return { success: true }
}

async function publishDraft(openid, id) {
  await journals.doc(id).update({
    data: { status: 'published', published_at: db.serverDate(), updated_at: db.serverDate() },
  })
  const res = await journals.doc(id).get()
  return { success: true, data: res.data }
}
