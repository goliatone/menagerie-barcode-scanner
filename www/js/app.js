var resultDiv, resultZbar, socket, _device, _location, _assetTag, _form;

var HOST = '<HOST>',
	PORT= null,
	SERVER_URL = 'http://' + HOST + (PORT ? ':' + PORT : ''),
	ENDPOINT = '/thing/barcode-scann';

var WEB_APP_TOKEN = '<OAUTH_TOKEN_HERE>';


var isPhoneGap = ! /^http/.test(document.location.protocol);

document.addEventListener("deviceready", init, false);
// document.addEventListener("deviceready", oauthsetup, false);

//HACK!Prevent scrolling out of view
document.addEventListener('touchmove', function(e) { e.preventDefault(); }, false);

var validations = {
	location: /^[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}$/,
	device: /^([0-9A-Fa-f]{2}[:-]?){5}([0-9A-Fa-f]{2})$/,
	assetTag: /^[0-9]{6}$/
};

function init()
{
	var eventType = isPhoneGap ? 'touchend' : 'mouseclick';
	document.querySelector("#clear").addEventListener(eventType, _clear, false);
	document.querySelector("#startScan").addEventListener(eventType, startScan, false);

	resultDiv = document.querySelector("#results");
	resultZbar = document.querySelector("#results-zbar");

	resultDiv.innerHTML = 'Connecting...';

	_form = document.querySelector('#main-form');

	_device = $('#device');
	_location = $('#location');
	_assetTag = $('#assetTag');

	$('#main-form').submit(function(e){
		e.preventDefault();

		var payload = {
			deviceId: _device.val(),
			location: _location.val(),
			assetTag: _assetTag.val()
		};

		var endpoint = SERVER_URL + ENDPOINT;
		//we send and on success we clear the device field
		notifyReading(endpoint, payload);

		_clear();

		return false;
	});

	//Handle options modal window:
	$(document).on('open.fndtn.reveal', '[data-reveal]', function () {
		$('[name=url]', '#options-form').val(SERVER_URL);
		$('[name=token]', '#options-form').val(WEB_APP_TOKEN);
	});

	//Handle options modal window:
	$(document).on('close.fndtn.reveal', '[data-reveal]', function () {
		console.log('CLOSE REVEAL');
		SERVER_URL = $('[name=url]', '#options-form').val();
		WEB_APP_TOKEN = $('[name=token]', '#options-form').val();
		createSocket(SERVER_URL);
	});

	$('#options-btn').on('click', function(){
		$('#options-modal').foundation('reveal', 'close');
	});

	console.log('URL', SERVER_URL);

	createSocket(SERVER_URL);
}

function createSocket(url){

	if(socket && socket.io.uri === url){
		if(socket.connected) return console.log('Socket connected');
	}

	if(socket){
		socket.close();
		socket.removeAllListeners();
		socket.doConnect = true;
		console.log('Socket reset');
	}

	socket = io(url, {
		transports:[
			'polling',
			'websocket',
			'htmlfile',
			'xhr-polling',
			'jsonp-polling'
		]
	});

	socket.on('connect', function () {
		console.log('Connected');
		resultDiv.innerHTML = 'Connected';
	});

	socket.on('error', function(e){
		resultDiv.innerHTML = 'ERROR:' + e.toString();
	});

	socket.on('/thing/barcode-scann', function(payload){
		console.log('UPDATED: ', JSON.stringify(payload));
		resultDiv.innerHTML = payload.success ? '<p>All GOOD</p>' : '<p>Error :(</p>';
	});

	if(socket.doConnect){
		socket.connect();
		console.log('Socket connecting');
	}

	window.socket = socket;
}




function startScan(e) {
	e.preventDefault();

	// cordova.plugins.zbarScanner.scan(
	cordova.plugins.barcodeScanner.scan(
		function (result) {
			var s = "Result: " + result.text + "<br/>" +
			"Format: " + result.format + "<br/>" +
			"Cancelled: " + result.cancelled;
			result = sanitizePayload(result);
			handleReading(result);
		},
		function (error) {
			alert("Scanning failed: " + error);
		}
	);
}

function _clear(e){
	e && e.preventDefault();

	_device.val('');
	_location.val('');
	_assetTag.val('');

	return false;
}

function handleReading(result){

	var reg, valid = false;
	Object.keys(validations).map(function(key){
		reg = validations[key];
		if(!reg.test(result.text)) return;
		$('#'+key).val(result.text);
		valid = true;
	});

	if(!valid) resultDiv.innerHTML = 'Invalid: ' + result.text;

	if(_form.checkValidity()) updateUI();
}

function updateUI(){
	$('#toolbar').toggleClass('hidden');
	$('#startScan').toggleClass('hidden');
}

function notifyReading(endpoint, payload){
	console.log('=> NOTIFY READING', endpoint, JSON.stringify(payload));

	socket.emit('/thing/socketes', payload);

	resultDiv.innerHTML = endpoint;

	$.ajax({
		url: endpoint,
		data: payload,
		type: "POST",
		crossDomain: true,
		dataType: "json",
		beforeSend : setAuthorizationToken
	}).done(function(res){
		console.log('AJAX response: ', JSON.stringify(res));
		if(res.success) resultDiv.innerHTML = 'Transaction complete';
		else resultDiv.innerHTML = res.message;
	}).fail(function(e){
		console.error('ERROR %s', e, JSON.stringify(e));
		resultDiv.innerHTML = '<h4>Error</h4><br/><code>' + JSON.stringify(e, null, 4) + '</code>';
	}).always(function(){
		updateUI();
	});

	console.log('POST', endpoint, JSON.stringify(payload));
}

function getToken(){
	console.log('WEB APP TOKEN', WEB_APP_TOKEN);
	return "Bearer " + WEB_APP_TOKEN;
}
function setAuthorizationToken(xhr){
	xhr.setRequestHeader("Authorization", getToken());
}

function sanitizePayload(result){
	//TODO: for realz
	result.text = result.text.replace('/find/device/', '');
	result.text = result.text.replace('/find/location/', '');
	// result.text = (result.text || '').replace(/\W/g, '');
	result.barcode = result.text;
	return result;
}



function oauthsetup(){
	var authUrl = 'http://things.weworkers.io/login';
	var authWindow = window.open(authUrl, '_blank', 'location=no,toolbar=no');
	$(authWindow).on('loadstop', function(e){
		console.log('LOADSTOP');
		console.log('e', JSON.stringify(e, null, 4));
	});

	$(authWindow).on('loaderror', function(e){
		console.log('LOADERROR');
		console.log('e', JSON.stringify(e, null, 4));
	});

	$(authWindow).on('exit', function(e){
		console.log('EXIT');
		console.log('e', JSON.stringify(e, null, 4));
	});

	$(authWindow).on('loadstart', function(e){
		var url = e.originalEvent.url;
		var code = /\?code=(.+)$/.exec(url);
		var error = /\?error=(.+)$/.exec(url);

		if (code || error) {
			//Always close the browser when match is found
			authWindow.close();
			console.log('Close authwindow', code ? code : error);
		}

		console.log(authWindow.document.title);
		if (code) {
			//Exchange the authorization code for an access token
			$.post('https://accounts.google.com/o/oauth2/token', {
				code: code[1],
				client_id: options.client_id,
				client_secret: options.client_secret,
				redirect_uri: options.redirect_uri,
				grant_type: 'authorization_code'
			}).done(function(data) {
				deferred.resolve(data);
			}).fail(function(response) {
				deferred.reject(response.responseJSON);
			});
		} else if (error) {
			//The user denied access to the app
			deferred.reject({
				error: error[1]
			});
		}
	});
}
