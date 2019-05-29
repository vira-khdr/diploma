import { Thread } from 'react-native-threads';

// start a new react native JS process
const thread = new Thread('src/RNThreads/thread.js');
const resolvers = {};

export async function send(data) {
    const id = Date.now();
    thread.postMessage(JSON.stringify({ ...data, id }));

    return new Promise(resolve => resolvers[id] = resolve);
}

// listen for messages
thread.onmessage = (_data) => {
    const { id, type, ...data } = JSON.parse(_data);
    console.log({ id, type, ...data });

    if (resolvers) {
        if (resolvers[id]) resolvers[id](data);
        delete resolvers[id];
    }
}