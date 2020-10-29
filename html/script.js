


// const vscode = acquireVsCodeApi(); // acquireVsCodeApi can only be invoked once


var elements = document.getElementsByTagName("a"); 

for(var i=0; i<elements.length; i++){
    const href = elements[i].href;
    elements[i].onclick = () => { 
        vscode.postMessage({
            message: 'linkClicked',
            href: href
        }); 
    };
}
