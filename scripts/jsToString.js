const fs = require('fs');

async function main() {
    console.log('start', 1);
    const inputFilePath = `${process.cwd()}/src/WebViewCode/dist/bundle.js`;
    const outputFilePath = `${process.cwd()}/src/WebViewCode/dist/external-lib.js`
    console.log('start', 2);
    const js = await new Promise((resolve, reject) => {
        fs.readFile(inputFilePath, { encoding: 'utf-8' }, (err, data) => {
            if (err) reject(err);
            else resolve(data);
        });
    });
    console.log('start', 3);
    // console.log(js);
    const json = `module.exports = ${JSON.stringify(js)};`;
    console.log('start', 4);
    // console.log(json);
    await new Promise((resolve, reject) => {
        fs.writeFile(outputFilePath, json, { encoding: 'utf-8' }, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
    console.log('start', 5);
    process.exit(0);
}

main();