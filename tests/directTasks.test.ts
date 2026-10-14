import 'fake-indexeddb/auto'
import { beforeEach, expect, it } from 'vitest'
import { clearLocalData, loadData } from '../src/services/localDataService'
import { saveTask } from '../src/services/workspaceService'
import { parseSyncRecord } from '../src/shared/utils/records'
import { parentOf } from '../worker/merge'
import { parseTags } from '../src/shared/utils/tags'

beforeEach(() => clearLocalData())
it('creates a standalone task without a hidden note and preserves tags through sync parsing', async () => {
  const [record] = await saveTask({ captureId: null }, { title: 'Buy milk', dueAt: null, reminderAt: null, pinned: false, tags: ['personal'] })
  expect((await loadData()).captures).toEqual([])
  expect((await loadData()).tasks).toHaveLength(1)
  expect(parentOf(record)).toBeNull()
  expect(parseSyncRecord(record)).toMatchObject({ type: 'task', value: { captureId: null, tags: ['personal'] } })
})
it('normalises simple tags and rejects malformed synced tags', async () => {
  expect(parseTags('Work, personal, work, , errands')).toEqual(['work', 'personal', 'errands'])
  const [record] = await saveTask({ captureId: null }, { title: 'Buy milk', dueAt: null, reminderAt: null, pinned: false })
  expect(parseSyncRecord({ ...record, value: { ...record.value, tags: [2] } })).toBeNull()
})
