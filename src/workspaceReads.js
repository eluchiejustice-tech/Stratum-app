// A refresh is successful only when every requested dataset was read.
export function tablePage(query, offset = 0, pageSize = 50) {
  return { async abortSignal(signal) {
    const response = await query.range(offset, offset + pageSize - 1).abortSignal(signal)
    if (response.error) return response
    const items = response.data || []
    if (!Array.isArray(items)) throw new Error('The list response was invalid. Refresh and retry.')
    if (!items.length && response.count != null && offset < response.count) throw new Error('The list changed or the page could not be read. Refresh and retry.')
    return { data: { items, nextOffset: offset + items.length,
      hasMore: response.count == null ? items.length === pageSize : offset + items.length < response.count,
      total: response.count ?? null } }
  } }
}

export async function readWorkspaceSnapshot(requests, { signal, timeoutMs = 30000 } = {}) {
  const controller = new AbortController()
  let timer, abort
  const interruption = new Promise((_, reject) => {
    abort = () => { controller.abort(); reject(new Error('Refresh cancelled.')) }
    if (signal?.aborted) return abort()
    signal?.addEventListener('abort', abort, { once: true })
    timer = setTimeout(() => {
      controller.abort()
      reject(new Error('The data request timed out. Check your connection and retry.'))
    }, timeoutMs)
  })
  try {
    const reads = Promise.all(Object.entries(requests).map(async ([name, query]) => {
      const response = await query.abortSignal(controller.signal)
      if (response.error) throw new Error(name + ': ' + response.error.message)
      return [name, response.data ?? response.count ?? null]
    }))
    return Object.fromEntries(await Promise.race([reads, interruption]))
  } catch (error) {
    controller.abort()
    throw error
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

