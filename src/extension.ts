import * as vscode from 'vscode';

import * as path from 'path';

import { RHelpPanel, RHelpPanelOptions } from './rHelpPanel';
import { RHelpClient } from './rHelpClient';


let extensionPath: string = '';

export function activate(context: vscode.ExtensionContext) {

	console.log('Activating...');

	extensionPath = context.extensionPath;

	const rHelpPanelOptions: RHelpPanelOptions = {
		rPath: 'R',
		webviewScriptPath: path.join(context.extensionPath, '/html/script.js'),
		webviewStylePath: path.join(context.extensionPath, '/html/theme.css'),
		rHelpProvider: 'custom'
	};

	const rHelpPanel = new RHelpPanel(rHelpPanelOptions);

	context.subscriptions.push(rHelpPanel);

	vscode.commands.registerCommand('rhelp.showHelp', () => {
		rHelpPanel.showHelpForInput();
		// rHelpPanel.showHelp('help', 'utils'); // for debugging
	});

	vscode.commands.registerCommand('rhelp.showDoc', () => {
		rHelpPanel.showHelp('index.html', 'doc');
		// rHelpPanel.show
	});


	// rHelpPanel.showHelp('help', 'utils'); // for debugging

	console.log('Done Activating.');
}

export function deactivate() {}

