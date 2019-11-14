var express = require('express');
var router = express.Router();
const fs = require('fs');
const path = require('path');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const MediaSplit = require('media-split');

let snek = 'https://www.youtube.com/watch?v=0arsPXEaIUY';
let eatshitbob = 'https://www.youtube.com/watch?v=UN8bJb8biZU';
let comeAlong = 'https://www.youtube.com/watch?v=u8rT6ij0PSo';

router.get('/', function(req, res, next) {
	res.render('index.ejs');
})

router.post('/save-audio-media-split', function(req, res, next) {
	let split = new MediaSplit({ 
		input: comeAlong, 
		sections: ['[00:05 - 03:05] Come Along'], 
		output: '/Users/janice/Music',
		audioonly: true,
		quality: 'highestaudio',
		downloadCover: false
	});
	split.parse().then((sections) => {	
	  for (let section of sections) {
	    console.log(section.name);      // filename
	    console.log(section.start);     // section start
	    console.log(section.end);       // section end
	    console.log(section.trackName); // track name
	  }
	  res.status(200).end();
	});

})

/* GET home page. */
router.post('/save-audio', function(req, res, next) {
	console.log(req.body);

	let stream = ytdl(req.body.url, {
		quality: 'highestaudio',
		filter: 'audioonly'
	});

	// tagging
	let versionTxt = req.body.version ? ` [${req.body.version}]` : '';

	let artistTxt = req.body.artist ? `${req.body.artist} - ` : '';

	let filename = artistTxt + req.body.title + versionTxt;

	let filepath = req.body.dir ? path.join(req.body.dir, filename) : filename;

	let startTime = 0, endTime = 0;

	// start time
	let startHInS = isNaN(req.body['start-h']) ? 0 : parseInt(req.body['start-h']) * 3600;

	let startMinInS = isNaN(req.body['start-m']) ? 0 : parseInt(req.body['start-m']) * 60;

	let startS = isNaN(req.body['start-s']) ? 0 : parseInt(req.body['start-s']);

	startTime = startHInS + startMinInS + startS;

	// end time
	console.log(parseInt(req.body['end-h']), parseInt(req.body['end-m']), parseInt(req.body['end-s']));
	if (req.body['end-h'] && !isNaN(req.body['end-h'])) {
		endTime += parseInt(req.body['end-h']) * 3600;
	}

	if (req.body['end-m'] && !isNaN(req.body['end-m'])) {
		endTime += parseInt(req.body['end-m']) * 60;
	}

	if (req.body['end-s'] && !isNaN(req.body['end-s'])) {
		endTime += parseInt(req.body['end-s']);
	}

	let audio = ffmpeg(stream);

	if (req.body.title) {
		audio.outputOptions('-metadata', `title=${req.body.title}${versionTxt}`);
	}

	if (req.body.artist) {
		audio.outputOptions('-metadata', `artist=${req.body.artist}`);
	}

	console.log(endTime, startTime, endTime - startTime);

	audio = audio.seekInput(startTime);
	if (endTime) {
		audio = audio.setDuration(endTime - startTime);
	}
	
	audio.save(filepath + '.mp3').on('end', () => {
		console.log('finished saving');
		res.status(200).send('file finished saving');
	});

});

router.post('/save-video', function(req, res, next) {

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
	let stream = ytdl(snek, {
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
	ytdl.getInfo(snek).then(result => {
		res.status(200).send(result);
	}).catch(err => {
		res.status(err.code).send(err);
	})
})

module.exports = router;
