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
}

async function run(id) {
    let start;
    let end;
    document.postMessage(JSON.stringify({ type: 'LOG', message: 'start' }));
    start = Date.now();
    await calculate();
    end = Date.now();
    document.postMessage(JSON.stringify({ type: 'LOG', message: 'end' }));
    const time = (end - start) / 1000;
    document.postMessage(JSON.stringify({ type: 'LOG', message: time }));
    document.postMessage(JSON.stringify({ type: 'END', id, time }));
}

async function receiveMessage(event) {
  if (event && event.data) {
      const { type, id } = JSON.parse(event.data);
      switch(type) {
          case 'END':
          case 'LOG':
            return;
          case 'RUN':
            run(id);
            break;
        default:
            document.postMessage(JSON.stringify({ type: 'LOG', message: 'receiveMessage', event }));
            break;
      }
  }
}

setTimeout(() => {
  window.postMessage(JSON.stringify({ type: 'LOG', message: 'connected window' }));
  if (ReactNative !== null) ReactNative.postMessage(JSON.stringify({ type: 'LOG', message: 'connected document' }));
}, 5000);

document.addEventListener("message", receiveMessage, false);