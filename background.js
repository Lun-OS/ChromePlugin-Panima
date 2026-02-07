const state = {
  active: false,
  tabId: null,
  filters: null,
  startTime: null,
  requests: new Map(),
  responses: new Map(),
  resources: [],
  wsFrames: new Map()
}

const textEncoder = new TextEncoder()

const typeGroups = {
  js: ["application/javascript", "text/javascript", "application/x-javascript"],
  css: ["text/css"],
  html: ["text/html", "application/xhtml+xml"],
  image: ["image/"],
  video: ["video/"]
}

const imageExts = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg", ".ico", ".avif", ".tiff"])
const videoExts = new Set([".mp4", ".webm", ".mov", ".mkv", ".flv", ".m3u8", ".ts", ".avi", ".wmv"])

function writeUint16(buffer, offset, value) {
  buffer[offset] = value & 255
  buffer[offset + 1] = (value >> 8) & 255
}

function writeUint32(buffer, offset, value) {
  buffer[offset] = value & 255
  buffer[offset + 1] = (value >> 8) & 255
  buffer[offset + 2] = (value >> 16) & 255
  buffer[offset + 3] = (value >> 24) & 255
}

function crc32(data) {
  let crc = 4294967295
  for (let i = 0; i < data.length; i += 1) {
    crc ^= data[i]
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1)
      crc = (crc >>> 1) ^ (3988292384 & mask)
    }
  }
  return (crc ^ 4294967295) >>> 0
}

function toUint8Array(body, base64) {
  if (!body) return new Uint8Array()
  if (!base64) return textEncoder.encode(body)
  const binary = atob(body)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function buildZipBlob(files) {
  const fileRecords = []
  const chunks = []
  let offset = 0
  for (const file of files) {
    const nameBytes = textEncoder.encode(file.path)
    const dataBytes = toUint8Array(file.body, file.base64)
    const checksum = crc32(dataBytes)
    const localHeader = new Uint8Array(30 + nameBytes.length)
    writeUint32(localHeader, 0, 67324752)
    writeUint16(localHeader, 4, 20)
    writeUint16(localHeader, 6, 0)
    writeUint16(localHeader, 8, 0)
    writeUint16(localHeader, 10, 0)
    writeUint16(localHeader, 12, 0)
    writeUint32(localHeader, 14, checksum)
    writeUint32(localHeader, 18, dataBytes.length)
    writeUint32(localHeader, 22, dataBytes.length)
    writeUint16(localHeader, 26, nameBytes.length)
    writeUint16(localHeader, 28, 0)
    localHeader.set(nameBytes, 30)
    chunks.push(localHeader, dataBytes)
    fileRecords.push({
      nameBytes,
      checksum,
      size: dataBytes.length,
      offset
    })
    offset += localHeader.length + dataBytes.length
  }
  const centralChunks = []
  let centralSize = 0
  for (const record of fileRecords) {
    const central = new Uint8Array(46 + record.nameBytes.length)
    writeUint32(central, 0, 33639248)
    writeUint16(central, 4, 20)
    writeUint16(central, 6, 20)
    writeUint16(central, 8, 0)
    writeUint16(central, 10, 0)
    writeUint16(central, 12, 0)
    writeUint16(central, 14, 0)
    writeUint32(central, 16, record.checksum)
    writeUint32(central, 20, record.size)
    writeUint32(central, 24, record.size)
    writeUint16(central, 28, record.nameBytes.length)
    writeUint16(central, 30, 0)
    writeUint16(central, 32, 0)
    writeUint16(central, 34, 0)
    writeUint16(central, 36, 0)
    writeUint32(central, 38, 0)
    writeUint32(central, 42, record.offset)
    central.set(record.nameBytes, 46)
    centralChunks.push(central)
    centralSize += central.length
  }
  const end = new Uint8Array(22)
  writeUint32(end, 0, 101010256)
  writeUint16(end, 4, 0)
  writeUint16(end, 6, 0)
  writeUint16(end, 8, fileRecords.length)
  writeUint16(end, 10, fileRecords.length)
  writeUint32(end, 12, centralSize)
  writeUint32(end, 16, offset)
  writeUint16(end, 20, 0)
  const totalSize =
    chunks.reduce((sum, chunk) => sum + chunk.length, 0) +
    centralChunks.reduce((sum, chunk) => sum + chunk.length, 0) +
    end.length
  const buffer = new Uint8Array(totalSize)
  let cursor = 0
  for (const chunk of chunks) {
    buffer.set(chunk, cursor)
    cursor += chunk.length
  }
  for (const chunk of centralChunks) {
    buffer.set(chunk, cursor)
    cursor += chunk.length
  }
  buffer.set(end, cursor)
  return new Blob([buffer], { type: "application/zip" })
}

async function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 32768
  let binary = ""
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

async function downloadBlob(blob, fileName) {
  const buffer = await blob.arrayBuffer()
  const base64 = await arrayBufferToBase64(buffer)
  const dataUrl = `data:application/zip;base64,${base64}`
  await chrome.downloads.download({ url: dataUrl, filename: fileName, saveAs: true })
}

function resetState() {
  state.active = false
  state.tabId = null
  state.filters = null
  state.startTime = null
  state.requests.clear()
  state.responses.clear()
  state.resources = []
  state.wsFrames.clear()
}

function isSelected(category) {
  return state.filters && state.filters[category]
}

function getCategory(url, mimeType) {
  const lowerUrl = url.toLowerCase()
  if (mimeType) {
    if (typeGroups.js.some((m) => mimeType.includes(m))) return "js"
    if (typeGroups.css.some((m) => mimeType.includes(m))) return "css"
    if (typeGroups.html.some((m) => mimeType.includes(m))) return "html"
    if (mimeType.startsWith("image/")) return "image"
    if (mimeType.startsWith("video/")) return "video"
  }
  const ext = getExtension(lowerUrl)
  if (imageExts.has(ext)) return "image"
  if (videoExts.has(ext)) return "video"
  if (ext === ".js" || ext === ".mjs") return "js"
  if (ext === ".css") return "css"
  if (ext === ".html" || ext === ".htm" || ext === ".shtml") return "html"
  return "other"
}

function getExtension(url) {
  const path = url.split("?")[0].split("#")[0]
  const dotIndex = path.lastIndexOf(".")
  if (dotIndex === -1) return ""
  return path.slice(dotIndex).toLowerCase()
}

function sanitizeSegment(segment) {
  return segment.replace(/[<>:"\\|?*\x00-\x1F]/g, "_").replace(/\s+/g, " ").trim()
}

function hashString(input) {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  return (hash >>> 0).toString(16)
}

function extensionFromMime(mimeType, fallbackCategory) {
  if (!mimeType) {
    if (fallbackCategory === "js") return ".js"
    if (fallbackCategory === "css") return ".css"
    if (fallbackCategory === "html") return ".html"
    return ""
  }
  if (mimeType.includes("javascript")) return ".js"
  if (mimeType.includes("text/css")) return ".css"
  if (mimeType.includes("text/html")) return ".html"
  if (mimeType.startsWith("image/")) return "." + mimeType.split("/")[1]
  if (mimeType.startsWith("video/")) return "." + mimeType.split("/")[1]
  return ""
}

function urlToPath(url, mimeType, category) {
  let urlObj
  try {
    urlObj = new URL(url)
  } catch {
    const fallback = sanitizeSegment(url)
    return `unknown/${fallback || "resource"}`
  }
  const host = sanitizeSegment(urlObj.host.replace(":", "_"))
  let pathname = urlObj.pathname || "/"
  if (!pathname.startsWith("/")) pathname = "/" + pathname
  const segments = pathname.split("/").map((seg) => sanitizeSegment(decodeURIComponent(seg)))
  let fileName = segments.pop() || ""
  const hasTrailingSlash = pathname.endsWith("/")
  if (hasTrailingSlash || !fileName) {
    fileName = "index"
  }
  const ext = getExtension(fileName)
  if (!ext) {
    fileName += extensionFromMime(mimeType, category) || ".bin"
  }
  if (urlObj.search) {
    fileName += "__q" + hashString(urlObj.search)
  }
  segments.push(fileName)
  const cleanSegments = segments.filter((seg) => seg.length > 0)
  return [host, ...cleanSegments].join("/")
}

async function startCrawl(filters) {
  if (state.active) return { ok: false, error: "already_active" }
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const tab = tabs[0]
  if (!tab || !tab.id || !tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("edge://")) {
    return { ok: false, error: "invalid_tab" }
  }
  resetState()
  state.active = true
  state.tabId = tab.id
  state.filters = filters
  state.startTime = Date.now()
  await chrome.debugger.attach({ tabId: tab.id }, "1.3")
  await chrome.debugger.sendCommand({ tabId: tab.id }, "Network.enable")
  await chrome.debugger.sendCommand({ tabId: tab.id }, "Page.enable")
  await chrome.debugger.sendCommand({ tabId: tab.id }, "Network.setCacheDisabled", { cacheDisabled: true })
  await chrome.tabs.reload(tab.id, { bypassCache: true })
  return { ok: true }
}

async function stopCrawl() {
  if (!state.active || state.tabId === null) return { ok: false, error: "not_active" }
  const tabId = state.tabId
  state.active = false
  try {
    await chrome.debugger.detach({ tabId })
  } catch {}
  const zipBlob = await buildZip()
  const fileName = buildZipName()
  await downloadBlob(zipBlob, fileName)
  resetState()
  return { ok: true }
}

function buildZipName() {
  const now = new Date()
  const pad = (v) => v.toString().padStart(2, "0")
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `panima_${stamp}.zip`
}

async function buildZip() {
  const files = [...state.resources]
  if (isSelected("packets")) {
    const requests = []
    for (const [requestId, req] of state.requests.entries()) {
      const res = state.responses.get(requestId)
      const frames = state.wsFrames.get(requestId)
      requests.push({
        requestId,
        request: req || null,
        response: res || null,
        websocket: frames || null
      })
    }
    files.push({
      path: "packets/requests.json",
      body: JSON.stringify({ createdAt: new Date().toISOString(), items: requests }, null, 2),
      base64: false
    })
  }
  return buildZipBlob(files)
}

function shouldCaptureBody(category) {
  return isSelected(category) || isSelected("packets")
}

async function captureResponseBody(requestId) {
  if (!state.active || state.tabId === null) return
  let bodyInfo
  try {
    bodyInfo = await chrome.debugger.sendCommand({ tabId: state.tabId }, "Network.getResponseBody", { requestId })
  } catch (error) {
    const response = state.responses.get(requestId) || {}
    state.responses.set(requestId, {
      ...response,
      body: null,
      base64Encoded: false,
      bodyUnavailableReason: "getResponseBody_failed"
    })
    return
  }
  const response = state.responses.get(requestId) || {}
  state.responses.set(requestId, { ...response, body: bodyInfo.body, base64Encoded: bodyInfo.base64Encoded })
  const category = response.category || getCategory(response.url || "", response.mimeType || "")
  if (isSelected(category)) {
    const path = urlToPath(response.url || requestId, response.mimeType, category)
    state.resources.push({
      path,
      body: bodyInfo.body,
      base64: bodyInfo.base64Encoded,
      mimeType: response.mimeType || "",
      url: response.url || "",
      status: response.status || 0
    })
  }
}

chrome.debugger.onEvent.addListener((source, method, params) => {
  if (!state.active || source.tabId !== state.tabId) return
  if (method === "Network.requestWillBeSent") {
    state.requests.set(params.requestId, {
      url: params.request.url,
      method: params.request.method,
      headers: params.request.headers || {},
      postData: params.request.postData || null,
      timestamp: params.timestamp,
      initiator: params.initiator || null
    })
  } else if (method === "Network.responseReceived") {
    const category = getCategory(params.response.url, params.response.mimeType || "")
    state.responses.set(params.requestId, {
      url: params.response.url,
      status: params.response.status,
      statusText: params.response.statusText,
      headers: params.response.headers || {},
      mimeType: params.response.mimeType || "",
      protocol: params.response.protocol || "",
      category,
      resourceType: params.type || ""
    })
  } else if (method === "Network.loadingFinished") {
    const response = state.responses.get(params.requestId)
    const category = response ? response.category : "other"
    if (shouldCaptureBody(category)) {
      captureResponseBody(params.requestId)
    }
  } else if (method === "Network.webSocketFrameReceived" || method === "Network.webSocketFrameSent") {
    const list = state.wsFrames.get(params.requestId) || []
    list.push({
      direction: method === "Network.webSocketFrameSent" ? "sent" : "received",
      timestamp: params.timestamp,
      opcode: params.response.opcode,
      mask: params.response.mask,
      payloadData: params.response.payloadData
    })
    state.wsFrames.set(params.requestId, list)
  }
})

chrome.debugger.onDetach.addListener((source) => {
  if (source.tabId === state.tabId) {
    resetState()
  }
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "start") {
    startCrawl(message.filters).then(sendResponse)
    return true
  }
  if (message.type === "stop") {
    stopCrawl().then(sendResponse)
    return true
  }
  if (message.type === "status") {
    sendResponse({ active: state.active })
    return true
  }
  return false
})
