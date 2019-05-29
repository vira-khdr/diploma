import { Worker } from 'rn-workers';

// start a new react native JS process
const worker = new Worker();
const resolvers = {};

export async function send(data) {
    const id = Date.now();
    worker.postMessage(JSON.stringify({ ...data, id }));

    return new Promise(resolve => resolvers[id] = resolve);
}

// listen for messages
worker.onmessage = (_data) => {
    const { id, type, ...data } = JSON.parse(_data);
    console.log({ id, type, ...data });

    if (resolvers) {
        if (resolvers[id]) resolvers[id](data);
        delete resolvers[id];
    }
}