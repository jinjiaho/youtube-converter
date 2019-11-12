var express = require('express');
var router = express.Router();
const fs = require('fs');
const path = require('path');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');


let url = 'https://www.youtube.com/watch?v=0arsPXEaIUY';
let eatshitbob = 'https://www.youtube.com/watch?v=UN8bJb8biZU';

router.get('/', function(req, res, next) {
	res.render('index.ejs');
})

/* GET home page. */
router.post('/save-audio', function(req, res, next) {

	console.log(req.body);

	let filename = req.body.dir ? path.join(req.body.dir, req.body.filename) : req.body.filename;

	let stream = ytdl(req.body.url, {
		quality: 'highestaudio',
		filter: 'audioonly'
	});

	ffmpeg(stream)
	.audioBitrate(128)
	.save(filename + '.mp3')
	.on('end', (p) => {
		res.status(200).send('file finished saving');
	});
});

router.post('/save-video', function(req, res, next) {
	console.log(req.body);

	let filename = req.body.dir ? path.join(req.body.dir, req.body.filename) : req.body.filename;

	let stream = ytdl(req.body.url, {
		quality: 'highestvideo'
	}).pipe(fs.createWriteStream(filename + '.mp4'));

	stream.on('finish', () => {
		res.status(200).send('file finished saving');
	})
})

/* GET home page. */
router.get('/test-audio', function(req, res, next) {
	let stream = ytdl(url, {
		quality: 'highestaudio',
		filter: 'audioonly'
	});

	ffmpeg(stream)
	.audioBitrate(128)
	.save('noperopes.mp3')
	.on('end', (p) => {
		res.status(200).send('file finished saving');
	});
});

/* GET eat shit bob video */
router.get('/test-video', function(req, res, next) {
	let stream = ytdl(eatshitbob, {
		// quality: 'highestvideo',
		begin: '20:60'
	}).pipe(fs.createWriteStream('eatshitbob.mp4'));

	stream.on('finish', () => {
		res.status(200).send('file finished saving');
	})
});

router.get('/get-info', function(rea, res, next) {
	ytdl.getInfo(url).then(result => {
		res.status(200).send(result);
	}).catch(err => {
		res.status(err.code).send(err);
	})
})

module.exports = router;
