import { WorkerService } from 'rn-workers';
import calculate from '../WebViewCode/calculate';

const worker = new WorkerService();

async function run(id) {
    let start;
    let end;
    worker.postMessage(JSON.stringify({ type: 'LOG', message: 'start' }));
    start = Date.now();
    await calculate();
    end = Date.now();
    worker.postMessage(JSON.stringify({ type: 'LOG', message: 'end' }));
    const time = (end - start) / 1000;
    worker.postMessage(JSON.stringify({ type: 'LOG', message: time }));
    worker.postMessage(JSON.stringify({ type: 'END', id, time }));
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
            // worker.postMessage(JSON.stringify({ type: 'LOG', message: 'receiveMessage', event }));
            break;
      }
  }
}

worker.onmessage = receiveMessage;