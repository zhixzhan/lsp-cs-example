/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2018 TypeFox GmbH (http://www.typefox.io). All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import * as monaco from 'monaco-editor-core';
import { listen, MessageConnection } from 'vscode-ws-jsonrpc';
import {
    MonacoLanguageClient, CloseAction, ErrorAction,
    MonacoServices, createConnection
} from 'monaco-languageclient';
import normalizeUrl = require('normalize-url');
const ReconnectingWebSocket = require('reconnecting-websocket');

// register Monaco languages
monaco.languages.register({
    id: 'json',
    extensions: ['.json', '.bowerrc', '.jshintrc', '.jscsrc', '.eslintrc', '.babelrc'],
    aliases: ['JSON', 'json'],
    mimetypes: ['application/json'],
});

declare global {
    interface Window { lspclient: any; }
}

// create Monaco editor

const files = [
    {
        uri: 'inmemory://model1.json',
        LUISAuthoringKey: '',
        language: 'json',
        value: `{
    "$schema": "http://json.schemastore.org/coffeelint",
    "line_endings": "unix"
}`
    },
    {
        uri: 'inmemory://model2.json',
        LUISAuthoringKey: '0d4991873f334685a9686d1b48e0ff48',
        language: 'json',
        value: `{
    "$schema": "http://json.schemastore.org/coffeelint",
    "line_endings": "linux"
}`
    }
];

const models = files.map(file => {
    const {value, language, uri} = file;
    return monaco.editor.createModel(value, language, monaco.Uri.parse(uri))
})
let modelIdx = 0;

const editor = monaco.editor.create(document.getElementById("container")!, {
    model: models[modelIdx],
    glyphMargin: true,
    lightbulb: {
        enabled: true
    }
});

document.getElementById('button').onclick = () => {
    modelIdx = modelIdx === 0 ? 1 : 0;
    editor.setModel(models[modelIdx]);
}

// install Monaco language client services
MonacoServices.install(editor);

// create the web socket
const url = createUrl('/sampleServer')
const webSocket = createWebSocket(url);
// listen when the web socket is opened
listen({
    webSocket,
    onConnection: connection => {
        // create and start the language client
        const languageClient = createLanguageClient(connection);
        window.lspclient = languageClient;
        initializeLuisKeys(languageClient);
        const disposable = languageClient.start();
        connection.onClose(() => disposable.dispose());
    }
});

async function initializeLuisKeys(languageClient) {
    const data = files.map( file => {
        const {uri, LUISAuthoringKey} = file;
        return {
            textDocument: {uri},
            LUISAuthoringKey
        }
    } )
    await languageClient.onReady()
    languageClient.sendRequest('initializeLuis', {data})
}

function createLanguageClient(connection: MessageConnection): MonacoLanguageClient {
    return new MonacoLanguageClient({
        name: "Sample Language Client",
        clientOptions: {
            // use a language id as a document selector
            documentSelector: ['json'],
            // disable the default error handler
            errorHandler: {
                error: () => ErrorAction.Continue,
                closed: () => CloseAction.DoNotRestart
            },
            initializationOptions: () => {
                console.log('initialization options');
                console.log(window.lspclient.state)
            }
        },
        // create a language client connection from the JSON RPC connection on demand
        connectionProvider: {
            get: (errorHandler, closeHandler) => {
                return Promise.resolve(createConnection(connection, errorHandler, closeHandler))
            }
        }
    });
}

function createUrl(path: string): string {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    // return normalizeUrl(`${protocol}://${location.host}${location.pathname}${path}`);
    return normalizeUrl(`${protocol}://localhost:3000${location.pathname}${path}`);
}

function createWebSocket(url: string): WebSocket {
    const socketOptions = {
        maxReconnectionDelay: 10000,
        minReconnectionDelay: 1000,
        reconnectionDelayGrowFactor: 1.3,
        connectionTimeout: 10000,
        maxRetries: Infinity,
        debug: false
    };
    return new ReconnectingWebSocket(url, [], socketOptions);
}

