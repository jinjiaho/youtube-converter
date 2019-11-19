
function save(formId) {
	let form = $("#" + formId);
	// showSavingOverlay();

	let dirSet = $("#dirpath").val();
	// trim the whitespace from text input values
	let values = toKeyValuePairs(form.serializeArray());
	values['dir'] = dirSet;
	showMessage();

	$.ajax({
		type: 'POST',
		url: `/save-${formId}`,
		data: values, 
		success: function() {	
			// hideSavingOverlay();
			alert('saved within timeout!');
		}, error: function(err) {
			// hideSavingOverlay();
			// alert('not saved: ', err);
		}
	});

	function toKeyValuePairs(serializedArray) {
		let keyValPairs = {};
		for (let i of serializedArray) {
		  keyValPairs[i.name] = i.value;
		}
		return keyValPairs;
	}

	function getInputValue(name) {
		return form.find(`input[name=${name}]`).val().trim();
	}
}

function showMessage() {
	$("#message-modal").addClass('active');
}

function dismissMessage() {
	$("#message-modal").removeClass('active');
}

function showSavingOverlay() {
	$("#saving-overlay").show();
	animation = setIntevrval(function() {
		// animation here
	}, 100);
}

function hideSavingOverlay() {
	$("#saving-overlay").hide();
	clearInterval(animation);
	animation = null;
}