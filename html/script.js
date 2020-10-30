

const vscode = acquireVsCodeApi(); // acquireVsCodeApi can only be invoked once

// window.location.href = 'vscode-webview://a/b/c/d/e/f/R.html';

// window.location.replace('vscode-webview://a/b/c/d/e/f/R.html');

sendMessage = function(msg){
    vscode.postMessage({
        message: 'text',
        text: msg
    });
};

sendMessage('Hello world!');

var elements = document.getElementsByTagName("a"); 


for(var i=0; i<elements.length; i++){
    const href = elements[i].href;
    console.log(' href: ' + href);
    elements[i].onclick = () => { 
        vscode.postMessage({
            message: 'linkClicked',
            href: href
        }); 
    };
}



window.onmousedown = (ev) => {
    vscode.postMessage({
        message: 'mouseClick',
        button: ev.button
    });
};

