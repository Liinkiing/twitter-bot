"use strict";

require('dotenv').config();


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


let interval = process.env.INTERVAL || 1800; // Exprimed in seconds

console.log(`Retweet et follow toutes les ${interval}s`);

let user_to_warn = process.env.USER_TO_WARN; // Put here the user mail you want to warn when the bot got a response

console.log(`${user_to_warn} sera prévenu lorsque je recevrai un tweet ou un DM`);

let me_id;




const messages = [
	`wsh @{0}, @{1} m'a tweeté, inshallah t'as gagné un concours (https://twitter.com/{2}/status/{3})`,
	`hé @{0}, je crois que @{1} a tweeté, t'as peut-être gagné un concours 😱😱😱 (https://twitter.com/{2}/status/{3})`,
	`@{0}, jvoulais te dire que @{1} m'a tweeté. Imagine t'as gagné un concours ? 😍😍 (https://twitter.com/{2}/status/{3})`,
	`⚠️ @{1} m'a tweeté par rapport à son concours (https://twitter.com/{2}/status/{3}). cc @{0} ⚠️`
];

if(process.env.IS_RUNNING == "true") {
	T.get('account/verify_credentials')
		.catch(err => {
			console.error(err)
		})
		.then(response => {
			
			let dmstream = T.stream('user', {stringify_friend_ids: true});
			let homeTimeline = T.stream('user', {stringify_friend_ids: true, with: "followings"});
			
			console.log(dmstream);
			dmstream.on('direct_message', reactToDM);
			
			console.log(homeTimeline);
			homeTimeline.on('tweet', reactToTweet);
			
			me_id = response.data.id_str;
			
			retweetAndFollow();
			
			setInterval(retweetAndFollow, interval * 1000);
			
		});
} else {
	setInterval(_ => {
		console.warn("Le bot ne peut pas démarrer car la variable d'environnement 'IS_RUNNING' est réglé à " + process.env.IS_RUNNING);
	}, 10 * 1000);
}




function sendMail(to, subject, body) {
	
	let helper = require('sendgrid').mail;
	let from_email = new helper.Email('no-reply@twitter-bot.com');
	let to_email = new helper.Email(to);
	let content = new helper.Content('text/html', body);
	let mail = new helper.Mail(from_email, subject, to_email, content);
	
	let sg = require('sendgrid')(process.env.SENDGRID_API_KEY);
	
	let request = sg.emptyRequest({
		method: 'POST',
		path: '/v3/mail/send',
		body: mail.toJSON(),
	});
	
	sg.API(request, function(error, response) {
		console.log(response.statusCode);
		console.log(response.body);
		console.log(response.headers);
	});
}


function reactToDM(reponse) {
	console.log(reponse.direct_message);
	postTweet({
		status: `[${new Date().toLocaleString('fr')}] - Hey @${user_to_warn}, @${reponse.direct_message.sender_screen_name} m'a laissé un DM !`
	});
	// sendMail(user_to_warn, `@${reponse.direct_message.sender_screen_name} m'as envoyé un DM !`, `J'ai reçu un DM`);
}

function reactToTweet(tweet) {
	if (isRetweet(tweet)) console.log("Détails du tweet ommis car il s'agissait d'un RT. ('" + tweet.text + "')");
	else if (!isRetweet(tweet) && isAReplyTo(tweet, me_id)) {
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

function retweetAndFollow() {
	T.get('search/tweets', {
		q: 'Concours RT + Follow',
		count: 30
	}, (err, data, response) => {
		console.log(data.search_metadata);
		let i = 0;
		data.statuses.forEach(function (tweet) {
			i += 2000;
			setTimeout(_ => {
				console.log(tweet.text + "\n\n----------\n\n");
				if (isRetweet(tweet)) {
					if (tweet.retweeted_status.user.following) {
						console.log('Vous followez déjà @' + tweet.retweeted_status.user.screen_name);
					} else {
						console.log('Vous ne followez pas @' + tweet.retweeted_status.user.screen_name);
						retweet(tweet.retweeted_status);
						followFromTweet(tweet.retweeted_status);
					}
				} else {
					if (tweet.user.following) {
						console.log('Vous followez déjà @' + tweet.user.screen_name);
					} else {
						console.log('Vous ne followez pas @' + tweet.user.screen_name);
						retweet(tweet);
						followFromTweet(tweet);
					}
					
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
	if(isRetweet(tweet)){
		if("user_mentions" in tweet.retweeted_status.entities && tweet.retweeted_status.entities.user_mentions.length > 0) {
			for(let user of tweet.retweeted_status.entities.user_mentions) {
				console.log(user);
				follow(user.screen_name);
			}
		} else {
			let userToFollow = tweet.retweeted ? tweet.retweeted_status.user.screen_name : tweet.user.screen_name;
			follow(userToFollow);
		}
	} else {
		if("user_mentions" in tweet.entities && tweet.entities.user_mentions.length > 0) {
			for(let user of tweet.entities.user_mentions) {
				console.log(user);
				follow(user.screen_name);
			}
		} else {
			let userToFollow = tweet.retweeted ? tweet.retweeted_status.user.screen_name : tweet.user.screen_name;
			follow(userToFollow);
		}
	}
	
}

function follow(username, errorHandle, responseHandle) {
	T.post('friendships/create', {screen_name: username})
		.catch(err => {
			if (errorHandle) errorHandle(err); else console.log(err);
		})
		.then(response => {
			if (responseHandle) responseHandle(response); else console.log(`Vous avez bien follow @${username}\n`)
		});
}

function format(fmtstr) {
	let args = Array.prototype.slice.call(arguments, 1);
	return fmtstr.replace(/\{(\d+)\}/g, function (match, index) {
		return args[index];
	});
}
