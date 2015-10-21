var resultDiv, resultZbar, socket, _device, _location, _assetTag, _form;

var IP = '10.31.70.86',
	PORT= '1337',
	SERVER_URL = 'http://' + IP + ':' + PORT,
	ENDPOINT = '/thing/barcode-scann';


SERVER_URL = 'http://menagerie.ngrok.io';

var isPhoneGap = ! /^http/.test(document.location.protocol);

document.addEventListener("deviceready", init, false);

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

	_form = document.querySelector('#menagerie');

	_device = $('#device');
	_location = $('#location');
	_assetTag = $('#assetTag');

	console.log('URL', SERVER_URL);
	console.log('WS', 'ws://' + SERVER_URL);

	$('#menagerie').submit(function(e){
		e.preventDefault();

		var payload = {
			alias: _device.val(),
			location: _location.val(),
			assetTag: _assetTag.val()
		};
		var endpoint = SERVER_URL + ENDPOINT;
		//we send and on success we clear the device field
		notifyReading(endpoint, payload);

		_clear();

		return false;
	});

	socket = io(SERVER_URL, {
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
}

function startScan(e) {
	e.preventDefault();

	// cordova.plugins.zbarScanner.scan(
	cordova.plugins.barcodeScanner.scan(
		function (result) {
			var s = "Result: " + result.text + "<br/>" +
			"Format: " + result.format + "<br/>" +
			"Cancelled: " + result.cancelled;
            // resultZbar.innerHTML = s;
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

	socket.emit('scanner/barcode', payload);

	$.ajax({
		url: endpoint,
		data: payload,
		type: "POST",
        crossDomain: true,
        dataType: "json",
	}).done(function(a){
		console.log('DONE ', JSON.stringify(a));
		resultDiv.innerHTML = 'Transaction complete';
	}).fail(function(e){
		console.error('ERROR %s', e, JSON.stringify(e));
		resultDiv.innerHTML = '<h4>Error</h4><br/><code>' + JSON.stringify(e, null, 4) + '</code>';
	}).always(function(){
		updateUI();
	});
	resultDiv.innerHTML = endpoint;
	console.log('POST', endpoint, JSON.stringify(payload));
}


function sanitizePayload(result){
	//TODO: for realz
	result.text = result.text.replace('/find/device/', '');
	result.text = result.text.replace('/find/location/', '');
	// result.text = (result.text || '').replace(/\W/g, '');
	result.barcode = result.text;
	return result;
}
