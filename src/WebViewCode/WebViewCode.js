import React, { Component } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

const myJsLib = require('./dist/external-lib.js');

export default class WebViewCode extends Component {
    constructor(...args) {        
        super(...args);
        this.resolvers = {};
    }
    send = (data) => {
        if (this.webView) {
            const id = Date.now();
            this.webView.postMessage(JSON.stringify({ ...data, id }));

            return new Promise(resolve => this.resolvers[id] = resolve);
        }
    }
    _receiver = (event) => {
        console.log(event.nativeEvent);
        const { id, type, ...data } = JSON.parse(event.nativeEvent.data);
        console.log({ id, type, ...data });

        if (this.resolvers) {
            if (this.resolvers[id]) this.resolvers[id](data);
            delete this.resolvers[id];
        }
    }
    render() {
        return (
            // <View style={{ position: 'absolute' }}>
                <WebView
                    ref       = {webView => this.webView = webView}
                    onMessage = {this._receiver}
                    injectedJavaScript = {myJsLib}
                    source={{ html: '<div id="message"></div>' }}
                    style    = {{ flex: 1, backgroundColor: 'lightblue', width: 360 }}
                    javaScriptEnabledAndroid={true}
                    javaScriptEnabled={true}
                />
            //</View>
        );
    }
}