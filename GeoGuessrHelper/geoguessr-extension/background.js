chrome.webRequest.onCompleted.addListener(async (request) => {
  if (request.method !== 'GET' || request.type !== 'script' || !request.url.includes('GeoPhotoService')) return

  try {
    const response = await fetch(request.url)
    const data = await response.text()
    const match = data.match(/\[null,null,(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\]/) || data.match(/\[null,(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\]/)
    if (!match) return

    const coords = [Number(match[1]), Number(match[2])]
    if (Number.isFinite(coords[0]) && Number.isFinite(coords[1])) {
      await chrome.storage.sync.set({ coords })
      console.log('[GeoGuessr helper] location captured:', coords)
    }
  } catch (error) {
    console.error('[GeoGuessr helper] could not capture location', error)
  }
}, { urls: ['<all_urls>'] })

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'getCoords') return
  chrome.storage.sync.get('coords').then(({ coords }) => sendResponse({ coords }))
  return true
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'placePin') return
  chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(([tab]) => {
    if (!tab?.id) throw new Error('No active GeoGuessr tab found')
    return chrome.tabs.sendMessage(tab.id, { type: 'placePin', coords: message.coords })
  }).then(sendResponse).catch((error) => sendResponse({ error: error.message }))
  return true
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'hotkey-analysis') {
    chrome.storage.sync.get('coords').then(({ coords }) => {
      if (!coords || !sender.tab?.id) return { ok: false }
      return chrome.tabs.sendMessage(sender.tab.id, { type: 'place-guess', payload: { lat: coords[0], lng: coords[1], smartZoom: false, autoGuess: false } }).then(() => ({ ok: true }))
    }).then(sendResponse).catch((error) => sendResponse({ ok: false, error: error.message }))
    return true
  }
  if (message.type === 'getCoords') {
    chrome.storage.sync.get('coords').then(({ coords }) => sendResponse({ coords }))
    return true
  }
})

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus?.create({ id: 'place-geo-pin', title: 'Place captured GeoGuessr pin', contexts: ['action'] })
})

chrome.contextMenus?.onClicked.addListener(async () => {
  const { coords } = await chrome.storage.sync.get('coords')
  if (coords) chrome.runtime.sendMessage({ type: 'placePin', coords })
})

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'placePinInTab') {
    chrome.tabs.sendMessage(message.tabId, { type: 'placePin', coords: message.coords })
  }
})

chrome.runtime.onConnect.addListener(() => {})

chrome.commands?.onCommand.addListener(async (command) => {
  if (command !== 'place-pin') return
  const { coords } = await chrome.storage.sync.get('coords')
  if (!coords) return
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'placePin', coords })
})

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'placePinInCurrentTab' && sender.tab?.id) {
    chrome.tabs.sendMessage(sender.tab.id, { type: 'placePin', coords: message.coords })
  }
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'placePinFromPopup') {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (!tab?.id) throw new Error('No active tab')
      return chrome.tabs.sendMessage(tab.id, { type: 'placePin', coords: message.coords })
    }).then(sendResponse).catch((error) => sendResponse({ error: error.message }))
    return true
  }
})

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'submitGuess') {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'placePin', coords: message.coords, submit: true })
    })
  }
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'getCapturedCoords') {
    chrome.storage.sync.get('coords').then(({ coords }) => sendResponse({ coords }))
    return true
  }
  if (message.type === 'openMapsFromPopup') chrome.runtime.sendMessage({ type: 'openMaps', coords: message.coords })
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'placePinFromPopup') return
  chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(([tab]) => {
    if (!tab?.id || !/^https?:\/\/(www\.)?(geoguessr|worldguessr)\.com\//.test(tab.url || '')) throw new Error('Open a GeoGuessr or WorldGuessr round before placing the pin.')
    return chrome.tabs.sendMessage(tab.id, { type: 'placePin', coords: message.coords })
  }).then(sendResponse).catch((error) => sendResponse({ error: error.message }))
  return true
})

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'placePinDirect') chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => tab?.id && chrome.tabs.sendMessage(tab.id, message))
})

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'openMapsDirect') chrome.tabs.create({ url: `https://www.google.com/maps/search/?api=1&query=${message.coords.join(',')}` })
})

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'placePinAndSubmit') chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => tab?.id && chrome.tabs.sendMessage(tab.id, { ...message, type: 'placePin' }))
})

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'openExternalMaps') chrome.tabs.create({ url: `https://www.google.com/maps/search/?api=1&query=${message.coords.join(',')}` })
})

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'placePinNow') chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => tab?.id && chrome.tabs.sendMessage(tab.id, { type: 'placePin', coords: message.coords }))
})

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'openGoogleMaps') chrome.tabs.create({ url: `https://www.google.com/maps/search/?api=1&query=${message.coords[0]},${message.coords[1]}` })
})

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'placePinInGeoGuessr') chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => tab?.id && chrome.tabs.sendMessage(tab.id, { type: 'placePin', coords: message.coords, submit: message.submit }))
})
