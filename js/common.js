var Settings = {

	// set to false for development
	ONLINE : true,
	
	UI_TIMEOUT : 2000,
		
	PROXY : 'https://stage.birdops.com/',
	API_KEY : 'GQyCKJBmiufakgJ7P5T1eAsxV',
	API_SECRET : 'Hmwv71tVYpHOSOrNT7w0WGdb71JG5Wgxcfo3Gn2qDlhmbtWs2w',
	ACCESS_TOKEN : null,
	ACCESS_TOKEN_SECRET : null,
	
	AUTH_STATE_LOGIN : 'login',
	AUTH_STATE_PIN : 'pin',
	AUTH_STATE_COMPLETED : 'completed',
		
	PROPERTIES : [ 'apiKey', 'apiSecret', 'accessToken', 'accessTokenSecret', 'authState',
			'embedType', 'embedTemplate', 'embedTheme', 'embedShowMedia',
			'embedShowConversation', 'embedIncludeScriptTag', 'lastUsedCollectionId' ],
			
	properties : null,
			
	init : function(success, failure) {
		
		chrome.storage.sync.get(this.PROPERTIES, function(properties) {
			Settings.properties = properties;
			success(properties);
		});

	},

	save : function(properties, callback) {
		
		chrome.storage.sync.set(properties, function() {
			for (var key in properties) {
				Settings.properties[key] = properties[key];
			}
			if (callback){
				callback();
			}
		});

	},
	
	remove : function(properties, callback) {

		chrome.storage.sync.remove(properties, function() {
			for (var key in properties) {
				delete Settings.properties[key];
			}
			if (callback){
				callback();
			}
		});

	}

}

var Twitter = {
		
	SCRIPT_TAG : "<script>!function(d,s,id){var js,fjs=d.getElementsByTagName(s)[0],p=/^http:/.test(d.location)?'http':'https';if(!d.getElementById(id)){js=d.createElement(s);js.id=id;js.src=p+'://platform.twitter.com/widgets.js';fjs.parentNode.insertBefore(js,fjs);}}(document, 'script', 'twitter-wjs');</script>",
	NEWLINE : '\n',

	cb : null,
	user : null,

	init : function(success, failure) {

		if (!Settings.ONLINE){
			Twitter.user = {}
			success();
		}
		
		if (!Twitter.cb){
			Twitter.cb = new Codebird();
			Twitter.cb.setUseProxy(false);
			// Twitter.cb.setProxy(Settings.PROXY);
			Twitter.cb.setConsumerKey(Settings.API_KEY, Settings.API_SECRET);
		}
		
		if (!Twitter.user) {

			var properties = Settings.properties;

			var accessToken = properties['accessToken'];
			var accessTokenSecret = properties['accessTokenSecret'];

			if (accessToken && accessTokenSecret) {

				Twitter.cb.setToken(accessToken, accessTokenSecret);

				// do something here to verify it's good
				Twitter.cb.__call("account_verifyCredentials", {},
						function(result) {

							if (result && result.id) {
								
								Twitter.user = result;
								
								if (success) {
									success();
								}
							} else {
								if (failure) {
									failure();
								}
							}

						});

			} else {

				if (failure) {
					failure();
				}
			}

		} else {
			success();
		}
	},
	
	requestToken : function(callback){
		
		Twitter.cb.__call(
			    "oauth_requestToken",
			    {oauth_callback: "oob"},
			    function (reply) {
			        // stores it
			        Twitter.cb.setToken(reply.oauth_token, reply.oauth_token_secret);

			        // gets the authorize screen URL
			        Twitter.cb.__call(
			            "oauth_authorize",
			            {},
		            	callback
			        );
			    }
			);
		
	},
	
	accessToken : function(pin, callback){
		
		Twitter.cb.__call(
			    "oauth_accessToken",
			    {oauth_verifier: pin},
			    function (reply) {
			        // store the authenticated token, which may be different from the request token (!)
			        Twitter.cb.setToken(reply.oauth_token, reply.oauth_token_secret);

			        // if you need to persist the login after page reload,
			        // consider storing the token in a cookie or HTML5 local storage
			        
			        callback(reply.oauth_token, reply.oauth_token_secret);
			    }
			);
		
	},

	call : function(endpoint, params, callback) {

		if (Settings.ONLINE){
			
			Twitter.cb.__call(endpoint, params, callback);
						
		} else {

			result = null;
			
			if (endpoint == 'account_verifyCredentials'){
				result = TweetStore.accountVerifyCredentials;
			}

			if (endpoint == 'statuses_oembed'){
				result = TweetStore.statusesOembed;
			}
			
			if (endpoint == 'collections_list'){
				result = TweetStore.collectionsList;
			}
			
			if (endpoint == 'timelines_timeline'){
				result = TweetStore.timelinesTimeline;
			}

			if (endpoint == 'collections_remove'){
				result = {};
			}

			callback(result);
			return;
			
		}
		
	},

	saveTweetsToCollection : function(collectionId, tweetIds, callback) {

		async.eachSeries(tweetIds, function(tweetId, callback){
			Twitter.call("collections_add", {
				id : collectionId,
				tweet_id: tweetId
			}, function(response) {
				callback(null);
			});
		}, function(err){
			callback(err);
		});
		
	},
	
	removeTweetsFromCollection : function(collectionId, tweetIds, callback) {

		async.eachSeries(tweetIds, function(tweetId, callback){
			Twitter.call("collections_remove", {
				id : collectionId,
				tweet_id: tweetId
			}, function(response) {
				callback(null);
			});
		}, function(err){
			callback(err);
		});
		
	},
	
	embedTweets : function(tweetIds, callback) {
		
		var contentAll = '';
		
		async.eachSeries(tweetIds, function(tweetId, done){
			
			Twitter.embedTweet(tweetId, function(content){
				
				if (contentAll){
					contentAll = contentAll + Twitter.NEWLINE; 
				}
				
				contentAll = contentAll + content;
				
				// need to call done() to tell eachSeries we're... done.
				done();
				
			});
			
		}, function(err){
			
			if (Settings.properties.embedIncludeScriptTag){
				contentAll = contentAll + Twitter.NEWLINE + Twitter.SCRIPT_TAG;
			}
			
			var request = {
				type : "contentscript.insertTextAtPosition",
				content : contentAll
			};
			
			chrome.tabs.query({
				active : true,
				currentWindow : true
			}, function(tabs) {
				chrome.tabs.sendMessage(tabs[0].id, request, function(el) {
					if (callback){
						callback(contentAll);
					}
				});
			});
			
		});
		
	},
	
	embedTweet : function(tweetId, callback) {

		var hide_media = Settings.properties.embedShowMedia ? "false" : "true";
		var hide_thread = Settings.properties.embedShowConversation ? "false" : "true";
		
		var params = {
			hide_media : hide_media,
			hide_thread : hide_thread,
			id : tweetId,
			omit_script : "true"
		}

//		console.log("embedTweet: " + JSON.stringify(params));
		
		Twitter.call("statuses_oembed", params, function(result) {

			var content = null;

			var embedType = Settings.properties.embedType;
			if (embedType == "embed") {
				content = result.html;
			} else if (embedType == "url") {
				content = result.url;
			} else if (embedType == "shortcode") {
				content = "[tweet " + result.url + " hide_media='"+hide_media+"' hide_thread='"+hide_thread+"']";
			} else if (embedType == "custom") {
				content = JSON.stringify(result);
				var embedTemplate = Settings.properties.embedTemplate;
				if (embedTemplate) {
					// alert(embedTemplate);
				}
			}

			if (callback){
				
				callback(content);
				
			}
			
		});

	},
	
	// http://stackoverflow.com/questions/6549223/javascript-code-to-display-twitter-created-at-as-xxxx-ago
	parseTwitterDate : function(tdate) {
		
	    var system_date = new Date(Date.parse(tdate));
	    var user_date = new Date();
//	    if (K.ie) {
//	        system_date = Date.parse(tdate.replace(/( \+)/, ' UTC$1'))
//	    }
	    var diff = Math.floor((user_date - system_date) / 1000);
	    if (diff <= 1) {return "just now";}
	    if (diff < 20) {return diff + " seconds ago";}
	    if (diff < 40) {return "half a minute ago";}
	    if (diff < 60) {return "less than a minute ago";}
	    if (diff <= 90) {return "one minute ago";}
	    if (diff <= 3540) {return Math.round(diff / 60) + " minutes ago";}
	    if (diff <= 5400) {return "1 hour ago";}
	    if (diff <= 86400) {return Math.round(diff / 3600) + " hours ago";}
	    if (diff <= 129600) {return "1 day ago";}
	    if (diff < 604800) {return Math.round(diff / 86400) + " days ago";}
	    if (diff <= 777600) {return "1 week ago";}
	    
	    system_date = Twitter.MONTH_ARRAY[system_date.getMonth()] + " " + system_date.getDate();
	    return " " + system_date;
	},
	
    MONTH_ARRAY : new Array("Jan","Feb","Mar","Apr","May","June","July","Aug","Sept","Oct","Nov","Dec")

}

var URL = {

	CHROME_BASE : "chrome-extension://"+chrome.runtime.id+"/",

	TWITTER_AUTH_LOGIN : "http://twitter.com/login",

	TWITTER_AUTH_LOGOUT : "http://twitter.com/logout",

	TWITTER_STATUS : 'https://twitter.com/intent/tweet?text=',

	make : function(page, params) {
		if (!params){
			params = {}
		}
		params['page'] = page;
		var url = URL.CHROME_BASE + "page.html?" + QueryString.encode(params);
		return url;
	},
	
	open : function(page, params) {
		var url = URL.make(page, params);
		chrome.tabs.create({
			"url" : url
		});
	},
	
	external : function(url){
		chrome.tabs.create({
			"url" : url
		});
	}

}

var QueryString = {

	encode : function(obj) {
		var str = [];
		for ( var p in obj) {
			str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
		}
		return str.join("&");
	},

	parse : function(str) {
		var query = {};
		var a = str.split('&');
		for ( var i in a) {
			var b = a[i].split('=');
			query[decodeURIComponent(b[0])] = decodeURIComponent(b[1]);
		}

		return query;
	},
	
	get : function(name, _default){
		var value = _default;
		var search = window.location.search;
		if (search.length > 0) {
			search = search.substring(1);
			var qs = QueryString.parse(search);
			if (qs[name]) {
				value = qs[name];
			}
		}
		return value;
	}

}

Settings.DEFAULT = {
	 'apiKey' : Settings.API_KEY, 
	 'apiSecret' : Settings.API_SECRET,
	 'accessToken' : Settings.ACCESS_TOKEN, 
	 'accessTokenSecret' : Settings.ACCESS_TOKEN_SECRET,
	 'authState' : Settings.AUTH_STATE_LOGIN, 
	 'embedType' : 'embed',
	 'embedTheme' : 'light',
	 'embedShowMedia' : true,
	 'embedShowConversation' : false,
	 'embedIncludeScriptTag' : true
}