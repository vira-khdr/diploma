import React, { Component } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

const myJsLib = require('./dist/external-lib.js');

export default class WebViewCode extends Component {
    send = (data) => {
        if (this.webView) {
            const id = Date.now();
            this.webView.postMessage(JSON.stringify({ ...data, id }));
            
            return new Promise((resolve) => {
                if (!this.resolvers) this.resolvers = {};
                this.resolvers[id] = resolve;
            });
        }
    }
    _receiver = (event) => {
        console.log(event);
        const { id, type, ...data } = JSON.parse(event.nativeEvent.data);

        if (this.resolvers) {
            if (this.resolvers[id]) this.resolvers[id](data);
            delete this.resolvers[id];
        }
    }
    render() {
        return (
            <View style={{ position: 'absolute' }}>
                <WebView
                    ref       = {webView => this.webView = webView}
                    onMessage = {this._receiver}
                    injectedJavaScript = {myJsLib}
                    // onLoadEnd = {() => console.warn('onLoadEnd')}
                    // onLoadStart = {() => console.warn('onLoadStart')}
                    // originWhitelist={['*']}
                    // source={{ html: '<h1>Hello world</h1>' }}
                    // style    ={{ position: 'absolute' }}
                    javaScriptEnabledAndroid={true}
                />
            </View>
        );
    }
}