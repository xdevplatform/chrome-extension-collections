/**
 * background.js is loaded once per browser instance. acts as the handler from
 * page.js and dispatcher to contentscript.js
 */

var manifest = chrome.runtime.getManifest();

if (chrome.runtime.onInstalled) {
	chrome.runtime.onInstalled.addListener(function() {
		Menu.createContext();
		
		Settings.save(Settings.DEFAULT);
	});

};

// listen for actual context menu selection
if (chrome.contextMenus && chrome.contextMenus.onClicked) {
	chrome.contextMenus.onClicked.addListener(Menu.onClickHandler);
}

// Because Twitter always here, all requests to insert tweets go here
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {

	console.log("background.js: " + JSON.stringify(request));

	var type = request.type;

	if (type == "background.twitterRequestToken") {

		Twitter.requestToken(function (auth_url) {
            // Create window to allow auth and get pin
			chrome.tabs.create({
				"url" : auth_url
			});
			
			// unused, but notifies UI to change state
			sendResponse({ success : true });
        });
		
		// allow async callback of sendResponse()
		return true;

	}
	
	if (type == "background.twitterAccessToken") {

		pin = request.pin;
		
		Twitter.accessToken(pin, function (accessToken, accessTokenSecret) {

			if (accessToken && accessTokenSecret){

				var properties = {
						 'accessToken' : accessToken, 
						 'accessTokenSecret' : accessTokenSecret
					}
					
				Settings.save(properties, function(){
					// after success, call Twitter.init to set user
					
					Twitter.init(function(){
						sendResponse({ success : true, status : "Authentication saved." });
					}, function(){
						sendResponse({ success : false, status : "Invalid PIN. Please refresh and try again." });
					});
				});
				
			} else {
				
				sendResponse({ success : false, status : "Invalid PIN. Please refresh and try again." });
				
			}
			


        });
		
		// allow async callback of sendResponse()
		return true;

	}
	
	if (type == "background.reloadSettings") {

		init();
		
		sendResponse({});
		
		// allow async callback of sendResponse()
		return true;

	}

	if (type == "background.loadCollections") {

        // BUGBUG: occasionally, page loads and sends
		// request BEFORE background has loaded. Guard around
		// this by initializing on demand.
		
        if (!Twitter.user){
    		Twitter.init(function() {

    			Twitter.call("collections_list", {
    				count : 25,
    				user_id : Twitter.user.id
    			}, function(response) {
    				console.log("response:");
    				console.log(JSON.stringify(response));
    				sendResponse(response);
    			});

    		}, function() {
    			URL.open("settings");
    		});
        } else {
        	
    		Twitter.call("collections_list", {
    			count : 25,
    			user_id : Twitter.user.id
    		}, function(response) {
    			sendResponse(response);
    		});

        }

		// allow async callback of sendResponse()
		return true;

	}
	
	if (type == "background.loadTweets") {

		var collectionId = request.id;
		Twitter.call("timelines_timeline", {
			id : collectionId
		}, function(response) {
			sendResponse(response);
		});

		// allow async callback of sendResponse()
		return true;

	}
	
	if (type == "background.deleteCollection") {

		var collectionId = request.id;
		Twitter.call("collections_destroy", {
			id : collectionId
		}, function(response) {
			sendResponse(response);
		});

		// allow async callback of sendResponse()
		return true;

	}
	
	if (type == "background.saveTweetsToCollection") {

		var collectionId = request.collectionId;
		var tweetIds = request.ids;
		
		// new collection or updating everything
		if (collectionId == 'new'){

			var request = {
					name : request.collectionName,
					description : request.collectionDescription,
					timeline_order : request.collectionOrder
				}; 

			Twitter.call("collections_create", request, function(response) {

				if (response.error){
					sendResponse(response);
				} else {
				
					collectionId = response['response']['timeline_id'];
					Twitter.saveTweetsToCollection(collectionId, tweetIds, function(err){
						sendResponse({collectionId : collectionId});
					});
					
				}

			});
		
		} else {

			Twitter.saveTweetsToCollection(collectionId, tweetIds, function(err){
				sendResponse({collectionId : collectionId});
			});

		}
		
		// allow async callback of sendResponse()
		return true;

	}
	
	if (type == "background.reorderTweets") {

		var collectionId = request.collectionId;
		var tweetIds = request.ids;
		
		// first: get the full collection
		var request = {
			id : collectionId
		}
		
		Twitter.call("collections_show", request, function(response) {

			if (response.error){
				sendResponse(response);
			} else {

				var object = response['objects']['timelines'][collectionId];
				
				// next: set order to reverse cron
				request['name'] = object['name'];
				request['description'] = object['description'];
				request['timeline_order'] = "curation_reverse_chron";

				Twitter.call("collections_update", request, function(response) {

					if (response.error){
						sendResponse(response);
					} else {

						// next: purse all old tweets
						Twitter.removeTweetsFromCollection(collectionId, tweetIds, function(err){

							// last: re-add in desired order
							Twitter.saveTweetsToCollection(collectionId, tweetIds, function(err){
								sendResponse({});
							});

						
						});
						
					}

				});
				
			}
			
		});
		
		// allow async callback of sendResponse()
		return true;

	}
	
	if (type == "background.removeTweetsFromCollection"){

		var collectionId = request.collectionId;
		var tweetIds = request.ids;

		Twitter.removeTweetsFromCollection(collectionId, tweetIds, function(err){
			sendResponse({});
		});

		// allow async callback of sendResponse()
		return true;
		
	}
	
	if (type == "background.embedTweets") {
		var tweetIds = request.ids;
		Twitter.embedTweets(tweetIds, function(content){
			sendResponse({content: content});
		});
		
		// allow async callback of sendResponse()
		return true;

	}

});

function init(){
	Settings.init(function(){
		console.log("Settings.init complete");
		Twitter.init(function() {
			console.log("Twitter.init complete");
		}, function() {
			URL.open("settings");
		});
	}, function() {
		URL.open("settings");
	});
}

init();
