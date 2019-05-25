/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow
 */

import React, { Component } from "react";
import { StyleSheet, Text, View, Button } from "react-native";
import calculate from "./src/WebViewCode/calculate";
import WebView from './src/WebViewCode/WebViewCode.js';
import WebViewCode from "./src/WebViewCode/WebViewCode.js";

export default class App extends Component {
	state = {
		message: ""
	};
	handleRunCalculation = (action, data) => {
		this.setState({ message: 'Loading...' });
		setTimeout(async () => {
			try {
				const start = Date.now();
				await action(data);
				const end = Date.now();
				const time = (end - start) / 1000;
				this.setState({ message: time });
			} catch (error) {
				console.log(error);
				this.setState({ message: error });
			}
		}, 100);
	}
	handleNative = () => {
		this.handleRunCalculation(calculate);
	};
	handleWebView = async () => {
		if (this.webView) {
			this.handleRunCalculation(this.webView.send, { type: 'RUN' });
		}
	}
	render() {
		const { message } = this.state;
		return (
			<View style={styles.container}>
				<Text>{message}</Text>
				<Button onPress={this.handleNative} title='Run action Native' />
				<Button onPress={this.handleWebView} title='Run action WebView' />
				<WebViewCode
					ref = {webView => this.webView = webView}
				/>
			</View>
		);
	}
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "#F5FCFF"
	}
});
