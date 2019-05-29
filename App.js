/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow
 */

import React, { Component } from "react";
import { StyleSheet, Text, View, Button } from "react-native";
import { Stopwatch } from 'react-native-stopwatch-timer';
import calculate from "./src/WebViewCode/calculate";
import WebViewCode from "./src/WebViewCode/WebViewCode.js";

export default class App extends Component {
	state = {
		message: '',
		nativeTime : '--',
		webViewTime : '--',
		stopwatchStart : false,
		stopwatchReset : false
	};
	toggleStopwatch() {
		this.setState({stopwatchStart: !this.state.stopwatchStart, stopwatchReset: false});
	}
	resetStopwatch() {
		this.setState({stopwatchStart: false, stopwatchReset: true});
	}
	handleRunCalculation = async (action, data) => {
		return new Promise((resolve, reject) => {
			this.setState({ message: 'Loading...' });
			this.resetStopwatch();
			this.toggleStopwatch();
			setTimeout(async () => {
				try {
					const start = Date.now();
					await action(data);
					const end = Date.now();
					const time = (end - start) / 1000;
					resolve(time);
				} catch (error) {
					resolve(error);
				} finally {
					this.setState({ message: '' });
					this.toggleStopwatch();
				}
			}, 100);
		});
	}
	handleNative = async () => {
		const nativeTime = await this.handleRunCalculation(calculate);
		this.setState({ nativeTime });
	};
	handleWebView = async () => {
		if (this.webView) {
			const webViewTime = await this.handleRunCalculation(this.webView.send, { type: 'RUN' });
			this.setState({ webViewTime });
		}
	}
	render() {
		const { message, nativeTime, webViewTime } = this.state;
		return (
			<View style={styles.container}>
				<Stopwatch
					msecs = {false}
					start = {this.state.stopwatchStart}
					reset = {this.state.stopwatchReset}
				/>
				<Text>{message}</Text>
				<Text>{`Native Time: ${nativeTime}`}</Text>
				<Text>{`WebView Time: ${webViewTime}`}</Text>
				<View style={styles.button}>
					<Button onPress={this.handleNative} title='Run action Native' />
				</View>
				<View style={styles.button}>
					<Button style={styles.button} onPress={this.handleWebView} title='Run action WebView' />
				</View>
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
	},
	button : {
		margin : 10
	}
});
