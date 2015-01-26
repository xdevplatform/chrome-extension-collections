/*
 * page.js handles only interaction with user.
 * any model/controller logic is deferred to background.js.
 */

// BUGBUG:
// - Copy to clipboard functionality!

$(document).ready(function() {

	Settings.init(function(){
		console.log("Settings.init complete");
		Page.init();
	}, function() {
		URL.open("settings");
	});

});

$(document).error(function(){
	Page.setError("Some error.");
});

var Page = {

	init : function() {

		$('#status').hide();
		$('#error').hide();

		CollectionsPage.init();
		SettingsPage.init();
		TutorialPage.init();
		Page.setDefault();

	},

	setDefault : function() {

		var isAuthenticated = Settings.properties['accessToken'];
		var authState = Settings.properties['authState'];
		if (isAuthenticated){
			SettingsPage.setState(isAuthenticated, false);
		} else if (authState && authState == Settings.AUTH_STATE_PIN){
			SettingsPage.setState(false, true);
		} else {
			SettingsPage.setState(isAuthenticated, false);
		}

		var page = QueryString.get("page", "collections");
		if ((Settings.ONLINE && !isAuthenticated) || page == 'settings') {
			SettingsPage.showTab();
		} else if (page == 'tutorial'){
			TutorialPage.showTab();
		} else if (page == 'save'){
			CollectionsPage.showTab();
			CollectionsPage.showSaveTweet();
		} else /* if (page == 'collections') */ {
			CollectionsPage.showTab();
			CollectionsPage.showCollections();
		}
	},

	setStatus : function(text) {

		$('#status').html(text).show();
		setTimeout(function() {
			$('#status').fadeOut();
		}, Settings.UI_TIMEOUT);
	},

	setError : function(text) {

		$('#error').html(text).show();
		setTimeout(function() {
			$('#error').fadeOut();
		}, Settings.UI_TIMEOUT);
	},

	setSpinner : function(id){
		$(id).html("<div class='spinner'><img src='img/spinner.gif'></div>");
	},

}

var CollectionsPage = {

	init : function() {
		
		CollectionsPage.hideAll();
		
		/**
		 * Navigation
		 */

		$(document).on("click", ".collection", function(e) {
			var collectionId = $(this).data("id");
			var name = $(this).data("collection-name");
			CollectionsPage.showTweets(collectionId, name);

			// on first click, good time to remove explainer
			$('#collections_subtitle').hide();
		});

		$(document).on("click", "#collections_breadcrumb li:first", function() {
			CollectionsPage.showCollections();
		});
		
		/**
		 * Tweet Actions
		 */
		
		// tweet embed: individual
		$(document).on("click", ".tweet_embed", function() {
			var tweetId = $(this).data("id");
			var request = {
				type : "background.embedTweets",
				ids : [tweetId]
			};

			chrome.runtime.sendMessage(request, function(response) {
				Page.setStatus("Tweet(s) embedded at cursor and copied to clipboard.");
				
				// Page.setStatus(JSON.stringify(response));
				CollectionsPage.copyToClipboard(response.content);
			});

		});
		
		// tweet embed: batch
		$(document).on("click", "#tweets_embed", function() {
			var tweetIds = CollectionsPage.getSelectedTweetIds();
			
			if (tweetIds.length == 0){
				Page.setStatus("No tweets selected.");
				return;
			}

			var request = {
				type : "background.embedTweets",
				ids : tweetIds
			};

			chrome.runtime.sendMessage(request, function(response) {
				$("#tweets_actions_embed").hide();
				Page.setStatus("Tweet(s) embedded at cursor and copied to clipboard.");
				
				// Page.setStatus(JSON.stringify(response));
				CollectionsPage.copyToClipboard(response.content);
			});

		});
		
		// tweet remove: individual
		$(document).on("click", ".tweet_remove", function() {

			// remove has no confirm; instead offers delay to cancel
			if ($(this).hasClass("btn-danger")){
				
				var timeout = $(this).data("timeout");
				clearTimeout(timeout);
				
				$(this).removeClass("btn-danger").html("Remove");
				
			} else {
				
				$(this).addClass("btn-danger").html("Undo");

				var collectionId = $(this).data("collection-id");
				var tweetId = $(this).data("id");
				var timeout = setTimeout(function() {

					var request = {
						type : "background.removeTweetsFromCollection",
						ids : [tweetId],
						collectionId : collectionId
					};

					chrome.runtime.sendMessage(request, function(response) {
						$(".row_" + tweetId).fadeOut();
					});
					
				}, Settings.UI_TIMEOUT);
				
				$(this).data("timeout", timeout);
			}
			
		});
		
		// tweet remove: batch
		$(document).on("click", "#tweets_remove", function() {
			
			var collectionId = $(this).data("collection-id");
			var tweetIds = CollectionsPage.getSelectedTweetIds();
			if (tweetIds.length == 0){
				Page.setStatus("No tweets selected.");
				return;
			}
			var request = {
				type : "background.removeTweetsFromCollection",
				collectionId : collectionId,
				ids : tweetIds,
			};

			chrome.runtime.sendMessage(request, function(response) {
				$("#tweets_actions_embed").hide();
				Page.setStatus("Tweet(s) removed.");
				CollectionsPage.showTweets(collectionId, null);
			});

		});
		
		// tweet select: individual
		$(document).on("click", ".tweet_check", function(){
			
			// on de-select, handle the "all selected" action 
			var prop = $(this).prop('checked');
			if (!prop){
				$(".tweet_check_all").prop('checked', false);
			}
			
			var count = 0;
			$(".tweet_check").each(function(){
				if ($(this).prop('checked')){
					count = count + 1;
				}
			});
			 if (count > 0){
				 $("#tweets_actions_embed").show();
			 } else {
				 $("#tweets_actions_embed").hide();
			 }

		}); 		
		
		// tweet select: batch
		$(document).on("click", ".tweet_check_all", function(){
			var prop = $(this).prop('checked');
			 $(".tweet_check").prop('checked', prop);
			 if (prop){
				 $("#tweets_actions_embed").show();
			 } else {
				 $("#tweets_actions_embed").hide();
			 }
		}); 

		// reorder: save
		$(document).on("click", "#tweets_order", function() {

			var collectionId = $(this).data("collection-id");
			
			var tweetIds = CollectionsPage.getOrderedTweetIds();
			if (tweetIds.length == 0){
				Page.setStatus("No tweets.");
				$("#tweets_actions_order").hide();
				return;
			}
			
			var request = {
				type : "background.reorderTweets",
				collectionId : collectionId,
				ids : tweetIds,  
			};

			chrome.runtime.sendMessage(request, function(response) {
				$("#tweets_actions_order").hide();
				Page.setStatus("Tweet(s) saved.");
				// CollectionsPage.showCollections();
			});
			
		});

		// reorder: cancel
		$(document).on("click", "#tweets_order_cancel", function() {

			$("#tweets_actions_order").hide();

		});
		
		$(document).on("click", ".external_url", function(e) {
			var url = $(this).attr("href");
			if (url){
				URL.external(url);
			}
		});
		
		/**
		 * Collection Actions
		 */
		
		$(document).on("click", "#view_collection", function(){
			
			var collectionId = $("#save_collection_id").val();
			var collectionName = $('#save_collection_id').find(":selected").text();
			if (!collectionId || collectionId == 'new'){
				Page.setError('Please select a Collection or create a new one.');
				return;
			}
			
			CollectionsPage.showTweets(collectionId, collectionName);
		});
		
		$(document).on("click", "#save_collection", function(){

			var collectionId = $("#save_collection_id").val();
			var collectionName = $("#save_collection_name").val();
			var collectionDescription = $("#save_collection_description").val();
			var collectionOrder = $("#save_collection_order").val();
			var tweetId = $("#save_tweet_id").val();
			
			if (!collectionId){
				Page.setError('Please select a Collection or create a new one.');
				return;
			}
			
			if (collectionId == 'new' && (!collectionName || !collectionDescription)){
				Page.setError('Collection name and description are required.');
				return;
			}
			
			var request = {
					type : "background.saveTweetsToCollection",
					collectionId : collectionId,
					collectionName : collectionName,
					collectionDescription : collectionDescription,
					collectionOrder : collectionOrder,
					ids : [tweetId],
				};

			chrome.runtime.sendMessage(request, function(response) {
				if (response.error){
					Page.setError(response.error);
				} else {
					
					var collectionId = response.collectionId;
					
					var properties = {
						lastUsedCollectionId : collectionId
					};
					Settings.save(properties, function(){
						Page.setStatus("Tweet(s) saved.");
						
						// Add to collection drop-down and set the collection ID in page, 
						// so "View Collection" button works
						var option = $("<option></option>").attr("value",collectionId).text(collectionName);
					    $('#save_collection_id').prepend(option);
					    
					    // set as new default
					    $('#save_collection_id').val(collectionId);
					    
					    // hide inputs
					    $("#save_collection_id").change();
					    
						
					});
					
				}
			});

		}); 
		
		$(document).on("change", "#save_collection_id", function(){
			var val = $(this).val();
			if (val == 'new'){
				$(".save_collection_attributes").fadeIn();
			} else {
				$(".save_collection_attributes").hide();
			}
		});
		$("#save_collection_id").change();
		
		$(document).on("click", ".collection_delete", function(){

			// delete has no confirm; instead offers delay to cancel
			if ($(this).hasClass("btn-danger")){
				
				var timeout = $(this).data("timeout");
				clearTimeout(timeout);
				
				$(this).removeClass("btn-danger").html("Delete");
				
			} else {
				
				$(this).addClass("btn-danger").html("Undo");

				var collectionId = $(this).data('id');
				var timeout = setTimeout(function() {

					var request = {
							type : "background.deleteCollection",
							id : collectionId,
						};

						chrome.runtime.sendMessage(request, function(response) {
							$(".row_" + collectionId).fadeOut();
						});

				}, Settings.UI_TIMEOUT);
				
				$(this).data("timeout", timeout);
			}
			
		}); 

	},
	
	copyToClipboard : function(content){
	    var el = document.createElement("textarea");
	    el.textContent = content;
	    document.body.appendChild(el);
	    el.focus();
	    document.execCommand('SelectAll');
	    document.execCommand('Copy');
	    document.body.removeChild(el);
	},
	
	hideAll : function(){
		$("#save_container").hide();
		$("#collections_breadcrumb").hide();
		$("#collections_container").hide();
		$("#tweets_container").hide();
		$('#tweets_actions_embed').hide();
		$('#tweets_actions_order').hide();
	},
	
	getSelectedTweetIds : function(){
		var tweetIds = [];
		$(".tweet_check").each(function(){
			if ($(this).prop('checked')){
				tweetIds[tweetIds.length] = $(this).data("id");
			}
		});
		return tweetIds;
	},

	getOrderedTweetIds: function(){
		var tweetIds = [];
		$(".tweet_check").each(function(){
			tweetIds[tweetIds.length] = $(this).data("id");
		});
		return tweetIds;
	},
	
	showTab : function() {
		$('#myTab a[href="#collections"]').tab('show');
	},
	
	TWEET_ID_REGEXP: /https?:\/\/twitter.com\/[a-zA-Z0-9_]{1,20}\/status\/([0-9]*)/,
	
	showSaveTweet : function() {

		CollectionsPage.hideAll();
		$("#collections_subtitle").html("Choose a Collection to save your Tweet to.");
		$("#save_container").hide();
		$("#save_container").after("<div id='save_container_waiting' class='spinner'><img src='img/spinner.gif'></div></td></tr>");
		
		var tweetId = null;
		
		var url = QueryString.get("url");
		var pair = CollectionsPage.TWEET_ID_REGEXP.exec(url);
		if (pair && pair.length == 2){
			tweetId = pair[1];
		}

		if (!tweetId){
			alert("No Tweet passed to this page.");
			return;
		} else {
			$("#save_tweet_id").val(tweetId);
			$("#save_tweet_url").val(url);
		}

		$('#save_collection_id')
        .append($("<option></option>")
        .attr("value", "")
        .text("-- Select One --")); 
		
		var request = {
			type : "background.loadCollections"
		};

		chrome.runtime.sendMessage(request, function(response) {

			var timelines = response['objects']['timelines'];
			if (timelines){
				
				var lastUsedCollectionId = Settings.properties['lastUsedCollectionId'];

				$.each(timelines, function(id, obj) {
					option = $("<option></option>").attr("value", id).text(obj.name);
					if (id == lastUsedCollectionId){
						option.attr("SELECTED", "SELECTED");
					}
				    $('#save_collection_id').append(option);
				          
				});
				
			}
			
			$('#save_collection_id')
	        .append($("<option></option>")
	        .attr("value", "new")
	        .text("-- Create New Collection --")); 

			$("#save_container_waiting").remove();
			$("#save_container").fadeIn();

		});
		
	},
	
	ROW_COLLECTION_TEMPLATE : $('#template_collection_row').html(),
	ROW_COLLECTION_NONE : "<tr><td colspan='4' class='norows'>No collections.</td></tr>",

	showCollections : function() {
		
		CollectionsPage.hideAll();
		$("#collections_container").show();
		$("#collections_breadcrumb").show();
		$("#collections_breadcrumb li:last").hide();

		// Page.setSpinner();
		$("#collections_rows").html("<tr><td colspan='3'><div class='spinner'><img src='img/spinner.gif'></div></td></tr>");
		
		var request = {
			type : "background.loadCollections"
		};

		chrome.runtime.sendMessage(request, function(response) {

			var collections = response['objects']['timelines'];
			var results = response['response']['results'];

			var rows = "";
			if (!results || results.length == 0){
				
				rows = CollectionsPage.ROW_COLLECTION_NONE;
				
			} else {
				
				$.each(results, function(idx, entry) {
					var collection_id = entry.timeline_id;
					var collection = collections[collection_id];
					collection.id = collection_id;
					results[idx] = collection;
				});
				
				var template = $('#template_collection_row').html()
				rows = Mustache.render(template, {collections : results});
			
			}

			$("#collections_rows").fadeOut(function(){
				 $("#collections_rows").html(rows);
				 $("#collections_rows").fadeIn();
			});

		});
		
	},

	ROW_TWEET_NONE : "<tr><td colspan='5' class='norows'>No tweets.</td></tr>",
	
	showTweets : function(collectionId, collectionName) {
		
		CollectionsPage.hideAll();
		$("#tweets_container").show();
		$("#collections_breadcrumb").show();
		if (collectionName){
			var nameWithLink = collectionName + " <a href='https://twitter.com/twitter/timelines/"+collectionId.substring(7)+"' target='_target'><img class='external' src='img/external.png'></a>";
			$("#collections_breadcrumb li:last").html(nameWithLink).show();
		}

		$("#tweets_embed").data("collection-id", collectionId);
		$("#tweets_remove").data("collection-id", collectionId);
		$("#tweets_order").data("collection-id", collectionId);
		$("#tweets_order").data("collection-name", collectionId);
		
		$("#tweets_rows").html("<tr><td colspan='5'><div class='spinner'><img src='img/spinner.gif'></div></td></tr>");
		
		var request = {
			type : "background.loadTweets",
			id : collectionId
		};

		chrome.runtime.sendMessage(request, function(response) {

			var users = response['objects']['users'];
			var tweets = response['objects']['tweets'];
			var timeline = response['response']['timeline'];
			
			var rows = ""
			if (!timeline || timeline.length == 0){
				
				rows = CollectionsPage.ROW_TWEET_NONE;
				
			} else {
				
				timeline = timeline.sort(function(a, b){
					return a.tweet.sort_index - b.tweet.sort_index;	
				});
				
				$.each(timeline, function(idx, entry) {
					var tweetId = entry.tweet.id;
					var tweet = tweets[tweetId];
					var user = users[tweet.user.id];
					var userUrl = "http://www.twitter.com/" + user.screen_name;
					user['url'] = userUrl;
					tweet['user'] = user;
					
					var createdAt = tweet['created_at'];
					if (createdAt){
						createdAt = Twitter.parseTwitterDate(createdAt);
					}
					tweet['date'] = createdAt;
					tweet['url'] = userUrl + "/status/" + tweetId;
					
					entry['tweet'] = tweet;
					entry['collection_id'] = collectionId;
				});
				
				var template = $('#template_tweet_row').html()
				rows = Mustache.render(template, {timeline : timeline});
				
			 }

			 $("#tweets_rows").fadeOut(function(){
				 $("#tweets_rows").html(rows);
				 $("#tweets_rows").fadeIn();

				 $("#tweets_rows").sortable({
					 stop: function( event, ui ) {
						 $("#tweets_actions_order").show();
				 	 }
				 });
			     $("#tweets_rows").disableSelection();
			     
				// default to selecting them all
			     $(".tweet_check_all").prop("checked", false);
				$(".tweet_check_all").click();

			 });

		});
		
	},

}

var TutorialPage = {
		
	init : function() {
		
	},

	showTab : function() {
		$('#myTab a[href="#tutorial"]').tab('show');
	}
}

var SettingsPage = {

	init : function() {
		
		$("#advanced_options").hide();

		SettingsPage.load(function() {

			$('#embedType').change(function(e) {
				// alert($('#embedType').val());
				if ($('#embedType').val() == 'custom') {
					$("#embedTemplateSection").fadeIn();
				} else {
					$("#embedTemplateSection").hide();
				}
				return false;
			});

			$('#embedType').change();
		});

		$(document).on('click', '#settings_save', function(e) {
			SettingsPage.save();
			return false;
		});

		$(document).on('click', '#auth_connect', function(e) {
			
			var request = {
					type : "background.twitterRequestToken",
				};

			chrome.runtime.sendMessage(request, function(response) {
				var properties = {
						authState : Settings.AUTH_STATE_PIN
					};
				Settings.save(properties, function(){
					SettingsPage.setState(false, true);
					Page.setStatus("Please enter PIN below.");
				});
			});
			
			return false;
		});

		$(document).on('click', '#auth_pin', function(e) {
			
			var request = {
					type : "background.twitterAccessToken",
					pin : $('#authenticationPin').val()
				};

			chrome.runtime.sendMessage(request, function(response) {
				var success = response.success;
				var status = response.status; 
				if (success){

					var properties = {
							authState : Settings.AUTH_STATE_COMPETED
						};
					Settings.save(properties, function(){
						Page.setStatus(status);
						SettingsPage.setState(true, false);
						
						URL.open("tutorial");
					});

				} else {
					Page.setError(status);
					SettingsPage.setState(false, false);
				}
			});
			
			return false;
		});
		
		$(document).on('click', '#auth_restart', function(e) {
			
			var properties = {
					authState : Settings.AUTH_STATE_LOGIN
				};
			Settings.save(properties, function(){
				SettingsPage.setState(false, false);
			});
			
			return false;
		});
		
		$(document).on('click', '#auth_disconnect', function(e) {

			var properties = [
				'accessToken',
				'accessTokenSecret'
			]
			Settings.remove(properties, function() {
				var request = {
						type : "background.reloadSettings",
					};

				chrome.runtime.sendMessage(request, function(response) {
					Page.setStatus("Settings saved.");
					SettingsPage.setState(false, false);
				});
			});
			
		});
		
		$(document).on("click", "#advanced_options_toggle", function() {
			$("#advanced_options_toggle").hide();
			$("#advanced_options").fadeIn();
		});


	},

	showTab : function() {
		$('#myTab a[href="#settings"]').tab('show');
	},
	
	setState : function(isAuthenticated, isWaitingForPin) {
		$(".auth_input").hide();
		if (isAuthenticated){
			$("#auth_disconnect").show();
		} else if (isWaitingForPin){
			$(".auth_pin_holder").show();
		} else {
			$("#auth_connect").show();
		}
	},

	load : function(callback) {
		Object.keys(Settings.properties).forEach(function(key) {

			var value = Settings.properties[key];

			var id = "#" + key;
			var el = $(id);
			
			if (el.is(':checkbox')){
				$(id).prop('checked', value);
			} else {
				$(id).val(value);
			}
			

		});

		if (callback) {
			callback();
		}
	},

	save : function(callback) {

		var properties = {};

		for ( var i = 0; i < Settings.PROPERTIES.length; i++) {
			
			var key = Settings.PROPERTIES[i];
			var id = "#" + key;
			var el = $(id);
			
			var val = '';
			if (el.is(':checkbox')){
				val = el.prop('checked') == true;
			} else {
				val = el.val();
			}

			properties[key] = val;
		}

//		console.log('SettingsPage.save: ' + JSON.stringify(properties));

		Settings.save(properties, function() {
			var request = {
					type : "background.reloadSettings",
			};

			chrome.runtime.sendMessage(request, function(response) {
				Page.setStatus("Settings saved.");
			});
		});

		if (callback) {
			callback();
		}

	},

}
