const statusEl = document.getElementById("status")
const startBtn = document.getElementById("start")
const stopBtn = document.getElementById("stop")

function getFilters() {
  return {
    js: document.getElementById("opt-js").checked,
    css: document.getElementById("opt-css").checked,
    html: document.getElementById("opt-html").checked,
    image: document.getElementById("opt-image").checked,
    video: document.getElementById("opt-video").checked,
    packets: document.getElementById("opt-packets").checked,
    other: document.getElementById("opt-other").checked
  }
}

function setStatus(active) {
  if (active) {
    statusEl.textContent = "爬取中"
    startBtn.disabled = true
    stopBtn.disabled = false
  } else {
    statusEl.textContent = "空闲"
    startBtn.disabled = false
    stopBtn.disabled = true
  }
}

startBtn.addEventListener("click", async () => {
  const result = await chrome.runtime.sendMessage({ type: "start", filters: getFilters() })
  if (!result || !result.ok) {
    statusEl.textContent = "启动失败"
    return
  }
  setStatus(true)
})

stopBtn.addEventListener("click", async () => {
  const result = await chrome.runtime.sendMessage({ type: "stop" })
  if (!result || !result.ok) {
    statusEl.textContent = "停止失败"
    return
  }
  setStatus(false)
})

chrome.runtime.sendMessage({ type: "status" }).then((result) => {
  setStatus(result && result.active)
})
