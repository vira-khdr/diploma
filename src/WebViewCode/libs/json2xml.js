#!/usr/bin/env node

/* eslint-disable */
const fs = require('fs');
const js2xmlparser = require('js2xmlparser');

const path = process.argv[2];

fs.readFile(path, 'utf8', onLoad);

function onLoad(err, json) {
    if (err) throw err;

    const xml = js2xmlparser('references', json);


    fs.writeFile(path.replace('.json', '.xml'), xml, (e) => {
        if (e) throw e;
        console.log(`${path.replace('.json', '.xml')} saved!`);
    });
}
