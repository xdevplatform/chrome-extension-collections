/*
 * auth.js handles callback after OAuth login and 
 * saves Settings.
 */

$(document).ready(function() {

	$("#success").hide();
	$("#failure").hide();

	var accessToken = QueryString.get("1", null);
	var accessTokenSecret = QueryString.get("2", null);
	
	if (!accessToken || !accessTokenSecret){
		$("#failure").show();
		return;
	}
	
	var properties = {
		'accessToken' : accessToken,
		'accessTokenSecret' : accessTokenSecret,
	}

	// alert(JSON.stringify(properties));

	Settings.save(properties, function() {
		var request = {
			type : "background.reloadSettings",
		};

		chrome.runtime.sendMessage(request, function(response) {
			$("#success").show();
		});
	});

});
