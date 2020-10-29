// const express = require('express');

import express from 'express';

import * as cp from 'child_process';

import * as path from 'path';

import * as fs from 'fs';

// helper function to make sure x is a string
function forceString(x: any, fallback: string = ''): string {
	return typeof x === 'string' ? x : fallback;
}

export interface RHelpOptions {
	// path of the R executable. Could be left out (with limited functionality)
	rPath?: string;
	// paths of installed R packages. Can be left out if rPath is provided.
	libPaths?: string[];
	// location to use for temporary .Rd file, defaults to '.'
	tempDir?: string;
}

// Class to look up help files for given functions/packages
// Looks in the installation directories of R packages
// Uses R to identify libPaths, extract .rdb files, and convert .Rd to .html
//
// This functionality could be replaced by forwarding queries to the internal R help server!
// Not sure, which approach is better...
export class RHelp {
	readonly rPath: string;
	readonly libPaths: string[];
	readonly tempDir: string;

	constructor(options: RHelpOptions = {}) {
		this.rPath = options.rPath || 'R';
		this.tempDir = options.tempDir || '.';

		this.tempDir = path.normalize(this.tempDir);

		if (options.libPaths) {
			// libPaths supplied -> store
			this.libPaths = options.libPaths;
		} else if (this.rPath) {
			// get .libPaths() from R
			const cmd = `${this.rPath} --silent --vanilla --no-echo -e "cat(paste(.libPaths(), collapse='\\n'))"`;
			const libPathString = cp.execSync(cmd).toString();
			this.libPaths = libPathString.replace('\r', '').split('\n');
		} else {
			// not good... throw error?
			this.libPaths = [];
		}
	}

	// Return the html of the help file for a function in a package
	public getHtmlForFunction(pkgName: string, fncName: string): string {
		// try to find a html file for the function (easiest/fastest)
		const htmlFile = this.findHtmlFile(pkgName, fncName);

		// if found, simply read the html content
		if (htmlFile) {
			const htmlContent = fs.readFileSync(htmlFile);
			return htmlContent.toString();
		}

		// try to find a directory "library/PKGNAME/help/", containing
		// PKGNAME.rdb and PKGNAME.rdx.
		// These files contain compressed versions of .Rd files,
		// which can be converted to .html
		const rdbDir = this.findRdbDir(pkgName);

		if (!rdbDir) {
			return '';
		}

		// Extract .Rd file form .rdb and convert to .html
		const htmlContent = this.extractHtml(rdbDir, pkgName, fncName);

		if (!htmlContent) {
			return '';
		}

		return htmlContent;
	}

	private findHtmlFile(pkgName: string, fncName: string): string | undefined {
		for (const libPath of this.libPaths) {
			// e.g. "C:\Program Files\R\R-4.0.3\library\utils\html\help.html"
			const fullPath = path.join(libPath, pkgName, 'html', fncName + '.html');
			if (fs.existsSync(fullPath)) {
				return fullPath;
			}
		}
		return undefined;
	}

	private findRdbDir(pkgName: string): string | undefined {
		for (const libPath of this.libPaths) {
			// e.g. "C:\Program Files\R\R-4.0.3\library\utils\help\utils.rdb"
			// and "C:\Program Files\R\R-4.0.3\library\utils\help\utils.rdx"
			const helpDir = path.join(libPath, pkgName, 'help');
			const rdbFile = path.join(helpDir, pkgName + '.rdb');
			const rdxFile = path.join(helpDir, pkgName + '.rdx');
			if (fs.existsSync(rdbFile) && fs.existsSync(rdxFile)) {
				return helpDir;
			}
		}
		return undefined;
	}

	private extractHtml(cwd: string, pkgName: string, fncName: string): string | undefined {
		// (lazy)loads the contents of the .rdb file
		const cmd1a = `"invisible(lazyLoad('${pkgName}'))"`;

		// prints the content of the .Rd file belonging to the requested function
		const cmd1b = `"cat(paste0(tools:::as.character.Rd(\`${fncName}\`),collapse=''))"`;

		// output file (supposed to be temporary)
		const rdFileName = path.join(path.normalize(this.tempDir), fncName + '.Rd');

		const cmd1 = `${this.rPath} -e ${cmd1a} -e ${cmd1b} --vanilla --silent --no-echo > ${rdFileName}`;

		const options = {
			cwd: cwd,
		};

		// produces the .Rd file of a function
		const out1 = cp.execSync(cmd1, options);

		const cmd2 = `${this.rPath} CMD Rdconv --type=html ${rdFileName}`;

		// converts the .Rd file to .html
		const htmlContent = cp.execSync(cmd2, options).toString();

		// try to remove temporary .Rd file
		try {
			fs.rmdirSync(rdFileName);
		} catch (e) {}

		return htmlContent;
	}
}

export interface RHelpServerOptions extends RHelpOptions {
	port?: number;
	host?: string;
}

/*
A help server similar to the one started when using help(...)
Tries to mimic the behaviour of the normal help server
Only implements the frontend, the actual help lookup is done by RHelp above
*/
export class RHelpServer {
	readonly port: number = 8000;
	readonly host: string = 'localhost';

	readonly rHelp: RHelp;

	readonly app: express.Application;

	constructor(options: RHelpServerOptions = {}) {
		this.rHelp = new RHelp(options);
		this.port = options.port ?? 8000;
		this.host = options.host || 'localhost';
		this.app = express();
		this.app.get('*', (req: any, res: any) => this.handleRequest(req, res));
		this.app.listen(this.port, this.host, () => {
			console.log(`⚡️[server]: Server is running at https://${this.host}:${this.port}`);
		});
	}

	private handleRequest(req: any, res: any) {
		const url = forceString(req.originalUrl);

		const parts = url.split('/');

		let error: string = '';
		let html: string = '';

		if (parts.length !== 5) {
			error = `Unexpected number of elements in path: ${parts.length}!`;
		} else if (parts[1] !== 'library') {
			error = `Unexpected first path element: ${parts[1]}!`;
		} else if (parts[3] !== 'html') {
			error = `Unexpected third path element: ${parts[4]}!`;
		}

		if (!error) {
			const pkgName = parts[2];
			const fncName = parts[4].replace(/\.html$/, '');

			html = this.rHelp.getHtmlForFunction(pkgName, fncName);
		}

		if (!error && !html) {
			error = 'Help file not found!';
		}

		if (error) {
			html = `<h1>${error}<\h1>`;
		}

		res.send(html);
	}
}
