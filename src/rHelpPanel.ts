
import * as vscode from 'vscode';

import * as rHelp from './rHelpProvider';

import * as jsdom from 'jsdom';

import * as fs from 'fs';

import * as hljs from 'highlight.js';
import { RHelpClient } from './rHelpClient';



export interface RHelpPanelOptions extends rHelp.RHelpOptions {
	/* Local path of script.js, used to send messages to vs code */
	webviewScriptPath: string;
	/* Local path of theme.css, used to actually format the highlighted syntax */
	webviewStylePath: string;
	/* which provider to use for source info: custom implementation or builtin */
	rHelpProvider: "custom"|"builtin";
}

interface HistoryEntry {
	pkgName: string;
	fncName: string;
	helpFile: rHelp.HelpFile;
	scrollStatus?: number;
};

export class RHelpPanel {
	readonly rHelp: rHelp.RHelpProvider;
	// readonly rHelp: rHelp.RHelp;

	private panel?: vscode.WebviewPanel;
	private webviewScriptUri?: vscode.Uri;
	readonly webviewScriptFile: vscode.Uri;

	private webviewStyleUri?: vscode.Uri;
	readonly webviewStyleFile: vscode.Uri;
	

	private currentEntry: HistoryEntry|null = null;
	private history: HistoryEntry[] = [];
	private forwardHistory: HistoryEntry[] = [];

	constructor(options: RHelpPanelOptions){
		// this.rHelp = new rHelp.RHelp(options);
		this.rHelp = new RHelpClient(options);
		this.webviewScriptFile = vscode.Uri.file(options.webviewScriptPath);
		this.webviewStyleFile = vscode.Uri.file(options.webviewStylePath);
	}

	public dispose(){
		this.rHelp.dispose();
		if(this.panel){
			this.panel.dispose();
		}
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
				this.webviewStyleUri = undefined;
			});

			this.webviewScriptUri = this.panel.webview.asWebviewUri(this.webviewScriptFile);
			this.webviewStyleUri = this.panel.webview.asWebviewUri(this.webviewStyleFile);
		}

		this.panel.webview.onDidReceiveMessage((e: any) => {
			console.log('received message');
			this.handleMessage(e);
		});

		return this.panel.webview;
	}

	public showHelpForPath(requestedPath: string){
		const helpFile = this.rHelp.getHelpFileFromRequestPath(requestedPath, this.currentEntry.helpFile.fileLocation);

		if(helpFile){
			this.showHelpFile(helpFile);
		} else{
			console.error(`Couldnt handle path:\n${requestedPath}\n`);
		}
	}

	public showHelp(fncName: string, pkgName?: string, updateHistory: boolean = true){
		if(this.currentEntry){
			pkgName = pkgName || this.currentEntry.pkgName;
		}
		if(!pkgName){
			throw new Error('No package name specified or stored!');
		}

		let helpFile: rHelp.HelpFile|Promise<rHelp.HelpFile>;

		if(pkgName === 'doc'){
			helpFile = this.rHelp.getHelpFileForDoc(fncName);
		} else{
			helpFile = this.rHelp.getHelpFileForFunction(pkgName, fncName);
		}

		this.showHelpFile(helpFile, pkgName, updateHistory);
	}

	public async showHelpFile(helpFile: rHelp.HelpFile|Promise<rHelp.HelpFile>, pkgName: string='', updateHistory: boolean = true){

		const webview = this.getWebview();

		helpFile = await helpFile;

		let html = pimpMyHelp(helpFile.html, helpFile.requestDirname);

		const fncName = helpFile.requestFilename.replace(/\.html$/, '');

		// for debugging:
		if(false){
			let htmlFile = html + `\n<link rel="stylesheet" href="theme.css"></link>`;
			htmlFile += `\n<script src="script.js"></script>`;
			fs.writeFileSync(`html/${fncName}.html`, htmlFile);
		}

		html += `\n<link rel="stylesheet" href="${this.webviewStyleUri}"></link>`;
		html += `\n<script src=${this.webviewScriptUri}></script>`;


		webview.html = html;

		if(updateHistory){
			if(this.currentEntry){
				this.history.push(this.currentEntry);
			}
			this.forwardHistory = [];
		}

		const helpFilePath = helpFile.requestPath;

		this.currentEntry = {
			pkgName: pkgName,
			fncName: fncName,
			scrollStatus: 0,
			helpFile: helpFile
		};
	}

	private showHistoryEntry(entry: HistoryEntry){
		const pkgName = entry.pkgName;
		const fncName = entry.fncName;
		const helpFile = entry.helpFile;
		this.showHelpFile(helpFile, pkgName, false);
	}

	private goBack(){
		const entry = this.history.pop();
		if(entry){
			if(this.currentEntry){
				this.forwardHistory.push(this.currentEntry);
			}
			this.showHistoryEntry(entry);
		}
	}

	private goForward(){
		const entry = this.forwardHistory.pop();
		if(entry){
			if(this.currentEntry){
				this.history.push(this.currentEntry);
			}
			this.showHistoryEntry(entry);
		}
	}

	private async handleMessage(msg: any){
		if(msg.message === 'linkClicked'){
			const t0 = new Date();
			const href: string = msg.href || '';
			const uri = vscode.Uri.parse(href);

			console.log('Link clicked: ' + href);

			const parts = uri.path.split('/');

			parts.shift();
			parts.shift();

			const path2 = parts.join('/');

			const helpFile = await this.rHelp.getHelpFileFromRequestPath(path2);

			if(helpFile){
				this.showHelpFile(helpFile);
			}

		} else if(msg.message === 'mouseClick'){
			const button: number = msg.button || 0;
			if(button === 3){
				this.goBack();
			} else if(button === 4){
				this.goForward();
			}
		} else if(msg.message === 'text'){
			console.log('Message (text): ' + msg.text);
		} else{
			console.log('Unknown message:', msg);
		}
	}
}

function pimpMyHelp(html: string, relPath: string = ''): string {

	// parse the html string
	const dom = new jsdom.JSDOM(html);

	// find all code sections (indicated by 'pre' tags)
	const codeSections = dom.window.document.body.getElementsByTagName('pre');

	// check length here, to be sure it doesn't change during the loop:
	const nSec = codeSections.length; 

	for(let i=0; i<nSec; i++){
		// apply syntax highlighting to each code section:
		const section = codeSections[i].textContent || '';
		const html3 = hljs.highlight('r', section);
		codeSections[i].innerHTML = html3.value;
	}

	if(relPath){
		relPath = relPath.replace(/\\/g, '/');
		const links = dom.window.document.getElementsByTagName('a');
		const nLinks = links.length;
		for(let i=0; i<nLinks; i++){
			let href = links[i].getAttribute('href');
			if(href){
				const uri = vscode.Uri.parse(href);
				if(!uri.authority){
					href = [relPath, href].join('/');
				}
				links[i].setAttribute('href', href);
			}
		}
	}

	html = dom.serialize();

	// return the html of the modified page:
	return html;
}