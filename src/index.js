"use strict";


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


let interval = 120; // Exprimed in seconds

let user_to_warn = 'OmarBarrage'; // Put here the user screen name you want to warn when the bot got a response
let me_id;

let followings = [];




T.get('account/verify_credentials')
	.catch(err => {console.error(err)})
	.then(response => {
		me_id = response.data.id_str;

		retweetAndFollow();
		updateFollowings();

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
				if(isRetweet(tweet)) console.log("Détails du tweet ommis car il s'agissait d'un RT. ('" + tweet.text + "')");
				else {
					if(isAReplyTo(tweet, me_id)) {
						console.log("@" + tweet.user.screen_name + " vous a tweeté ! Peut-être avez-vous gagné un concours :o \n\n" +
						"====== DÉTAILS DU TWEET ======\n");
						console.log(tweet);
						console.log("\n============");
						const newTweet = {
							status: `wsh @${user_to_warn}, @${tweet.user.screen_name} m'a tweeté, inshallah t'as gagné un concours (https://twitter.com/${tweet.user.id_str}/status/${tweet.id_str})`,
						};
						T.post('statuses/update', newTweet)
							.catch(err => {console.error(err)})
							.then(response => {
								console.log(response);
							})
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
		data.statuses.forEach(function (status) {
			i += 2000;
			console.log(status.text + "\n\n----------\n\n");
			setTimeout(_ => {
				if(followings.length > 0 && followings.includes(status.user.id)) {
					console.log('Vous followez déjà @' + status.user.screen_name);
				} else {
					console.log('Vous ne followez pas @' + status.user.screen_name);
					T.post('statuses/retweet/:id', {id: status.id_str})
						.catch((err) => {
							console.error(err);
						})
						.then((result) => {
							console.log('Vous avez bien RT le tweet de @' + status.user.screen_name + '\n');
						});
					T.post('friendships/create', {screen_name: status.retweeted ? status.retweeted_status.user.screen_name : status.user.screen_name})
						.catch((err) => {
							console.error(err);
						})
						.then((result) => {
							console.log("Vous avez bien follow la personne @" + status.user.screen_name + "\n\n");
						});
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

