import calculate from './calculate';

let ReactNative = null;
if (
    (window.webkit != null) &&
    (window.webkit.messageHandlers != null) &&
    (window.webkit.messageHandlers.ReactNative != null) &&
    (typeof window.webkit.messageHandlers.ReactNative.postMessage === 'function')
) {
    ReactNative = window.webkit.messageHandlers.ReactNative;
}
else if (
    (window['window.webkit.messageHandlers.ReactNative'] != null) &&
    (typeof window['window.webkit.messageHandlers.ReactNative'].postMessage === 'function')
) {
    ReactNative = window['window.webkit.messageHandlers.ReactNative'];
} else if (
    window.ReactNativeWebView
) {
    ReactNative = window.ReactNativeWebView;
}

async function run(id) {
    let start;
    let end;
    ReactNative.postMessage(JSON.stringify({ type: 'LOG', message: 'start' }));
    document.getElementById('message').innerHTML+=`<br>start`;
    start = Date.now();
    await calculate();
    end = Date.now();
    ReactNative.postMessage(JSON.stringify({ type: 'LOG', message: 'end' }));
    document.getElementById('message').innerHTML+=`<br>end`;
    const time = (end - start) / 1000;
    ReactNative.postMessage(JSON.stringify({ type: 'LOG', message: time }));
    document.getElementById('message').innerHTML+=`<br>${time}`;
    ReactNative.postMessage(JSON.stringify({ type: 'END', id, time }));
}

async function receiveMessage(event) {
  document.getElementById('message').innerHTML=event.data;
  if (event && event.data) {
      const { type, id } = JSON.parse(event.data);
      document.getElementById('message').innerHTML+=`<br>${type}`;
      switch(type) {
          case 'END':
          case 'LOG':
            return;
          case 'RUN':
            run(id);
            break;
        default:
            // ReactNative.postMessage(JSON.stringify({ type: 'LOG', message: 'receiveMessage', event }));
            break;
      }
  }
}

// setTimeout(() => {
//   if (ReactNative !== null) ReactNative.postMessage(JSON.stringify({ type: 'LOG', message: 'connected document' }));
// // if (ReactNative !== null) ReactNative.postMessage('Hello WORLD');
// }, 3000);

document.addEventListener("message", receiveMessage, false);
window.addEventListener("message", receiveMessage, false);