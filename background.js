var ws;

var storage = localStorage;
var token;

var auth_data = null;
var portfolio = null;

var port;

var page_messages = {
    'auth': sendAuthenticate,
    'logout': logout
};

chrome.browserAction.setBadgeBackgroundColor({color: "#2e8836"});
updateBadge();

function openWebsocketConnection() {
    ws = new WebSocket('wss://ws.binaryws.com/websockets/v3');
    ws.onopen = function(evt) {
        token = token || storage.getItem('token');
        if (token) {
            sendWebsocketMessage({authorize: token});
        }
    };
    ws.onclose = function(evt) {
        ws.onopen = null;
        ws.onclose = null;
        auth_data = null;
        openWebsocketConnection();
    };
    ws.onmessage = websocketMessage;
}

function sendWebsocketMessage(message) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    }
}

openWebsocketConnection();

// page connected
chrome.runtime.onConnect.addListener(function(content_port) {
    port = content_port;
    port.onMessage.addListener(contentMessage);
    port.onDisconnect.addListener(contentDisconnected);
    sendPageMessage({auth: auth_data, portfolio: portfolio});
    sendWebsocketMessage({proposal_open_contract: 1, subscribe: 1});
});

// page disconnected
function contentDisconnected() {
    port = null;
    sendWebsocketMessage({forget_all: 'proposal_open_contract'});
}

function contentMessage(message) {
    if (page_messages.hasOwnProperty(message.type) && typeof page_messages[message.type] === 'function') {
        page_messages[message.type](message.value);
    }
}

// callbacks to websocket messages

function websocketMessage(msg) {
    var data = JSON.parse(msg.data);
    var echo = data.echo_req;
    if (echo) {
        if (echo.authorize) { // response to auth request
            auth_data = token = null;
            if (data.authorize) {
                auth_data = data.authorize;
                token = echo.authorize;
                if (data.passthrough && data.passthrough.remember) {
                    storage.setItem('token', token);
                }
                sendWebsocketMessage({portfolio: 1});
                sendWebsocketMessage({transaction: 1, subscribe: 1});
                sendPageMessage({auth: auth_data});
            } else if (data.error) {
                sendPageMessage({auth_error: data.error});
            }

        }
        if (data.portfolio) {
            portfolio = data.portfolio;
            sendWebsocketMessage({forget_all: 'proposal_open_contract'});
            sendPageMessage({portfolio: portfolio});
            updateBadge();
        }
        if (data.proposal_open_contract) {
            sendPageMessage({proposal: data.proposal_open_contract});
        }
        if (data.transaction && data.transaction.transaction_id) {
            ws.send(JSON.stringify({portfolio: 1}));
            auth_data.balance = data.transaction.balance;
            sendPageMessage({auth: auth_data});
            showTransactionNotification(data.transaction);
        }
        if (data.forget_all) {
            if (port) {
                sendWebsocketMessage({proposal_open_contract: 1, subscribe: 1});
            }
        }

    }

}

function sendPageMessage(message) {
    if (port) {
        port.postMessage(message);
    }
}

function sendAuthenticate(data) {
    var message = {
        'authorize': data.token
    };
    if (data.remember) {
        message.passthrough = { remember: true }
    }

    sendWebsocketMessage(message);
}

function logout() {
    storage.removeItem('token');
    token = null;
    auth_data = null;
    portfolio = null;
    ws.close();
    updateBadge();
    sendPageMessage({auth: null});
}

function showTransactionNotification(transaction) {
    var text = '';
    if (transaction.action === 'buy' || transaction.action === 'sell') {
        text = transaction.display_name + (transaction.action === 'buy' ? ' bought' : ' sold');
        text += '.\n';
    } else {
        text = transaction.longcode+'\n'
    }
    text += 'Balance is: $' + transaction.balance;
    new Notification(text, {
        icon: 'icons/favicon-160x160.png'
    });
}

function updateBadge() {
    var text = portfolio && portfolio.contracts && portfolio.contracts.length ? String(portfolio.contracts.length) : '';
    chrome.browserAction.setBadgeText({text: text});
}
