var body             = $('body');

var form_holder      = $('#form');
var form_input       = $('#input-token');
var form_remember    = $('#remember-token');
var form_submit      = form_holder.find('button');
var form_error       = $('#auth-error');
form_submit.on('click', tokenSubmitted);

var content          = $('#content');

var account_holder   = $('#account');
var account_id       = account_holder.find('.account-id');
var account_balance  = account_holder.find('.balance');
var logout_btn       = $('#logout');
logout_btn.on('click', logoutClicked);

var no_contracts     = $('#no-contracts');
var portfolio_holder = $('#portfolio');
var portfolio_rows   = portfolio_holder.find('table tbody');
var portfolio_tpl    = portfolio_holder.find('tr.tpl');

portfolio_tpl.removeClass('tpl').remove();

var port = chrome.runtime.connect({name: "binary"});

port.onMessage.addListener(function(message) {
    if (message) {
        if (message.hasOwnProperty('auth')) {
            if (message.auth) {
                updateAccountData(message.auth);
                showContent();
            } else {
                showForm();
            }
        }
        if (message.auth_error) {
            tokenError(message.auth_error.message);
        }
        if (message.portfolio) {
            updatePortfolio(message.portfolio);
        }
        if (message.proposal) {
            updateContract(message.proposal);
        }
    }
});

function showForm() {
    form_input.val('');
    body.removeClass('auth');
}

function clearForm() {
    form_input.val('');
    form_remember.prop('checked', false);
}

function tokenSubmitted() {
    var message = {
        type: 'auth',
        value: {
            token: form_input.val(),
            remember: form_remember.prop('checked')
        }
    };
    form_error.addClass('hidden').text('');
    port.postMessage(message);
}

function tokenError(message) {
    form_error.removeClass('hidden').text(message);
    clearForm();
}

function logoutClicked() {
    clearForm();
    portfolio_rows.html('');
    port.postMessage({type: 'logout'});
    window.close();
}

function showContent() {
    body.addClass('auth');
}

function updateAccountData(new_data) {
    account_id.text(new_data.loginid);
    account_balance.text(new_data.balance);
}

function updatePortfolio(portfolio) {
    var fragment, new_contract, new_link;
    portfolio_rows.html('');

    portfolio_holder.addClass('hidden');
    no_contracts.addClass('hidden');

    if (portfolio.contracts && portfolio.contracts.length) {
        fragment = $(document.createDocumentFragment());
        portfolio.contracts.forEach(function (contract) {
            new_contract = portfolio_tpl.clone();
            new_contract.addClass('contract-' + contract.contract_id);
            new_contract.find('.ref').text(contract.transaction_id);
            new_contract.find('.payout strong').text('$' + contract.payout);
            new_contract.find('.details').text(contract.longcode);
            new_contract.find('.purchase strong').text('$' + contract.buy_price);
            new_link = new_contract.find('.link a');
            new_link.attr('href', new_link.attr('href')+'?contract_id='+contract.contract_id);
            fragment.append(new_contract);
        });
        portfolio_rows.append(fragment);
        portfolio_holder.removeClass('hidden');
    } else {
        no_contracts.removeClass('hidden');
    }
}

function updateContract(proposal) {
    var contract = portfolio_rows.find('tr.contract-'+proposal.contract_id),
        proposal_holder, old_price, new_price, new_class = '';
    if (contract.length) {
        proposal_holder = contract.find('.indicative strong');
        old_price = Number($.data(proposal_holder[0], 'price'));
        new_price = Number(proposal.bid_price)*100;
        if (!proposal.is_valid_to_sell){
            new_class = 'no_resale';
        } else if (new_price > old_price) {
            new_class = 'price_moved_up';
        } else if (new_price < old_price) {
            new_class = 'price_moved_down';
        }
        proposal_holder.removeClass('no_resale price_moved_up price_moved_down');
        $.data(proposal_holder[0], 'price', new_price);
        proposal_holder.text('$'+proposal.bid_price);
        proposal_holder.addClass(new_class);
    }
}