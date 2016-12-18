"use strict";

function format (fmtstr) {
	let args = Array.prototype.slice.call(arguments, 1);
	return fmtstr.replace(/\{(\d+)\}/g, function (match, index) {
		return args[index];
	});
}
const Twit = require("twit");

let config;

switch (process.env.NODE_ENV) {
	case 'dev':
		config = require('./config');
		break;
	case 'prod':
		config = require('./config.dist');
		break;
}

let T = new Twit(config);



let interval = 1800; // Exprimed in seconds

let user_to_warn = 'OmarBarrage'; // Put here the user screen name you want to warn when the bot got a response
let me_id;
let followings = [];

const messages = [
	`wsh @{0}, @{1} m'a tweeté, inshallah t'as gagné un concours (https://twitter.com/{2}/status/{3})`,
	`hé @{0}, je crois que @{1} t'as tweeté, t'as peut-être gagné un concours 😱😱😱 (https://twitter.com/{2}/status/{3})`
];


T.get('account/verify_credentials')
	.catch(err => {
		console.error(err)
	})
	.then(response => {
		me_id = response.data.id_str;
		
		retweetAndFollow();
		updateFollowings();
		let dmstream = T.stream('user', {stringify_friend_ids: true});
		console.log(dmstream);
		dmstream.on('direct_message', (reponse) => {
			console.log(reponse.direct_message);
			postTweet({
				status: `[${new Date().toLocaleDateString('fr-FR')}, à ${new Date().toLocaleTimeString('fr-FR')}] - Hey @${user_to_warn}, @${reponse.direct_message.sender_screen_name} m'a laissé un DM !`
			});
		});
		
		setInterval(retweetAndFollow, interval * 1000);
		setInterval(updateFollowings, (interval + 60) * 1000);
	});


function updateFollowings() {
	T.get('friends/ids')
		.catch((err) => {
			console.error(err);
		})
		.then((response) => {
			console.log(me_id);
			followings = response.data.ids;
			let stream = T.stream('statuses/filter', {follow: followings.join(',')});
			console.log(stream);
			stream.on('message', (tweet) => {
				if (isRetweet(tweet)) console.log("Détails du tweet ommis car il s'agissait d'un RT. ('" + tweet.text + "')");
				else {
					if (isAReplyTo(tweet, me_id)) {
						console.log("@" + tweet.user.screen_name + " vous a tweeté ! Peut-être avez-vous gagné un concours :o \n\n" +
							"====== DÉTAILS DU TWEET ======\n");
						console.log(tweet);
						console.log("\n============");
						const newTweet = {
							status: format(messages[random(messages.length)], user_to_warn, tweet.user.screen_name, tweet.user.id_str, tweet.id_str)
						};
						postTweet(newTweet);
					}
				}
			});
			
		});
}


function retweetAndFollow() {
	T.get('search/tweets', {
		q: 'Concours RT + Follow',
		count: 20,
		result_type: 'popular'
	}, (err, data, response) => {
		console.log(data.search_metadata);
		let i = 0;
		data.statuses.forEach(function (tweet) {
			i += 2000;
			setTimeout(_ => {
				console.log(tweet.text + "\n\n----------\n\n");
				if (followings.length > 0 && followings.includes(tweet.user.id)) {
					console.log('Vous followez déjà @' + tweet.user.screen_name);
				} else {
					console.log('Vous ne followez pas @' + tweet.user.screen_name);
					retweet(tweet);
					followFromTweet(tweet);
				}
			}, i);
		});
	});
}




function isRetweet(tweet) {
	return "retweeted_status" in tweet;
}

function isAReplyTo(tweet, user_id) {
	return tweet.in_reply_to_user_id_str == user_id;
}

function random(max) {
	"use strict";
	return Math.floor(Math.random() * max);
}

function postTweet(tweet, errorHandle, responseHandle) {
	T.post('statuses/update', tweet)
		.catch(err => {
			if (errorHandle) errorHandle(err); else console.log(err);
		})
		.then(response => {
			if (responseHandle) responseHandle(response); else console.log(response)
		});
}

function retweet(tweet, errorHandle, responseHandle) {
	T.post('statuses/retweet/:id', {id: tweet.id_str})
		.catch(err => {
			if (errorHandle) errorHandle(err); else console.log(err);
		})
		.then(response => {
			if (responseHandle) responseHandle(response); else console.log(`Vous avez bien RT le tweet de @${tweet.user.screen_name}\n`)
		});
}

function followFromTweet(tweet, errorHandle, responseHandle) {
	T.post('friendships/create', {screen_name: tweet.retweeted ? tweet.retweeted_status.user.screen_name : tweet.user.screen_name})
		.catch(err => {
			if (errorHandle) errorHandle(err); else console.log(err);
		})
		.then(response => {
			if (responseHandle) responseHandle(response); else console.log(`Vous avez bien follow @${tweet.user.screen_name}\n`)
		});
}
