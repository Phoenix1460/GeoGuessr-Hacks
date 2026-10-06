const coordsEl = document.querySelector('#coords')
const statusEl = document.querySelector('#status')
let coords

chrome.runtime.sendMessage({ type: 'getCoords' }, (response) => {
  coords = response?.coords
  coordsEl.textContent = coords ? `${coords[0]}, ${coords[1]}` : 'No location captured yet.'
})

document.querySelector('#place').addEventListener('click', () => {
  if (!coords) return (statusEl.textContent = 'Capture a location first.')
  chrome.runtime.sendMessage({ type: 'placePinFromPopup', coords }, (response) => {
    statusEl.textContent = response?.error || response?.message || 'Pin placed.'
  })
})

document.querySelector('#maps').addEventListener('click', () => {
  if (coords) chrome.runtime.sendMessage({ type: 'openExternalMaps', coords })
})
