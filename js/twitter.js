$(document).bind("ready", function() {

	var tags = QueryString.get("tags");
	if (tags) {
		setTimeout(function() {
			if (tags && tags != 'null') {
				$("#postingHtmlBox").val(tags);
				$(".titleField").focus();
			}
		}, 2000);
	}

});
