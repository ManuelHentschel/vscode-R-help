
// import express from 'express';

// import * as http from 'http';

// import * as rHelp from './rHelp';




// // helper function to make sure x is a string
// function forceString(x: any, fallback: string = ''): string {
// 	return typeof x === 'string' ? x : fallback;
// }

// export interface RHelpServerOptions extends rHelp.RHelpOptions {
// 	port?: number;
// 	host?: string;
// }

// /*
// A help server similar to the one started when using help(...)
// Tries to mimic the behaviour of the normal help server
// Only implements the frontend, the actual help lookup is done by RHelp above
// */
// export class RHelpServer {
// 	readonly port: number = 8000;
// 	readonly host: string = 'localhost';

// 	readonly rHelp: rHelp.RHelp;

// 	readonly app: express.Application;
// 	readonly server: http.Server;

// 	constructor(options: RHelpServerOptions = {}) {
// 		this.rHelp = new rHelp.RHelp(options);
// 		this.port = options.port ?? 8000;
// 		this.host = options.host || 'localhost';
// 		this.app = express();
// 		this.app.get('*', (req: any, res: any) => this.handleRequest(req, res));
// 		this.server = this.app.listen(this.port, this.host, () => {
// 			console.log(`[server]: Server is running at https://${this.host}:${this.port}`);
// 		});
// 	}

// 	public dispose() {
// 		this.server.close();
// 		this.rHelp.dispose();
// 	}

// 	private handleRequest(req: any, res: any) {
// 		const url = forceString(req.originalUrl);

// 		const parts = url.split('/');

// 		let error: string = '';
// 		let html: string = '';

// 		if (parts.length !== 5) {
// 			error = `Unexpected number of elements in path: ${parts.length}!`;
// 		} else if (parts[1] !== 'library') {
// 			error = `Unexpected first path element: ${parts[1]}!`;
// 		} else if (parts[3] !== 'html') {
// 			error = `Unexpected third path element: ${parts[4]}!`;
// 		}

// 		if (!error) {
// 			const pkgName = parts[2];
// 			const fncName = parts[4].replace(/\.html$/, '');

// 			html = this.rHelp.getHelpFileForFunction(pkgName, fncName).html;
// 		}

// 		if (!error && !html) {
// 			error = 'Help file not found!';
// 		}

// 		if (error) {
// 			html = `<h1>${error}<\h1>`;
// 		}

// 		res.send(html);
// 	}
// }
