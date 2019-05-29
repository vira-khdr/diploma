/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow
 */

import React, { Component } from "react";
import DeviceInfo from 'react-native-device-info';
import { StyleSheet, Text, View, Button } from "react-native";
import { Stopwatch } from 'react-native-stopwatch-timer';
import calculate from "./src/WebViewCode/calculate";
import WebViewCode from "./src/WebViewCode/WebViewCode.js";
import * as ThreadManader from './src/RNThreads/ThreadManager.js';
// import * as WrokerManager from './src/RNWorkers/WrokerManager.js';

const titles = {
	native : 'Native',
	webview : 'WebView',
	threads : 'Threads',
	worker  : 'Worker'
};

const handlers = {};

export default class App extends Component {
	state = {
		message: '',
		isLoading : false,
		time : {},
		battery : {},
		stopwatchStart : false,
		stopwatchReset : false
	};
	constructor(...args) {
		super(...args);

		handlers['native'] = calculate;
		// handlers['webview'] = this.webView.send;
		handlers['threads'] = ThreadManader.send;
		// handlers['worker'] = this.handleWorker;
	}
	toggleStopwatch() {
		this.setState({stopwatchStart: !this.state.stopwatchStart, stopwatchReset: false});
	}
	resetStopwatch() {
		this.setState({ stopwatchStart: false, stopwatchReset: true });
	}
	handleRunCalculation = async (type) => {
		const data = { type: 'RUN' };
		if (this.state.isLoading) return;
		if (type === 'webview' && !this.webView) return;
		if (type === 'webview' && !handlers['webview']) handlers['webview'] = this.webView.send;
		if (!handlers[type]) return;
		return new Promise((resolve, reject) => {
			this.setState({ message: 'Loading...', isLoading: true });
			this.toggleStopwatch();
			setTimeout(async () => {
				try {
					const batteryStart = await DeviceInfo.getBatteryLevel();
					const start = Date.now();
					await handlers[type](data);
					const end = Date.now();
					const batteryEnd = await DeviceInfo.getBatteryLevel();
					const time = (end - start) / 1000;
					const battery = batteryEnd - batteryStart;
					console.log({ type, time, batteryStart, batteryEnd });
					
					this.setState({
						time	: { ...this.state.time, [type]: time },
						battery : { ...this.state.battery, [type]: battery },
					});
					resolve();
				} catch (error) {
					console.log(error);
					resolve();
				} finally {
					this.setState({ message: '', isLoading: false });
					this.resetStopwatch();
				}
			}, 100);
		});
	}
	renderLine = (type) => {
		const time = this.state.time[type] || '---.---';
		const battery = this.state.battery[type] || '-';

		return (
			<View style={{ margin: 10, flexDirection: 'row', width: 300, justifyContent: 'space-between' }} key={type}>
				<Text style={{ width: 100 }}>{titles[type]}</Text>
				<Text style={{ width: 50 }}>{time}</Text>
				<Text style={{ width: 50 }}>{battery}</Text>
				<Button onPress={this.handleRunCalculation.bind(null, type)} title='Run' />
			</View>
		);
	}
	render() {
		const { message } = this.state;
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
