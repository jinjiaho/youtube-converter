var express = require('express');
var router = express.Router();
const fs = require('fs');
const path = require('path');
const Joi = require('@hapi/joi');
const ytdl = require('ytdl-core');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
const MediaSplit = require('media-split');

const schema = Joi.object({
	url: Joi.string().uri(),
	dir: Joi.string().pattern(/[a-zA-z0-9\/\.]/).trim().allow(''),
	startH: Joi.string().pattern(/[0-9]/).allow(''),
	startM: Joi.string().pattern(/[0-9]{0,2}/).allow(''),
	startS: Joi.string().pattern(/[0-9]{0,2}/).allow(''),
	endH: Joi.string().pattern(/[0-9]/).allow(''),
	endM: Joi.string().pattern(/[0-9]{0,2}/).allow(''),
	endS: Joi.string().pattern(/[0-9]{0,2}/).allow(''),
	artist: Joi.string().trim().allow(''),
	title: Joi.string().trim(),
	version: Joi.string().trim().allow(''),
	artistInFilename: Joi.string()
});

let snek = 'https://www.youtube.com/watch?v=0arsPXEaIUY';
let eatshitbob = 'https://www.youtube.com/watch?v=UN8bJb8biZU';
let comeAlong = 'https://www.youtube.com/watch?v=u8rT6ij0PSo';

router.get('/', function(req, res, next) {
	res.render('index.ejs');
});

/* test case for media-split */
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

/* convert and save audio from YouTube video. */
router.post('/save-audio', function(req, res, next) {

	let validated = schema.validate(req.body);

	if (validated.error) {
		console.log(validated.error);
		throw new Error(400);
	}

	let values = validated.value;

	console.log('converting "' + values.title + '"...');

	let stream = ytdl(values.url, {
		quality: 'highestaudio',
		filter: 'audioonly'
	});

	// tagging
	let versionTxt = values.version ? ` [${values.version}]` : '';

	let artistTxt = (values.artist && values.artistInFilename) ? `${values.artist} - ` : '';

	let filename = artistTxt + values.title + versionTxt;

	let dir = (values.dir !== '') ? values.dir : './';

	let filepath = path.join(dir, filename);

	let startTimeInSeconds = 0, endTimeInSeconds = 0;

	// start time
	startTimeInSeconds += values.startH  ? parseInt(values.startH) * 3600 : 0;

	startTimeInSeconds += values.startM ? parseInt(values.startM) * 60 : 0;

	startTimeInSeconds += values.startS ? parseInt(values.startS) : 0;

	// end time
	endTimeInSeconds += values.endH ? parseInt(values.endH) * 3600 : 0;

	endTimeInSeconds += values.endM ? parseInt(values.endM) * 60 : 0;

	endTimeInSeconds += values.endS ? parseInt(values.endS) : 0;


	// Start converting
	let audio = ffmpeg(stream);

	audio.outputOptions('-metadata', `title=${values.title}${versionTxt}`);
	audio.outputOptions('-metadata', `artist=${values.artist}`);

	audio = audio.seekInput(startTimeInSeconds);

	if (endTimeInSeconds > 0) {
		let duration = endTimeInSeconds - startTimeInSeconds;
		let endTime = getEndTimeFormatted(endTimeInSeconds - startTimeInSeconds);
		let uncutSrc = filepath + ' uncut' + '.mp3';

		audio.setDuration(duration)
		.save(uncutSrc).on('end', () => {
			console.log('saved file for trimming', uncutSrc);
			let range = '00:00 - ' + endTime;
			trimAudio({
				inputSrc: uncutSrc, 
				dir: dir, 
				filename: filename, 
				range: range
			}).then(() => {
				console.log('Conversion and trimming complete!', filename);
				res.status(200).send('finished trimming file.');
			}).catch(err => {
				console.error(err);
				res.status(500).send(err.message);
			});
		});
	} else {
		console.log('no trimming required');

		audio.save(filepath + '.mp3').on('end', () => {
			console.log('finished saving w/o trimming', filepath + '.mp3');
			res.status(200).send('file finished saving');
		});
	}
});

router.post('/save-video', function(req, res, next) {

	let artistTxt = req.body.artist ? `${req.body.artist} - ` : '';

	let filename = artistTxt + req.body.title;

	let filepath = req.body.dir ? path.join(req.body.dir, filename) : filename;

	let stream = ytdl(req.body.url, {
		quality: 'highestvideo'
	}).pipe(fs.createWriteStream(filepath + '.mp4'));

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
});

function formatStartTime(h, m, s) {
	let hFormatted = h ? padStartZeros(h) + ':' : '';
	let mFormatted = m ? padStartZeros(m) + ':' : '00:';
	let sFormatted = s ? padStartZeros(s) : '00';

	let formatted = hFormatted + mFormatted + sFormatted;
	return formatted;
}

function getEndTimeFormatted(s) {
	let hours = Math.floor(s/60);
	let seconds = s % 60;
	let minutes = hours % 60;
	hours = Math.floor(hours/60);

	let hFormatted = hours ? padStartZeros(hours) + ':' : '';
	let mFormatted = minutes ? padStartZeros(minutes) + ':' : '00:';
	let sFormatted = seconds ? padStartZeros(seconds) : '00';

	let formatted = hFormatted + mFormatted + sFormatted;
	return formatted;
}

function padStartZeros(num) {
	// pad the start with zeros then take the last two characters.
	return String(num).padStart(2, '0').slice(-2);
}

function trimAudio(options) {
	console.log('trimming audio...', options.inputSrc, options.dir, options.filename, options.range);
	return new Promise((resolve, reject) => {
		try {
			let split = new MediaSplit({ 
				input: options.inputSrc, 
				sections: [`[${options.range}] ${options.filename}`], 
				output: options.dir,
				quality: 'highestaudio'
			});
			split.parse().then((sections) => {
			  for (let section of sections) {
			    console.log('saved:', section.name, section.start, '-', section.end);
			  }
			  fs.unlink(options.inputSrc, function(err) {
			  	if (err) {
			  		console.error(err);
			  		reject(err);
			  	}
			  	resolve('Removed uncut audio file.');
			  })
			});
		} catch(err) {
			reject(err);
		}
	});
}

module.exports = router;
