import { self } from 'react-native-threads';
import calculate from '../WebViewCode/calculate';

async function run(id) {
    let start;
    let end;
    self.postMessage(JSON.stringify({ type: 'LOG', message: 'start' }));
    start = Date.now();
    await calculate();
    end = Date.now();
    self.postMessage(JSON.stringify({ type: 'LOG', message: 'end' }));
    const time = (end - start) / 1000;
    self.postMessage(JSON.stringify({ type: 'LOG', message: time }));
    self.postMessage(JSON.stringify({ type: 'END', id, time }));
}

async function receiveMessage(data) {
  if (data) {
      const { type, id } = JSON.parse(data);
      switch(type) {
          case 'END':
          case 'LOG':
            return;
          case 'RUN':
            run(id);
            break;
        default:
            // self.postMessage(JSON.stringify({ type: 'LOG', message: 'receiveMessage', event }));
            break;
      }
  }
}

self.onmessage = receiveMessage;