"use strict";

const Twit = require("twit");
const config = require('./config');
let T = new Twit(config);

let interval = 120; // Exprimed in seconds

let followings = [];

T.get('friends/ids')
	.catch((err) => {
		console.error(err);
	})
	.then((response) => {
		console.log(response);
	});

function retweetAndFollow() {
	T.get('search/tweets', {
		q: 'Concours RT + Follow',
		count: 20,
		result_type: 'popular'
	}, (err, data, response) => {
		console.log(data.search_metadata);
		data.statuses.forEach(function (status) {
			console.log(status.text + "\n\n----------\n\n");
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
		});
	});
}
let stream = T.stream('statuses/filter');
stream.on('message', (message) => {
	// console.log(user_id);
});
setInterval(retweetAndFollow, interval * 1000);


