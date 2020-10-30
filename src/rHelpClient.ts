


import * as cp from 'child_process';

import * as http from 'http';

import * as rHelp from './rHelpProvider';

export interface RHelpClientOptions {
	// path of the R executable. Could be left out (with limited functionality)
    rPath: string;
}


export class RHelpClient implements rHelp.RHelpProvider {
    private cp: cp.ChildProcess;
    private port: number|Promise<number>;
    private readonly rPath: string;


    public constructor(options: RHelpClientOptions){
        this.rPath = options.rPath;
        this.port = this.launchRHelpServer();
    }

    public async launchRHelpServer(){
        console.log('Launching R help server');
        const cmd = (
            `${this.rPath} -e --silent --no-echo --vanilla ` +
            `"cat(tools::startDynamicHelp(),'\\n'); while(TRUE) Sys.sleep(1)" ` 
        );

        this.cp = cp.exec(cmd);

        console.log('Called exec.');

        const outputPromise = new Promise<string>((resolve) => {
            this.cp.stdout.on('data', (data) => {
                console.log(data.toString());
                resolve(data.toString());
            });
        });

        const output = await outputPromise;

        const port = Number(output);

        console.log('Got port: ' + port);

        return port;
    }

    public getHelpFileForDoc(docFile: string){
        const requestPath = `doc/html/${docFile}`;
        return this.getHelpFileFromRequestPath(requestPath);
    }

    public getHelpFileForFunction(pkgName: string, fncname: string){
        const requestPath = `library/${pkgName}/html/${fncname}.html`;
        return this.getHelpFileFromRequestPath(requestPath);
    }

    public async getHelpFileFromRequestPath(requestPath: string){
        this.port = await this.port;
        while(requestPath.startsWith('/')){
            requestPath = requestPath.substr(1);
        }
        const url = `http://localhost:${this.port}/${requestPath}`;
        console.log('requesting: ' + url);
        const htmlPromise = new Promise<string>((resolve, reject) => {
            let content: string = '';
            http.get(url, (res: http.IncomingMessage) => {
                res.on('data', (chunk) => {
                    content += chunk.toString();
                });
                res.on('close', () => {
                    resolve(content);
                });
                res.on('error', () => {
                    reject();
                });
            });
        });

        const html = await htmlPromise;

        const ret: rHelp.HelpFile = {
            ...rHelp.splitRequestPath(requestPath),
            html: html,
            isRealFile: false
        };

        console.log('Returning helpfile');

        return ret;
    }

    dispose(){
        if(this.cp){
            this.cp.kill();
        }
    }

}


