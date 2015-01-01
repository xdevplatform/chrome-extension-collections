/**
 * contentscript.js handles only requests to modify the DOM.
 * 
 * menu items are initialized in background.js
 */

var Collections = {

	TWEET_ACTION : "<div class='ProfileTweet-action ProfileTweet-action--collection js-toggleState' data-url='%URL%'>" +
		"<span class='ProfileTweet-actionButton' style='font-weight:bold; font-size: 1.8em; margin-top:-.2em;' onmouseover='this.style.color=\"#3B94D9\";' onmouseout='this.style.color=\"#ccd6dd\";');return false;'>&plus;</span>" +
		"</div>",
		
	MODAL : "<div id='collectionModal'><div id='dialog'>" +
		"<div id='header'><h3 id='headerText'>Add Tweet to Collection</h3></div>" +
		"<div id='contents'><p>Add this tweet to:</p>" +
		" <div id='collectionModalList'>" +
		" </div>" +
		"</div>" +
		"<div id='footer'> " +
		" <a href='#' class='pull-left' id='collectionModalNew'>Create New Collection</a> " +
		" <a href='#' class='btn primary-btn pull-right' id='collectionModalSave'>Save</a> " +
		" <a href='#' class='btn pull-right' id='collectionModalCancel'>Cancel</a> " +
		"</div> " +
		"</div></div>",
		
	init : function(){

		// add collection modal 
		$(document.body).append(Collections.MODAL);
		
		// immediately hide collection modal & batch save button
		Collections.hideModal();
		
		// collection modal: enable single save
		$("#collectionModal").on("click", ".collectionModalListItem", function(){
			var tweetId = $(this).data("tweet-id");
			var collectionId = $(this).data("collection-id");
			Collections.saveTweetToCollections(tweetId, [collectionId]);
			return false;
		});	
		
		// collection modal: enable bulk select
		$("#collectionModal").on("click", ".collectionModalListItemCheckbox", function(){
			var collectionIds = Collections.getSelected();
			if (collectionIds.length > 0){
				$("#collectionModalSave").show();
			} else {
				$("#collectionModalSave").hide();
			}
		});	

		// collection modal: enable bulk save
		$("#collectionModal").on("click", "#collectionModalSave", function(){
			var tweetId = $(this).data("tweet-id");
			var collectionIds = Collections.getSelected();
			if (collectionIds.length > 0){
				Collections.saveTweetToCollections(tweetId, collectionIds);
			}
			return false;
		});
		
		// collection modal: enable cancel
		$("#collectionModal").on("click", "#collectionModalCancel", function(){
			Collections.hideModal();
			return false;
		});

		// collection modal: enable new (link in new window)
		$("#collectionModal").on("click", "#collectionModalNew", function(){
			var url = $(this).data('url');
			url = URL.make("save", {url : url});
			window.open(url, '_target');
			Collections.hideModal();
			return false;
		});
		
		// add icon to each tweet 
		Collections.injectAddins();
		
	},
	
	getSelected : function(){
		var collectionIds = [];
		$(".collectionModalListItemCheckbox").each(function(){
			if ($(this).prop('checked')){
				collectionIds[collectionIds.length] = $(this).data("collection-id");
			}
		});
		return collectionIds;
	},
	
	saveTweetToCollections : function(tweetId, collectionIds){
		
		async.each(collectionIds, function(collectionId, callback){
			var request = {
				type: "background.saveTweetsToCollection",
				collectionId : collectionId,
				ids : [tweetId]
			};
			chrome.runtime.sendMessage(request, function(response){
				callback(null);
			});
		}, function(err){

			$("#contents").hide();
			$("#footer").hide();
			$("#headerText").html("Saved to Collections.");

			setTimeout(function() {
				$("#collectionModal").fadeOut();
			}, 1000 /* Settings.UI_TIMEOUT */);

		});

	},
	
	showModal : function(tweetId, tweetUrl) {
		
		$("#header").show();
		$("#contents").show();
		$("#footer").show();
		$("#headerText").html("Add Tweet to Collection");
		$("#collectionModalList").html("<center><div class='spinner'></div></center>");
		$("#collectionModalSave").hide();
		$("#collectionModal").show();

		chrome.runtime.sendMessage({type: "background.loadCollections"},
		  function(response) {
			
			var htmlList = "";
			
			if (response && response.response && response.response.results){
				for (var i = 0; i < response.response.results.length; i++){
					var collectionId = response.response.results[i].timeline_id;
					var collection = response.objects.timelines[collectionId];
					var html = "<li><input type='checkbox' class='collectionModalListItemCheckbox' data-tweet-id='"+tweetId+"' data-collection-id='"+collectionId+"'></input> &nbsp;<a class='collectionModalListItem' data-tweet-id='"+tweetId+"' data-collection-id='"+collectionId+"'>" + collection.name + "</a></li>";
					htmlList = htmlList + html;
				}
			}
			htmlList = "<ul>" + htmlList + "</ul>";
			$("#collectionModalList").html(htmlList);
			$("#collectionModalNew").data("url", tweetUrl);
			$("#collectionModalSave").data("tweet-id", tweetId);
			$("#footer").show();

		});
	},
	
	hideModal : function(){
		$("#collectionModal").hide();
	},

	injectCollectionAction : function(){
		
		// insert collection icon for every tweet
		$(".tweet, .js-tweet").each(function(){

			var tweetId = $(this).data("tweet-id");
			var existingCollectionAction = $(this).find(".ProfileTweet-action--collection");
			
			// only add once
			if (!existingCollectionAction || existingCollectionAction.length == 0){
				var href = $(this).find(".js-permalink").attr("href");
				var url = "http://twitter.com" + href;
				
				var lastAction = $(this).find(".ProfileTweet-actionList div.ProfileTweet-action:last-child");
				lastAction.before(Collections.TWEET_ACTION.replace('%URL%', url));
				
				$(this).on("click", ".ProfileTweet-action--collection", function(){
					Collections.showModal(tweetId, url);
					return false;
				});	
			}

		});
		
	},
	
	injectAddins : function(){
		
		setInterval(function(){
			Collections.injectCollectionAction();
		}, 2000);

	},
		
}

var HTML = {
		
	insertTextAtPosition : function(txt) {

		var found = false;
		var focusEl = window.top.document;
		var failSafe = 0;
		var parent = window;

		var text = txt;
		var html = null;

		while (false === found) {

			// has an active element so need to keep searching, ie in a frame
			if (focusEl.activeElement) {

				// set next focusEl
				focusEl = focusEl.activeElement;

				if (focusEl instanceof HTMLIFrameElement) {

					parent = focusEl.contentDocument;
					focusEl = focusEl.contentDocument;

				}

				// found iframe in design mode
				if (focusEl.designMode == 'on' || focusEl.contentEditable) {

					// no need to carry on
					found = true;

				}

			}
			// no more active elements so we can stop
			else {

				found = true;

			}

			failSafe++;

			// failsafe in case something went wrong to prevent infinite loop
			if (failSafe > 100) {
				found = true;
				alert('Sorry, couldn\'t find target to insert text into.');
				return false;
			}

		}

		// design mode editor
		if (focusEl.designMode == 'on') {
			console.log('designmode');

			if (!html) {
				// replace line breaks with <br/> tags
				text = text.replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g,
						'$1<br/>$2');
			}

			// insert
			focusEl.execCommand('insertHtml', false, text);

		}
		// input, textarea
		else if (focusEl.tagName.toLowerCase() == 'input'
				|| focusEl.tagName.toLowerCase() == 'textarea') {
			console.log('input');
			// get start and end position of caret
			var startPos = focusEl.selectionStart;
			var endPos = focusEl.selectionEnd;

			// insert text
			focusEl.value = focusEl.value.substring(0, startPos) + text
					+ focusEl.value.substring(endPos, focusEl.value.length);

			// update caret position
			focusEl.setSelectionRange(startPos + text.length, startPos
					+ text.length);

		}
		// if content editable
		else if (focusEl.contentEditable) {
			console.log('contentEditable');
			// get selection
			var selection = parent.getSelection();
			var range = selection.getRangeAt(0);

			range.deleteContents();

			// get text
			if (html) {
				var div = document.createElement('div');
				div.innerHTML = text;
				range.insertNode(div);
			} else {
				var text = text.replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g,
						'$1<br/>$2');
				var texts = text.split('<br/>');

				// insert
				for ( var i = texts.length - 1; i >= 0; i--) {
					range.insertNode(document.createTextNode(texts[i]));
					if (i > 0) {
						range.insertNode(document.createElement('br'));
					}
				}
			}
			range.collapse(true);
			range.detach();

		}

	},
	
}

//prevent IFRAMES from loading this listener multiple times.
if (!window.top.listenerLoaded) {
	
	window.top.listenerLoaded = true;
	
	chrome.extension.onMessage.addListener(function(request, sender,
			sendResponse) {

		console.log('contentscript.js: ' + JSON.stringify(request));

		var type = request.type;
		
		if (type == "contentscript.insertTextAtPosition") {
			var text = request.content;
			HTML.insertTextAtPosition(text);
			
			sendResponse({});
		}
		
		// allow async callback of sendResponse()
		return true;
		
	});
	
	Collections.init();
	
	console.log('contentscript.js: loaded');

}