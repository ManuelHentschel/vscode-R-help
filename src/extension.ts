import * as vscode from 'vscode';

import * as path from 'path';

import { HelpPanel, HelpPanelOptions, HelpProvider } from './rHelpPanel';
import { RHelpClient } from './rHelpProviderBuiltin';
import { RHelp } from './rHelpProviderCustom';


export function activate(context: vscode.ExtensionContext) {

	console.log('Activating...');

	const rHelpPanel = startHelpPanel(context.extensionPath);

	context.subscriptions.push(rHelpPanel);

	vscode.commands.registerCommand('rhelp.showHelp', () => {
		rHelpPanel.showHelpForInput();
		// rHelpPanel.showHelp('help', 'utils'); // for debugging
	});

	vscode.commands.registerCommand('rhelp.showDoc', () => {
		rHelpPanel.showHelpForFunctionName('index.html', 'doc');
		// rHelpPanel.show
	});


	// rHelpPanel.showHelp('help', 'utils'); // for debugging

	console.log('Done Activating.');
}

export function deactivate() {}


function startHelpPanel(extensionPath: string) {

	// might be different for different implementations of HelpProvider
	const rHelpProviderOptions = {
		rPath: 'R'
	};
	let helpProvider: HelpProvider;

	// dummy setting:
	const helpProviderType: "custom" | "RServer" = "RServer";

	// @ts-ignore 
	if(helpProviderType === "custom"){
		helpProvider = new RHelp(rHelpProviderOptions);
	} else {
		helpProvider = new RHelpClient(rHelpProviderOptions);
	}

	const rHelpPanelOptions: HelpPanelOptions = {
		webviewScriptPath: path.join(extensionPath, path.normalize('/html/script.js')),
		webviewStylePath: path.join(extensionPath, path.normalize('/html/theme.css'))
	};

	const rHelpPanel = new HelpPanel(helpProvider, rHelpPanelOptions);

	return rHelpPanel;
}


