/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow
 */

import React, { Component } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import excelEngine from "./src/excel";

const instructions = Platform.select({
	ios: "Press Cmd+R to reload,\n" + "Cmd+D or shake for dev menu",
	android: "Double tap R on your keyboard to reload,\n" + "Shake or press menu button for dev menu"
});

export default class App extends Component {
	state = {
		message: "Loading..."
	};
	componentDidMount() {
		setTimeout(this.handleRecompute, 3000);
	}
	handleRecompute = () => {
		try {
			// console.warn('patients', excelEngine.get('/inputs/patients/cabgPatientsPerYear'));
			
			// console.log(excelEngine.get("/"));
			const dataToSet = { "/inputs/patients/cabgPatientsPerYear": 0 };
			let end;
			const start = Date.now();
			excelEngine.set(dataToSet);
			excelEngine.recompute(() => {
				end = Date.now();
			});
			const time = (end - start) / 1000;
			// console.log(excelEngine.get("/"));
			this.setState({ message: time });
		} catch (error) {
			this.setState({ message: error });
		}
	};
	render() {
		const { message } = this.state;
		return (
			<View style={styles.container}>
				<Text>{message}</Text>
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
	welcome: {
		fontSize: 20,
		textAlign: "center",
		margin: 10
	},
	instructions: {
		textAlign: "center",
		color: "#333333",
		marginBottom: 5
	}
});
