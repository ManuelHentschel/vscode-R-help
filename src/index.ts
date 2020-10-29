// const express = require('express');

import express from "express";

import * as cp from "child_process";

import * as path from "path";

import * as fs from "fs";

// http://127.0.0.1:26912/library/utils/html/help.html

function forceString(x: any, fallback: string = ""): string {
	return typeof x === "string" ? x : fallback;
}

class HelpServer {
	readonly port: number = 8000;
	readonly host: string = "localhost";

	readonly rPath: string = "R";
	readonly libPaths: string[] = [];
	readonly tempDir: string = ".";

	readonly app: express.Application;

	constructor() {
		const cmd = `${this.rPath} --silent --vanilla --no-echo -e "cat(paste(.libPaths(), collapse='\\n'))"`;
		const libPathString = cp.execSync(cmd).toString();
		this.libPaths = libPathString.replace("\r", "").split("\n");

		this.app = express();
		this.app.get("*", (req, res) => this.handleRequest(req, res));
		this.app.listen(this.port, this.host, () => {
			console.log(
				`⚡️[server]: Server is running at https://localhost:${this.port}`
			);
		});
	}

	private handleRequest(req: any, res: any) {
		const url = forceString(req.originalUrl);

		const parts = url.split("/");

		let error: string = undefined;
		let html: string;

		if (parts.length !== 5) {
			error = `Unexpected number of elements in path: ${parts.length}!`;
		} else if (parts[1] !== "library") {
			error = `Unexpected first path element: ${parts[1]}!`;
		} else if (parts[3] !== "html") {
			error = `Unexpected third path element: ${parts[4]}!`;
		}

		if (!error) {
			const pkgName = parts[2];
			const fncName = parts[4].replace(/\.html$/, "");

			html = this.getHtmlForPackage(pkgName, fncName);
		}

		if (!error && !html) {
			error = "Help file not found!";
		}

		if (error) {
			html = `<h1>${error}<\h1>`;
		}

		res.send(html);
	}

	private getHtmlForPackage(
		pkgName: string,
		fncName: string
	): string | undefined {
		const htmlFile = this.findHtmlFile(pkgName, fncName);

		if (htmlFile) {
			const htmlContent = fs.readFileSync(htmlFile);
			return htmlContent.toString();
		}

		const rdbDir = this.findRdbDir(pkgName);

		if (!rdbDir) {
			return undefined;
		}

		const htmlContent = this.extractHtml(rdbDir, pkgName, fncName);

		if (!htmlContent) {
			return undefined;
		}

		return htmlContent;
	}


	private findHtmlFile(
		pkgName: string,
		fncName: string
	): string | undefined {
		for (const libPath of this.libPaths) {
			const fullPath = path.join(libPath, pkgName, "html", fncName + ".html");
			if (fs.existsSync(fullPath)) {
				return fullPath;
			}
		}
		return undefined;
	}

	private findRdbDir(
		pkgName: string
	): string | undefined {
		for (const libPath of this.libPaths) {
			const helpDir = path.join(libPath, pkgName, "help");
			const rdbFile = path.join(helpDir, pkgName + ".rdb");
			const rdxFile = path.join(helpDir, pkgName + ".rdx");
			if (fs.existsSync(rdbFile) && fs.existsSync(rdxFile)) {
				return helpDir;
			}
		}
		return undefined;
	}


	private extractHtml(cwd: string, pkgName: string, fncName: string): string | undefined {
		const cmd1a = `"invisible(lazyLoad('${pkgName}'))"`;
		const cmd1b = `"cat(paste0(tools:::as.character.Rd(\`${fncName}\`),collapse=''))"`;

		const rdFileName = path.join(path.normalize(this.tempDir), fncName + ".Rd");

		const htmlFileName = fncName + ".html";

		const cmd1 = `${this.rPath} -e ${cmd1a} -e ${cmd1b} --vanilla --silent --no-echo > ${rdFileName}`;

		const options = {
			cwd: cwd,
		};

		const out1 = cp.execSync(cmd1, options);
		console.log(out1);

		const cmd2 = `${this.rPath} CMD Rdconv --type=html ${rdFileName}`;

		const htmlContent = cp.execSync(cmd2, options).toString();
		console.log(htmlContent);

		try{
			fs.rmdirSync(rdFileName);
		} catch(e){}

		return htmlContent;
	}
}

// "D:/Documents/R/win-library/4.0"     "C:/Program Files/R/R-4.0.3/library"
// extractHtml();

const server = new HelpServer();
