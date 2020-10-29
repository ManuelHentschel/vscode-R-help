import * as vscode from 'vscode';

import * as path from 'path';

import * as helpServer from './helpServer';

import * as jsdom from 'jsdom';

import * as showdown from 'showdown';

import * as hljs from 'highlight.js';


export function activate(context: vscode.ExtensionContext) {

	console.log('Activating...');

	const rHelpPanelOptions = {
		webviewScriptPath: path.join(context.extensionPath, 'script.js'),
		webviewStylePath: path.join(context.extensionPath, 'theme.css')
	};

	const rHelpPanel = new RHelpPanel(rHelpPanelOptions);

	let disposable = vscode.commands.registerCommand('rhelp.showHelp', () => {
		rHelpPanel.showHelpForInput();
		// rHelpPanel.showHelp('help', 'utils'); // for debugging
	});

	context.subscriptions.push(disposable);

	console.log('Done Activating.');
}

export function deactivate() {}


interface RHelpPanelOptions extends helpServer.RHelpOptions {
	/* Local path of script.js, used to send messages to vs code */
	webviewScriptPath: string;
	/* Local path of theme.css, used to actually format the highlighted syntax */
	webviewStylePath: string;
}

class RHelpPanel {
	readonly rHelp: helpServer.RHelp;

	public panel?: vscode.WebviewPanel;
	public webviewScriptUri?: vscode.Uri;
	readonly webviewScriptFile: vscode.Uri;

	public webviewStyleUri?: vscode.Uri;
	readonly webviewStyleFile: vscode.Uri;
	
	public currentPackage: string = '';

	constructor(options: RHelpPanelOptions){
		this.rHelp = new helpServer.RHelp(options);
		this.webviewScriptFile = vscode.Uri.file(options.webviewScriptPath);
		this.webviewStyleFile = vscode.Uri.file(options.webviewStylePath);
	}

	public async showHelpForInput(){
		const pkgName = await vscode.window.showInputBox({
			value: 'utils',
			prompt: 'Please enter the package name'
		});
		if(!pkgName){
			return false;
		}
		let fncName = await vscode.window.showInputBox({
			value: 'help',
			prompt: 'Please enter the function name'
		});
		if(!fncName){
			return false;
		}
		fncName = fncName.replace(/^\./, 'dot-');
		this.showHelp(fncName, pkgName);
	}

	public getWebview(): vscode.Webview {
		if(this.panel){
			return this.panel.webview;
		} else{
			const webViewOptions: vscode.WebviewOptions = {
				enableScripts: true,
			};
			this.panel = vscode.window.createWebviewPanel('rhelp', 'R Help', vscode.ViewColumn.Two, webViewOptions);

			this.panel.onDidDispose((e: void) => {
				this.panel = undefined;
				this.webviewScriptUri = undefined;
			});

			this.webviewScriptUri = this.panel.webview.asWebviewUri(this.webviewScriptFile);
			this.webviewStyleUri = this.panel.webview.asWebviewUri(this.webviewStyleFile);
		}

		this.panel.webview.onDidReceiveMessage((e: any) => {
			this.handleMessage(e);
		});

		return this.panel.webview;
	}

	public showHelp(fncName: string, pkgName?: string){
		pkgName = pkgName || this.currentPackage;
		if(!pkgName){
			throw new Error('No package name specified or stored!');
		}
		const webview = this.getWebview();

		let html: string = this.rHelp.getHtmlForFunction(pkgName, fncName);
		html = pimpMyHelp(html);
		console.log(this.webviewStyleUri);
		console.log(this.webviewStyleFile);
		html += `\n<link rel="stylesheet" href="${this.webviewStyleUri}"></link>`;
		html += `\n<script src=${this.webviewScriptUri}></script>`;

		console.log(html);

		webview.html = html;
		this.currentPackage = pkgName;
	}

	private handleMessage(msg: any){
		console.log(msg);
		if(msg.message === 'linkClicked'){
			const href: string = msg.href || '';
			const uri = vscode.Uri.parse(href);

			const parts = uri.path.replace(/\.html$/, '').split('/');

			if(parts.length === 3){
				this.showHelp(parts[2]);
			} else if(parts.length === 4){
				this.showHelp(parts[3], parts[1]);
			}

		} else{
			console.log('Unknown message:', msg);
		}
	}
}

function pimpMyHelp(html: string): string {

	// parse the html string
	const dom = new jsdom.JSDOM(html);

	// set up converter for syntax highlighting
	const converter = new showdown.Converter();
	converter.setFlavor('github');

	// find all code sections (indicated by 'pre' tags)
	const codeSections = dom.window.document.body.getElementsByTagName('pre');

	// check length here, to be sure it doesn't change during the loop:
	const nSec = codeSections.length; 

	for(let i=0; i<nSec; i++){
		// apply syntax highlighting to each code section:
		const section = codeSections[i].innerHTML;
		const html3 = hljs.highlight('r', section);
		codeSections[i].innerHTML = html3.value;
	}

	// return the html of the modified page:
	return dom.serialize();
}
