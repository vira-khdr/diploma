const resolvers = {};

function send(data) {
    const id = Date.now();
    window.postMessage({ ...data, id });

    return new Promise((resolve) => {
        resolvers[id] = resolve;
    });
}

function _receiver({ data }) {
    const { id, type, ...dataT } = data;

    if (resolvers[id] && type === 'END') resolvers[id](dataT);
    delete resolvers[id];
}

window.addEventListener('message', _receiver);