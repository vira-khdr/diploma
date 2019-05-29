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
import * as ThreadManader from './src/RNThreads/ThreadManager.js';

const titles = {
	native : 'Native',
	webview : 'WebView',
	threads : 'Threads'
};

const handlers = {};

export default class App extends Component {
	state = {
		message: '',
		isLoading : false,
		nativeTime : '--',
		webviewTime : '--',
		threadsTime : '--',
		stopwatchStart : false,
		stopwatchReset : false
	};
	constructor(...args) {
		super(...args);

		handlers['native'] = this.handleNative;
		handlers['webview'] = this.handleWebView;
		handlers['threads'] = this.handleThreads;
	}
	toggleStopwatch() {
		this.setState({stopwatchStart: !this.state.stopwatchStart, stopwatchReset: false});
	}
	resetStopwatch() {
		this.setState({stopwatchStart: false, stopwatchReset: true});
	}
	handleRunCalculation = async (action, data) => {
		if (this.state.isLoading) return;
		return new Promise((resolve, reject) => {
			this.setState({ message: 'Loading...', isLoading: true });
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
					this.setState({ message: '', isLoading: false });
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
			const webviewTime = await this.handleRunCalculation(this.webView.send, { type: 'RUN' });
			this.setState({ webviewTime });
		}
	}
	handleThreads = async () => {
		try {
			const threadsTime = await this.handleRunCalculation(ThreadManader.send, { type: 'RUN' });
			console.log(threadsTime);
			this.setState({ threadsTime });
		} catch(e) {
			console.log(e);
		}
	}
	renderLine = (type) => {
		const time = this.state[`${type}Time`];

		return (
			<View style={{ margin: 10, flexDirection: 'row', width: 300, justifyContent: 'space-between' }} key={type}>
				<Text style={{ width: 100 }}>{titles[type]}</Text>
				<Text style={{ width: 50 }}>{time}</Text>
				<Button onPress={handlers[type]} title='Run' />
			</View>
		);
	}
	render() {
		const { message, nativeTime, webViewTime, threadsTime } = this.state;
		return (
			<View style={styles.container}>
				<Stopwatch
					msecs = {false}
					start = {this.state.stopwatchStart}
					reset = {this.state.stopwatchReset}
				/>
				<Text>{message}</Text>
				{Object.keys(titles).map(this.renderLine)}
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
