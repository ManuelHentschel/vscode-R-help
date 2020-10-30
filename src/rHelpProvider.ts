


import * as cp from 'child_process';

import * as path from 'path';

import * as fs from 'fs';

import * as os from 'os';

import { randomBytes } from 'crypto';



export interface RHelpProvider {
	getHelpFileFromRequestPath(requestPath: string, prevFileLocation?: HelpFileLocation): HelpFile|Promise<HelpFile>;

	getHelpFileForDoc(fncName: string): HelpFile|Promise<HelpFile>;
	getHelpFileForFunction(pkgName: string, fncName: string): HelpFile|Promise<HelpFile>;

	dispose(): void;
}


export interface RHelpOptions {
	// path of the R executable. Could be left out (with limited functionality)
	rPath: string;
	// paths of installed R packages. Can be left out if rPath is provided.
	libPaths?: string[];
	// value of R.home()
	homePath?: string;
}

export interface HelpFileLocation {
	// path of the libLoc/homePath where the file was found
	truncPath: string;
	// directory of the file relative to the truncPath. Not necessarily an actual dir!
	relPath: string;
	// filename (without any part of the path). Not necessarily an actual file!
	fileName: string;
}

export class HelpFileLocation implements HelpFileLocation {
	constructor(
		public truncPath: string='',
		public relPath: string='',
		public fileName: string=''
	){};
}


export interface HelpDir extends HelpFileLocation {
	// path of the dir containing PKGNAME.rdb / .rdx
	helpDir: string;
}


export interface HelpFile {
	// content of the file
    html: string;
    // path as used by help server
	requestPath: string;
	// filename as used by help server
	requestFilename: string;
	// path as used by help server, without filename
	requestDirname: string;
    // file location
    fileLocation?: HelpFileLocation;
    // is real file
    isRealFile: boolean;
}

export function splitRequestPath(requestPath: string):{
	requestPath: string,
	requestFilename: string,
	requestDirname: string
} {
	requestPath.replace(/\\/g, '/');
	const parts = requestPath.split('/');
	const requestFilename = parts.pop();
	const requestDirname = parts.join('/');
	return {
		requestPath: requestPath,
		requestFilename: requestFilename,
		requestDirname: requestDirname
	};
}


export class RHelp implements RHelpProvider {
	readonly rPath: string;
	readonly libPaths: string[];
	readonly homePath: string;
	readonly tempDir: string;

	constructor(options: RHelpOptions = {rPath: 'R'}) {
		this.rPath = options.rPath || 'R';

		this.tempDir = path.join(os.tmpdir(), 'vscode-R-Help-' + randomBytes(10).toString('hex'));
		console.log(this.tempDir);

		fs.mkdirSync(this.tempDir);

		if(options.homePath){
			this.homePath = options.homePath;
		} else if(this.rPath){
			const cmd = `${this.rPath} --silent --vanilla --no-echo -e "cat(R.home())"`;
			this.homePath = cp.execSync(cmd).toString();
		} else {
			this.homePath = "";
		}

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
		console.log(`Homepath:\n${this.homePath}\n\nlibPaths:\n${this.libPaths}`);
	}

	public dispose() {
		const options: fs.RmDirOptions = {
			recursive: true
		};
		fs.rmdir(this.tempDir, options, () => null);
    }

    public getHelpFileForDoc(docFile: string){
        const requestPath = `doc/html/${docFile}`;
        return this.getHelpFileFromRequestPath(requestPath);
    }

    public getHelpFileForFunction(pkgName: string, fncname: string){
        const requestPath = `library/${pkgName}/html/${fncname}.html`;
        return this.getHelpFileFromRequestPath(requestPath);
    }

    public getHtmlFromFileLocation(fileLocation: HelpFileLocation): string {
        const parts = [
            fileLocation.relPath,
            fileLocation.relPath,
            fileLocation.fileName
        ];
        const fullPath = path.normalize(path.join(...parts));
        try{
            const html = fs.readFileSync(fullPath, 'utf-8');
            return html;
        } catch(e){}
        return '';
    }

    public getHelpFileFromRequestPath(requestPath: string, prevFileLocation?: HelpFileLocation): HelpFile|null {
        let helpFile: HelpFile|null;
        helpFile = this.getRealFileFromRequestPath(requestPath, prevFileLocation);
        if(helpFile){
            return helpFile;
        }

        helpFile = this.extractHelpFileFromRequestPath(requestPath);
        
        return helpFile;
    }

    public getRealFileFromRequestPath(requestPath: string, prevFileLocation?: HelpFileLocation): HelpFile|null {

		const fileName = path.basename(requestPath);
		const relPath = path.dirname(requestPath);

		console.log(`Getting help for path: ${requestPath} ...`);

        const locs: HelpFileLocation[] = [];
        
		if(prevFileLocation){
			const truncPath = prevFileLocation.truncPath;
			locs.push(new HelpFileLocation(truncPath, relPath, fileName));
		}

		if(this.homePath){
			locs.push(new HelpFileLocation(this.homePath, relPath, fileName));
		}

		const parts = relPath.split('/');
		while(parts.length>0 && parts[0]===''){
			parts.shift();
		}

		if(parts[0]==='library'){
			parts.shift();
			const relPath2 = path.join(...parts);

			for(let libPath of this.libPaths){
				locs.push(new HelpFileLocation(libPath, relPath2, fileName));
			}
		}

		for(let loc of locs){
			const fullPath = path.normalize(path.join(loc.truncPath, loc.relPath, loc.fileName));
			if(fs.existsSync(fullPath)){
				const html = fs.readFileSync(fullPath, 'utf-8');
				console.log(`Found in file ${fullPath}`);
				const helpFile: HelpFile = {
					...splitRequestPath(requestPath),
                    html: html,
                    fileLocation: loc,
                    isRealFile: true
				};
				return helpFile;
			}
		}
		return null;
    }

    public extractHelpFileFromRequestPath(requestPath: string): HelpFile|null {

        console.log(`Trying to extract help file for ${requestPath}...`);

        const parts = requestPath.split('/');
        
        const htmlFileName = parts.pop();
        const htmlDir = parts.pop();
        const pkgName = parts.pop();
        const libraryDir = parts.pop();

        const fncName = htmlFileName.replace(/\.html$/, '');

        if(libraryDir !== 'library' || htmlDir !== 'html'){
            return null;
        }

        for(const libPath of this.libPaths){
            // directory containing compressed help files:
            const helpDir = path.join(libPath, pkgName, 'help');
            // actual compressed help files:
            const rdbFile = path.join(helpDir, pkgName + '.rdb');
            const rdxFile = path.join(helpDir, pkgName + '.rdx');

			if (fs.existsSync(rdbFile) && fs.existsSync(rdxFile)) {
                const html = this.extractHtmlFile(helpDir, pkgName, fncName);
                if(html){
                    const helpFile: HelpFile = {
						...splitRequestPath(requestPath),
                        html: html,
                        isRealFile: false
                    };
                    return helpFile;
                }
			}
        }

        console.log('Found no help file to extract.');

        return null;
    }

	private extractHtmlFile(helpDir: string, pkgName: string, fncName: string): string | null {
		// (lazy)loads the contents of the .rdb file
		const cmd1a = `"invisible(lazyLoad('${pkgName}'))"`;

		// prints the content of the .Rd file belonging to the requested function
		const cmd1b = `"cat(paste0(tools:::as.character.Rd(\`${fncName}\`),collapse=''))"`;

		// output file (supposed to be temporary)
		const rdFileName = path.join(os.tmpdir(), fncName + '.Rd');

		const cmd1 = `${this.rPath} -e ${cmd1a} -e ${cmd1b} --vanilla --silent --no-echo > ${rdFileName}`;

		const options: cp.ExecSyncOptionsWithStringEncoding = {
			cwd: helpDir,
			encoding: 'utf-8'
		};

        // produce the .Rd file of a function
        try{
            const out1 = cp.execSync(cmd1, options);
        } catch(e){
            console.log('Failed to extract .Rd file');
            return null;
        }

        // convert the .Rd file to .html
        const cmd2 = `${this.rPath} CMD Rdconv --type=html ${rdFileName}`;
        let htmlContent: string = '';
        try{
            htmlContent = cp.execSync(cmd2, options);
        } catch(e){
            console.log('Failed to convert .Rd to .html');
            return null;
        }


		// try to remove temporary .Rd file
		try {
			fs.rmdirSync(rdFileName);
		} catch (e) {
			console.log('Failed to remove temp file. (Still working though)');
		}

		return htmlContent;
	}


    public getHtmlFromHelpFile(helpFile: HelpFile): string {
        if(helpFile.html){
            return helpFile.html;
        } else if(helpFile.fileLocation && helpFile.isRealFile){
            return this.getHtmlFromFileLocation(helpFile.fileLocation);
        } else if(helpFile.requestPath){
            helpFile = this.getHelpFileFromRequestPath(helpFile.requestPath);
            return helpFile.html;
        } else{
            return '';
        }
    }
}

